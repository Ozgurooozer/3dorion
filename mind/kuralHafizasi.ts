// mind/kuralHafizasi.ts — BÜYÜYEN KURAL HAFIZASI: deneyimden doğan, okunur, istisnalı kurallar.
//
// Ozyn'in modeli (2026-09-26): "Hafıza demek yeni nöronlar, sinapslar demek.
// Ana bir bölge var, kuralları hiç değişmiyor; etrafında yeni kurallar ekleniyor."
// Ana bölge içgüdülerdir (mind/icgudu.ts). Bu modül etrafında büyüyen kısım:
// her HAFIZA NÖRONU bir kuraldır ve deneyimden doğar.
//
//   nöron = { koşul: işaret kümesi (mind/durumKodu.ts), sayaç: {uyan, sus},
//             kanıt: onu doğuran ve besleyen deneyimlerin kimlikleri }
//
// KARAR: koşulu algının kodunda TAMAMEN bulunan nöronlardan EN ÖZGÜLÜ (en çok
// koşullu) karar verir. Sayacının çoğunluğu GUVEN_PAYI'nı geçmiyorsa karar yok:
// kapı içgüdüye bırakır. İstisna nöronları genel kuraldan daha özgül olduğu için
// kendi durumlarında onu ezer; genel kural silinmez.
//
// ÖĞRENME (öğretmenin bir kararıyla, TEK DENEMEDE):
//   1. Algının kodu bir nöronun koşuluyla BİREBİR aynıysa: aynı durumdur, o
//      nöronun sayacı artar.
//   2. Değilse benzer bir nöron aranır (ARTMAP, Carpenter, Grossberg ve Reynolds
//      1991). Benzerlik = ortak işaretlerin algının işaretlerine oranı; eşik
//      UYANIKLIK. Kararı aynı olan benzer nöron GENELLEŞİR: koşulu ortak
//      işaretlere iner.
//   3. Kararı çelişen benzer nöron atlanır ve eşik o benzerliğin üstüne çıkar
//      (eşleşme takibi): arama daha benzer bir nöronda sürer ya da biter.
//   4. Bulunamazsa YENİ NÖRON DOĞAR: koşulu algının tüm kodudur.
//
// Neden ağırlık değil kural: brain-lab'in dersi (A3): yavaş, dağıtık kredi
// öğrenmesi tıkandı; büyüyen hafıza (A2) çalıştı. Kural okunabilir de:
// "K7: tur:sonuc ∧ durum:hata ∧ niyet_kaynagi:elle → sus (3/3), doğdu a14".
// Sinekte de bir koku bir sonuçla tek denemede eşleşir (Tully ve Quinn 1985).
//
// Bağımlılık: yok. Saf, belirlenimci: aynı olay dizisi → aynı hafıza.
"use strict";

export type KapiYonu = "uyan" | "sus";

export interface HafizaNoronu {
  /** "K1", "K2"… doğum sırasıyla, asla yeniden kullanılmaz. */
  id: string;
  /** Kuralın koşulu: sıralı işaret listesi. */
  kosul: string[];
  /** Bu nöronda buluşan öğretmen kararları. */
  sayac: Record<KapiYonu, number>;
  /** Nöronu doğuran ve besleyen deneyimlerin kimlikleri (karar kaydı / akış). */
  kanit: string[];
  /** Kaçıncı öğrenme olayında doğdu. */
  dogum: number;
}

export type HafizaOlayi =
  | { tur: "dogdu"; noron: string; kosul: string[]; yon: KapiYonu; deneyim: string }
  | { tur: "tekrar"; noron: string; yon: KapiYonu; deneyim: string }
  | { tur: "genelledi"; noron: string; once: string[]; sonra: string[]; yon: KapiYonu; deneyim: string };

export interface HafizaKarari {
  yon: KapiYonu;
  noron: HafizaNoronu;
  /** Çoğunluğun payı (0,5–1). */
  pay: number;
}

export interface KuralHafizasiAyari {
  /** Benzerlik eşiği: ortak işaret / algının işareti. Varsayılan 0,5. */
  uyaniklik?: number;
  /** Seçim fonksiyonundaki α: |ortak| / (α + |koşul|). Varsayılan 0,5. */
  alfa?: number;
  /** Genelleşmede koşul bundan aza inmez. Varsayılan 2 (tür + içgüdü). */
  enAzKosul?: number;
  /** Kararın geçerli sayılması için çoğunluğun asgari payı. Varsayılan 0,75. */
  guvenPayi?: number;
  /**
   * KARAR ANINDA KAPSAMA (H-K1, defter 2026-09-27): kararı veren kuralın koşulu
   * algının işaretlerinin en az bu kadarını kapsamalı. Varsayılan 0: yalnızca
   * "koşul algıda var mı" sorulur (eski davranış, birebir).
   *
   * Neden: çevrimdışı kıyasta kesişimle küçülen kurallar pek çok YENİ durumla
   * tam eşleşti ve orada sınıf oranı düzeyinde karar verdi (aşırı genelleme).
   */
  kapsamaEsigi?: number;
}

