// uygulama/graf/aktorDugumleri.ts — AKTÖR DÜĞÜMLERİ (spec 43 A3; Blueprint'in "Get/Set component property" + üye değişkeni).
//
// Bir level aktörünün (nesne/ışık) bileşen alanını ve örnek değişkenini okur/yazar: `aktor.oku/yaz`, `aktor.degisken_oku/yaz`. Hangi alanın grafta
// okunup yazılabildiği `world/level/cekirdek/bilesen.ts` şemasındaki `grafta` bayrağından türer (tür/aralık orada, burada kopya yok; bekçi: aktorDugumleri.test.ts).
//
// `aktor` ayarı "@bu" (varsayılan: grafı çalıştıran aktör — Details'ten ▶ ile başlatılınca dolu) ya da bir aktör kimliğidir. "@bu" aktörsüz çalışmada
// (Graf sekmesi ▶, dinleyici) NEDENLE düşer. `@bu` aktör, `@ben` NPC'dir; karışmasın.
// Yazma GEÇİCİDİR: level tanımına/diske gitmez, çalışma bitince tanımdaki hâle dönülür (yetenek tarafı). Kalıcı olan yalnız Details'te girilen başlangıç değeri.
"use strict";
import type { GrafDegeri, PinTanimi } from "../../protocol/graf.ts";
import { BILESEN_SEMALARI, type AlanTipi } from "../../world/level/cekirdek/bilesen.ts";
import { grafAdiGecerli } from "../../protocol/graf.ts";
import { AKIS_GIRIS, AKIS_SONRA, type AyarTanimi, type DugumCalismasi, type DugumTanimi } from "./dugumKaydi.ts";
import type { AktorYetenegi, GrafYetenegi } from "./grafYetenegi.ts";

export const AKTOR_DUGUMU = { oku: "aktor.oku", yaz: "aktor.yaz", degiskenOku: "aktor.degisken_oku", degiskenYaz: "aktor.degisken_yaz" } as const;
/** `aktor` ayarının "bu grafı çalıştıran aktör" değeri. */
export const BU = "@bu";

type PinTipi = PinTanimi["tip"];
const pinTipi = (t: AlanTipi): PinTipi => (t === "sayi" ? "sayi" : t === "bool" ? "bool" : "metin");

/**
 * Grafta okunup yazılabilen alanlar ve pin türleri: nesne ve ışık şemalarının `grafta` alanları (aynı ad iki şemada varsa türü aynı olmalı —
 * değilse modül yüklenirken fırlatır: iki aktör türü aynı alan adını farklı türle verirse pin türü belirsiz kalırdı).
 */
export const GRAFTA_ALANLARI: Readonly<Record<string, PinTipi>> = (() => {
  const r: Record<string, PinTipi> = {};
  for (const s of Object.values(BILESEN_SEMALARI)) {
    for (const a of s.alanlar) {
      if (!a.grafta) continue;
      const t = pinTipi(a.tip);
      if (r[a.ad] !== undefined && r[a.ad] !== t) throw new Error(`bilesen.ts: '${a.ad}' alanı iki şemada farklı türde (${r[a.ad]} / ${t})`);
      r[a.ad] = t;
    }
  }
  return r;
})();
const ALAN_ADLARI = Object.keys(GRAFTA_ALANLARI);

const AKTOR_AYARI: AyarTanimi = { ad: "aktor", tip: "metin", varsayilan: BU, aciklama: `${BU} = bu grafı çalıştıran aktör; ya da bir level aktörünün kimliği (Outliner'daki kimlik)` };
const ALAN_AYARI: AyarTanimi = { ad: "alan", tip: "metin", varsayilan: ALAN_ADLARI[0] ?? "", secenekler: ALAN_ADLARI, aciklama: "aktörün bileşen alanı (yalnız grafta açık olanlar)" };
const DEG_AD_AYARI: AyarTanimi = { ad: "ad", tip: "metin", aciklama: "aktör değişkeninin adı (Details ▸ Değişkenler'de tanımlı)", ornek: "hiz" };

function alanTipi(a: Readonly<Record<string, GrafDegeri>>): { alan: string; tip: PinTipi } {
  const alan = a["alan"] ?? ALAN_ADLARI[0];
  if (typeof alan !== "string" || GRAFTA_ALANLARI[alan] === undefined) throw new Error(`alan: '${String(alan)}' grafta kullanılamaz (seçenekler: ${ALAN_ADLARI.join(", ")})`);
  return { alan, tip: GRAFTA_ALANLARI[alan]! };
}

function degiskenAdi(a: Readonly<Record<string, GrafDegeri>>): string {
  const ad = a["ad"];
  if (typeof ad !== "string" || !ad) throw new Error("değişken adı verilmedi (ayar.ad: örn. \"hiz\")");
  if (!grafAdiGecerli(ad)) throw new Error(`değişken adı geçersiz: ${JSON.stringify(ad)} (harf, rakam, _ ve -; boşluk yok)`);
  return ad;
}

