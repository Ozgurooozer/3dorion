// uygulama/graf/ajanDugumleri.ts — AJAN DÜĞÜMLERİ (spec 35 dilim 1): Git, Bak, Otur, Kalk, Söyle, Jest + Ajan seç, Nesne bul.
//
// Her eylem düğümü bir `kim` (tip `ajan`) alır, ham niyeti kurar, PROTOKOL DOĞRULAYICISINDAN (`niyetDogrula`) geçirir ve O AJANIN tek eylem yolundan yürütür
// (`GrafYetenegi.niyetYurut`: Orion'da `niyetiYurut`, Flash'ta kendi beden kapısı). Düğüm niyetin SONUCUNU BEKLER: `bitti` → sonraki düğüm; `hata` →
// düğüm hatası (ajanın nedeni aynen söylenir: "hedefe giden yol yok…"); `iptal` → düğüm hatası ("iş kesildi": başka bir niyet araya girdi). ■ beklemeyi
// keser ve ajana `dur` gider (`durdurulunca`). Grafikte OLMAYANLAR bilerek yok: `komut` (terminal), `hatirla`, `doktor`, `ortam`, `yaz`, `emret`.
//
// HEDEF (Git, Bak): `hedef` ayarı pinleri seçer — `ozyn` (pin yok; protokolün `oyuncu` hedefi), `capa` (metin pini: çapa adı ya da etiketi; doğrulayıcı
// "beyaz tahta"yı `tahta`ya çevirir), `nesne` (nesne pini: Nesne bul'dan). NEDEN ayarla ve tek "hedef" pini değil: bağsız veri girişi ayar ister (denetim),
// yani "isteğe bağlı pin" yok; hedef türü sabit bir seçimdir, pin listesi ona göre değişir ("Sıra 3" üç çıkış gibi). Nesneye giden hedef etkileşim
// menüsüyle AYNI kuraldan (`world/yer/nesneEylemleri.ts` `nesneHedefleri`): çapalıysa çapa, değilse nokta + yarıçap.
"use strict";
import type { GrafDegeri, PinTanimi } from "../../protocol/graf.ts";
import { JESTLER, type Niyet } from "../../protocol/niyet.ts";
import type { Hedef } from "../../protocol/temel.ts";
import { niyetDogrula, type Sonuc } from "../../protocol/dogrula.ts";
import type { Nesne } from "../../world/level/nesneKaydi.ts";
import { NESNE_TURLERI } from "../../world/level/cekirdek/anlam.ts";
import { nesneHedefleri } from "../../world/yer/nesneEylemleri.ts";
import { AKIS_GIRIS, AKIS_SONRA, type AyarTanimi, type DugumCalismasi, type DugumSonucu, type DugumTanimi, type PinOrtami } from "./dugumKaydi.ts";
import type { GrafYetenegi } from "./grafYetenegi.ts";

/** Ajan seçeneklerinin kaynağı: pin ortamındaki ajan defteri (denetim anında; Flash sonradan gelir). */
const ajanSecenekleri = (o: PinOrtami): readonly string[] => o.ajanlar?.() ?? [];

const KIM: PinTanimi = { ad: "kim", tip: "ajan" };
/** `kim` bağsızsa ayardan okunur; ayar varsa ajan defterinde olmalı (denetim). */
const KIM_AYARI: AyarTanimi = { ad: "kim", tip: "metin", secenekler: ajanSecenekleri, aciklama: "ajan kimliği (bağ yoksa)" };

export const GIT_HEDEFLERI = ["ozyn", "capa", "nesne"] as const;
export const BAK_HEDEFLERI = [...GIT_HEDEFLERI, "serbest"] as const;
type HedefTuru = (typeof BAK_HEDEFLERI)[number];
/** Mesafe ayarının tavanı (m): ova ölçeği; 0 = hedefin kendi yakınlığı. */
export const MESAFE_AZAMI = 50;

const hedefPinleri = (h: GrafDegeri | undefined): PinTanimi[] =>
  h === "capa" ? [{ ad: "capa", tip: "metin" }] : h === "nesne" ? [{ ad: "nesne", tip: "nesne" }] : [];

