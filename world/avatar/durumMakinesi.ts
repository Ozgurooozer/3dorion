// world/avatar/durumMakinesi.ts — Poz durum makinesi: SAF, Babylon YOK.
//
// `POZLAR` sözlüğü protokolde sabittir (molp `core/sahne.ts` ile birebir).
// Burada eklenen tek şey GEÇİŞ KURALLARI: hangi pozdan hangisine atlanabilir.
//
// Neden kural gerekiyor: `oturuyor` durumundan doğrudan `koşuyor`a geçmek
// karakteri sandalyenin içinden fırlatır. Animasyon açısından kurtarılamaz bir
// sıçrama, mantık açısından da yanlış: kalkmadan koşulmaz. Kuralı veri olarak
// tutmak, onu test edilebilir kılar.
//
// Reddedilen geçiş SESSİZ KALMAZ: `gec()` bir gerekçe döner ve `yurutucu`
// bunu `NiyetSonucu{durum:"hata", not}` olarak yayar — model kendini
// düzeltebilsin (bkz. protocol/SOZLESME.md "güvenilmezlik varsayımı").
"use strict";
import type { Poz } from "../../protocol/niyet.ts";

/**
 * İzin verilen geçişler. Anahtar = mevcut poz, değer = gidilebilecek pozlar.
 * Aynı poza geçiş her zaman geçerlidir (no-op) ve listelerde tekrar edilmez.
 *
 * Tasarım notu — `bakıyor` neden bir poz: protokol onu POZLAR içine koymuş
 * (molp uyumu). `bak` NİYETİ bu pozu değiştirmez; `bakıyor` yalnızca açık bir
 * `poz` niyetiyle girilen "dikkatle izliyor" duruşudur.
 */
export const GECISLER: Record<Poz, readonly Poz[]> = {
  duruyor:  ["yürüyor", "koşuyor", "oturuyor", "eğiliyor", "yatıyor", "bakıyor"],
  yürüyor:  ["duruyor", "koşuyor", "bakıyor"],
  koşuyor:  ["duruyor", "yürüyor"],
  // Oturmuş hâlden çıkışın tek yolu ayağa kalkmak. `kalk` niyeti bunu yapar.
  oturuyor: ["duruyor"],
  yatıyor:  ["duruyor"],
  eğiliyor: ["duruyor", "yürüyor"],
  bakıyor:  ["duruyor", "yürüyor", "koşuyor"],
};

/** Yer değiştirme içeren pozlar — beden yürüme salınımını bunlarda oynatır. */
export function hareketliMi(p: Poz): boolean {
  return p === "yürüyor" || p === "koşuyor";
}

export interface GecisSonucu {
  ok: boolean;
  /** `ok` false ise zorunlu: neden + geçerli seçenekler. */
  neden?: string;
  /** Geçiş gerçekten oldu mu (aynı poza geçiş `ok:true`, `degisti:false`). */
  degisti: boolean;
}

/**
 * Poz durumu + geçiş kapısı. Zaman bilgisi tutar ki beden geçişi
 * yumuşatabilsin (harmanlama ağırlığı = geçişYaşı / GECIS_SURESI).
 */
export class PozMakinesi {
  private _poz: Poz;
  private _onceki: Poz;
  private _yas = 0;

  constructor(baslangic: Poz = "duruyor") {
    this._poz = baslangic;
    this._onceki = baslangic;
  }

  get poz(): Poz { return this._poz; }
  get onceki(): Poz { return this._onceki; }
  /** Son geçişten bu yana geçen süre, saniye. */
  get yas(): number { return this._yas; }

  /** 20 Hz tikinden çağrılır. Yalnızca geçiş yaşını ilerletir. */
  ilerle(dt: number): void { this._yas += dt; }

  gecebilirMi(hedef: Poz): boolean {
    if (hedef === this._poz) return true;
    return GECISLER[this._poz].includes(hedef);
  }

  gec(hedef: Poz): GecisSonucu {
    if (hedef === this._poz) return { ok: true, degisti: false };
    if (!GECISLER[this._poz].includes(hedef)) {
      const secenek = GECISLER[this._poz].join(", ");
      return {
        ok: false,
        degisti: false,
        neden: `'${this._poz}' → '${hedef}' geçersiz geçiş. '${this._poz}' durumundan yalnızca şunlara geçilir: ${secenek}.`
             + (this._poz === "oturuyor" ? " Önce `kalk` niyeti gönder." : ""),
      };
    }
    this._onceki = this._poz;
    this._poz = hedef;
    this._yas = 0;
    return { ok: true, degisti: true };
  }
}
