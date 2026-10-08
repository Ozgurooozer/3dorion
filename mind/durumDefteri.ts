// mind/durumDefteri.ts — Orion'un KALICI "şu an" bilgisi (spec 16 F2). Saf.
//
// Spec 12'nin katmanları ömre göreydi: ANLIK (benlik, çalışma belleği) oturumla ölür, DERİN (anılar)
// yalnız olanı biriktirir. Arada bir boşluk vardı: "neredesin", "neredeydin", "ne yapıyorsun",
// "en son ne konuştuk" sorularının cevabı ya oturumla kayboluyor ya hiç tutulmuyordu — yer yalnız
// ham koordinattı ("position 0.9,-1.2").
//
// DEFTER: anahtar başına TEK satır, ÜZERİNE YAZILIR (spec 06 K2: durum ≠ anı — anı birikir, durum
// değişir), her satır zamanıyla (K3: yaş her satırda yazılır, bayat bilgi "şimdi" diye sunulmaz).
// Diske yazılır, oturumlar arası kalır. Güncelleme olaylardan gelir; model UYANMAZ.
//
// BAĞLAMA GİRMESİ: yalnız yönlendirici o anahtarı isterse (spec 16 K2, mind/hafizaYonlendirici.ts).
// Defterin kendisi kimsenin bağlamına bir şey koymaz; `satirlar` istenen anahtarların metnidir.
//
// KONUM GÜRÜLTÜSÜ: yürürken çapaların yanından geçmek "konum" değildir. Yeni yer, en az
// `KONUM_OTURMA_MS` boyunca aynı kalınca konum olur; eski konum `onceki_konum`a kayar.
"use strict";
import { oncesiSozu } from "./zaman.ts";

export const DURUM_ANAHTARLARI = ["konum", "onceki_konum", "yapiyor", "son_is", "son_ozyn", "son_orion", "monitor"] as const;
export type DurumAnahtari = typeof DURUM_ANAHTARLARI[number];

/** Bağlama istenebilenler: defterin anahtarları + önceki oturumun bitişi (yüklemeden türer, yazılmaz). */
export type DurumIstegi = DurumAnahtari | "onceki_oturum";

/** Defterin bir satırı. `t`: değerin GEÇERLİ olmaya başladığı an (konumda "ne zamandan beri"). */
export interface DurumKaydi { anahtar: DurumAnahtari; deger: string; t: number }

/** Yeni yerin konum sayılması için orada kalma süresi (ms). Yanından geçmek konum değildir. */
export const KONUM_OTURMA_MS = 2_000;
/** Söz satırlarının kesildiği uzunluk (bağlam küçük kalsın). */
export const SOZ_SINIRI = 140;

export interface DurumDefteriAyari {
  simdi?: () => number;
  /** Önceki oturumlardan okunan satırlar (doğrulanmamış; bozuk satır atlanır). */
  kayitlar?: readonly unknown[];
  /** Bir satır değişince (yazım için; köprü kısarak diske yazar). Hatası defteri durdurmaz. */
  degisti?: () => void;
}

const kes = (m: string) => (m.length > SOZ_SINIRI ? m.slice(0, SOZ_SINIRI - 1) + "…" : m);

export class DurumDefteri {
  private _simdi: () => number;
  private _degisti: () => void;
  private _s = new Map<DurumAnahtari, DurumKaydi>();
  private _aday: { ad: string; t: number } | null = null;
  /** Yüklenen satırların en yenisi: önceki oturumun son hareketi. */
  readonly oncekiOturumSonu: number | null;

  constructor(a: DurumDefteriAyari = {}) {
    this._simdi = a.simdi ?? (() => Date.now());
    this._degisti = a.degisti ?? (() => {});
    let son: number | null = null;
    for (const h of a.kayitlar ?? []) {
      const k = h as Partial<DurumKaydi>;
      if (!k || typeof k.deger !== "string" || typeof k.t !== "number" || !Number.isFinite(k.t)) continue;
      if (!(DURUM_ANAHTARLARI as readonly string[]).includes(k.anahtar as string)) continue;
      const t = Math.min(k.t, this._simdi());
      this._s.set(k.anahtar as DurumAnahtari, { anahtar: k.anahtar as DurumAnahtari, deger: k.deger, t });
      son = son === null ? t : Math.max(son, t);
    }
    // "Yapıyorum" oturumla biter: kapanırken süren iş artık sürmüyor. Yanlış "şimdi" olmasın.
    this._s.delete("yapiyor");
    this.oncekiOturumSonu = son;
  }

