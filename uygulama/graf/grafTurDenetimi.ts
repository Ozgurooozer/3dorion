// uygulama/graf/grafTurDenetimi.ts — GRAFİĞİN ANLAM DENETİMİ (spec 35): biçimi `protocol/graf.ts` doğrular; burası kütüphaneye göre bakar.
//
// "Kontrol et" düğmesi ve Orion'un `dunya_oner`i bunu çağırır; hata listesi editörde ve modele döner (sessiz düşme yok). Kurallar (Blueprint ile aynı):
//   • her düğüm türü kayıtlı; ayarlar türüne ve aralığına uyar;
//   • bağ: kaynak bir ÇIKIŞ pini, hedef bir GİRİŞ pini, türler aynı (`herhangi` her veriyle bağlanır, `akis` yalnız `akis`la);
//   • bir veri girişine en çok bir bağ; bir akış çıkışından en çok bir bağ (dallanma Sıra düğümüyle);
//   • bağsız veri girişinin değeri ayarda ya da varsayılanda olmalı;
//   • akış DÖNGÜSÜ yok (tekrar için Tekrar düğümü: sonlanma garantisi), veri döngüsü yok;
//   • olay grafiğinde en çok bir "▶ Başla" ve en az bir giriş (Başla ya da dünya olayı düğümü, dilim 2); fonksiyon (desen) grafiğinde tam bir
//     "Fonksiyon girişi" ve olay düğümü yok; bir desen kendini doğrudan çağıramaz.
// Dilim 2b (görsel editör): kurallar EDİTÖRLE ORTAKTIR — editör bağ çekerken aynı `uyumlu`, `tekBagUcu` ve `donguVarMi`yı kullanır (kopya kural yok:
// ikinci bir kopya "editör kabul etti, Kontrol et reddetti" çelişkisi doğururdu). Hatalar YAPILI da alınabilir (`grafTurDenetleYapili`: hangi düğüm,
// hangi bağ) — editör hatalı düğümü kırmızı çerçeveyle gösterir; metin listesi (`grafTurDenetle`) aynen aynı mesajlardır.
"use strict";
import type { Graf, GrafDegeri, PinTanimi, PinTipi } from "../../protocol/graf.ts";
import { secenekleriCoz, type DugumKaydi, type DugumPinleri, type DugumTanimi, type PinOrtami } from "./dugumKaydi.ts";

/** Olay/fonksiyon giriş-çıkış düğümlerinin türleri (yorumlayıcıyla ortak). */
export const BASLA_TIPI = "olay.basla";
export const FONKSIYON_GIRIS_TIPI = "fonksiyon.giris";
export const FONKSIYON_DONUS_TIPI = "fonksiyon.donus";
export const DESEN_CAGIR_TIPI = "desen.cagir";

export interface CozulmusDugum {
  tanim: DugumTanimi<unknown>;
  pinler: DugumPinleri;
  ayar: Readonly<Record<string, GrafDegeri>>;
}

/** Denetim hatasının yeri: editör düğümü kırmızı çerçeveyle, bağı listede gösterir. Grafik düzeyindeki hata (Başla yok) düğümsüzdür. */
export interface DenetimHatasi {
  mesaj: string;
  /** Hatanın düğümü (bağ hatasında hedef ya da kaynak düğüm); grafik düzeyinde null. */
  dugum: string | null;
  /** Bağ hatasıysa `baglar` dizisindeki sırası. */
  bag: number | null;
}

const pinBul = (l: readonly PinTanimi[], ad: string) => l.find((p) => p.ad === ad) ?? null;

/** İki pin türü bağlanabilir mi: aynı tür, ya da biri `herhangi` (veri için; `akis` yalnız `akis`la). Editör de bunu kullanır. */
export const uyumlu = (a: PinTipi, b: PinTipi): boolean =>
  a === b || (a !== "akis" && b !== "akis" && (a === "herhangi" || b === "herhangi"));

/**
 * Tek-bağ kuralının hangi uca uygulandığı: akış bağı KAYNAK çıkışından tektir (dallanma Sıra ile), veri bağı HEDEF girişine tektir (bir girişin iki
 * değeri olamaz). Denetim sayar, editör yeni bağı çekince o uçtaki eski bağı değiştirir (Blueprint gibi).
 */
