// uygulama/graf/editor/grafIslemleri.ts — GÖRSEL EDİTÖRÜN GRAFİK İŞLEMLERİ (spec 35 dilim 2b): düğüm ekle/sil/taşı, ayar, bağ, kopyala/yapıştır,
// grafik bilgisi. SAF ve DEĞİŞTİRİLEMEZ: her işlem YENİ bir `Graf` döner (girdiye dokunmaz) — geri al/yinele yığını eski hâlleri olduğu gibi tutar.
//
// BİÇİM TEK DOĞRULUK KAYNAĞIDIR (protocol/graf.ts): her işlemin sonucu `grafDogrula`dan geçer; tavanı (GRAF_SINIRLARI) aşan ya da biçimi bozan işlem
// NEDENLE reddedilir ve grafik değişmez (editör "neden olmadı"yı gösterir). Editör yalnız görünümdür: burada üretilen grafik Orion'un yazacağıyla
// aynı JSON'dur. Kimlikler benzersiz ve okunur ("git", "git_2"): Ozyn JSON'a bakınca hangi düğüm olduğunu anlasın.
"use strict";
import { GRAF_SINIRLARI, grafAdiGecerli, grafDogrula, type Graf, type GrafBagi, type GrafDegeri, type GrafDugumu, type PinTanimi } from "../../../protocol/graf.ts";
import type { Sonuc } from "../../../protocol/dogrula.ts";
import type { Nokta } from "../../duzenleyici/tuvalMatematigi.ts";

const hata = (m: string): Sonuc<never> => ({ ok: false, hata: m });

/** İşlem sonucunu biçimden geçirir: geçemezse grafik değişmez, neden döner. */
function dogrula<E extends object>(g: Graf, ek: E): Sonuc<{ graf: Graf } & E> {
  const r = grafDogrula(g);
  return r.ok ? { ok: true, deger: { graf: r.deger, ...ek } } : hata(`biçim: ${r.hata}`);
}

/**
 * Yeni düğüm kimliği: türün son parçası ("ajan.git" → "git"), alınmışsa "git_2", "git_3"… Ad kuralına (grafAdiGecerli) ve uzunluk tavanına uyar.
 * `alinan` aynı işlemde üretilenleri de tutar (yapıştırmada çakışma olmasın).
 */
export function yeniKimlik(g: Graf, tip: string, alinan: ReadonlySet<string> = new Set()): string {
  const var_ = (id: string) => alinan.has(id) || g.dugumler.some((d) => d.id === id);
  const son = tip.split(".").pop() ?? "dugum";
  const temel = (grafAdiGecerli(son) ? son : "dugum").slice(0, GRAF_SINIRLARI.ad - 4);
  if (!var_(temel)) return temel;
  for (let i = 2; ; i++) { const id = `${temel}_${i}`; if (!var_(id)) return id; }
}

const kopyaDugum = (d: GrafDugumu): GrafDugumu => ({ id: d.id, tip: d.tip, ...(d.ayar ? { ayar: { ...d.ayar } } : {}), ...(d.konum ? { konum: [d.konum[0], d.konum[1]] } : {}) });
const kopyaBag = (b: GrafBagi): GrafBagi => ({ kaynak: [b.kaynak[0], b.kaynak[1]], hedef: [b.hedef[0], b.hedef[1]] });
/** Grafiğin derin kopyası (girdi asla değiştirilmesin). */
const kopya = (g: Graf, ek: Partial<Pick<Graf, "dugumler" | "baglar">> = {}): Graf => ({
  ...g, girisler: g.girisler.map((p) => ({ ...p })), cikislar: g.cikislar.map((p) => ({ ...p })),
  dugumler: ek.dugumler ?? g.dugumler.map(kopyaDugum), baglar: ek.baglar ?? g.baglar.map(kopyaBag),
});
const yuvarla = (n: Nokta): [number, number] => [Math.round(n.x), Math.round(n.y)];

