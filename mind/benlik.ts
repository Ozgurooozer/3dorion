// mind/benlik.ts — ANLIK BENLİK: "şu an ne yapıyorum, neyi bekliyorum" (spec 12 Faz 1–2,
// spec 13 Faz 4'te taşındı).
//
// Orion'un düşünce öncesi birimleri (algı, süzgeç, refleks, dikkat, hafıza) bugün
// Orion'un kendisinden habersiz karar veriyor (spec 12 §2, B1–B8). Bu dosya onlara tek,
// ucuz (0 token), yazılı bir kayıt verir. Bir KİŞİLİK değil, bir GÖSTERGE PANELİDİR:
// yalnız GÖZLENEN yazılır (gönderilen niyet, dönen sonuç, ölçülen poz) — "neden yaptım"
// çıkarımı yok, ruh hâli yok (spec 12 §3.1 uyarısı).
//
// KURALLAR (spec 12 §4.2, testli):
//   - Her alanın tek yazıcısı var: köprü (niyet, sonuç, düşünce, söz); gövde ÇEKİLİR
//     (`beden()`), 20 Hz yazılmaz.
//   - Her alanın azami yaşı var: sonucu hiç dönmeyen niyet sonsuza dek "yapıyorum"da
//     kalmaz → BOŞA ÇIKTI geçişi.
//   - KALICI DEĞİL: diske, kayda, hafızaya yazılmaz (ANLIK katman). Derine yalnız uç
//     geçişler çöker — o Faz 6 (spec 12), burada yok.
//   - `tik` yolunda okunmaz da yazılmaz da (köprü `tik`i özetten önce eler).
//
// Bağımlılık: protocol/. Saf (saat dışarıdan).
"use strict";
import type { Niyet, NiyetSonucu, NiyetTur } from "../protocol/niyet.ts";
import type { Algi } from "../protocol/algi.ts";

/** Gövdenin çekilen anlık okuması. */
export interface BedenOkumasi {
  poz: string;
  oturuyor: boolean;
}

/** Bir algının ya da niyetin faili (spec 12 §4.3 ALGI merceği). */
export type Eden = "ben" | "ozyn" | "ortak" | "dunya";

export interface SurenNiyet { id: string; tur: NiyetTur; ozet: string; eden: Eden; basladi: number }
export interface Bekleme { ne: "onay" | "komut_sonucu"; niyet: string; ozet: string; basladi: number }
export interface BitenNiyet { id: string; tur: NiyetTur; ozet: string; durum: "bitti" | "hata" | "iptal" | "bosa_cikti"; an: number; not?: string }

export interface BenlikGoruntusu {
  an: number;
  beden: BedenOkumasi | null;
  yapiyorum: readonly SurenNiyet[];
  bekliyorum: Bekleme | null;
  dusunce: { uyanik: boolean; beyin: string; koken: "dis" | "inisiyatif" };
  son: { soz?: { metin: string; an: number }; bitenNiyet?: BitenNiyet };
}

/** Azami yaşlar (ms). Onay: onay kapısının zaman aşımı 90 sn (mind/onayKapisi.ts). */
export const AZAMI_YAS = { niyet: 60_000, onay: 90_000, komutSonucu: 60_000, son: 120_000 } as const;

/** Bir niyetin kısa, okunur özeti (duvar ve izdüşüm için). */
export function niyetOzeti(n: Niyet): string {
  switch (n.tur) {
    case "git": return `git → ${n.hedef.tip === "oyuncu" ? "Ozyn" : "ad" in n.hedef ? n.hedef.ad : "nokta"}`;
    case "bak": return `bak → ${n.hedef === null ? "serbest" : n.hedef.tip === "oyuncu" ? "Ozyn" : "ad" in n.hedef ? n.hedef.ad : "nokta"}`;
    case "otur": return `otur${n.capa ? ` → ${n.capa}` : ""}`;
    case "yaz": return `yaz "${n.metin.slice(0, 40)}"`;
    case "komut": return `komut \`${n.metin.slice(0, 60)}\``;
    case "odaklan": return `odaklan → ${n.capa}`;
    case "jest": return `jest ${n.jest}`;
    case "poz": return `poz ${n.poz}`;
    default: return n.tur;
  }
}

/** Sonucu beklenmeyen, anlık niyetler: "yapıyorum"a girmez. */
const ANLIK: ReadonlySet<NiyetTur> = new Set(["soyle", "sor"]);

export class AnlikBenlik {
  private _simdi: () => number;
  private _beden: () => BedenOkumasi | null;
  private _yapiyorum = new Map<string, SurenNiyet>();
  private _bekliyorum: Bekleme | null = null;
  private _dusunce: BenlikGoruntusu["dusunce"] = { uyanik: false, beyin: "", koken: "dis" };
  private _son: BenlikGoruntusu["son"] = {};