export const tekBagUcu = (kaynakTipi: PinTipi): "kaynak" | "hedef" => (kaynakTipi === "akis" ? "kaynak" : "hedef");

function ayarHatalari(id: string, t: DugumTanimi<unknown>, ayar: Readonly<Record<string, GrafDegeri>>, ortam: PinOrtami): string[] {
  const h: string[] = [];
  for (const a of t.ayarlar ?? []) {
    const d = ayar[a.ad];
    if (d === undefined || d === null) continue;
    if (a.tip === "sayi") {
      if (typeof d !== "number") { h.push(`${id}.${a.ad}: sayı olmalı`); continue; }
      if ((a.en !== undefined && d < a.en) || (a.cok !== undefined && d > a.cok)) h.push(`${id}.${a.ad}: ${d} aralık dışı (${a.en ?? "-∞"}–${a.cok ?? "∞"})`);
    } else if (a.tip === "bool") {
      if (typeof d !== "boolean") h.push(`${id}.${a.ad}: true/false olmalı`);
    } else {
      if (typeof d !== "string") { h.push(`${id}.${a.ad}: metin olmalı`); continue; }
      const secenekler = secenekleriCoz(a, ortam);
      if (secenekler && !secenekler.includes(d)) h.push(`${id}.${a.ad}: '${d}' geçersiz (seçenekler: ${secenekler.join(", ") || "yok"})`);
    }
  }
  return h;
}

/** Düğümleri kütüphaneyle çözer; çözülemeyenler YAPILI hata olur (düğümün kimliğiyle). */
export function dugumleriCozYapili(g: Graf, kayit: DugumKaydi<unknown>, ortam: PinOrtami): { cozum: Map<string, CozulmusDugum>; hatalar: DenetimHatasi[] } {
  const cozum = new Map<string, CozulmusDugum>();
  const hatalar: DenetimHatasi[] = [];
  const pinOrtami: PinOrtami = { ...ortam, buGraf: g };
  for (const d of g.dugumler) {
    const yer = (mesaj: string): DenetimHatasi => ({ mesaj, dugum: d.id, bag: null });
    const t = kayit.al(d.tip);
    if (!t) { hatalar.push(yer(`${d.id}: bilinmeyen düğüm türü '${d.tip}'`)); continue; }
    const ayar: Record<string, GrafDegeri> = {};
    for (const a of t.ayarlar ?? []) if (a.varsayilan !== undefined) ayar[a.ad] = a.varsayilan;
    Object.assign(ayar, d.ayar ?? {});
    let pinler: DugumPinleri;
    try { pinler = t.pinler(ayar, pinOrtami); }
    catch (err) { hatalar.push(yer(`${d.id}: ${err instanceof Error ? err.message : String(err)}`)); continue; }
    hatalar.push(...ayarHatalari(d.id, t, ayar, pinOrtami).map(yer));
    cozum.set(d.id, { tanim: t, pinler, ayar });
  }
  return { cozum, hatalar };
}

/** Düğümleri kütüphaneyle çözer; çözülemeyenler hata olur (çözüm haritası yalnız çözülenleri taşır). */
export function dugumleriCoz(g: Graf, kayit: DugumKaydi<unknown>, ortam: PinOrtami): { cozum: Map<string, CozulmusDugum>; hatalar: string[] } {
  const r = dugumleriCozYapili(g, kayit, ortam);
  return { cozum: r.cozum, hatalar: r.hatalar.map((h) => h.mesaj) };
}

/** Yönlü grafikte döngü var mı: varsa döngüdeki bir düğüm (hata yeri), yoksa null. Editör yeni bağın döngü kurup kurmadığını da buna sorar. */
export function donguVarMi(dugumler: readonly string[], kenarlar: ReadonlyMap<string, readonly string[]>): string | null {
  const durum = new Map<string, 1 | 2>();
  const ziyaret = (n: string): string | null => {
    durum.set(n, 1);
    for (const m of kenarlar.get(n) ?? []) {
      const s = durum.get(m);
      if (s === 1) return m;
      if (s === undefined) { const r = ziyaret(m); if (r) return r; }
    }
    durum.set(n, 2);
    return null;
  };
  for (const n of dugumler) if (!durum.has(n)) { const r = ziyaret(n); if (r) return r; }
  return null;
}

