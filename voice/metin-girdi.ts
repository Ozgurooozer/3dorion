// voice/metin-girdi.ts — Klavyeden yazılan girdiyi konuşma gibi davranan kaynak.
// Mikrofon yokken hattın tamamı bununla uçtan uca test edilebilir.
"use strict";
import type { KonusmaKaynagi, Tanima } from "./tip.ts";

export class MetinGirdi implements KonusmaKaynagi {
  readonly ad = "metin";
  private _dinleyiciler = new Set<(t: Tanima) => void>();
  private _hataDinleyiciler = new Set<(h: string) => void>();
  private _acik = false;

  kullanilabilir(): boolean { return true; }
  async baslat(): Promise<void> { this._acik = true; }
  durdur(): void { this._acik = false; }

  dinle(cb: (t: Tanima) => void): () => void {
    this._dinleyiciler.add(cb);
    return () => { this._dinleyiciler.delete(cb); };
  }
  hataDinle(cb: (h: string) => void): () => void {
    this._hataDinleyiciler.add(cb);
    return () => { this._hataDinleyiciler.delete(cb); };
  }

  /** UI'dan çağrılır: kullanıcı bir satır yazıp Enter'a bastı. */
  gonder(metin: string): void {
    if (!this._acik) { this._hata("girdi kapalı"); return; }
    const t = metin.trim();
    if (!t) return;
    for (const d of this._dinleyiciler) d({ metin: t, kesin: true, guven: 1 });
  }

  /** Yazarken ara sonuç yaymak istersek (Orion "yazdığını görüyor" hissi). */
  yaziyor(kismi: string): void {
    if (!this._acik || !kismi.trim()) return;
    for (const d of this._dinleyiciler) d({ metin: kismi, kesin: false });
  }

  private _hata(h: string): void { for (const d of this._hataDinleyiciler) d(h); }
}
