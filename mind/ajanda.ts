// mind/ajanda.ts — Boşta ajanda: beyin konuşmuyorken Orion ne yapar?
//
// bosta.ts (world/avatar/) yalnızca "gövde kaç milimetre oynuyor" sorusuna
// yanıt verir, KARAR VERMEZ — bu dosyanın işi tam olarak o kararı vermek:
// belirli aralıklarla düşük maliyetli bir niyet (bak/jest) öner, ki avatar
// beyin sessizken de bir heykel gibi durmasın.
//
// KATI KURAL: beyin meşgulken (mesgulMu=true, örn. bir "git"/"soyle" sürüyor)
// ASLA öneri üretmez — ajanda beyni EZEMEZ, yalnızca boşluğu doldurur.
//
// Saf ve DETERMİNİSTİK: Math.random yok, dışarıdan zaman verilir. bosta.ts'in
// "sapma" tekniğiyle aynı: aynı tohum + aynı sayaç → aynı seçim, testte
// tekrarlanabilir.
"use strict";
import type { Niyet } from "../protocol/niyet.ts";

export interface AjandaAyari {
  /** İki öneri arasındaki asgari boşta süresi (ms). Tel de olabilir. */
  asgariAralikMs?: number | (() => number);
  /** Asgariye eklenen determinist uzatma üst sınırı (ms). Tel de olabilir. */
  azamiSapmaMs?: number | (() => number);
  /** Bakılacak çapa adayları (ör. ["masa","tahta","pencere","kapi"]). */
  bakilacakCapalar?: readonly string[];
  /** Avatar başına sabit tohum — iki avatar aynı ritimde hareket etmesin. */
  tohum?: number;
}

/** bosta.ts'teki ile aynı determinist sapma üreteci: n,tohum → 0..1. */
function sapma(n: number, tohum: number): number {
  const s = Math.sin(n * 12.9898 + tohum * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

const JEST_HAVUZU = ["gülümsüyor", "bekliyor", "kaş_çatıyor", "el_açıyor"] as const;

export class Ajanda {
  private _asgariMs: () => number;
  private _sapmaMs: () => number;
  private _capalar: readonly string[];
  private _tohum: number;
  private _sonOneriMs = -Infinity;
  private _sayac = 0;
  private _oneriSayisi = 0;

  constructor(ayar: AjandaAyari = {}) {
    // Sabit sayı da kabul edilir — mevcut çağrı yerleri değişmez.
    const tel = (a: number | (() => number) | undefined, v: number): (() => number) =>
      a === undefined ? () => v : (typeof a === "function" ? a : () => a);
    this._asgariMs = tel(ayar.asgariAralikMs, 15_000);
    this._sapmaMs = tel(ayar.azamiSapmaMs, 15_000);
    this._capalar = ayar.bakilacakCapalar ?? ["masa", "tahta", "pencere", "kapi"];
    this._tohum = ayar.tohum ?? 0;
  }

  /**
   * Her tikte çağrılır. `mesgulMu=true` ise (beyin sürüyor / kullanıcı
   * etkileşimde) her zaman `null` döner — ajanda araya girmez.
   */
  tikle(simdiMs: number, mesgulMu: boolean): Niyet | null {
    if (mesgulMu) { this._sonOneriMs = simdiMs; return null; }

    const bekleme = this._asgariMs() + sapma(this._sayac, this._tohum) * this._sapmaMs();
    if (simdiMs - this._sonOneriMs < bekleme) return null;

    this._sonOneriMs = simdiMs;
    this._sayac++;
    this._oneriSayisi++;

    // Sırayla bak / jest değiştir — ikisi art arda aynı türde gelmesin diye
    // sayaç tek/çift ile ayrılır (aynı jestin arka arkaya tekrarı mekanik durur).
    if (this._sayac % 2 === 0) {
      const jest = JEST_HAVUZU[Math.floor(sapma(this._sayac, this._tohum + 1) * JEST_HAVUZU.length)] ?? JEST_HAVUZU[0];
      return { tur: "jest", jest };
    }
    const capaAdi = this._capalar[Math.floor(sapma(this._sayac, this._tohum + 2) * this._capalar.length)] ?? this._capalar[0] ?? "masa";
    return { tur: "bak", hedef: { tip: "capa", ad: capaAdi } };
  }

  /** Testte/tanılamada kaç öneri üretildiğini görmek için. */
  oneriSayisi(): number { return this._oneriSayisi; }

  // Devre panosu okuyucuları — salt okunur.
  get asgariAralikMs(): number { return this._asgariMs(); }
  get azamiSapmaMs(): number { return this._sapmaMs(); }
  get capaSayisi(): number { return this._capalar.length; }

  /** Kullanıcı/beyin araya girdiğinde sayacı sıfırlamadan sadece bekletir. */
  ertele(simdiMs: number): void { this._sonOneriMs = simdiMs; }
}
