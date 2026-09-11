// world/engine/tik.ts — Sabit adımlı dünya tick'i (20 Hz).
//
// Neden sabit adım: render FPS'i dalgalanır (60, 144, arka planda 5). Dünya
// mantığı render'a bağlanırsa Orion'un davranışı donanıma göre değişir ve
// tekrarlanabilirliği kaybederiz. Mantık 20Hz sabit, render serbest.
//
// Kabul ölçütü K1: 20Hz ± %5, 10 dakika sapmasız.
"use strict";

export const TIK_HZ = 20;
export const TIK_MS = 1000 / TIK_HZ;

/** Bir karede en fazla kaç mantık adımı telafi edilir (spiral of death önlemi). */
const AZAMI_TELAFI = 5;

export type TikDinleyici = (t: number, dt: number) => void;

export class Saat {
  private _dinleyiciler = new Set<TikDinleyici>();
  private _birikim = 0;
  private _tikSayisi = 0;
  private _t = 0;
  private _basladi = 0;
  private _atlanan = 0;

  /** Render döngüsünden her karede çağrılır. `gercekDt` milisaniye. */
  ilerle(gercekDt: number): void {
    if (this._basladi === 0) this._basladi = performance.now();
    // Sekme/pencere dondurma sonrası dev dt gelir — birikimi sınırla.
    this._birikim += Math.min(gercekDt, TIK_MS * AZAMI_TELAFI * 2);

    let adim = 0;
    while (this._birikim >= TIK_MS) {
      if (adim >= AZAMI_TELAFI) {
        // Telafi edemedik: kalan birikimi düşür ve borcu kaydet.
        this._atlanan += Math.floor(this._birikim / TIK_MS);
        this._birikim = 0;
        break;
      }
      this._birikim -= TIK_MS;
      this._t += TIK_MS / 1000;
      this._tikSayisi++;
      adim++;
      for (const d of this._dinleyiciler) {
        try { d(this._t, TIK_MS / 1000); }
        catch (err) {
          // Bir dinleyicinin hatası dünyayı durdurmaz ama SESSİZ de kalmaz.
          console.error("[tik] dinleyici hatası:", err);
        }
      }
    }
  }

  dinle(d: TikDinleyici): () => void {
    this._dinleyiciler.add(d);
    return () => { this._dinleyiciler.delete(d); };
  }

  /** Dünya zamanı, saniye. */
  get t(): number { return this._t; }
  get tikSayisi(): number { return this._tikSayisi; }

  /**
   * Ölçülen gerçek tick frekansı. K1 denetimi bunu okur.
   * Başlangıçta 0 döner (yeterli örnek yok).
   */
  get olculenHz(): number {
    const gecen = (performance.now() - this._basladi) / 1000;
    return gecen > 1 ? this._tikSayisi / gecen : 0;
  }

  /** Telafi edilemeyip düşürülen tick sayısı. 0 olmalı; değilse dünya boğuluyor. */
  get atlanan(): number { return this._atlanan; }
}