/** Değer bir nesne mi (Nesne bul'un çıktısı ya da desen girişi). Yapı denetimi: yanlış bağlanmış bir değer sessizce (0,0)'a yürütmesin. */
export function nesneMi(v: unknown): v is Nesne {
  if (typeof v !== "object" || v === null) return false;
  const n = v as Partial<Nesne>;
  const k = n.kutu as Partial<Nesne["kutu"]> | undefined;
  return typeof n.id === "string" && typeof n.ad === "string" && typeof k === "object" && k !== null
    && [k.x, k.y, k.z, k.g, k.d].every((x) => typeof x === "number" && Number.isFinite(x));
}

/** `kim` girişinin değeri: defterde olan bir ajan kimliği. Denetimden sonra defter değişmiş olabilir (ajan kapandı): çalışma anında da bakılır. */
async function kimOku(c: DugumCalismasi<GrafYetenegi>): Promise<{ id: string; ad: string }> {
  const v = await c.giris("kim");
  if (typeof v !== "string" || !v) throw new Error(`kim: bir ajan olmalı (Ajan seç'e bağla ya da ayar.kim ver; gelen: ${JSON.stringify(v)})`);
  const ajanlar = c.yetenek.ajanlar();
  const a = ajanlar.find((x) => x.id === v);
  if (!a) throw new Error(`bilinmeyen ajan '${v}' (var: ${ajanlar.map((x) => x.id).join(", ") || "yok"})`);
  return a;
}

/** Hedef ayarına göre protokol hedefi (ham; doğrulayıcı sonra bakar). `nesne` için git/bak niyeti menüyle aynı kuraldan gelir. */
async function hedefOku(c: DugumCalismasi<GrafYetenegi>, tur: HedefTuru): Promise<{ hedef: Hedef | null; nesne?: Nesne }> {
  if (tur === "ozyn") return { hedef: { tip: "oyuncu" } };
  if (tur === "serbest") return { hedef: null };
  if (tur === "capa") {
    const ad = await c.giris("capa");
    if (typeof ad !== "string" || !ad.trim()) throw new Error(`capa: çapa adı olmalı (örn. "sandalye", "tahta"; gelen: ${JSON.stringify(ad)})`);
    return { hedef: { tip: "capa", ad: ad.trim() } };
  }
  const n = await c.giris("nesne");
  if (!nesneMi(n)) throw new Error("nesne: bir nesne olmalı (Nesne bul düğümüne bağla)");
  return { hedef: null, nesne: n };
}

/**
 * Niyeti doğrular, `kim`in kapısından yürütür ve SONUCU BEKLER. ■ beklerken gelirse çalışma 'durdu' olur ve ajana `dur` gider (iş kesilir).
 * Doğrulayıcının reddi düğüm hatasıdır (sessiz düşme yok); ajanın hatası nedeniyle döner.
 */
async function yurut(c: DugumCalismasi<GrafYetenegi>, kim: { id: string; ad: string }, ham: unknown): Promise<DugumSonucu> {
  const r: Sonuc<Niyet> = niyetDogrula(ham);
  if (!r.ok) throw new Error(`niyet reddedildi: ${r.hata}`);
  const is = c.yetenek.niyetYurut(kim.id, r.deger);
  const birak = c.durdurulunca(() => is.kes());
  const s = await c.bekleVeyaDur(is.sonuc).finally(birak);
  if (s.durum === "bitti") return { sonra: "sonra" };
  if (s.durum === "iptal") throw new Error(`${kim.ad}: iş kesildi (${s.not ?? "başka bir niyet araya girdi"})`);
  throw new Error(`${kim.ad}: ${s.not ?? "yapamadı (neden söylenmedi)"}`);
}

/** Söylenecek değer: metin olduğu gibi; sayı/bool yazıya; nesne adıyla. Başka şey (bağ yanlış) hata. */
function metinle(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (nesneMi(v)) return v.ad;
  throw new Error(`söylenecek değer metin, sayı ya da nesne olmalı (gelen: ${v === null ? "null" : typeof v})`);
}

const norm = (s: string): string => s.trim().toLocaleLowerCase("tr");

/**
 * NESNE BUL (saf): ad (ya da kimlik) ve isteğe bağlı türle. Önce TAM eşleşme (kimlik ya da ad), yoksa adın İÇİNDE geçen; tek aday kazanır.
 * Birden çok aday HATADIR, ilkini sessizce seçmek yanlış nesneye yürütürdü: adaylar sayılır ki Ozyn adı belirginleştirsin. Bulunamazsa var olanlardan
 * birkaçı söylenir.
 */