  constructor(a: { simdi?: () => number; beden?: () => BedenOkumasi | null } = {}) {
    this._simdi = a.simdi ?? Date.now;
    this._beden = a.beden ?? (() => null);
  }

  /** Köprü bir niyeti dünyaya gönderdi. `komut` → onay bekleniyor. */
  niyetGonderildi(id: string, n: Niyet, eden: Eden = "ben"): void {
    const an = this._simdi();
    if (n.tur === "komut") {
      this._bekliyorum = { ne: "onay", niyet: id, ozet: niyetOzeti(n), basladi: an };
      return;
    }
    if (ANLIK.has(n.tur)) return;
    this._yapiyorum.set(id, { id, tur: n.tur, ozet: niyetOzeti(n), eden, basladi: an });
  }

  /**
   * Bir niyetin akıbeti — SÜZÜLSE BİLE (spec 12 §4.2: onay bildirimi beyni uyandırmaz
   * ama benliği günceller). Onaylanan komut → `komut_sonucu` beklenir.
   */
  sonucGeldi(s: NiyetSonucu): void {
    if (s.durum === "basladi") return;
    const an = this._simdi();
    const b = this._bekliyorum;
    if (b?.ne === "onay" && b.niyet === s.niyet_id) {
      this._bekliyorum = s.durum === "bitti" ? { ne: "komut_sonucu", niyet: b.niyet, ozet: b.ozet, basladi: an } : null;
      this._son.bitenNiyet = { id: s.niyet_id, tur: "komut", ozet: b.ozet, durum: s.durum, an, ...(s.not ? { not: s.not } : {}) };
      return;
    }
    const y = this._yapiyorum.get(s.niyet_id);
    if (!y) return;
    this._yapiyorum.delete(s.niyet_id);
    this._son.bitenNiyet = { id: y.id, tur: y.tur, ozet: y.ozet, durum: s.durum, an, ...(s.not ? { not: s.not } : {}) };
  }

  /**
   * Terminalde bir komut bloğu bitti. Onaylanmış komutun sonucu bekleniyorsa kapanır:
   * onaydan SONRAKİ ilk tamamlanan blok (spec 12 §7: aynı komutu Ozyn yazarsa yanlış
   * eşleşme riski; komut satırı biliniyorsa metin de eşleşmeli).
   */
  terminalBitti(komut: string | null, kod?: number): void {
    const b = this._bekliyorum;
    if (b?.ne !== "komut_sonucu") return;
    const beklenen = /`(.*)`/.exec(b.ozet)?.[1];
    if (komut && beklenen && komut.trim() !== beklenen.trim()) return;
    this._bekliyorum = null;
    this._son.bitenNiyet = { id: b.niyet, tur: "komut", ozet: b.ozet, durum: kod === undefined || kod === 0 ? "bitti" : "hata", an: this._simdi(),
      ...(kod !== undefined ? { not: `çıkış kodu ${kod}` } : {}) };
  }

  dusunceBasladi(beyin: string, koken: "dis" | "inisiyatif"): void { this._dusunce = { uyanik: true, beyin, koken }; }
  dusunceBitti(): void { this._dusunce = { ...this._dusunce, uyanik: false }; }
  soyledi(metin: string): void { this._son.soz = { metin, an: this._simdi() }; }

  /** Dondurulmuş anlık görüntü. Yaşı geçen niyet BOŞA ÇIKAR, yaşı geçen bekleme ve "son" düşer. */
  oku(): BenlikGoruntusu {
    const an = this._simdi();
    for (const y of [...this._yapiyorum.values()]) {
      if (an - y.basladi > AZAMI_YAS.niyet) {
        this._yapiyorum.delete(y.id);
        this._son.bitenNiyet = { id: y.id, tur: y.tur, ozet: y.ozet, durum: "bosa_cikti", an };
      }
    }
    const b = this._bekliyorum;
    if (b && an - b.basladi > (b.ne === "onay" ? AZAMI_YAS.onay : AZAMI_YAS.komutSonucu)) this._bekliyorum = null;
    const son: BenlikGoruntusu["son"] = {};
    if (this._son.soz && an - this._son.soz.an <= AZAMI_YAS.son) son.soz = { ...this._son.soz };
    if (this._son.bitenNiyet && an - this._son.bitenNiyet.an <= AZAMI_YAS.son) son.bitenNiyet = { ...this._son.bitenNiyet };
    let beden: BedenOkumasi | null = null;
    try { beden = this._beden(); } catch { beden = null; }
    return Object.freeze({
      an, beden,
      yapiyorum: Object.freeze([...this._yapiyorum.values()].map((y) => ({ ...y }))),
      bekliyorum: this._bekliyorum ? { ...this._bekliyorum } : null,
      dusunce: { ...this._dusunce },
      son,
    });
  }
}