  oku(anahtar: DurumAnahtari): DurumKaydi | undefined { return this._s.get(anahtar); }
  /** Diske yazılacak hâl. */
  kayitlar(): DurumKaydi[] { return [...this._s.values()].map((k) => ({ ...k })); }

  private _yaz(anahtar: DurumAnahtari, deger: string, t = this._simdi()): void {
    const eski = this._s.get(anahtar);
    if (eski && eski.deger === deger) return;
    this._s.set(anahtar, { anahtar, deger, t });
    try { this._degisti(); } catch (err) { console.warn("[DURUM] yazim dinleyicisi hatasi:", err); }
  }

  /**
   * Bedenin şu an yanında olduğu yerin adı (çapa etiketi ya da "odanın ortası"). Sık çağrılabilir:
   * yer, `KONUM_OTURMA_MS` aynı kalınca konum olur; değişince eskisi `onceki_konum`a kayar.
   */
  konumGozlem(ad: string): void {
    const t = this._simdi();
    if (!this._aday || this._aday.ad !== ad) this._aday = { ad, t };
    const mevcut = this._s.get("konum");
    if (mevcut?.deger === ad || t - this._aday.t < KONUM_OTURMA_MS) return;
    if (mevcut) this._yaz("onceki_konum", mevcut.deger, this._aday.t);
    this._yaz("konum", ad, this._aday.t);
  }

  /** Bir iş başladı (niyet özeti, ör. "git → beyaz tahta"). */
  isBasladi(ozet: string): void { this._yaz("yapiyor", ozet); }

  /** İş bitti: "yapıyor" düşer (bu işse), "son iş" sonucuyla yazılır. */
  isBitti(ozet: string, sonuc: string): void {
    if (this._s.get("yapiyor")?.deger === ozet) { this._s.delete("yapiyor"); }
    this._yaz("son_is", `${ozet} → ${sonuc}`);
  }

  ozynDedi(metin: string): void { this._yaz("son_ozyn", kes(metin.trim())); }
  orionDedi(metin: string): void { this._yaz("son_orion", kes(metin.trim())); }
  monitor(acik: boolean): void { this._yaz("monitor", acik ? "open" : "closed"); }

  /**
   * İstenen anahtarların bağlam satırları — İngilizce çerçeve, Türkçe adlar (spec 06 §6.8), her
   * satır yaşıyla. Değeri olmayan anahtar satır üretmez (uydurma "bilmiyorum" satırı yok).
   */
  satirlar(anahtarlar: readonly DurumIstegi[]): string[] {
    const simdi = this._simdi();
    const yas = (k: DurumKaydi) => oncesiSozu(simdi - k.t);
    const out: string[] = [];
    for (const a of anahtarlar) {
      if (a === "onceki_oturum") {
        if (this.oncekiOturumSonu !== null) out.push(`Your previous session in this room ended ${oncesiSozu(simdi - this.oncekiOturumSonu)}.`);
        continue;
      }
      const k = this._s.get(a);
      if (!k) continue;
      switch (a) {
        case "konum": out.push(`You are at: ${k.deger} (arrived ${yas(k)}).`); break;
        case "onceki_konum": out.push(`Before that you were at: ${k.deger} (left ${yas(k)}).`); break;
        case "yapiyor": out.push(`You are doing: ${k.deger} (started ${yas(k)}).`); break;
        case "son_is": out.push(`The last thing you did: ${k.deger} (${yas(k)}).`); break;
        case "son_ozyn": out.push(`Ozyn's last words to you (${yas(k)}): "${k.deger}"`); break;
        case "son_orion": out.push(`Your last words (${yas(k)}): "${k.deger}"`); break;
        case "monitor": out.push(`Your terminal is ${k.deger} (changed ${yas(k)}).`); break;
      }
    }
    return out;
  }
}
