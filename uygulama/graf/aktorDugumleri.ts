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
import { olayAdiHatasi } from "../../world/level/cekirdek/aktorOlayYolu.ts";
import { aktorHatasi, kodluHata } from "../../world/level/cekirdek/aktorHatalari.ts";
import { AKIS_GIRIS, AKIS_SONRA, type AyarTanimi, type DugumCalismasi, type DugumTanimi } from "./dugumKaydi.ts";
import type { AktorYetenegi, GrafYetenegi } from "./grafYetenegi.ts";

export const AKTOR_DUGUMU = {
  oku: "aktor.oku", yaz: "aktor.yaz", degiskenOku: "aktor.degisken_oku", degiskenYaz: "aktor.degisken_yaz",
  olayYayinla: "aktor.olay_yayinla", ustBul: "aktor.ust_bul", altBul: "aktor.alt_bul",
  hareketEt: "aktor.hareket_et", soketeTak: "aktor.sokete_tak", sokettanAl: "aktor.sokettan_al",
} as const;
/** Aktör olayı düğümü (⚡ dinleme girişi; `olayDugumleri.ts` `olayTetikleri` bunu tanır). */
export const AKTOR_OLAYI_TIPI = "olay.aktor_olayi";
/** Dinleme adresinin öneki: `aktor:<id>` (`OlayKaynagi.dinle` bu önekle aktör olay yoluna yönlenir; ajan kimlikleriyle karışmaz: ajan kimliğinde `:` yok). */
export const AKTOR_ADRES_ONEKI = "aktor:";
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
      if (r[a.ad] !== undefined && r[a.ad] !== t) throw aktorHatasi("AKT-SEM-001", `bilesen.ts: '${a.ad}' alanı iki şemada farklı türde (${r[a.ad]} / ${t})`);
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
  if (typeof alan !== "string" || GRAFTA_ALANLARI[alan] === undefined) throw aktorHatasi("AKT-DUG-016", `alan: '${String(alan)}' grafta kullanılamaz (seçenekler: ${ALAN_ADLARI.join(", ")})`);
  return { alan, tip: GRAFTA_ALANLARI[alan]! };
}

function degiskenAdi(a: Readonly<Record<string, GrafDegeri>>): string {
  const ad = a["ad"];
  if (typeof ad !== "string" || !ad) throw aktorHatasi("AKT-DUG-017", "değişken adı verilmedi (ayar.ad: örn. \"hiz\")");
  if (!grafAdiGecerli(ad)) throw aktorHatasi("AKT-DUG-017", `değişken adı geçersiz: ${JSON.stringify(ad)} (harf, rakam, _ ve -; boşluk yok)`);
  return ad;
}

/** Çalışmanın aktör yeteneği + hedef aktör kimliği; `@bu` aktörsüzse, aktör yoksa ya da yetenek verilmemişse nedenle fırlatır. */
function hedef(c: DugumCalismasi<GrafYetenegi>): { y: AktorYetenegi; id: string } {
  const y = c.yetenek.aktor;
  if (!y) throw aktorHatasi("AKT-DUG-005", "bu dünyada aktör yeteneği yok (level açık değil ya da senaryo dünyası)");
  const ham = c.ayar["aktor"] ?? BU;
  if (typeof ham !== "string" || !ham) throw aktorHatasi("AKT-DUG-018", `aktor: aktör kimliği ya da '${BU}' olmalı (gelen: ${JSON.stringify(ham)})`);
  let id = ham;
  if (ham === BU) {
    if (c.aktor === null) throw aktorHatasi("AKT-DUG-013", `aktor: '${BU}' çözülemez — bu graf bir aktörün Details'inden ▶ ile başlatılmadı (Graf sekmesinden ve dinlemeden aktör yok; aktör kimliğini ayara yaz)`);
    id = c.aktor;
  }
  if (!y.var(id)) throw aktorHatasi("AKT-DUG-019", `aktor: '${id}' level'da yok`);
  return { y, id };
}