/**
 * MEŞGUL MÜYÜM — TEK KAYNAK (spec 12 B5, REFLEKS merceği Faz 1). Faz 1'de bugünkünün
 * AYNISI: düşünüyor ya da yürüyor/koşuyor. "Ozyn monitörde" Orion'un değil Ozyn'in
 * durumudur; çağıran ayrıca ekler (spec 12 §8 soru 3: davranış aynı, alan ayrı).
 */
export function mesgulMu(b: BenlikGoruntusu): { mesgul: boolean; sebep?: "dusunuyor" | "yuruyor" } {
  if (b.dusunce.uyanik) return { mesgul: true, sebep: "dusunuyor" };
  if (b.beden && (b.beden.poz === "yürüyor" || b.beden.poz === "koşuyor")) return { mesgul: true, sebep: "yuruyor" };
  return { mesgul: false };
}

/** Saniye cinsinden yaş, İngilizce çerçeve için. */
function yas(an: number, simdi: number): string {
  return `${Math.max(0, Math.round((simdi - an) / 1000))} sec`;
}

/**
 * İZDÜŞÜM — modele gidebilecek TEK satır (spec 12 §3.3, Faz 3). Bu fazda modele
 * GİTMEZ (sadakat A/B'si yok); duvar ve testler okur. Söylenecek bir şey yoksa null.
 */
export function izdusum(b: BenlikGoruntusu): string | null {
  const p: string[] = [];
  for (const y of b.yapiyorum) p.push(`You are doing: ${y.ozet} (${yas(y.basladi, b.an)}).`);
  if (b.bekliyorum) {
    p.push(b.bekliyorum.ne === "onay"
      ? `Waiting for Ozyn to approve ${b.bekliyorum.ozet.replace(/^komut /, "")} (${yas(b.bekliyorum.basladi, b.an)}).`
      : `Waiting for the result of ${b.bekliyorum.ozet.replace(/^komut /, "")} (${yas(b.bekliyorum.basladi, b.an)}).`);
  }
  return p.length ? p.join(" ") : null;
}

/** Niyet kimliğinin öneki: `n_…` → "n" (mind/durumKodu.ts `niyetKaynagi` ile aynı kural). */
function onek(id: string): string {
  const i = id.indexOf("_");
  return i > 0 ? id.slice(0, i) : id;
}

/** Orion'un KENDİ niyet kimlik önekleri: LLM, eylem sırası, komut programı, beceri refleksi, ara adım, ajanda. */
const BENIM_ONEKLERIM: ReadonlySet<string> = new Set(["n", "komut", "program", "refleks", "ajanda"]);

/**
 * KİM YAPTI — ALGI merceği (spec 12 §4.3, Faz 2). Kapı kararı DEĞİL, etiket: kayda gider.
 *   - sonuç: kimlik önekinden (`elle_` = Ozyn'in tuşu; Orion'un önekleri = ben)
 *   - Ozyn'in sözü: ozyn · bakış cevabı: ben
 *   - terminal: onaylanmış komutun sonucu bekleniyorsa ortak (Orion önerdi, Ozyn çalıştırdı), yoksa ozyn
 *   - yaklaştı/uzaklaştı: Orion o an yürüyorsa ben (B8: kendi yürüyüşü), değilse ozyn.
 *     SINIR (spec 12): Ozyn de yürüyorsa yanlış; Ozyn'in hızı bağlamda yok.
 *   - diğer olaylar: ozyn ya da (inisiyatif) ben; gerisi dunya.
 */
export function eden(a: Algi, b: BenlikGoruntusu): Eden {
  switch (a.tur) {
    case "sonuc": {
      const o = onek(a.sonuc.niyet_id);
      if (o === "elle") return "ozyn";
      return BENIM_ONEKLERIM.has(o) ? "ben" : "dunya";
    }
    case "duydum": return "ozyn";
    case "gordum": return "ben";
    case "terminal": return b.bekliyorum?.ne === "komut_sonucu" ? "ortak" : "ozyn";
    case "olay": {
      if (a.ayrinti?.kaynak === "inisiyatif") return "ben";
      if (a.ad === "ozyn_yaklasti" || a.ad === "ozyn_uzaklasti") {
        return b.beden && (b.beden.poz === "yürüyor" || b.beden.poz === "koşuyor") ? "ben" : "ozyn";
      }
      return a.ad.startsWith("ozyn_") ? "ozyn" : "dunya";
    }
    default: return "dunya";
  }
}
