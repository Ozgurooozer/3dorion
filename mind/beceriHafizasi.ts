// mind/beceriHafizasi.ts — BECERİ HAFIZASI (spec 10): bir kez başarılan görev, parametreleriyle
// yeniden yapılır.
//
// Ozyn (2026-09-28): "Bir görevi ilk defa yaptığında görevi tekrar kullanmak üzere otomatik
// kaydediyoruz ama belli parametrelerde. … o parametreler içinde aynı görevi modüler, esnek
// şekilde yapabilecek."
//
//   beceri = { çerçeve (sözün çapa dışı sözcükleri), yuva sayısı,
//              adımlar (bedensel niyetler), bağlar (hangi alan hangi yuvaya bağlı),
//              sayaç (başarı / hata), kanıt (doğuran ve besleyen görevler) }
//
// ÖĞRENME (mind/gorev.ts görevlerinden):
//   - İlk BAŞARI beceriyi doğurur (tek deneme; öğrenen kapıyla aynı ilke).
//   - Aynı tarifin sonraki başarısı ve hatası sayaca yazılır. Hatadan beceri doğmaz.
//   - Belirsiz görev (sonucu eksik, son adım iptal) hiçbir şeyi değiştirmez.
//   - Tarif = çerçeve + yuva sayısı + adımların yuvadan arındırılmış hali. Kimlik bu
//     içerikten türer (FNV-1a): hafıza kayıttan yeniden kurulunca da aynı kalır, kayıt
//     sırası ya da doğum sırası kimliği değiştirmez.
//   - Refleks yürütümü (Faz D) beceri doğurmaz; sonucu yürüttüğü becerinin sayacına
//     KİMLİKLE yazılır (tarifle değil: hatadan sonra gönderilmeyen adımlar tarifi eksik
//     gösterirdi). Başarı güveni artırır, hata payı düşürür; pay 0,75'in altına inince
//     beceri askıya alınır ve söz yine LLM'e gider.
//
// KARAR: sözün çerçevesi birebir aynı, yuva sayısı aynı, payı (başarı / toplam)
// `VARSAYILAN_GUVEN_PAYI`'nın üstünde olan beceriler aday. Çok başarılı olan, eşitlikte
// en yeni doğan kazanır. Adımlar yeni sözün çapalarıyla doldurulup KOPYA olarak döner.
//
// BİLEREK KATI (spec 10 "Eşleşme"): genelleme ancak gölgede ölçülünce gevşetilir. Öğrenen
// kapıda yeni duruma genelleme iki kez reddedildi (H-K1, H-K2).
//
// Bağımlılık: protocol/ (tipler), mind/gorev.ts, mind/kuralHafizasi.ts (güven payı),
// mind/ozet32.ts. Saf ve belirlenimci: dosya, saat, rastgelelik, dünya yok.
"use strict";
import type { Niyet } from "../protocol/niyet.ts";
import { niyetSinifi, sozAnahtari, zamanSirali, type GorevOrnegi, type SozAnahtari } from "./gorev.ts";
import { VARSAYILAN_GUVEN_PAYI } from "./kuralHafizasi.ts";
import { ozet32 } from "./ozet32.ts";

/** Bir adımın bir alanı, sözün bir yuvasına bağlı: `adimlar[adim]` içindeki `yol`, `yuvalar[yuva]` olur. */
export interface YuvaBagi {
  adim: number;
  yol: readonly string[];
  yuva: number;
}

export interface Beceri {
  /** "B" + 8 onaltılık hane; tariften türer. */
  id: string;
  cerceve: string[];
  yuvaSayisi: number;
  /** Tarifin adımları: bağlı alanlar ilk başarının çapalarını taşır (okunurluk için). */
  adimlar: Niyet[];
  baglar: YuvaBagi[];
  sayac: { basari: number; hata: number };
  /** Beceriyi doğuran ve besleyen görevlerin kimlikleri. */
  kanit: string[];
  /** Kaçıncı doğan beceri (eşitlik bozucu: en yeni kazanır). */
  dogum: number;
  /** Doğuran söz (okunurluk için). */
  ornek: string;
}

export interface BeceriEslesmesi {
  beceri: Beceri;
  /** Yeni sözün çapalarıyla doldurulmuş adımlar (kopya). */
  adimlar: Niyet[];
  /** Başarı / toplam. */
  pay: number;
}

export interface BeceriOlayi {
  tur: "dogdu" | "basari" | "hata";
  beceri: string;
  gorev: string;
}

export interface BeceriHafizasiAyari {
  /** Kararın geçerli sayılması için asgari başarı payı. Varsayılan: öğrenen kapıyla aynı. */
  guvenPayi?: number;
}

/** Adımın çapa değerli alanları: `hedef.ad` (hedef çapaysa) ve `capa`. */
function capaAlanlari(n: Niyet): { yol: string[]; deger: string }[] {
  const out: { yol: string[]; deger: string }[] = [];
  if ("hedef" in n && n.hedef && n.hedef.tip === "capa") out.push({ yol: ["hedef", "ad"], deger: n.hedef.ad });
  if ("capa" in n && typeof n.capa === "string") out.push({ yol: ["capa"], deger: n.capa });
  return out;
}

/** Sözde geçen bir çapaya eşit olan her alan o yuvaya bağlanır; kalanlar sabittir. */
function baglariKur(anahtar: SozAnahtari, adimlar: readonly Niyet[]): YuvaBagi[] {
  const baglar: YuvaBagi[] = [];
  adimlar.forEach((n, adim) => {
    for (const { yol, deger } of capaAlanlari(n)) {
      const yuva = anahtar.yuvalar.indexOf(deger as SozAnahtari["yuvalar"][number]);
      if (yuva >= 0) baglar.push({ adim, yol, yuva });
    }
  });
  return baglar;
}