export function nesneBul(nesneler: readonly Nesne[], ad: string, tur: string): Sonuc<Nesne> {
  const adaylar = tur ? nesneler.filter((n) => n.tur === tur) : [...nesneler];
  const q = norm(ad);
  const ozet = (l: readonly Nesne[]) => l.slice(0, 8).map((n) => n.ad).join(", ") + (l.length > 8 ? ` … (+${l.length - 8})` : "");
  const tek = (l: readonly Nesne[], neden: string): Sonuc<Nesne> | null =>
    l.length === 1 ? { ok: true, deger: l[0]! } : l.length > 1 ? { ok: false, hata: `birden çok nesne ${neden}: ${ozet(l)} — adı belirginleştir` } : null;
  const turYazisi = tur ? ` (tür: ${tur})` : "";
  if (!q) return tek(adaylar, `var${turYazisi}`) ?? { ok: false, hata: `hiç nesne yok${turYazisi}` };
  return tek(adaylar.filter((n) => norm(n.id) === q || norm(n.ad) === q), `'${ad}' adında`)
    ?? tek(adaylar.filter((n) => norm(n.ad).includes(q) || norm(n.id).includes(q)), `'${ad}' içeren`)
    ?? { ok: false, hata: `'${ad}' adlı nesne bulunamadı${turYazisi}${adaylar.length ? ` (var: ${ozet(adaylar)})` : ""}` };
}