const OLAY_AYARI: AyarTanimi = { ad: "olay", tip: "metin", aciklama: "özel olay adı (harf, rakam, _ ve -; noktalı yerleşik olaylar bileşenlere ayrılmıştır)", ornek: "ac" };
const YON_AYARI: AyarTanimi = { ad: "yon", tip: "metin", varsayilan: "aktor", secenekler: ["aktor", "ust", "alt"], aciklama: "olayın gideceği yer: aktor = yalnız bu aktörün dinleyicileri, ust = üst zinciri, alt = alt ağacı" };
/** Olaya iliştirilen değer; boş metin = veri yok (varsayılan: bağlanmazsa olay verisiz gider). */
const DEGER_AYARI: AyarTanimi = { ad: "deger", tip: "metin", varsayilan: "", aciklama: "olayla giden değer (sayı, metin ya da doğru/yanlış); boş = veri yok" };
const SIRA_AYARI: AyarTanimi = { ad: "sira", tip: "sayi", varsayilan: 0, aciklama: "kaçıncı alt (0'dan; tanımdaki sırayla)" };
const DINLENEN_AYARI: AyarTanimi = { ad: "aktor", tip: "metin", aciklama: "olayı dinlenecek aktörün kimliği (Outliner'daki kimlik; '@bu' dinlemede çözülemez)", ornek: "kapi" };
const DINLENEN_OLAY_AYARI: AyarTanimi = { ad: "olay", tip: "metin", aciklama: "dinlenen olay: özel ad ya da bileşen olayı (tetik.girdi, soket.takildi…)", ornek: "tetik.girdi" };

const HIZ_AYARI: AyarTanimi = { ad: "hiz", tip: "sayi", varsayilan: 0, aciklama: "ileri hız (m/s; eksi = geri). Hareket bileşeninin azami hızını aşamaz" };
const DONUS_AYARI: AyarTanimi = { ad: "donus", tip: "sayi", varsayilan: 0, aciklama: "dönme hızı (°/s; + = sağa). Hareket bileşeninin dönme hızını aşamaz" };
const UST_AYARI: AyarTanimi = { ad: "ust", tip: "metin", aciklama: `takılacağı üst: aktör kimliği, '${BU}' ya da beden soketi için 'beden:<ad>' (örn. beden:orion)`, ornek: "beden:orion" };
const SOKET_AYARI: AyarTanimi = { ad: "soket", tip: "metin", varsayilan: "", aciklama: "üstteki soketin adı (üst aktörün Soket bileşeni ya da bedenin soketi: el_sag…); boş = üstün orijini" };

function ozelOlayAdi(a: Readonly<Record<string, GrafDegeri>>): string {
  const ad = a["olay"];
  if (typeof ad !== "string" || !ad) throw aktorHatasi("AKT-DUG-001", "olay adı verilmedi (ayar.olay: örn. \"ac\")");
  // Noktasız: yerleşik bileşen olayları (`tetik.girdi`…) yalnız bileşenden gelir, graf taklit edemez.
  if (!grafAdiGecerli(ad)) throw aktorHatasi("AKT-DUG-002", `olay adı geçersiz: ${JSON.stringify(ad)} (harf, rakam, _ ve -; nokta yok)`);
  return ad;
}