/** Derin kopyadaki bir alanı yazar (`yol` baglariKur'dan gelir; ara nesneler vardır). */
function yerlestir(n: Niyet, yol: readonly string[], deger: string): void {
  let o = n as unknown as Record<string, unknown>;
  for (const p of yol.slice(0, -1)) o = o[p] as Record<string, unknown>;
  o[yol.at(-1)!] = deger;
}

/** Adımların kopyası, bağlı alanlara verilen değerler yazılmış. */
function doldur(adimlar: readonly Niyet[], baglar: readonly YuvaBagi[], deger: (b: YuvaBagi) => string): Niyet[] {
  const kopya = structuredClone(adimlar) as Niyet[];
  for (const b of baglar) yerlestir(kopya[b.adim]!, b.yol, deger(b));
  return kopya;
}

/** Anahtar sırasından bağımsız JSON: aynı içerik aynı metin (kimlik için). `undefined` yazılmaz. */
function kararliJson(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(kararliJson).join(",")}]`;
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${kararliJson(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(x);
}

/** Tarifin kimliği: çerçeve, yuva sayısı ve yuvadan arındırılmış adımlar. */
function beceriKimligi(anahtar: SozAnahtari, adimlar: readonly Niyet[], baglar: readonly YuvaBagi[]): string {
  const soyut = doldur(adimlar, baglar, (b) => `⟨yuva ${b.yuva}⟩`);
  const icerik = kararliJson({ cerceve: anahtar.cerceve, yuvaSayisi: anahtar.yuvalar.length, adimlar: soyut });
  return `B${ozet32(icerik).toString(16).padStart(8, "0")}`;
}

const pay = (b: Beceri): number => b.sayac.basari / (b.sayac.basari + b.sayac.hata);

export class BeceriHafizasi {
  private _beceriler: Beceri[] = [];
  private _dogum = 0;
  private _guvenPayi: number;

  constructor(ayar: BeceriHafizasiAyari = {}) {
    this._guvenPayi = ayar.guvenPayi ?? VARSAYILAN_GUVEN_PAYI;
  }

  get beceriler(): readonly Beceri[] { return this._beceriler; }

  /** Bir görevden öğrenir. Ne olduğunu döner; hiçbir şey değişmediyse null. */
  ogren(g: GorevOrnegi): BeceriOlayi | null {
    if (g.sonuc === "belirsiz" || g.adimlar.length === 0) return null;
    // Güvenlik (spec 10): yalnız bedensel adımlar tekrarlanır. Görev çıkarıcısı zaten
    // süzer; burada ikinci kez sorulur ki elle kurulmuş bir görev de `komut` sokamasın.
    if (g.adimlar.some((a) => niyetSinifi(a.govde.tur) !== "bedensel")) return null;
    // REFLEKS YÜRÜTÜMÜ (Faz D): sonuç yürütülen becerinin sayacına yazılır, doğum yok.
    // Tarife bakılmaz: hatadan sonra gönderilmeyen adımlar tarifi eksik gösterirdi.
    if (g.beceri !== undefined) {
      const b = this._beceriler.find((x) => x.id === g.beceri);
      if (!b) return null;
      b.sayac[g.sonuc]++;
      b.kanit.push(g.kimlik);
      return { tur: g.sonuc, beceri: b.id, gorev: g.kimlik };
    }
    const adimlar = g.adimlar.map((a) => a.govde);
    const baglar = baglariKur(g.anahtar, adimlar);
    const id = beceriKimligi(g.anahtar, adimlar, baglar);
    const b = this._beceriler.find((x) => x.id === id);
    if (!b) {
      if (g.sonuc !== "basari") return null;
      this._beceriler.push({
        id, cerceve: [...g.anahtar.cerceve], yuvaSayisi: g.anahtar.yuvalar.length,
        adimlar: structuredClone(adimlar) as Niyet[], baglar,
        sayac: { basari: 1, hata: 0 }, kanit: [g.kimlik], dogum: ++this._dogum, ornek: g.soz,
      });
      return { tur: "dogdu", beceri: id, gorev: g.kimlik };
    }
    b.sayac[g.sonuc]++;
    b.kanit.push(g.kimlik);
    return { tur: g.sonuc, beceri: id, gorev: g.kimlik };
  }

  /** Bu söz için parametre içinde eşleşen beceri; yoksa ya da emin değilse null. */
  karar(soz: string): BeceriEslesmesi | null {
    const a = sozAnahtari(soz);
    if (!a) return null;
    const cerceve = a.cerceve.join(" ");
    let en: Beceri | null = null;
    for (const b of this._beceriler) {
      if (b.cerceve.join(" ") !== cerceve || b.yuvaSayisi !== a.yuvalar.length || pay(b) < this._guvenPayi) continue;
      if (!en || b.sayac.basari > en.sayac.basari || (b.sayac.basari === en.sayac.basari && b.dogum > en.dogum)) en = b;
    }
    if (!en) return null;
    return { beceri: en, adimlar: doldur(en.adimlar, en.baglar, (bag) => a.yuvalar[bag.yuva]!), pay: pay(en) };
  }
}

/** Hafızayı görevlerden kurar: zaman sırasıyla, eşitlikte liste sırasıyla (defter ilkesi). */
export function beceriHafizasiKur(gorevler: readonly GorevOrnegi[], ayar?: BeceriHafizasiAyari): BeceriHafizasi {
  const h = new BeceriHafizasi(ayar);
  for (const g of zamanSirali(gorevler)) h.ogren(g);
  return h;
}
