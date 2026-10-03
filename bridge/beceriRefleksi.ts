// bridge/beceriRefleksi.ts — YETKİLİ BECERİ REFLEKSİ: kesin bir söz LLM'e sorulmadan öğrenilmiş bir
// becerinin adımlarıyla yürür (spec 10, Faz D; spec 14 R7'de bridge/kopru.ts'ten ayrıldı, davranış aynı).
//
// Durum makinesi: önce onay jesti (adım değildir, sonucu beklenmez), sonra adımlar sırayla — her biri
// öncekinin `bitti`ini bekler. `hata` ve zaman aşımı refleksi bitirir ve söz LLM'e döner (B13);
// `iptal` (yeni bir emir adımı geçti) ve kesilme sessizdir. Kalan adımlar gönderilmez.
// Eylem sırasıyla (bridge/eylemSirasi.ts) aynı desen; köprüye bağı yalnız geri çağrılardır:
// gönderim, kayıt satırı, LLM'e geri verme. Sözün kayda/anıya yazılması köprüde kalır.
"use strict";
import type { Niyet, NiyetSonucu } from "../protocol/niyet.ts";
import { kimlik } from "../protocol/temel.ts";
import { niyetDogrula } from "../protocol/dogrula.ts";
import { niyetKaydi, type NiyetKaydi, type RefleksBitisi, type RefleksSatiri } from "../mind/kararKaydi.ts";
import { REFLEKS_ONEKI, REFLEKS_ONAYI } from "./kopruTurleri.ts";

/** Refleksi başlatan söz ve beceri. */
export interface RefleksBaslangici {
  /** Söz algısının kayıttaki kimliği. */
  algi: string;
  soz: string;
  ozet: string;
  beceri: string;
  adimlar: readonly Niyet[];
}

/** Başarısız refleksin LLM'e geri verdiği. */
export interface RefleksGeriVerme {
  algi: string;
  soz: string;
  ozet: string;
  /** Durduğu adımın türü. */
  adim: string;
  /** İngilizce, modele giden neden. */
  neden: string;
}

export interface BeceriRefleksiAyari {
  /** Niyeti dünyaya gönderir (köprünün tek çıkışı; köprü niyet sayacını burada sayar). */
  gonder(n: Niyet, id: string): void;
  /** Bir adımın sonucu en çok bu kadar beklenir (ms). Her adımda okunur. */
  zamanAsimiMs(): number;
  /** Bitişte refleks satırı (mind/kararKaydi.ts `refleks`). */
  satirYaz(b: Omit<RefleksSatiri, "tur" | "o" | "id" | "t">): void;
  /** Hata ya da zaman aşımı: söz LLM'e döner. */
  geriVer(g: RefleksGeriVerme): void;
}

/** Süren bir refleks turu. */
interface SurenRefleks extends RefleksBaslangici {
  /** Sıradaki adımın indeksi. */
  sira: number;
  /** Sonucu beklenen adımın niyet kimliği. */
  bekleyen: string | null;
  onay?: NiyetKaydi;
  /** Gönderilen adımlar (doğrulanmış halleriyle), sırayla. */
  gonderilen: NiyetKaydi[];
  baslangic: number;
  zamanlayici: ReturnType<typeof setTimeout> | null;
}

export class BeceriRefleksi {
  private _a: BeceriRefleksiAyari;
  private _r: SurenRefleks | null = null;

  constructor(a: BeceriRefleksiAyari) { this._a = a; }

  /** Bir refleks sürüyor mu. */
  get suruyor(): boolean { return this._r !== null; }

  /** Onay jestini gönderir, ilk adımı başlatır. */
  baslat(b: RefleksBaslangici): void {
    const r: SurenRefleks = { ...b, sira: 0, bekleyen: null, gonderilen: [], baslangic: Date.now(), zamanlayici: null };
    this._r = r;
    const onay = niyetDogrula(REFLEKS_ONAYI);
    if (onay.ok) {
      const id = kimlik(REFLEKS_ONEKI);
      r.onay = niyetKaydi(id, onay.deger);
      this._a.gonder(onay.deger, id);
    }
    this._adim();
  }

  /**
   * Refleks niyetinin sonucu: beklenen adımınsa refleksi ilerletir. Onay jestinin ya da
   * kesilmiş bir adımın geç gelen sonucu yalnız kayıtta kalır.
   */
  sonuc(s: NiyetSonucu): void {
    const r = this._r;
    if (!r || s.niyet_id !== r.bekleyen || s.durum === "basladi") return;
    if (r.zamanlayici) { clearTimeout(r.zamanlayici); r.zamanlayici = null; }
    r.bekleyen = null;
    if (s.durum === "bitti") { r.sira++; this._adim(); }
    else if (s.durum === "hata") this.bitir("hata", s.not);
    else this.bitir("kesildi");   // iptal: yeni bir emir adımı geçti
  }

  /**
   * Refleksi bitirir ve satırını yazar; süren refleks yoksa bir şey yapmaz.
   *
   * Başarı ve kesilme sessizdir. Hata ve zaman aşımında söz LLM'e döner (B13): köprü onu
   * konuşma geçmişine ve tampona koyar, sebebi geri besleme olarak yanına; LLM hemen uyanır
   * ve görevi kendisi yapar. Kalan adımlar gönderilmez.
   */
  bitir(bitis: RefleksBitisi, sebep?: string): void {
    const r = this._r;
    if (!r) return;
    this._r = null;
    if (r.zamanlayici) clearTimeout(r.zamanlayici);
    this._a.satirYaz({
      algi: r.algi, beceri: r.beceri, ...(r.onay ? { onay: r.onay } : {}),
      niyetler: r.gonderilen, bitis, sureMs: Date.now() - r.baslangic,
    });
    console.log(`[BECERI] refleks bitti: ${bitis}${sebep ? ` (${sebep})` : ""}`);
    if (bitis === "basari" || bitis === "kesildi") return;
    this._a.geriVer({
      algi: r.algi, soz: r.soz, ozet: r.ozet,
      adim: r.gonderilen.at(-1)?.tur ?? "?",
      neden: bitis === "zaman_asimi" ? "no result in time" : (sebep ?? "failed"),
    });
  }

  /**
   * Sıradaki adımı DOĞRULAYIP gönderir (tek yol: `gonder`; doğrulayıcı atlanmaz — adım
   * kayıttan geliyor). Adım kalmadıysa refleks başarıyla biter. Beklenen kimlik ve zaman
   * aşımı GÖNDERMEDEN ÖNCE kurulur: dünya sonucu senkron verirse de yakalansın.
   */
  private _adim(): void {
    const r = this._r;
    if (!r) return;
    const n = r.adimlar[r.sira];
    if (!n) { this.bitir("basari"); return; }
    const d = niyetDogrula(n);
    if (!d.ok) { this.bitir("hata", `step "${n.tur}" is not valid: ${d.hata}`); return; }
    const id = kimlik(REFLEKS_ONEKI);
    r.bekleyen = id;
    r.gonderilen.push(niyetKaydi(id, d.deger));
    r.zamanlayici = setTimeout(() => this.bitir("zaman_asimi"), this._a.zamanAsimiMs());
    this._a.gonder(d.deger, id);
  }
}
