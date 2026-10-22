// uygulama/graf/durumDugumleri.ts — DURUM VE KOŞUL DÜĞÜMLERİ (spec 35 dilim 2): değişken oku/yaz/artır, Ve/Veya/Değil, Gün vakti, Metin birleştir.
//
// LLM'siz NPC'nin "zekâsı" kural + durumdur (oyunlardaki gibi): "kaçıncı ziyaret", "parolayı bildi mi", "gece mi". Bu düğümler mevcut Eğer ve Karşılaştır
// ile birlikte çalışır (Eğer bool ister, Karşılaştır sayı): yeni bir akış kuralı yok. Dünyaya dokunmazlar (yetenek kullanmazlar); değişkenler çalışmanın
// bellekteki alanında (`grafDurumu.ts`), saat çalışmanın saatinden.
//
// DEĞİŞKENİN TÜRÜ DÜĞÜMDE YAZILI (`tip`: sayi | metin | bool), alanda değil: Oku'nun çıkış pini türüyle bağlanır (denetim Eğer'e metin bağlanmasını
// yakalar). Alandaki değer başka türdeyse (biri "ziyaret"e metin yazdıysa) okuma HATADIR, sessiz dönüşüm yok. Hiç yazılmamış değişken türünün sıfırıdır
// (0, "", false): Blueprint değişkeninin varsayılanı gibi; "ilk ziyaret" sayacı böylece kurulumsuz çalışır.
"use strict";
import { grafAdiGecerli, type GrafDegeri, type PinTanimi } from "../../protocol/graf.ts";
import { gununVakti } from "../../mind/zaman.ts";
import { AKIS_GIRIS, AKIS_SONRA, type AyarTanimi, type DegiskenAlani, type DugumCalismasi, type DugumTanimi } from "./dugumKaydi.ts";
import { degiskenDegeriHatasi } from "./grafDurumu.ts";

export const DEGISKEN_TIPLERI = ["sayi", "metin", "bool"] as const;
export type DegiskenTipi = (typeof DEGISKEN_TIPLERI)[number];
/** Değişken düğümlerinin türleri: görsel editörün "Değişkenler" listesi (uygulama/graf/editor/degiskenler.ts) bunları tarar — tür adı tek yerde. */
export const DEGISKEN_DUGUMU = { oku: "degisken.oku", yaz: "degisken.yaz", artir: "degisken.artir" } as const;

/** Gün vakitleri (Türkçe, ASCII kimlik): `mind/zaman.ts` `gununVakti`nin beş İngilizce sözünden türer (kopya kural yok; bekçi: durumDugumleri.test.ts). */
export const GUN_VAKITLERI = ["sabah", "ogle", "aksam", "gece"] as const;
export type GunVakti = (typeof GUN_VAKITLERI)[number];

/**
 * Saatin gün vakti. Sınırlar `gununVakti`nin: 05–12 sabah, 12–17 öğle(den sonra), 17–21 akşam, 21–05 gece ("the middle of the night" da gece).
 * `gununVakti` yeni bir söz üretirse burası onu GECE'ye düşürmez: fırlatır (bekçi test bütün saatleri tarar).
 */
export function gunVaktiAdi(saat: number): GunVakti {
  const v = gununVakti(saat);
  if (v === "morning") return "sabah";
  if (v === "afternoon") return "ogle";
  if (v === "evening") return "aksam";
  if (v === "night" || v === "the middle of the night") return "gece";
  throw new Error(`gununVakti tanınmayan bir vakit söyledi: '${v}' (durumDugumleri.ts eşlemesini güncelle)`);
}

const sifiri = (t: DegiskenTipi): GrafDegeri => (t === "sayi" ? 0 : t === "metin" ? "" : false);
const turuMu = (t: DegiskenTipi, v: unknown): boolean => (t === "sayi" ? typeof v === "number" : t === "metin" ? typeof v === "string" : typeof v === "boolean");
const TUR_ADI: Record<DegiskenTipi, string> = { sayi: "sayı", metin: "metin", bool: "doğru/yanlış" };

const AD_AYARI: AyarTanimi = { ad: "ad", tip: "metin", aciklama: "değişkenin adı (harf, rakam, _ ve -; grafiğe özel)", ornek: "sayac" };
const TIP_AYARI: AyarTanimi = { ad: "tip", tip: "metin", varsayilan: "sayi", secenekler: DEGISKEN_TIPLERI, aciklama: "değişkenin türü" };