const kesisim = (a: ReadonlySet<string>, b: readonly string[]): string[] => b.filter((x) => a.has(x));

export class KuralHafizasi {
  private _noronlar: HafizaNoronu[] = [];
  private _olaySayisi = 0;
  private _uyaniklik: number;
  private _alfa: number;
  private _enAzKosul: number;
  private _guvenPayi: number;
  private _kapsamaEsigi: number;

  constructor(ayar: KuralHafizasiAyari = {}) {
    this._uyaniklik = ayar.uyaniklik ?? 0.5;
    this._alfa = ayar.alfa ?? 0.5;
    this._enAzKosul = ayar.enAzKosul ?? 2;
    this._guvenPayi = ayar.guvenPayi ?? 0.75;
    this._kapsamaEsigi = ayar.kapsamaEsigi ?? 0;
  }

  get noronlar(): readonly HafizaNoronu[] { return this._noronlar; }

  /** Koşulu kodda tamamen bulunan en özgül nöron (eşitlikte daha çok kanıtlı, sonra daha yaşlı). */
  private _enOzgul(kod: ReadonlySet<string>): HafizaNoronu | null {
    let en: HafizaNoronu | null = null;
    for (const n of this._noronlar) {
      if (!n.kosul.every((x) => kod.has(x))) continue;
      if (!en
        || n.kosul.length > en.kosul.length
        || (n.kosul.length === en.kosul.length && n.kanit.length > en.kanit.length)) en = n;
    }
    return en;
  }

  /** Bu kodlu algı için hafızanın kararı; emin değilse null (kapı içgüdüye bırakır). */
  karar(kod: readonly string[]): HafizaKarari | null {
    if (kod.length === 0) return null;
    const n = this._enOzgul(new Set(kod));
    if (!n) return null;
    // En özgül kural kapsamayı geçemiyorsa daha genel olanlar hiç geçemez.
    if (n.kosul.length / new Set(kod).size < this._kapsamaEsigi) return null;
    const toplam = n.sayac.uyan + n.sayac.sus;
    if (toplam === 0) return null;
    const yon: KapiYonu = n.sayac.uyan >= n.sayac.sus ? "uyan" : "sus";
    const pay = Math.max(n.sayac.uyan, n.sayac.sus) / toplam;
    return pay >= this._guvenPayi ? { yon, noron: n, pay } : null;
  }

  /** Öğretmenin bir kararından tek denemede öğrenir. Olanları olay listesi olarak döner. */
  ogren(kod: readonly string[], yon: KapiYonu, deneyim: string): HafizaOlayi[] {
    if (kod.length === 0) return [];
    this._olaySayisi++;
    const I = new Set(kod);
    const sirali = [...I].sort();

    // 1) Aynı durum: koşulu birebir aynı nöron.
    const ayni = this._noronlar.find((n) => n.kosul.length === sirali.length && n.kosul.every((x, i) => x === sirali[i]));
    if (ayni) {
      ayni.sayac[yon]++;
      ayni.kanit.push(deneyim);
      return [{ tur: "tekrar", noron: ayni.id, yon, deneyim }];
    }

    // 2–3) Benzer nöron araması, eşleşme takibiyle.
    let esik = this._uyaniklik;
    const adaylar = this._noronlar
      .map((n) => ({ n, ortak: kesisim(I, n.kosul) }))
      .filter((a) => a.ortak.length > 0)
      .sort((a, b) =>
        b.ortak.length / (this._alfa + b.n.kosul.length) - a.ortak.length / (this._alfa + a.n.kosul.length)
        || b.n.kosul.length - a.n.kosul.length
        || a.n.dogum - b.n.dogum);
    for (const { n, ortak } of adaylar) {
      const benzerlik = ortak.length / I.size;
      if (benzerlik < esik) continue;
      const nYon: KapiYonu = n.sayac.uyan >= n.sayac.sus ? "uyan" : "sus";
      if (nYon !== yon || ortak.length < this._enAzKosul) {
        // Eşleşme takibi: bu kadar benzer olan yanlış çıktı; daha benzerini ara.
        esik = benzerlik + 1e-9;
        continue;
      }
      const once = n.kosul;
      n.kosul = ortak;
      n.sayac[yon]++;
      n.kanit.push(deneyim);
      return [{ tur: "genelledi", noron: n.id, once, sonra: ortak, yon, deneyim }];
    }

    // 4) Yeni nöron.
    const noron: HafizaNoronu = {
      id: `K${this._noronlar.length + 1}`,
      kosul: sirali,
      sayac: { uyan: yon === "uyan" ? 1 : 0, sus: yon === "sus" ? 1 : 0 },
      kanit: [deneyim],
      dogum: this._olaySayisi,
    };
    this._noronlar.push(noron);
    return [{ tur: "dogdu", noron: noron.id, kosul: sirali, yon, deneyim }];
  }
}