function dinlenenAktor(a: Readonly<Record<string, GrafDegeri>>): { id: string; olay: string } {
  const id = a["aktor"], olay = a["olay"];
  if (typeof id !== "string" || !id) throw aktorHatasi("AKT-DUG-009", "dinlenecek aktör seçilmedi (ayar.aktor: aktör kimliği)");
  if (id === BU) throw aktorHatasi("AKT-DUG-010", `aktor: '${BU}' dinlemede çözülemez — aktör kimliğini yaz`);
  const h = olayAdiHatasi(olay);
  if (h) throw kodluHata(`olay: ${h}`);
  return { id, olay: olay as string };
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
        if (!turuMu(tip, v)) throw aktorHatasi("AKT-DUG-004", `deger: ${tipAdi[tip]} olmalı (alan: ${alan}; gelen: ${JSON.stringify(v)})`);
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
        if (v === undefined) throw aktorHatasi("AKT-DUG-020", `'${id}' aktörünün '${ad}' değişkeni yok (Details ▸ Değişkenler'den ekle)`);
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
        if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") throw aktorHatasi("AKT-DUG-004", `deger: sayı, metin ya da doğru/yanlış olmalı (gelen: ${JSON.stringify(v)})`);
        const { y, id } = hedef(c as DugumCalismasi<GrafYetenegi>);
        y.degiskenYaz(id, ad, v);
        return { sonra: "sonra" };
      },
    },
    {
      tip: AKTOR_DUGUMU.olayYayinla, ad: "Aktör olayı yayınla", kategori: "aktor", saf: false,
      aciklama: "Aktörün adına özel bir olay yayınlar (Unreal Event Dispatcher): aktörün dinleyicilerine, üst zincirine ya da alt ağacına. Olay derinlik ve kare tavanlıdır; aşılırsa düğüm nedenle düşer.",
      ayarlar: [AKTOR_AYARI, OLAY_AYARI, YON_AYARI, DEGER_AYARI],
      pinler: (a) => { ozelOlayAdi(a); return { girisler: [AKIS_GIRIS, { ad: "deger", tip: "herhangi" }], cikislar: [AKIS_SONRA] }; },
      calistir: async (c) => {
        const olay = ozelOlayAdi(c.ayar);
        const yon = c.ayar["yon"] ?? "aktor";
        if (yon !== "aktor" && yon !== "ust" && yon !== "alt") throw aktorHatasi("AKT-DUG-003", `yon: aktor, ust ya da alt olmalı (gelen: ${JSON.stringify(yon)})`);
        const v = await c.giris("deger");
        if (v !== "" && typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") throw aktorHatasi("AKT-DUG-004", `deger: sayı, metin ya da doğru/yanlış olmalı (gelen: ${JSON.stringify(v)})`);
        const { y, id } = hedef(c as DugumCalismasi<GrafYetenegi>);
        if (!y.olayYayinla) throw aktorHatasi("AKT-DUG-006", "bu dünyada aktör olay yolu yok (level açık değil ya da senaryo dünyası)");
        y.olayYayinla(id, olay, v === "" ? {} : { deger: v }, yon);
        return { sonra: "sonra" };
      },
    },
    {
      tip: AKTOR_DUGUMU.ustBul, ad: "Aktörün üstü", kategori: "aktor", saf: true,
      aciklama: "Aktörün üstünü verir ('id'; beden üstü `beden:<ad>` biçimindedir). Üstü yoksa 'var' yanlış, 'id' boş.",
      ayarlar: [AKTOR_AYARI],
      pinler: () => ({ girisler: [], cikislar: [{ ad: "id", tip: "metin" }, { ad: "var", tip: "bool" }] }),
      calistir: (c) => {
        const { y, id } = hedef(c as DugumCalismasi<GrafYetenegi>);
        if (!y.ustBul) throw aktorHatasi("AKT-DUG-007", "bu dünyada aktör hiyerarşisi yok (level açık değil ya da senaryo dünyası)");
        const u = y.ustBul(id);
        return { cikti: { id: u ?? "", var: u !== null } };
      },
    },
    {
      tip: AKTOR_DUGUMU.altBul, ad: "Aktörün altı", kategori: "aktor", saf: true,
      aciklama: "Aktörün sırayla N. altını verir ('id'); 'sayi' toplam alt sayısıdır. Sıra aralık dışıysa 'var' yanlış, 'id' boş.",
      ayarlar: [AKTOR_AYARI, SIRA_AYARI],
      pinler: () => ({ girisler: [], cikislar: [{ ad: "id", tip: "metin" }, { ad: "var", tip: "bool" }, { ad: "sayi", tip: "sayi" }] }),
      calistir: (c) => {
        const sira = c.ayar["sira"] ?? 0;
        if (typeof sira !== "number" || !Number.isInteger(sira) || sira < 0) throw aktorHatasi("AKT-DUG-008", `sira: 0 ya da daha büyük tam sayı olmalı (gelen: ${JSON.stringify(sira)})`);
        const { y, id } = hedef(c as DugumCalismasi<GrafYetenegi>);
        if (!y.altlar) throw aktorHatasi("AKT-DUG-007", "bu dünyada aktör hiyerarşisi yok (level açık değil ya da senaryo dünyası)");
        const l = y.altlar(id);
        return { cikti: { id: l[sira] ?? "", var: sira < l.length, sayi: l.length } };
      },
    },
    {
      tip: AKTOR_DUGUMU.hareketEt, ad: "Aktör hareket et", kategori: "aktor", saf: false,
      aciklama: "Hareket bileşeni olan aktöre komut verir: ileri hız (m/s) ve dönme hızı (°/s); 0 ve 0 durdurur. Komut KALICIDIR (graf bitse de aktör gitmeye devam eder; durdurmak için 0, 0 ver). Level dosyasına yazılmaz.",
      ayarlar: [AKTOR_AYARI, HIZ_AYARI, DONUS_AYARI],
      pinler: () => ({ girisler: [AKIS_GIRIS, { ad: "hiz", tip: "sayi" }, { ad: "donus", tip: "sayi" }], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => {
        const hiz = await c.giris("hiz"), donus = await c.giris("donus");
        if (typeof hiz !== "number" || typeof donus !== "number") throw aktorHatasi("AKT-DUG-014", `hiz ve donus sayı olmalı (gelen: ${JSON.stringify(hiz)}, ${JSON.stringify(donus)})`);
        const { y, id } = hedef(c as DugumCalismasi<GrafYetenegi>);
        if (!y.hareketEt) throw aktorHatasi("AKT-DUG-015", "bu dünyada aktör çalışma zamanı yok (level açık değil ya da senaryo dünyası)");
        y.hareketEt(id, hiz, donus);
        return { sonra: "sonra" };
      },
    },
    {
      tip: AKTOR_DUGUMU.soketeTak, ad: "Aktörü sokete tak", kategori: "aktor", saf: false,
      aciklama: "Aktörü bir üste (ve üstün soketine) takar: konum/dönüş artık üste göre yereldir, üst gidince o da gider (kılıç → elin soketi). Level dosyasına yazılmaz; level yeniden kurulunca gider.",
      ayarlar: [AKTOR_AYARI, UST_AYARI, SOKET_AYARI],
      pinler: () => ({ girisler: [AKIS_GIRIS], cikislar: [AKIS_SONRA] }),
      calistir: (c) => {
        const { y, id } = hedef(c as DugumCalismasi<GrafYetenegi>);
        const ham = c.ayar["ust"];
        if (typeof ham !== "string" || !ham) throw aktorHatasi("AKT-DUG-012", "üst verilmedi (ayar.ust: aktör kimliği, '@bu' ya da 'beden:<ad>')");
        let ust = ham;
        if (ham === BU) {
          if (c.aktor === null) throw aktorHatasi("AKT-DUG-013", `ust: '${BU}' çözülemez — bu graf bir aktörün Details'inden ▶ ile başlatılmadı`);
          ust = c.aktor;
        }
        const soket = c.ayar["soket"] ?? "";
        if (typeof soket !== "string") throw aktorHatasi("AKT-DUG-021", "soket: metin olmalı");
        if (!y.soketeTak) throw aktorHatasi("AKT-DUG-015", "bu dünyada aktör çalışma zamanı yok (level açık değil ya da senaryo dünyası)");
        y.soketeTak(id, ust, soket || undefined);
        return { sonra: "sonra" };
      },
    },
    {
      tip: AKTOR_DUGUMU.sokettanAl, ad: "Aktörü sokettan al", kategori: "aktor", saf: false,
      aciklama: "Aktörü üstünden ayırır (tanımdaki üstten bile) ve tanımdaki yerel konumuna döndürür. Üstü yoksa düğüm nedenle düşer.",
      ayarlar: [AKTOR_AYARI],
      pinler: () => ({ girisler: [AKIS_GIRIS], cikislar: [AKIS_SONRA] }),
      calistir: (c) => {
        const { y, id } = hedef(c as DugumCalismasi<GrafYetenegi>);
        if (!y.sokettanAl) throw aktorHatasi("AKT-DUG-015", "bu dünyada aktör çalışma zamanı yok (level açık değil ya da senaryo dünyası)");
        y.sokettanAl(id);
        return { sonra: "sonra" };
      },
    },
    {
      // ⚡ DİNLEME GİRİŞİ (olayDugumleri.ts ile aynı güvenlik: ▶ buradan başlamaz, yalnız Ozyn'in dinlemeye aldığı graf bu olayla yürür).
      tip: AKTOR_OLAYI_TIPI, ad: "⚡ Aktör olayı", kategori: "olay", olay: true, dunyaOlayi: "aktor_olayi", saf: false,
      aciklama: "Bir level aktörünün olayı gelince yürür (özel olay ya da bileşen olayı: tetik.girdi…). Grafik ⚡ DİNLEMEYE ALININCA (Graf sekmesi, senin tıklamanla) çalışır; ▶ Çalıştır buradan başlamaz.",
      ayarlar: [DINLENEN_AYARI, DINLENEN_OLAY_AYARI],
      pinler: (a) => { dinlenenAktor(a); return { girisler: [], cikislar: [AKIS_SONRA, { ad: "kaynak", tip: "metin" }, { ad: "kim", tip: "metin" }, { ad: "deger", tip: "herhangi" }] }; },
      calistir: (c) => {
        if (c.tetik?.dugum !== c.dugumId) throw aktorHatasi("AKT-DUG-011", "olay düğümü yalnız kendi olayıyla başlar (grafiği ⚡ dinlemeye al)");
        const v = c.tetik.veri;
        const metin = (x: unknown): string => (typeof x === "string" ? x : "");
        return { cikti: { kaynak: metin(v["kaynak"]), kim: metin(v["kim"]), deger: v["deger"] ?? "" }, sonra: "sonra" };
      },
    },
  ];
}
