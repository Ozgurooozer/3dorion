// uygulama/ajanlar/koltuklar.ts — KOLTUK DEFTERİ: aynı sandalye iki bedene verilmez (spec 33). SAF.
//
// Kural yürütücüde (world/avatar/yurutucu.ts `koltukDolu`): `otur` başlamadan "bu koltuk başkasının mı" diye sorar. Soru buraya gelir;
// defter HER bedenin o anki koltuğunu (oturuyor ya da oturmaya gidiyor) bedenin kendisinden okur — kayıt tutmaz, bırakmayı unutamaz.
// Beden kendine sorulmaz (`ben` hariç): Orion kendi koltuğuna yeniden "otur" derse kural onu engellemez (yürütücünün kendi kuralı bakar).
"use strict";

export class Koltuklar {
  private _bedenler = new Map<string, () => string | null>();

  /** Bedeni deftere ekler: `ad` hata cümlesinde görünür ("sandalye dolu: Orion orada"). Aynı ad yeniden kaydedilirse eskisinin yerine geçer. */
  kaydet(ad: string, koltugu: () => string | null): void { this._bedenler.set(ad, koltugu); }

  sil(ad: string): void { this._bedenler.delete(ad); }

  /** `capa` koltuğu `ben` dışında bir bedende mi? Öyleyse o bedenin adı, değilse null. Bir bedenin okuma hatası koltuğu boş saymaz: dolu der. */
  dolu(capa: string, ben: string): string | null {
    for (const [ad, koltugu] of this._bedenler) {
      if (ad === ben) continue;
      let k: string | null;
      try { k = koltugu(); } catch { return ad; }
      if (k === capa) return ad;
    }
    return null;
  }
}
