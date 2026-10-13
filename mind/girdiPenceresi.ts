// mind/girdiPenceresi.ts — Ozyn'in girdilerini sabit pencerelerde SAYAR (karar kaydının `girdi` satırı, OB13).
//
// Neden pencere: her tuşu ya da fare hareketini satır yapmak kaydı boğardı (pointermove saniyede onlarca kez gelir).
// Varlık kapısının sorusu "son N dakikada girdi var mı" olduğu için dakikalık sayı yeter. İçerik tutulmaz.
// SAF: zaman dışarıdan.
"use strict";
import type { GirdiBilgisi } from "./kararKaydi.ts";

export type GirdiTipi = "tus" | "fare" | "soz";
export const GIRDI_PENCERESI_MS = 60_000;

export class GirdiPenceresi {
  private _bas: number | null = null;
  private _say = { tus: 0, fare: 0, soz: 0 };
  private _ms: number;

  constructor(pencereMs = GIRDI_PENCERESI_MS) { this._ms = pencereMs; }

  /** Bir girdi oldu. Pencere ilk girdiyle açılır; önceki pencere kapanmışsa önce `tikle` onu verir. */
  say(tip: GirdiTipi, t: number): GirdiBilgisi | null {
    const biten = this.tikle(t);
    if (this._bas === null) this._bas = t;
    this._say[tip]++;
    return biten;
  }

  /** Pencere süresi dolduysa sayıları verir ve sıfırlanır; dolmadıysa ya da girdi yoksa null (boş pencere yazılmaz). */
  tikle(t: number): GirdiBilgisi | null {
    if (this._bas === null || t - this._bas < this._ms) return null;
    const b: GirdiBilgisi = { bas: this._bas, pencereMs: this._ms, ...this._say };
    this._bas = null;
    this._say = { tus: 0, fare: 0, soz: 0 };
    return b;
  }
}
