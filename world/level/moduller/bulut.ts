// world/level/moduller/bulut.ts — Kümülüs bulutlar: ikosahedron topak kümeleri, "pişmiş" gölge.
//
// Gölge ışıktan bağımsız: yüz aşağı baktıkça gölge rengine kayar (sanat yönü sabit kalsın). Bütün bulutlar
// tek mesh (tek çizim çağrısı); ağır ağır döner. Tohumlu: aynı ayar → aynı gök.
"use strict";
import { flatGeometri, meshKur, type Geometri, type Ucgen, type V3 } from "../cekirdek/geometri.ts";
import { karistir, type Renk } from "../cekirdek/renk.ts";
import { rastgele } from "../cekirdek/rastgele.ts";
import type { LevelModulu } from "../cekirdek/modul.ts";

export const BULUT_VARSAYILAN = {
  sayi: 9,
  tohum: 1907,
  /** Küme başına topak sayısı aralığı. */
  topakMin: 5,
  topakMax: 8,
  yukseklikMin: 55,
  yukseklikMax: 100,
  uzakMin: 170,
  uzakMax: 370,
  olcekMin: 14,
  olcekMax: 30,
  /** Dikey basıklık (1 = küre). */
  basiklik: 0.8,
  renk: "bulut",
  golge: "bulutGolge",
  /** Dönüş hızı (rad/sn). */
  donus: 0.004,
};
export type BulutAyari = typeof BULUT_VARSAYILAN;

const PHI = (1 + Math.sqrt(5)) / 2;
const IKO_K: V3[] = ([[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]] as V3[]).map((v) => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l] as V3; });
const IKO_Y: [number, number, number][] = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];

export interface BulutYeri { x: number; y: number; z: number; olcek: number }

export function bulutYerleri(a: BulutAyari): BulutYeri[] {
  const rnd = rastgele(a.tohum);
  const ara = (min: number, max: number) => min + rnd() * (max - min);
  return Array.from({ length: Math.max(0, Math.round(a.sayi)) }, () => {
    const aci = rnd() * Math.PI * 2, uzak = ara(a.uzakMin, a.uzakMax);
    return { x: Math.cos(aci) * uzak, y: ara(a.yukseklikMin, a.yukseklikMax), z: Math.sin(aci) * uzak, olcek: ara(a.olcekMin, a.olcekMax) };
  });
}

export function bulutGeometrisi(a: BulutAyari, renk: Renk, golge: Renk): Geometri {
  const rnd = rastgele(a.tohum + 1);
  const u: Ucgen[] = [];
  for (const y of bulutYerleri(a)) {
    const topak = a.topakMin + Math.floor(rnd() * (a.topakMax - a.topakMin + 1));
    for (let t = 0; t < topak; t++) {
      const r = y.olcek * (0.55 + rnd() * 0.5);
      const cx = y.x + (rnd() - 0.5) * y.olcek * 2.4, cy = y.y + rnd() * y.olcek * 0.6, cz = y.z + (rnd() - 0.5) * y.olcek * 1.2;
      for (const [i, j, k] of IKO_Y) {
        const p = (v: V3): V3 => [cx + v[0] * r, cy + v[1] * r * a.basiklik, cz + v[2] * r];
        const ka = p(IKO_K[i]!), kb = p(IKO_K[j]!), kc = p(IKO_K[k]!);
        const ny = (IKO_K[i]![1] + IKO_K[j]![1] + IKO_K[k]![1]) / 3;
        const yon: V3 = [(ka[0] + kb[0] + kc[0]) / 3 - cx, (ka[1] + kb[1] + kc[1]) / 3 - cy, (ka[2] + kb[2] + kc[2]) / 3 - cz];
        u.push({ a: ka, b: kb, c: kc, renk: karistir(golge, renk, (ny + 0.35) / 0.9), yon });
      }
    }
  }
  return flatGeometri(u);
}

export const bulutModulu: LevelModulu<BulutAyari> = {
  tur: "bulut",
  aciklama: "Kümülüs bulutlar (ikosahedron kümeleri, pişmiş gölge, yavaş dönüş).",
  varsayilan: BULUT_VARSAYILAN,
  kur(b, a) {
    const m = meshKur(b.sahne, "bulut", bulutGeometrisi(a, b.renk(a.renk), b.renk(a.golge)));
    const malzeme = b.malzeme("bulut", "pismis");
    m.material = malzeme;
    return { meshler: [m], guncelle(dt) { m.rotation.y += a.donus * dt; }, yokEt() { m.dispose(); malzeme.dispose(); } };
  },
};