/** Ad ve tür ayarları (denetimde: `pinler` fırlatınca hata listesine düşer). */
function adVeTip(a: Readonly<Record<string, GrafDegeri>>): { ad: string; tip: DegiskenTipi } {
  const ad = a["ad"];
  if (typeof ad !== "string" || !ad) throw new Error("değişken adı verilmedi (ayar.ad: örn. \"ziyaret\")");
  if (!grafAdiGecerli(ad)) throw new Error(`değişken adı geçersiz: ${JSON.stringify(ad)} (harf, rakam, _ ve -; boşluk yok)`);
  const tip = a["tip"] ?? "sayi";
  if (!DEGISKEN_TIPLERI.includes(tip as DegiskenTipi)) throw new Error(`tip: '${String(tip)}' geçersiz (seçenekler: ${DEGISKEN_TIPLERI.join(", ")})`);
  return { ad, tip: tip as DegiskenTipi };
}

function alanAl<Y>(c: DugumCalismasi<Y>): DegiskenAlani {
  if (!c.degiskenler) throw new Error("bu çalışmanın değişken alanı yok (değişken düğümleri yalnız Graf sekmesinden ▶ ya da dinlemeyle çalışır)");
  return c.degiskenler;
}

/** Alandaki değer, düğümün türüyle. Yoksa türün sıfırı; başka türdeyse HATA. */
function oku<Y>(c: DugumCalismasi<Y>, ad: string, tip: DegiskenTipi): GrafDegeri {
  const v = alanAl(c).oku(ad);
  if (v === undefined) return sifiri(tip);
  if (!turuMu(tip, v)) throw new Error(`'${ad}' ${TUR_ADI[tip]} değil (içinde ${JSON.stringify(v)} var): başka bir düğüm başka türle yazmış`);
  return v;
}

export const BOOL = (ad: string): PinTanimi => ({ ad, tip: "bool" });
async function boolOku<Y>(c: DugumCalismasi<Y>, pin: string): Promise<boolean> {
  const v = await c.giris(pin);
  if (typeof v !== "boolean") throw new Error(`${pin}: doğru/yanlış olmalı (gelen: ${JSON.stringify(v)})`);
  return v;
}

/** Birleştirilecek değer: metin, sayı, bool yazıya; başka şey (bağ yanlış) hata. */
function yaziya(v: unknown, pin: string): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  throw new Error(`${pin}: metin, sayı ya da doğru/yanlış olmalı (gelen: ${v === null ? "null" : typeof v})`);
}

/** Çalışmanın saati (0–24, kesirli); geçersizse nedenli hata. Gün vakti ve Saat düğümü AYNI kuraldan okur. */
export function gecerliSaat(c: { saat(): number }): number {
  const s = c.saat();
  if (typeof s !== "number" || !Number.isFinite(s) || s < 0 || s >= 24) throw new Error(`saat 0–24 arası olmalı (gelen: ${String(s)})`);
  return s;
}

