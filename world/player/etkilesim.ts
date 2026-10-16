// world/player/etkilesim.ts — Oyuncu etkileşim olay yayıcısı.
//
// Neden kendi yayıcım var (Babylon `Observable` veya DOM `CustomEvent` yerine):
//   1. T3 (monitör) ve T4 (köprü) buna abone olacak. İkisi de Babylon'u
//      tanımak zorunda kalmamalı; olay tipi saf veri olsun.
//   2. `window` üzerinden CustomEvent yaymak global ad alanını kirletir ve
//      test edilemez. Bu sınıf `node --test` altında koşar.
//
// KATI SINIR: burada protokol MESAJI üretilmez. `bridge/` (T4) bu olayları
// dinleyip `Algi` zarfına çevirir. `world/` beyne doğrudan yazmaz.
"use strict";
import { TUSLAR } from "./tuslar.ts";

/** Etkileşim olayının gövdesi. Saf veri — Babylon tipi içermez. */
export interface EtkilesimOlayi {
  /** Hangi çapa: "monitor" | "tahta" | "sandalye" | ... */
  capa: string;
  /** Hangi eylem: "kullan" | "odaklan" | "otur" | "yaz" ... */
  eylem: string;
  /** Oyuncunun o andaki konumu. */
  kaynak: { x: number; y: number; z: number };
  /** Dünya zamanı (saniye), `Saat.t`. */
  t: number;
}

/** İpucu değişimi — HUD bunu gösterir. `null` = gösterilecek ipucu yok. */
export interface Ipucu {
  capa: string;
  eylem: string;
  /** Ekranda görünecek hazır metin: "[F] monitör — kullan" (tuş etiketi `tuslar.ts`ten). */
  metin: string;
}

export type EtkilesimTur = "basladi" | "bitti" | "ipucu";

type Dinleyici<T> = (veri: T) => void;

/**
 * Minimal, tip güvenli olay yayıcısı.
 *
 * `basladi` — oyuncu etkileşim tuşuyla (`F`, bkz. tuslar.ts) bir çapayla etkileşime girdi.
 * `bitti`   — oyuncu `Esc` ile çıktı.
 * `ipucu`   — bakış ışınının altındaki etkileşim değişti (veya kayboldu).
 */
export class EtkilesimYayici {
  private _basladi = new Set<Dinleyici<EtkilesimOlayi>>();
  private _bitti = new Set<Dinleyici<EtkilesimOlayi>>();
  private _ipucu = new Set<Dinleyici<Ipucu | null>>();

  /** Şu anda aktif etkileşim (yoksa `null`). `OyuncuDurumu.etkilesim` bunu okur. */
  private _aktif: EtkilesimOlayi | null = null;
  private _sonIpucu: Ipucu | null = null;

  get aktif(): EtkilesimOlayi | null { return this._aktif; }
  get sonIpucu(): Ipucu | null { return this._sonIpucu; }

  /** Abone ol; dönen fonksiyon aboneliği iptal eder. */
  dinle(tur: "basladi" | "bitti", d: Dinleyici<EtkilesimOlayi>): () => void;
  dinle(tur: "ipucu", d: Dinleyici<Ipucu | null>): () => void;
  dinle(tur: EtkilesimTur, d: Dinleyici<EtkilesimOlayi> | Dinleyici<Ipucu | null>): () => void {
    const kume = this._kume(tur) as Set<unknown>;
    kume.add(d);
    return () => { kume.delete(d); };
  }

  private _kume(tur: EtkilesimTur): Set<unknown> {
    if (tur === "basladi") return this._basladi as Set<unknown>;
    if (tur === "bitti") return this._bitti as Set<unknown>;
    return this._ipucu as Set<unknown>;
  }

  /** Etkileşimi başlat. Zaten aktif bir etkileşim varsa `false` döner. */
  baslat(olay: EtkilesimOlayi): boolean {
    if (this._aktif) return false;
    this._aktif = olay;
    this._yay(this._basladi, olay);
    return true;
  }

  /** Aktif etkileşimi bitir. Aktif etkileşim yoksa `false`. */
  bitir(): boolean {
    const o = this._aktif;
    if (!o) return false;
    this._aktif = null;
    this._yay(this._bitti, o);
    return true;
  }

  /** İpucunu güncelle. Değişmediyse dinleyiciler rahatsız edilmez (20Hz gürültüsü yok). */
  ipucuAyarla(i: Ipucu | null): void {
    const a = this._sonIpucu;
    if (a === i) return;
    if (a && i && a.capa === i.capa && a.eylem === i.eylem) return;
    this._sonIpucu = i;
    this._yay(this._ipucu, i);
  }

  private _yay<T>(kume: Set<Dinleyici<T>>, veri: T): void {
    for (const d of kume) {
      // Bir abonenin hatası dünyayı durdurmaz ama sessiz de kalmaz.
      try { d(veri); } catch (err) { console.error("[etkilesim] dinleyici hatası:", err); }
    }
  }
}

/**
 * Süreç genelinde tek yayıcı. T3/T4 bunu import edip abone olur.
 * Test içinde yeni `EtkilesimYayici()` kurulabilir — singleton zorunlu değil.
 */
export const EtkilesimOlaylari = new EtkilesimYayici();

/**
 * Menüden ("ben yapayım", spec 28) bir çapayla etkileşime girmek için oyuncunun çapaya en çok bu kadar (m, XZ) yakın olması gerekir. Tuşla etkileşim
 * bakış ışınıyla (2,5 m) sınırlı; menüde ışın yok, mesafe var: biraz geniş, ama uzaktan oturtmaz. Menü ve oyuncu AYNI sabiti kullanır.
 */
export const ETKILESIM_MENZILI = 3.5;

/** Eylem kimliği ASCII ("gec"); ekranda Türkçe yazımı. Listede olmayan kimlik olduğu gibi yazılır. */
const EYLEM_YAZIMI: Readonly<Record<string, string>> = { gec: "geç" };

/** İpucu metnini üretir: "[F] monitör — kullan" (etiket `tuslar.ts`ten: yazı ile gerçek tuş ayrışmaz). */
export function ipucuMetni(etiket: string, eylem: string): string {
  return `[${TUSLAR.etkilesim.etiket}] ${etiket} — ${EYLEM_YAZIMI[eylem] ?? eylem}`;
}
