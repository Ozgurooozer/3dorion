// world/level/moduller/zemin.ts — Zemin: hafif dalgalı lowpoly ızgara, lekeli çayır renkleri, gölge alır.
//
// Merkez (yürünen yer) neredeyse düz, dışa doğru dalgalanır. Renk üçgen başına gürültü bandından, paletin
// çim renklerinden. `yukseklik(x, z)` dışarı açık: kamera ve ileride çim/kaya yerleşimi zemine oturur.
"use strict";
import { flatGeometri, meshKur, type Geometri, type Ucgen, type V3 } from "../cekirdek/geometri.ts";
import { gurultu } from "../cekirdek/rastgele.ts";
import type { Renk } from "../cekirdek/renk.ts";
import type { LevelModulu } from "../cekirdek/modul.ts";

export const ZEMIN_VARSAYILAN = {
  /** Yarı genişlik (m): sis kenarı göstermesin diye geniş. */
  yaricap: 320,
  /** Kenar başına bölüm; üçgen = 2·bölüm². */
  bolum: 110,
  tepeYukseklik: 2.2,
  tepeOlcek: 55,
  /** Bu yarıçapın içi neredeyse düz (yürünen yer). */
  duzYaricap: 40,
  /** Renk lekesi ölçeği (m). */
  lekeOlcek: 9,
  /** Renk bantları: gürültü eşiklerine göre (renkler.length = esikler.length + 1). */
  renkler: ["cimKoyu", "cimOrta", "cimAcik", "cimUc"],
  esikler: [0.3, 0.62, 0.86],
  tohum: 1907,
};
export type ZeminAyari = typeof ZEMIN_VARSAYILAN;

/** (x, z) → yükseklik (m). İki oktav; merkez düz, dışa doğru dalga. */
export function zeminYuksekligi(a: ZeminAyari): (x: number, z: number) => number {
  const s = a.tepeOlcek;
  return (x, z) => {
    const g = 0.65 * gurultu(x / s, z / s, a.tohum) + 0.35 * gurultu(x / (s * 0.37), z / (s * 0.37), a.tohum + 7);
    const merkez = Math.min(1, Math.hypot(x, z) / Math.max(1e-6, a.duzYaricap));
    return (g - 0.5) * 2 * a.tepeYukseklik * (0.25 + 0.75 * merkez);
  };
}

/** (x, z) → paletteki renk ADI (gürültü bandı). */
export function zeminRenkAdi(a: ZeminAyari, x: number, z: number): string {
  const g = gurultu(x / a.lekeOlcek, z / a.lekeOlcek, a.tohum + 3);
  const i = a.esikler.findIndex((e) => g < e);
  return a.renkler[i === -1 ? a.renkler.length - 1 : i]!;
}

export function zeminGeometrisi(a: ZeminAyari, renk: (ad: string) => Renk): Geometri {
  const y = zeminYuksekligi(a);
  const adim = (2 * a.yaricap) / a.bolum;
  const nokta = (i: number, j: number): V3 => { const x = -a.yaricap + i * adim, z = -a.yaricap + j * adim; return [x, y(x, z), z]; };
  const u: Ucgen[] = [];
  for (let i = 0; i < a.bolum; i++) {
    for (let j = 0; j < a.bolum; j++) {
      const p00 = nokta(i, j), p10 = nokta(i + 1, j), p01 = nokta(i, j + 1), p11 = nokta(i + 1, j + 1);
      // Köşegen dama tahtası gibi değişir: düzenli ızgara izi kırılır.
      const capraz = (i + j) % 2 === 0;
      const ucgenler: [V3, V3, V3][] = capraz ? [[p00, p10, p11], [p00, p11, p01]] : [[p00, p10, p01], [p10, p11, p01]];
      for (const [a0, b0, c0] of ucgenler) {
        const cx = (a0[0] + b0[0] + c0[0]) / 3, cz = (a0[2] + b0[2] + c0[2]) / 3;
        u.push({ a: a0, b: b0, c: c0, renk: renk(zeminRenkAdi(a, cx, cz)), yon: [0, 1, 0] });
      }
    }
  }
  return flatGeometri(u);
}

export const zeminModulu: LevelModulu<ZeminAyari> = {
  tur: "zemin",
  aciklama: "Lowpoly çayır zemini (dalgalı ızgara, lekeli renk, gölge alır).",
  varsayilan: ZEMIN_VARSAYILAN,
  aralik: {
    yaricap: { min: 50, max: 600, adim: 10 }, bolum: { min: 8, max: 200, adim: 1 },
    tepeYukseklik: { min: 0, max: 20, adim: 0.1 }, tepeOlcek: { min: 5, max: 200, adim: 1 },
    duzYaricap: { min: 1, max: 200, adim: 1 }, lekeOlcek: { min: 1, max: 60, adim: 0.5 },
    esikler: { min: 0, max: 1, adim: 0.01 }, tohum: { min: 0, max: 9999, adim: 1 },
  },
  kur(b, a) {
    if (a.renkler.length !== a.esikler.length + 1) throw new Error("zemin: renkler.length = esikler.length + 1 olmalı");
    const m = meshKur(b.sahne, "zemin", zeminGeometrisi(a, b.renk));
    const malzeme = b.malzeme("zemin", "isikli");
    m.material = malzeme;
    m.freezeWorldMatrix();
    b.golge(m, { alir: true });
    return { meshler: [m], yukseklik: zeminYuksekligi(a), yokEt() { m.dispose(); malzeme.dispose(); } };
  },
};
