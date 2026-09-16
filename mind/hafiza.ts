// mind/hafiza.ts — Orion'un hatırladıkları.
//
// SORUN: bugüne kadar bellek `Kopru._gecmis` içinde SABİT 12 turluk bir
// pencereydi. 13. turda ilk tur sessizce düşüyordu — Ozyn ne dediyse, Orion
// neyi başaramadıysa, hepsi. Odada yaşadığı iddia edilen bir varlık için
// bu, her birkaç dakikada bir hafıza kaybı demek.
//
// KAYNAK: Generative Agents (Park ve ark., arXiv:2304.03442). Formül ve
// sabitler makalenin HTML tam metninden BİREBİR doğrulandı (2026-09-12):
//   score = α_recency·recency + α_importance·importance + α_relevance·relevance
//   "all α's set to 1", skorlar min-max ile [0,1]'e normalize edilir
//   recency: üstel bozulma, "Our decay factor is 0.995", son ERİŞİMDEN beri
//   relevance: "cosine similarity between the memory's embedding vector and
//              the query memory's embedding vector"
//
// BİLİNÇLİ SAPMA — ilgi ölçümü: makale gömme (embedding) kullanıyor. Burada
// varsayılan ucuz bir kelime örtüşmesi; gömme TAKILABİLİR (`ilgiOlcer`).
// Sebep bu oturumun tekrar eden dersi: önce ucuz taban çizgisini kur ve ölç,
// pahalı olanı ancak ÖLÇÜMDE kazanırsa al (270M refleks modeli tam da bu
// yüzden elendi). `nomic-embed-text` kurulu; kıyas ölçümü ayrı iş.
//
// SAF: Babylon yok, ağ yok, zaman dışarıdan verilir.
"use strict";

export type AniTuru = "konusma" | "olay" | "terminal" | "sonuc" | "dusunce";

export interface Ani {
  metin: string;
  tur: AniTuru;
  /** 1-10. Yüksek = daha çarpıcı, daha uzun yaşar. */
  onem: number;
  /** Oluşma anı (ms). */
  olusma: number;
  /** Son ERİŞİM anı (ms) — recency bundan hesaplanır, oluşmadan değil. */
  sonErisim: number;
}

export interface HafizaAyari {
  /** Bu sayıyı aşınca en düşük skorlular atılır. */
  kapasite?: number;
  /** Kelime örtüşmesi yerine gömme kullanmak isteyen buraya takar. */
  ilgiOlcer?: (sorgu: string, ani: string) => number;
  simdi?: () => number;
}

/** Doğrulanmış sabit: "Our decay factor is 0.995" (saat başına). */
export const BOZULMA = 0.995;

/** Türkçe/İngilizce çok geçen, ayırt etmeyen kelimeler. */
const DOLGU = new Set([
  "bir", "bu", "şu", "o", "ve", "ile", "için", "ama", "da", "de", "mi", "mı",
  "ne", "çok", "daha", "gibi", "the", "a", "an", "and", "or", "to", "of", "in",
  "is", "it", "that", "this", "for", "on", "with",
]);

/** Metni karşılaştırılabilir kelime kümesine indirger. */
export function kelimeler(metin: string): Set<string> {
  const k = metin
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}_./-]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !DOLGU.has(w));
  return new Set(k);
}

/**
 * Varsayılan ilgi ölçüsü: Jaccard benzerliği (kesişim / birleşim).
 *
 * Gömme DEĞİL — ve bu bilinçli. Sınırı açık: eşanlamlıyı yakalayamaz
 * ("terminal" ile "kabuk" ilgisiz görünür). Kıyas ölçümü yapılana kadar
 * taban çizgisidir, nihai cevap değil.
 */
export function kelimeIlgisi(sorgu: string, ani: string): number {
  const a = kelimeler(sorgu), b = kelimeler(ani);
  if (a.size === 0 || b.size === 0) return 0;
  let kesisim = 0;
  for (const w of a) if (b.has(w)) kesisim++;
  return kesisim / (a.size + b.size - kesisim);
}

/** [0,1] aralığına min-max normalize — makaledeki adım. */
function normalize(x: number[]): number[] {
  if (x.length === 0) return x;
  const enAz = Math.min(...x), enCok = Math.max(...x);
  const aralik = enCok - enAz;
  // Hepsi eşitse normalize etmek anlamsız; 1 vererek bileşeni etkisiz bırak.
  if (aralik < 1e-9) return x.map(() => 1);
  return x.map((v) => (v - enAz) / aralik);
}

export interface GetirSonucu {
  ani: Ani;
  skor: number;
  /** Bileşenler — "neden bu anı seçildi" sorusu cevapsız kalmasın. */
  parca: { tazelik: number; onem: number; ilgi: number };
}

export class Hafiza {
  private _aniler: Ani[] = [];
  private _kapasite: number;
  private _ilgiOlcer: (sorgu: string, ani: string) => number;
  private _simdi: () => number;
  /** Reflection eşiği için biriken önem (Generative Agents: eşik 150). */
  private _birikenOnem = 0;

  constructor(ayar: HafizaAyari = {}) {
    this._kapasite = ayar.kapasite ?? 300;
    this._ilgiOlcer = ayar.ilgiOlcer ?? kelimeIlgisi;
    this._simdi = ayar.simdi ?? (() => Date.now());
  }

  get sayi(): number { return this._aniler.length; }
  get birikenOnem(): number { return this._birikenOnem; }