/** Düğüm ekle (palette, değişken kısayolu, desen listesi). Tavan dolu ya da biçim bozuksa nedenle reddedilir. */
export function dugumEkle(g: Graf, d: { tip: string; ayar?: Record<string, GrafDegeri>; konum?: Nokta }): Sonuc<{ graf: Graf; id: string }> {
  if (g.dugumler.length >= GRAF_SINIRLARI.dugum) return hata(`en çok ${GRAF_SINIRLARI.dugum} düğüm (grafik dolu)`);
  const id = yeniKimlik(g, d.tip);
  const yeni: GrafDugumu = { id, tip: d.tip, ...(d.ayar && Object.keys(d.ayar).length ? { ayar: { ...d.ayar } } : {}), ...(d.konum ? { konum: yuvarla(d.konum) } : {}) };
  return dogrula(kopya(g, { dugumler: [...g.dugumler.map(kopyaDugum), yeni] }), { id });
}

/** Düğümleri SİL ve onlara dokunan bütün bağları da (yarım bağ bırakılmaz). Silinen bağ sayısı döner (kullanıcıya söylenir). */
export function dugumleriSil(g: Graf, idler: ReadonlySet<string>): { graf: Graf; silinenBag: number } {
  const baglar = g.baglar.filter((b) => !idler.has(b.kaynak[0]) && !idler.has(b.hedef[0]));
  return { graf: kopya(g, { dugumler: g.dugumler.filter((d) => !idler.has(d.id)).map(kopyaDugum), baglar: baglar.map(kopyaBag) }), silinenBag: g.baglar.length - baglar.length };
}

/** Konumları yaz (sürükleme bırakılınca, otomatik yerleşim). Listede olmayan düğüm yerinde kalır. */
export function konumlariKoy(g: Graf, konumlar: ReadonlyMap<string, Nokta>): Graf {
  return kopya(g, { dugumler: g.dugumler.map((d) => { const k = konumlar.get(d.id); return k ? { ...kopyaDugum(d), konum: yuvarla(k) } : kopyaDugum(d); }) });
}

/** Seçili düğümleri (dx, dy) kaydır; konumu olmayan (0,0)'dan sayılır. */
export function dugumleriTasi(g: Graf, idler: ReadonlySet<string>, dx: number, dy: number): Graf {
  const m = new Map<string, Nokta>();
  for (const d of g.dugumler) if (idler.has(d.id)) m.set(d.id, { x: (d.konum?.[0] ?? 0) + dx, y: (d.konum?.[1] ?? 0) + dy });
  return konumlariKoy(g, m);
}

/** Bir ayarı yaz (`undefined` siler: bağsız giriş varsayılana/denetimin "ayarı yok" hatasına döner). Pin değişikliğinin budaması `pinBudama.ts`te. */
export function ayarDegistir(g: Graf, id: string, ad: string, deger: GrafDegeri | undefined): Sonuc<{ graf: Graf }> {
  const d = g.dugumler.find((x) => x.id === id);
  if (!d) return hata(`'${id}' adlı düğüm yok`);
  if (!grafAdiGecerli(ad)) return hata(`geçersiz ayar adı: ${JSON.stringify(ad)}`);
  const ayar: Record<string, GrafDegeri> = { ...(d.ayar ?? {}) };
  if (deger === undefined) delete ayar[ad]; else ayar[ad] = deger;
  const yeni: GrafDugumu = { id: d.id, tip: d.tip, ...(Object.keys(ayar).length ? { ayar } : {}), ...(d.konum ? { konum: [d.konum[0], d.konum[1]] } : {}) };
  return dogrula(kopya(g, { dugumler: g.dugumler.map((x) => (x.id === id ? yeni : kopyaDugum(x))) }), {});
}

/** Bağ ekle; `degisen` (tek-bağ kuralının attığı eski bağlar, `bagDenetle`) çıkarılır. Tavan dolu ise reddedilir. */
export function bagEkle(g: Graf, bag: GrafBagi, degisen: readonly GrafBagi[] = []): Sonuc<{ graf: Graf }> {
  const esit = (a: GrafBagi, b: GrafBagi) => a.kaynak.join("\u0000") === b.kaynak.join("\u0000") && a.hedef.join("\u0000") === b.hedef.join("\u0000");
  const kalan = g.baglar.filter((b) => !degisen.some((x) => esit(x, b)));
  if (kalan.length >= GRAF_SINIRLARI.bag) return hata(`en çok ${GRAF_SINIRLARI.bag} bağ (grafik dolu)`);
  return dogrula(kopya(g, { baglar: [...kalan.map(kopyaBag), kopyaBag(bag)] }), {});
}