export function durumDugumleri<Y>(): DugumTanimi<Y>[] {
  return [
    // ── değişkenler ──
    {
      tip: DEGISKEN_DUGUMU.oku, ad: "Değişken oku", kategori: "veri", saf: true,
      aciklama: "Grafiğin değişkenini okur (bellekte; uygulama kapanınca gider). Hiç yazılmadıysa türünün sıfırı: 0, \"\" ya da false.",
      ayarlar: [AD_AYARI, TIP_AYARI],
      pinler: (a) => ({ girisler: [], cikislar: [{ ad: "deger", tip: adVeTip(a).tip }] }),
      calistir: (c) => { const { ad, tip } = adVeTip(c.ayar); return { cikti: { deger: oku(c, ad, tip) } }; },
    },
    {
      tip: DEGISKEN_DUGUMU.yaz, ad: "Değişken yaz", kategori: "veri", saf: false,
      aciklama: "Grafiğin değişkenine değer yazar (sayı, metin, doğru/yanlış; tür ayardan). 'deger' bağlı değilse ayar.deger.",
      ayarlar: [AD_AYARI, TIP_AYARI],
      pinler: (a) => {
        const { tip } = adVeTip(a);
        // Bağsız 'deger' ayardan okunur; türü burada denetlenir (denetimde yakalansın, çalışma ortasında değil).
        const d = a["deger"];
        if (d !== undefined && d !== null && !turuMu(tip, d)) throw new Error(`deger: ${TUR_ADI[tip]} olmalı (tip: ${tip}; gelen: ${JSON.stringify(d)})`);
        return { girisler: [AKIS_GIRIS, { ad: "deger", tip }], cikislar: [AKIS_SONRA] };
      },
      calistir: async (c) => {
        const { ad, tip } = adVeTip(c.ayar);
        const v = await c.giris("deger");
        if (!turuMu(tip, v)) throw new Error(`deger: ${TUR_ADI[tip]} olmalı (gelen: ${JSON.stringify(v)})`);
        alanAl(c).yaz(ad, v as GrafDegeri);
        return { sonra: "sonra" };
      },
    },
    {
      tip: DEGISKEN_DUGUMU.artir, ad: "Değişken artır", kategori: "veri", saf: false,
      aciklama: "Sayı değişkenine 'miktar' ekler (varsayılan 1; eksi de olur) ve yeni değeri verir. Hiç yazılmadıysa 0'dan başlar (ziyaret sayacı).",
      ayarlar: [AD_AYARI, { ad: "miktar", tip: "sayi", varsayilan: 1, en: -1_000_000, cok: 1_000_000 }],
      pinler: (a) => { adVeTip({ ...a, tip: "sayi" }); return { girisler: [AKIS_GIRIS, { ad: "miktar", tip: "sayi" }], cikislar: [AKIS_SONRA, { ad: "deger", tip: "sayi" }] }; },
      calistir: async (c) => {
        const { ad } = adVeTip({ ...c.ayar, tip: "sayi" });
        const m = await c.giris("miktar");
        if (typeof m !== "number" || !Number.isFinite(m)) throw new Error(`miktar: sayı olmalı (gelen: ${JSON.stringify(m)})`);
        const yeni = (oku(c, ad, "sayi") as number) + m;
        const h = degiskenDegeriHatasi(yeni);
        if (h) throw new Error(`'${ad}': ${h}`);
        alanAl(c).yaz(ad, yeni);
        return { cikti: { deger: yeni }, sonra: "sonra" };
      },
    },

    // ── mantık (saf) ──
    {
      tip: "mantik.ve", ad: "Ve", kategori: "veri", saf: true,
      aciklama: "a VE b: ikisi de doğruysa doğru (Eğer'in koşuluna bağlanır).",
      pinler: () => ({ girisler: [BOOL("a"), BOOL("b")], cikislar: [BOOL("sonuc")] }),
      calistir: async (c) => ({ cikti: { sonuc: (await boolOku(c, "a")) && (await boolOku(c, "b")) } }),
    },
    {
      tip: "mantik.veya", ad: "Veya", kategori: "veri", saf: true,
      aciklama: "a VEYA b: biri doğruysa doğru.",
      pinler: () => ({ girisler: [BOOL("a"), BOOL("b")], cikislar: [BOOL("sonuc")] }),
      // İkisi de okunur (kısa devre yok): bozuk bir b girişi a doğru diye gizlenmesin, hata her zaman görünsün.
      calistir: async (c) => { const a = await boolOku(c, "a"), b = await boolOku(c, "b"); return { cikti: { sonuc: a || b } }; },
    },
    {
      tip: "mantik.degil", ad: "Değil", kategori: "veri", saf: true,
      aciklama: "a'nın tersi.",
      pinler: () => ({ girisler: [BOOL("a")], cikislar: [BOOL("sonuc")] }),
      calistir: async (c) => ({ cikti: { sonuc: !(await boolOku(c, "a")) } }),
    },

    // ── zaman ──
    {
      tip: "saat.gun_vakti", ad: "Gün vakti", kategori: "veri", saf: true,
      aciklama: "Şu an seçilen vakit mi (sabah 05–12, öğle 12–17, akşam 17–21, gece 21–05; bilgisayarın saati). 'sonuc' Eğer'e, 'vakit' Söyle'ye bağlanır.",
      ayarlar: [{ ad: "vakit", tip: "metin", varsayilan: "gece", secenekler: GUN_VAKITLERI, aciklama: "sorulan vakit" }],
      pinler: () => ({ girisler: [], cikislar: [BOOL("sonuc"), { ad: "vakit", tip: "metin" }] }),
      calistir: (c) => {
        const s = gecerliSaat(c);
        const vakit = gunVaktiAdi(s);
        return { cikti: { sonuc: vakit === c.ayar["vakit"], vakit } };
      },
    },

    // ── metin ──
    {
      tip: "metin.birlestir", ad: "Metin birleştir", kategori: "veri", saf: true,
      aciklama: "a ile b'yi yan yana yazar (\"Ziyaret: \" + 3). Sayı ve doğru/yanlış yazıya çevrilir.",
      pinler: () => ({ girisler: [{ ad: "a", tip: "herhangi" }, { ad: "b", tip: "herhangi" }], cikislar: [{ ad: "metin", tip: "metin" }] }),
      calistir: async (c) => ({ cikti: { metin: yaziya(await c.giris("a"), "a") + yaziya(await c.giris("b"), "b") } }),
    },
  ];
}
