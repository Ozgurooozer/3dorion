// uygulama/takip.ts — "Beni takip et": Orion, Ozyn uzaklaştıkça yanına yürür (içgüdü `kopru.takip`).
//
// Takip SÜREN bir davranış: köprü sözü tanır ve bunu açar/kapatır; burada her `tik`te mesafeye bakılır.
// Ozyn `UZAK_M`ten uzaklaşınca Orion onun `YAKIN_M` yakınına yürür (`git {tip:"oyuncu"}` — mevcut beden
// yolu, kalkma dahil). Yürürken yeni yürüyüş başlatılmaz; bitince tekrar bakılır. Aradaki boşluk
// (histerezis) Orion'un her adımda kıpırdanmasını önler. LLM uyanmaz, model bağlamı büyümez.
//
// BİTİŞ köprüden gelir: "takibi bırak" sözü ya da yeni bir beden emri (dur, otur, tahtaya git…).
"use strict";
import type { Niyet, NiyetSonucu } from "../protocol/niyet.ts";

/** Ozyn bundan uzaktaysa Orion yürür (m). */
export const UZAK_M = 2.6;
/** Orion Ozyn'in bu kadar yakınında durur (m). `UZAK_M`ten küçük olmalı (histerezis). */
export const YAKIN_M = 1.3;

export interface TakipBaglami {
  orionKonumu(): { x: number; z: number } | null;
  ozynKonumu(): { x: number; z: number };
  /** Beden adımı (uygulama/niyetYurutucu.ts `bedenAdimi`): niyeti yürütür, sonucu döner. */
  bedenAdimi(n: Niyet): Promise<NiyetSonucu>;
}

export class Takipci {
  private _b: TakipBaglami;
  private _aktif = false;
  private _yuruyor = false;

  constructor(b: TakipBaglami) { this._b = b; }

  get aktif(): boolean { return this._aktif; }
  get yuruyor(): boolean { return this._yuruyor; }

  baslat(): void { this._aktif = true; }

  /** Takibi bitirir. Süren yürüyüş bedenin işidir (yeni emir onu zaten keser); burada yenisi başlamaz. */
  birak(): void { this._aktif = false; }

  /** Periyodik çağrılır (giris.ts). Uzaklaşıldıysa yanına yürür. */
  tik(): void {
    if (!this._aktif || this._yuruyor) return;
    const o = this._b.orionKonumu();
    if (!o) return;
    const p = this._b.ozynKonumu();
    if (Math.hypot(o.x - p.x, o.z - p.z) <= UZAK_M) return;
    this._yuruyor = true;
    void this._b.bedenAdimi({ tur: "git", hedef: { tip: "oyuncu" }, mesafe: YAKIN_M })
      .finally(() => { this._yuruyor = false; });
  }
}