/** Bağı kaldır (yoksa grafik aynen döner). */
export function bagKaldir(g: Graf, bag: GrafBagi): Graf {
  const esit = (b: GrafBagi) => b.kaynak[0] === bag.kaynak[0] && b.kaynak[1] === bag.kaynak[1] && b.hedef[0] === bag.hedef[0] && b.hedef[1] === bag.hedef[1];
  return kopya(g, { baglar: g.baglar.filter((b) => !esit(b)).map(kopyaBag) });
}

/** Kopyalanmış parça: seçili düğümler ve YALNIZ aralarındaki bağlar (dışarı giden bağ yapıştırılınca anlamsız olurdu). */
export interface Pano { dugumler: GrafDugumu[]; baglar: GrafBagi[] }

export function secimiKopyala(g: Graf, idler: ReadonlySet<string>): Pano {
  return {
    dugumler: g.dugumler.filter((d) => idler.has(d.id)).map(kopyaDugum),
    baglar: g.baglar.filter((b) => idler.has(b.kaynak[0]) && idler.has(b.hedef[0])).map(kopyaBag),
  };
}

/**
 * Panoyu yapıştır: her düğüme YENİ kimlik (grafikte ve panoda çakışmasız), iç bağlar yeni kimliklere çevrilir, parçanın sol üstü `hedef`e taşınır.
 * Başka grafikten kopyalanan parça da yapıştırılır (biçim denetimi yine burada; tür denetimi editörün işi).
 */
export function yapistir(g: Graf, pano: Pano, hedef: Nokta): Sonuc<{ graf: Graf; idler: string[] }> {
  if (!pano.dugumler.length) return hata("pano boş (önce düğüm seç ve Ctrl+C)");
  if (g.dugumler.length + pano.dugumler.length > GRAF_SINIRLARI.dugum) return hata(`yapıştırılamaz: en çok ${GRAF_SINIRLARI.dugum} düğüm`);
  if (g.baglar.length + pano.baglar.length > GRAF_SINIRLARI.bag) return hata(`yapıştırılamaz: en çok ${GRAF_SINIRLARI.bag} bağ`);
  const x0 = Math.min(...pano.dugumler.map((d) => d.konum?.[0] ?? 0));
  const y0 = Math.min(...pano.dugumler.map((d) => d.konum?.[1] ?? 0));
  const alinan = new Set<string>();
  const esle = new Map<string, string>();
  const yeniDugumler = pano.dugumler.map((d): GrafDugumu => {
    const id = yeniKimlik(g, d.tip, alinan);
    alinan.add(id); esle.set(d.id, id);
    return { ...kopyaDugum(d), id, konum: yuvarla({ x: hedef.x + (d.konum?.[0] ?? 0) - x0, y: hedef.y + (d.konum?.[1] ?? 0) - y0 }) };
  });
  const yeniBaglar = pano.baglar.flatMap((b): GrafBagi[] => {
    const k = esle.get(b.kaynak[0]), h = esle.get(b.hedef[0]);
    return k && h ? [{ kaynak: [k, b.kaynak[1]], hedef: [h, b.hedef[1]] }] : [];
  });
  return dogrula(kopya(g, { dugumler: [...g.dugumler.map(kopyaDugum), ...yeniDugumler], baglar: [...g.baglar.map(kopyaBag), ...yeniBaglar] }), { idler: yeniDugumler.map((d) => d.id) });
}

/** Grafiğin kendi bilgisi (Ayrıntılar paneli): açıklama, tür, desenin giriş/çıkış pinleri. Ad DEĞİŞMEZ (ad = dosya adı; yeniden adlandırma depoda). */
export interface GrafBilgisi { aciklama?: string | null; tur?: Graf["tur"]; girisler?: readonly PinTanimi[]; cikislar?: readonly PinTanimi[] }

export function grafBilgisiDegistir(g: Graf, b: GrafBilgisi): Sonuc<{ graf: Graf }> {
  const yeni = kopya(g);
  if (b.aciklama !== undefined) { if (b.aciklama === null || b.aciklama === "") delete yeni.aciklama; else yeni.aciklama = b.aciklama; }
  if (b.tur !== undefined) yeni.tur = b.tur;
  if (b.girisler !== undefined) yeni.girisler = b.girisler.map((p) => ({ ...p }));
  if (b.cikislar !== undefined) yeni.cikislar = b.cikislar.map((p) => ({ ...p }));
  return dogrula(yeni, {});
}