export function ajanDugumleri(): DugumTanimi<GrafYetenegi>[] {
  return [
    // ── seçici / veri (saf) ──
    {
      tip: "ajan.sec", ad: "Ajan seç", kategori: "veri", saf: true,
      aciklama: "Listeden bir ajan (Orion, Flash…); çıkışı eylem düğümlerinin 'kim' girişine bağlanır. Liste ajan defterinden gelir.",
      ayarlar: [{ ad: "ajan", tip: "metin", secenekler: ajanSecenekleri, aciklama: "ajan kimliği" }],
      pinler: (a) => {
        if (typeof a["ajan"] !== "string" || !a["ajan"]) throw new Error("ajan seçilmedi (ayar.ajan: örn. \"flash\")");
        return { girisler: [], cikislar: [{ ad: "ajan", tip: "ajan" }] };
      },
      calistir: (c) => {
        const id = c.ayar["ajan"] as string;
        const ajanlar = c.yetenek.ajanlar();
        if (!ajanlar.some((x) => x.id === id)) throw new Error(`bilinmeyen ajan '${id}' (var: ${ajanlar.map((x) => x.id).join(", ") || "yok"})`);
        return { cikti: { ajan: id } };
      },
    },
    {
      tip: "nesne.bul", ad: "Nesne bul", kategori: "veri", saf: true,
      aciklama: "Ozyn'in bulunduğu yerdeki bir nesneyi adıyla (ya da kimliğiyle; isteğe bağlı türle) bulur. Bulunamazsa ya da birden çok aday varsa HATA.",
      ayarlar: [
        { ad: "tur", tip: "metin", varsayilan: "", secenekler: ["", ...NESNE_TURLERI], aciklama: "tür süzgeci (boş: hepsi)" },
      ],
      pinler: () => ({ girisler: [{ ad: "ad", tip: "metin" }], cikislar: [{ ad: "nesne", tip: "nesne" }] }),
      calistir: async (c) => {
        const ad = await c.giris("ad");
        if (typeof ad !== "string") throw new Error(`ad: metin olmalı (gelen: ${typeof ad})`);
        const r = nesneBul(c.yetenek.nesneler(), ad, (c.ayar["tur"] as string | undefined) ?? "");
        if (!r.ok) throw new Error(r.hata);
        return { cikti: { nesne: r.deger } };
      },
    },

    // ── ajan eylemleri (akışlı; sonucu bekler) ──
    {
      tip: "ajan.git", ad: "Git", kategori: "ajan", saf: false,
      aciklama: "Ajan hedefe yürür; VARINCA devam eder. Hedef: Ozyn, çapa ya da nesne (ayar.hedef). Yol yoksa nedeniyle hata.",
      ayarlar: [
        { ad: "hedef", tip: "metin", varsayilan: "ozyn", secenekler: GIT_HEDEFLERI },
        { ad: "mesafe", tip: "sayi", varsayilan: 0, en: 0, cok: MESAFE_AZAMI, aciklama: "hedefin kaç metre yakınında durulur (0: hedefin kendi yakınlığı)" },
        KIM_AYARI,
      ],
      pinler: (a) => ({ girisler: [AKIS_GIRIS, KIM, ...hedefPinleri(a["hedef"])], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => {
        const kim = await kimOku(c);
        const h = await hedefOku(c, c.ayar["hedef"] as HedefTuru);
        const mesafe = c.ayar["mesafe"];
        const m = typeof mesafe === "number" && mesafe > 0 ? { mesafe } : {};
        const ham = h.nesne ? { ...nesneHedefleri(h.nesne, c.yetenek.capalar()).git, ...m } : { tur: "git", hedef: h.hedef, ...m };
        return yurut(c, kim, ham);
      },
    },
    {
      tip: "ajan.bak", ad: "Bak", kategori: "ajan", saf: false,
      aciklama: "Ajan başını/gövdesini hedefe çevirir (Ozyn, çapa, nesne) ya da serbest bakışa döner.",
      ayarlar: [{ ad: "hedef", tip: "metin", varsayilan: "ozyn", secenekler: BAK_HEDEFLERI }, KIM_AYARI],
      pinler: (a) => ({ girisler: [AKIS_GIRIS, KIM, ...hedefPinleri(a["hedef"])], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => {
        const kim = await kimOku(c);
        const h = await hedefOku(c, c.ayar["hedef"] as HedefTuru);
        return yurut(c, kim, h.nesne ? nesneHedefleri(h.nesne, c.yetenek.capalar()).bak : { tur: "bak", hedef: h.hedef });
      },
    },
    {
      tip: "ajan.otur", ad: "Otur", kategori: "ajan", saf: false,
      aciklama: "Ajan çapaya (varsayılan sandalye) yürür ve OTURUNCA devam eder. Koltuk doluysa ya da oturulmazsa nedeniyle hata.",
      ayarlar: [{ ad: "capa", tip: "metin", varsayilan: "sandalye", aciklama: "oturulacak çapa (sandalye, bank…)" }, KIM_AYARI],
      pinler: () => ({ girisler: [AKIS_GIRIS, KIM, { ad: "capa", tip: "metin" }], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => {
        const kim = await kimOku(c);
        const capa = await c.giris("capa");
        if (typeof capa !== "string" || !capa.trim()) throw new Error(`capa: çapa adı olmalı (gelen: ${JSON.stringify(capa)})`);
        return yurut(c, kim, { tur: "otur", capa: capa.trim() });
      },
    },
    {
      tip: "ajan.kalk", ad: "Kalk", kategori: "ajan", saf: false,
      aciklama: "Oturan ajan kalkar; ayağa kalkınca devam eder (zaten ayaktaysa nedeniyle hata).",
      ayarlar: [KIM_AYARI],
      pinler: () => ({ girisler: [AKIS_GIRIS, KIM], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => yurut(c, await kimOku(c), { tur: "kalk" }),
    },
    {
      tip: "ajan.soyle", ad: "Söyle", kategori: "ajan", saf: false,
      aciklama: "Ajan söyler (altyazı; Orion'da ses de). Söz bitince devam eder. Metin, sayı ya da nesne (adı) bağlanabilir.",
      ayarlar: [KIM_AYARI],
      pinler: () => ({ girisler: [AKIS_GIRIS, KIM, { ad: "metin", tip: "herhangi" }], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => {
        const kim = await kimOku(c);
        return yurut(c, kim, { tur: "soyle", metin: metinle(await c.giris("metin")) });
      },
    },
    {
      tip: "ajan.jest", ad: "Jest", kategori: "ajan", saf: false,
      aciklama: "Ajan bir jest yapar (el sallama, baş sallama…). Jest anında biter: art arda jest için arasına Bekle koy.",
      ayarlar: [{ ad: "jest", tip: "metin", varsayilan: "el_salliyor", secenekler: JESTLER }, KIM_AYARI],
      pinler: () => ({ girisler: [AKIS_GIRIS, KIM], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => yurut(c, await kimOku(c), { tur: "jest", jest: c.ayar["jest"] }),
    },
  ];
}