/** Çalışmanın aktör yeteneği + hedef aktör kimliği; `@bu` aktörsüzse, aktör yoksa ya da yetenek verilmemişse nedenle fırlatır. */
function hedef(c: DugumCalismasi<GrafYetenegi>): { y: AktorYetenegi; id: string } {
  const y = c.yetenek.aktor;
  if (!y) throw new Error("bu dünyada aktör yeteneği yok (level açık değil ya da senaryo dünyası)");
  const ham = c.ayar["aktor"] ?? BU;
  if (typeof ham !== "string" || !ham) throw new Error(`aktor: aktör kimliği ya da '${BU}' olmalı (gelen: ${JSON.stringify(ham)})`);
  let id = ham;
  if (ham === BU) {
    if (c.aktor === null) throw new Error(`aktor: '${BU}' çözülemez — bu graf bir aktörün Details'inden ▶ ile başlatılmadı (Graf sekmesinden ve dinlemeden aktör yok; aktör kimliğini ayara yaz)`);
    id = c.aktor;
  }
  if (!y.var(id)) throw new Error(`aktor: '${id}' level'da yok`);
  return { y, id };
}

const tipAdi: Record<PinTipi, string> = { sayi: "sayı", bool: "doğru/yanlış", metin: "metin", akis: "akış", nesne: "nesne", ajan: "ajan", konum: "konum", herhangi: "değer" };
const turuMu = (t: PinTipi, v: unknown): v is string | number | boolean => (t === "sayi" ? typeof v === "number" : t === "bool" ? typeof v === "boolean" : typeof v === "string");

export function aktorDugumleri<Y extends GrafYetenegi>(): DugumTanimi<Y>[] {
  return [
    {
      tip: AKTOR_DUGUMU.oku, ad: "Aktör alanı oku", kategori: "aktor", saf: true,
      aciklama: "Aktörün bileşen alanını okur (ışık: renk, şiddet, menzil, gizli; nesne: gizli). Çalışma sırasında bu graf kendi yazdığını da görür.",
      ayarlar: [AKTOR_AYARI, ALAN_AYARI],
      pinler: (a) => ({ girisler: [], cikislar: [{ ad: "deger", tip: alanTipi(a).tip }] }),
      calistir: (c) => {
        const { alan } = alanTipi(c.ayar);
        const { y, id } = hedef(c as DugumCalismasi<GrafYetenegi>);
        return { cikti: { deger: y.alanOku(id, alan) } };
      },
    },
    {
      tip: AKTOR_DUGUMU.yaz, ad: "Aktör alanı yaz", kategori: "aktor", saf: false,
      aciklama: "Aktörün bileşen alanına değer yazar (örn. ışığın şiddetini kısmak). GEÇİCİDİR: level dosyasına gitmez, çalışma bitince/durdurulunca eski hâle döner.",
      ayarlar: [AKTOR_AYARI, ALAN_AYARI],
      pinler: (a) => ({ girisler: [AKIS_GIRIS, { ad: "deger", tip: alanTipi(a).tip }], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => {
        const { alan, tip } = alanTipi(c.ayar);
        const v = await c.giris("deger");
        if (!turuMu(tip, v)) throw new Error(`deger: ${tipAdi[tip]} olmalı (alan: ${alan}; gelen: ${JSON.stringify(v)})`);
        const { y, id } = hedef(c as DugumCalismasi<GrafYetenegi>);
        y.alanYaz(id, alan, v);
        return { sonra: "sonra" };
      },
    },
    {
      tip: AKTOR_DUGUMU.degiskenOku, ad: "Aktör değişkeni oku", kategori: "aktor", saf: true,
      aciklama: "Aktörün Details'te tanımlı değişkenini okurken 'deger' verir (tür değişkenin türü: sayı, metin ya da doğru/yanlış). Tanımsız değişken HATADIR.",
      ayarlar: [AKTOR_AYARI, DEG_AD_AYARI],
      pinler: (a) => { degiskenAdi(a); return { girisler: [], cikislar: [{ ad: "deger", tip: "herhangi" }] }; },
      calistir: (c) => {
        const ad = degiskenAdi(c.ayar);
        const { y, id } = hedef(c as DugumCalismasi<GrafYetenegi>);
        const v = y.degiskenOku(id, ad);
        if (v === undefined) throw new Error(`'${id}' aktörünün '${ad}' değişkeni yok (Details ▸ Değişkenler'den ekle)`);
        return { cikti: { deger: v } };
      },
    },
    {
      tip: AKTOR_DUGUMU.degiskenYaz, ad: "Aktör değişkeni yaz", kategori: "aktor", saf: false,
      aciklama: "Aktörün değişkenine değer yazar (türü değişmez). GEÇİCİDİR: çalışma bitince Details'teki başlangıç değerine döner.",
      ayarlar: [AKTOR_AYARI, DEG_AD_AYARI],
      pinler: (a) => { degiskenAdi(a); return { girisler: [AKIS_GIRIS, { ad: "deger", tip: "herhangi" }], cikislar: [AKIS_SONRA] }; },
      calistir: async (c) => {
        const ad = degiskenAdi(c.ayar);
        const v = await c.giris("deger");
        if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") throw new Error(`deger: sayı, metin ya da doğru/yanlış olmalı (gelen: ${JSON.stringify(v)})`);
        const { y, id } = hedef(c as DugumCalismasi<GrafYetenegi>);
        y.degiskenYaz(id, ad, v);
        return { sonra: "sonra" };
      },
    },
  ];
}
