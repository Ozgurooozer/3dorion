// voice/sahte-mikrofon.ts — Senaryolu konuşma kaynağı.
//
// Amacı test: mikrofon yokken de "kullanıcı konuştu → Orion döndü → cevap verdi"
// zincirinin tamamı, gerçek zamanlamayla ve ara sonuçlarla koşturulabilir.
// Mikrofon takıldığında bu dosya SİLİNMEZ — regresyon testi olarak kalır.
"use strict";
import type { KonusmaKaynagi, Tanima } from "./tip.ts";

export interface SahteCumle {
  metin: string;
  /** Bu cümlenin başlamasına kaç ms kaldı (öncekinin bitişinden sayılır). */
  gecikmeMs?: number;
  /** Kelime kelime ara sonuç yay (gerçek STT davranışı). */
  kademeli?: boolean;
}

export class SahteMikrofon implements KonusmaKaynagi {
  readonly ad = "sahte-mikrofon";
  private _dinleyiciler = new Set<(t: Tanima) => void>();
  private _hataDinleyiciler = new Set<(h: string) => void>();
  private _zamanlayicilar: ReturnType<typeof setTimeout>[] = [];
  private _senaryo: SahteCumle[];
  /** Test edilebilirlik: zaman kaynağı enjekte edilebilir. */
  private _bekle: (ms: number, cb: () => void) => ReturnType<typeof setTimeout>;

  constructor(senaryo: SahteCumle[], bekle?: (ms: number, cb: () => void) => ReturnType<typeof setTimeout>) {
    this._senaryo = senaryo;
    this._bekle = bekle ?? ((ms, cb) => setTimeout(cb, ms));
  }

  kullanilabilir(): boolean { return true; }

  async baslat(): Promise<void> {
    let t = 0;
    for (const c of this._senaryo) {
      t += c.gecikmeMs ?? 800;
      if (c.kademeli) {
        const kelimeler = c.metin.split(/\s+/);
        for (let i = 1; i < kelimeler.length; i++) {
          const ara = kelimeler.slice(0, i).join(" ");
          this._zamanlayicilar.push(this._bekle(t + i * 120, () => this._yay({ metin: ara, kesin: false })));
        }
        t += kelimeler.length * 120;
      }
      this._zamanlayicilar.push(this._bekle(t, () => this._yay({ metin: c.metin, kesin: true, guven: 0.95 })));
    }
  }

  durdur(): void {
    for (const z of this._zamanlayicilar) clearTimeout(z);
    this._zamanlayicilar = [];
  }

  dinle(cb: (t: Tanima) => void): () => void {
    this._dinleyiciler.add(cb);
    return () => { this._dinleyiciler.delete(cb); };
  }
  hataDinle(cb: (h: string) => void): () => void {
    this._hataDinleyiciler.add(cb);
    return () => { this._hataDinleyiciler.delete(cb); };
  }

  private _yay(t: Tanima): void { for (const d of this._dinleyiciler) d(t); }
}