  /** Anıyı kaydet. Aynı metin tekrar gelirse yenisi eklenmez, tazelenir. */
  ekle(metin: string, tur: AniTuru, onem: number): void {
    const temiz = metin.trim();
    if (!temiz) return;
    const t = this._simdi();
    const mevcut = this._aniler.find((a) => a.metin === temiz);
    if (mevcut) {
      // Tekrar eden olay yeni anı değildir; var olanı tazeler ve önemini
      // yükseltir — üç kez olan bir şey bir kez olandan daha kayda değer.
      mevcut.sonErisim = t;
      mevcut.onem = Math.min(10, mevcut.onem + 1);
      return;
    }
    const o = Math.max(1, Math.min(10, Math.round(onem)));
    this._aniler.push({ metin: temiz, tur, onem: o, olusma: t, sonErisim: t });
    this._birikenOnem += o;
    this._budama();
  }

  /**
   * Sorguyla en ilgili N anıyı getirir ve onları TAZELER (son erişim güncellenir).
   * Tazeleme makalenin recency tanımı gereği: "recently accessed".
   */
  getir(sorgu: string, adet = 5, haric: readonly string[] = []): GetirSonucu[] {
    if (this._aniler.length === 0) return [];
    const t = this._simdi();

    // ŞU ANKİ girdi hatırlanamaz — o zaten önümüzde. `haric` bu turda
    // eklenen metinlerdir ve ÇAĞIRAN tarafından AÇIKÇA verilir.
    //
    // Bir tasarım hatasından doğdu: köprü algıyı önce hafızaya yazıp sonra
    // sorgu olarak kullanıyordu; "şifrem neydi" sorusu kendisini mükemmel
    // ilgi + mükemmel tazelikle ilk sıradan getirip asıl aranan eski anıyı
    // listeden dışarı itiyordu.
    //
    // İlk düzeltme `sorgu.includes(a.metin)` idi — ÇOK GENİŞTİ: sorgunun
    // meşru olarak andığı bir anıyı da eliyor ve onu asla tazelemiyordu.
    // Çıkarım yerine açık dışlama: çağıran bu turda ne eklediğini bilir.
    const haricKume = new Set(haric.map((h) => h.trim()));
    const adaylar = haricKume.size
      ? this._aniler.filter((a) => !haricKume.has(a.metin))
      : this._aniler;
    if (adaylar.length === 0) return [];

    const ham = adaylar.map((a) => ({
      a,
      tazelik: Math.pow(BOZULMA, (t - a.sonErisim) / 3_600_000), // saat cinsinden
      onem: a.onem,
      ilgi: this._ilgiOlcer(sorgu, a.metin),
    }));

    const nT = normalize(ham.map((h) => h.tazelik));
    const nO = normalize(ham.map((h) => h.onem));
    const nI = normalize(ham.map((h) => h.ilgi));

    const sonuc: GetirSonucu[] = ham.map((h, i) => ({
      ani: h.a,
      // Tüm α = 1 (makalede birebir böyle).
      skor: (nT[i] ?? 0) + (nO[i] ?? 0) + (nI[i] ?? 0),
      parca: { tazelik: nT[i] ?? 0, onem: nO[i] ?? 0, ilgi: nI[i] ?? 0 },
    }));

    sonuc.sort((x, y) => y.skor - x.skor);
    const secilen = sonuc.slice(0, Math.max(0, adet));
    for (const s of secilen) s.ani.sonErisim = t;
    return secilen;
  }

  /** Reflection zamanı geldi mi? Eşik makaleden: biriken önem 150. */
  yansimaGerek(esik = 150): boolean { return this._birikenOnem >= esik; }
  /** Yansıma yapıldı; sayaç sıfırlanır. */
  yansimaYapildi(): void { this._birikenOnem = 0; }

  /** Tanılama: en yeni N anı (skorlamadan bağımsız). */
  sonAniler(adet = 10): Ani[] {
    return this._aniler.slice(-adet).reverse();
  }

  /** Kapasite aşılınca EN DÜŞÜK skorlular atılır — kör FIFO değil. */
  private _budama(): void {
    if (this._aniler.length <= this._kapasite) return;
    const t = this._simdi();
    const puan = (a: Ani) =>
      Math.pow(BOZULMA, (t - a.sonErisim) / 3_600_000) + a.onem / 10;
    this._aniler.sort((x, y) => puan(y) - puan(x));
    this._aniler.length = this._kapasite;
    // Sıra bozuldu; oluşma sırasına geri döndür (sonAniler anlamlı kalsın).
    this._aniler.sort((x, y) => x.olusma - y.olusma);
  }
}

/**
 * Kural tabanlı önem (1-10).
 *
 * Makale bunu LLM'e sordurur ("rate the likely poignancy ... on a scale of
 * 1 to 10"). Burada kural kullanılıyor çünkü sinyaller ZATEN elimizde:
 * çıkış kodu, algı türü, konuşma. Her anı için bir LLM turu ödemek, ölçülmüş
 * bir fayda olmadan kabul edilemez — 270M refleks modeli tam olarak bu
 * gerekçeyle elenmişti. Gömme/LLM sürümü takılabilir ve kıyaslanabilir.
 */
export function kuralOnemi(tur: AniTuru, metin: string, kod?: number): number {
  if (tur === "konusma") return 8;               // Ozyn'in söyledikleri
  if (tur === "sonuc") return 6;                 // yapamadığı şeyler öğretici
  if (tur === "terminal") {
    if (kod !== undefined && kod !== 0) return 7; // gerçek başarısızlık
    if (/\b(pass(ed)?\s+\d+|tests?\s+\d+|built in)\b/i.test(metin)) return 5;
    return 2;
  }
  if (tur === "olay") return 4;
  return 3;
}