/** Grafiğin anlam hataları, YERLERİYLE (düğüm/bağ); boş liste = çalıştırılabilir. Mesajlar `grafTurDenetle`ninkiyle aynıdır. */
export function grafTurDenetleYapili(g: Graf, kayit: DugumKaydi<unknown>, ortam: PinOrtami): DenetimHatasi[] {
  const { cozum, hatalar } = dugumleriCozYapili(g, kayit, ortam);
  const girisSayisi = new Map<string, number>();
  const akisCikisSayisi = new Map<string, number>();
  const akisKenari = new Map<string, string[]>();
  const veriKenari = new Map<string, string[]>();
  const anahtarDugumu = new Map<string, string>();
  const bagHatasi = (i: number, dugum: string, mesaj: string) => hatalar.push({ mesaj, dugum, bag: i });

  for (const [i, b] of g.baglar.entries()) {
    const k = cozum.get(b.kaynak[0]), h = cozum.get(b.hedef[0]);
    if (!k || !h) continue;   // düğüm çözülemedi: hatası zaten yazıldı
    const kp = pinBul(k.pinler.cikislar, b.kaynak[1]);
    const hp = pinBul(h.pinler.girisler, b.hedef[1]);
    if (!kp) { bagHatasi(i, b.kaynak[0], `baglar[${i}]: '${b.kaynak[0]}' düğümünün '${b.kaynak[1]}' adlı ÇIKIŞ pini yok (çıkışlar: ${k.pinler.cikislar.map((p) => p.ad).join(", ") || "yok"})`); continue; }
    if (!hp) { bagHatasi(i, b.hedef[0], `baglar[${i}]: '${b.hedef[0]}' düğümünün '${b.hedef[1]}' adlı GİRİŞ pini yok (girişler: ${h.pinler.girisler.map((p) => p.ad).join(", ") || "yok"})`); continue; }
    if (!uyumlu(kp.tip, hp.tip)) { bagHatasi(i, b.hedef[0], `baglar[${i}]: tür uyuşmuyor (${b.kaynak.join(".")}: ${kp.tip} → ${b.hedef.join(".")}: ${hp.tip})`); continue; }
    if (tekBagUcu(kp.tip) === "kaynak") {
      const anahtar = b.kaynak.join("\u0000");
      anahtarDugumu.set(anahtar, b.kaynak[0]);
      akisCikisSayisi.set(anahtar, (akisCikisSayisi.get(anahtar) ?? 0) + 1);
      (akisKenari.get(b.kaynak[0]) ?? akisKenari.set(b.kaynak[0], []).get(b.kaynak[0])!).push(b.hedef[0]);
    } else {
      const anahtar = b.hedef.join("\u0000");
      anahtarDugumu.set(anahtar, b.hedef[0]);
      girisSayisi.set(anahtar, (girisSayisi.get(anahtar) ?? 0) + 1);
      (veriKenari.get(b.hedef[0]) ?? veriKenari.set(b.hedef[0], []).get(b.hedef[0])!).push(b.kaynak[0]);
    }
  }
  const yerli = (a: string, mesaj: string): DenetimHatasi => ({ mesaj, dugum: anahtarDugumu.get(a) ?? null, bag: null });
  for (const [a, n] of girisSayisi) if (n > 1) hatalar.push(yerli(a, `${a.replace("\u0000", ".")}: veri girişine ${n} bağ var (en çok 1)`));
  for (const [a, n] of akisCikisSayisi) if (n > 1) hatalar.push(yerli(a, `${a.replace("\u0000", ".")}: akış çıkışından ${n} bağ var (en çok 1; dallanma için Sıra düğümü)`));

  // Bağsız veri girişinin değeri ayarda olmalı.
  for (const [id, c] of cozum) {
    for (const p of c.pinler.girisler) {
      if (p.tip === "akis" || girisSayisi.has(`${id}\u0000${p.ad}`)) continue;
      if (c.ayar[p.ad] === undefined) hatalar.push({ mesaj: `${id}.${p.ad}: bağlı değil ve ayarı yok (bir bağ ya da ayar.${p.ad} ver)`, dugum: id, bag: null });
    }
  }

  const kimlikler = g.dugumler.map((d) => d.id);
  const akisDongusu = donguVarMi(kimlikler, akisKenari);
  if (akisDongusu) hatalar.push({ mesaj: `akış döngüsü var ('${akisDongusu}' üzerinden): tekrar için Tekrar düğümünü kullan`, dugum: akisDongusu, bag: null });
  const veriDongusu = donguVarMi(kimlikler, veriKenari);
  if (veriDongusu) hatalar.push({ mesaj: `veri döngüsü var ('${veriDongusu}' üzerinden)`, dugum: veriDongusu, bag: null });

  const tipli = (tip: string) => g.dugumler.filter((d) => d.tip === tip);
  const say = (tip: string) => tipli(tip).length;
  /** Fazla olanın ikincisi (editör onu işaretler); hiç yoksa düğümsüz. */
  const ikinci = (tip: string) => tipli(tip)[1]?.id ?? null;
  const grafHatasi = (mesaj: string, dugum: string | null = null) => hatalar.push({ mesaj, dugum, bag: null });
  // Dünya olayı düğümleri (dilim 2): grafiğin ikinci tür girişi. ▶ Başla'yla aynı grafikte olabilir (Ozyn ▶ ile dener, dinlemede olay yürütür).
  const olayDugumleri = [...cozum.entries()].filter(([, c]) => c.tanim.dunyaOlayi !== undefined).map(([id]) => id);
  const olaylar = olayDugumleri.length;
  if (g.tur === "olay") {
    if (say(BASLA_TIPI) > 1) grafHatasi(`olay grafiğinde en çok bir '▶ Başla' (${BASLA_TIPI}) olur (${say(BASLA_TIPI)} var)`, ikinci(BASLA_TIPI));
    if (say(BASLA_TIPI) === 0 && olaylar === 0) grafHatasi(`olay grafiğinin girişi olmalı: tam bir '▶ Başla' (${BASLA_TIPI}) ya da en az bir olay düğümü (örn. olay.ozyn_yaklasti)`);
    if (say(FONKSIYON_GIRIS_TIPI) || say(FONKSIYON_DONUS_TIPI)) grafHatasi("olay grafiğinde fonksiyon giriş/dönüş düğümü olmaz", (tipli(FONKSIYON_GIRIS_TIPI)[0] ?? tipli(FONKSIYON_DONUS_TIPI)[0])?.id ?? null);
  } else {
    if (say(FONKSIYON_GIRIS_TIPI) !== 1) grafHatasi(`desen (fonksiyon) grafiğinde tam bir 'Fonksiyon girişi' (${FONKSIYON_GIRIS_TIPI}) olmalı (${say(FONKSIYON_GIRIS_TIPI)} var)`, ikinci(FONKSIYON_GIRIS_TIPI));
    if (say(BASLA_TIPI)) grafHatasi("desen grafiğinde '▶ Başla' olmaz (desen başka grafikten çağrılır)", tipli(BASLA_TIPI)[0]!.id);
    // Desen bir fonksiyondur: çağıran grafik yürütür. İçinde olay düğümü olsaydı kimin dinlediği belirsizleşirdi (dinleme yalnız grafiğe kurulur).
    if (olaylar) grafHatasi("desen grafiğinde olay düğümü olmaz (olayı grafik dinler, deseni çağırır)", olayDugumleri[0]!);
  }
  for (const d of g.dugumler) {
    if (d.tip === DESEN_CAGIR_TIPI && d.ayar?.["desen"] === g.ad) hatalar.push({ mesaj: `${d.id}: desen kendini çağıramaz ('${g.ad}')`, dugum: d.id, bag: null });
  }
  return hatalar;
}

/** Grafiğin anlam hataları; boş liste = çalıştırılabilir. */
export function grafTurDenetle(g: Graf, kayit: DugumKaydi<unknown>, ortam: PinOrtami): string[] {
  return grafTurDenetleYapili(g, kayit, ortam).map((h) => h.mesaj);
}
