// world/olayUretici.ts — Sürekli dünya durumundan AYRIK olaylar üretir.
//
// NEDEN VAR: Orion bugüne kadar yalnızca Ozyn'in yazdığı metni algılıyordu.
// Odada olup biten hiçbir şeyi görmüyordu — Ozyn yaklaşsa, masaya otursa,
// monitörü açsa haberi olmuyordu. Projenin tezi "masayı paylaşıyorsunuz";
// masadaki olanları görmeyen bir varlık o tezi karşılamaz.
//
// Bu dosya SAF: Babylon yok, protokol dışında bağımlılık yok, zaman dışarıdan
// verilir. 20Hz'lik sürekli akıştan saniyede bir kaç tane bile olay çıkmaz —
// iş histerezis ve eşik geçişlerinde.
//
// HİSTEREZİS ŞART: tek eşikle "yakın mı" sorulursa, oyuncu tam eşikte durduğunda
// yaklaştı/uzaklaştı olayları saniyede onlarca kez titrer ve beyni boğar.
// Bu yüzden girme eşiği çıkma eşiğinden DAR: bir kez girince, çıkmak için
// daha fazla uzaklaşmak gerekir.
"use strict";
import type { OrionDurumu, OyuncuDurumu } from "../protocol/algi.ts";

export interface OlayUreticiAyari {
  /** Bu mesafenin altına inince "yaklaştı" (m). */
  yakinEsik?: number;
  /** Bu mesafenin üstüne çıkınca "uzaklaştı" (m). Yakın eşikten BÜYÜK olmalı. */
  uzakEsik?: number;
  /** Aynı olay bu süre dolmadan tekrar üretilmez (ms). */
  sogumaMs?: number;
}

/** Üretilen olay: protokoldeki `algi: "olay"` gövdesiyle birebir aynı biçim. */
export interface UretilenOlay {
  ad: string;
  ayrinti?: Record<string, unknown>;
}

export class OlayUretici {
  private _yakinEsik: number;
  private _uzakEsik: number;
  private _sogumaMs: number;

  /** Önceki örnekteki durumlar — kenar algılama bunlara göre yapılır. */
  private _yakindaydi = false;
  private _bakiyordu = false;
  private _etkilesim: string | null = null;
  private _oturuyordu = false;
  private _ilkOrnek = true;
  private _sonUretim = new Map<string, number>();

  constructor(ayar: OlayUreticiAyari = {}) {
    this._yakinEsik = ayar.yakinEsik ?? 1.8;
    this._uzakEsik = ayar.uzakEsik ?? 2.6;
    this._sogumaMs = ayar.sogumaMs ?? 4000;
    if (this._uzakEsik <= this._yakinEsik) {
      throw new Error("uzakEsik yakinEsik'ten büyük olmalı — yoksa histerezis yok, olay titrer");
    }
  }

  /**
   * Bir dünya örneği ver, sıfır veya daha fazla ayrık olay al.
   *
   * İLK ÖRNEK sessizdir: açılışta "Ozyn yakında" diye olay üretmek yanlış olur,
   * bu bir DEĞİŞİM değil başlangıç durumudur. Orion açılış durumunu zaten
   * `dunyaDurumu()` metninden öğreniyor.
   */
  ornekle(simdiMs: number, orion: OrionDurumu, oyuncu: OyuncuDurumu): UretilenOlay[] {
    const cikti: UretilenOlay[] = [];

    const yakin = this._yakindaydi
      ? oyuncu.mesafe < this._uzakEsik      // içerideyken: çıkmak için uzak eşik
      : oyuncu.mesafe < this._yakinEsik;    // dışarıdayken: girmek için yakın eşik

    if (this._ilkOrnek) {
      this._ilkOrnek = false;
      this._yakindaydi = yakin;
      this._bakiyordu = oyuncu.bakiyor;
      this._etkilesim = oyuncu.etkilesim;
      this._oturuyordu = orion.oturuyor_mu;
      return cikti;
    }

    if (yakin !== this._yakindaydi) {
      cikti.push(yakin
        ? { ad: "ozyn_yaklasti", ayrinti: { mesafe: Number(oyuncu.mesafe.toFixed(1)) } }
        : { ad: "ozyn_uzaklasti", ayrinti: { mesafe: Number(oyuncu.mesafe.toFixed(1)) } });
      this._yakindaydi = yakin;
    }

    // Bakış yalnızca yakınken anlamlı: odanın öbür ucundan bakmak olay değil.
    if (oyuncu.bakiyor !== this._bakiyordu) {
      if (oyuncu.bakiyor && yakin) cikti.push({ ad: "ozyn_sana_bakti" });
      this._bakiyordu = oyuncu.bakiyor;
    }

    if (oyuncu.etkilesim !== this._etkilesim) {
      if (oyuncu.etkilesim) cikti.push({ ad: "ozyn_yuzeye_gecti", ayrinti: { yuzey: oyuncu.etkilesim } });
      else if (this._etkilesim) cikti.push({ ad: "ozyn_yuzeyden_cikti", ayrinti: { yuzey: this._etkilesim } });
      this._etkilesim = oyuncu.etkilesim;
    }

    if (orion.oturuyor_mu !== this._oturuyordu) {
      this._oturuyordu = orion.oturuyor_mu;
      // Orion'un kendi oturması ona haber edilmez: kendi yaptığı şeyi
      // "olay" diye geri beslemek bağlamı kirletir, niyet sonucu zaten var.
    }

    // Soğuma: aynı olay adı kısa aralıkla tekrar etmesin.
    return cikti.filter((o) => {
      const son = this._sonUretim.get(o.ad);
      if (son !== undefined && simdiMs - son < this._sogumaMs) return false;
      this._sonUretim.set(o.ad, simdiMs);
      return true;
    });
  }
}
