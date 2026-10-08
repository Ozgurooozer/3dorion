// world/level/moduller/kaya.ts — Lowpoly kayalar: çarpıtılmış ikosahedron, zemine oturur, gölge atar ve alır.
//
// Kodda üretilir (tohumlu); Blender uzak tepeler ve elle şekillenmiş "kahraman" objeler için kalır. Bütün
// kayalar tek mesh (tek çizim çağrısı). Zemine oturmak için `baglam.yukseklik` kullanır — bu yüzden level
// tanımında zeminden SONRA gelmeli (katman sırası = bağımlılık sırası, cekirdek/levelKur.ts).
"use strict";
import { flatGeometri, meshKur, type Geometri, type Ucgen, type V3 } from "../cekirdek/geometri.ts";
import { karistir, type Renk } from "../cekirdek/renk.ts";
import { rastgele } from "../cekirdek/rastgele.ts";
import type { LevelModulu } from "../cekirdek/modul.ts";

export const KAYA_VARSAYILAN = {
  sayi: 14,
  tohum: 77,
  /** Kayaların dağıldığı halka (m). */
  icYaricap: 6,
  disYaricap: 60,
  boyMin: 0.4,
  boyMax: 2.2,
  /** Biçim bozma oranı (0 = düzgün ikosahedron). */
  bozma: 0.35,
  /** Dikey basıklık. */
  basiklik: 0.7,
  renk: "kaya",
  koyu: "kayaKoyu",
};
export type KayaAyari = typeof KAYA_VARSAYILAN;

const PHI = (1 + Math.sqrt(5)) / 2;
const K: V3[] = ([[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]] as V3[]).map((v) => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l] as V3; });
const Y: [number, number, number][] = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];

export interface KayaYeri { x: number; z: number; boy: number; aci: number }

export function kayaYerleri(a: KayaAyari): KayaYeri[] {
  const rnd = rastgele(a.tohum);
  return Array.from({ length: Math.max(0, Math.round(a.sayi)) }, () => {
    const aci = rnd() * Math.PI * 2;
    const r = a.icYaricap + Math.sqrt(rnd()) * (a.disYaricap - a.icYaricap);
    return { x: Math.cos(aci) * r, z: Math.sin(aci) * r, boy: a.boyMin + rnd() * (a.boyMax - a.boyMin), aci: rnd() * Math.PI * 2 };
  });
}

export function kayaGeometrisi(a: KayaAyari, yukseklik: (x: number, z: number) => number, renk: Renk, koyu: Renk): Geometri {
  const rnd = rastgele(a.tohum + 1);
  const u: Ucgen[] = [];
  for (const y of kayaYerleri(a)) {
    // Köşe başına sabit bozma (komşu yüzler aynı köşeyi paylaşsın: çatlak açılmasın).
    const bozuk = K.map((v) => { const s = 1 + (rnd() - 0.5) * 2 * a.bozma; return [v[0] * s, v[1] * s * a.basiklik, v[2] * s] as V3; });
    const c = Math.cos(y.aci), s = Math.sin(y.aci);
    // Taban zemine gömülsün (havada durmasın): en alçak köşe zeminin biraz altına.
    const taban = yukseklik(y.x, y.z) - 0.15 * y.boy;
    const enAlt = Math.min(...bozuk.map((v) => v[1]));
    const p = (v: V3): V3 => [y.x + (v[0] * c - v[2] * s) * y.boy, taban + (v[1] - enAlt) * y.boy, y.z + (v[0] * s + v[2] * c) * y.boy];
    for (const [i, j, k] of Y) {
      const ka = p(bozuk[i]!), kb = p(bozuk[j]!), kc = p(bozuk[k]!);
      const merkez: V3 = [y.x, taban + y.boy * 0.5, y.z];
      const yon: V3 = [(ka[0] + kb[0] + kc[0]) / 3 - merkez[0], (ka[1] + kb[1] + kc[1]) / 3 - merkez[1], (ka[2] + kb[2] + kc[2]) / 3 - merkez[2]];
      u.push({ a: ka, b: kb, c: kc, renk: karistir(koyu, renk, rnd()), yon });
    }
  }
  return flatGeometri(u);
}

export const kayaModulu: LevelModulu<KayaAyari> = {
  tur: "kaya",
  aciklama: "Lowpoly kayalar (tohumlu, zemine oturur, gölge atar/alır). Zeminden sonra gelmeli.",
  varsayilan: KAYA_VARSAYILAN,
  aralik: {
    sayi: { min: 0, max: 200, adim: 1 }, tohum: { min: 0, max: 9999, adim: 1 },
    icYaricap: { min: 0, max: 100, adim: 1 }, disYaricap: { min: 5, max: 300, adim: 1 },
    boyMin: { min: 0.1, max: 5, adim: 0.05 }, boyMax: { min: 0.1, max: 10, adim: 0.05 },
    bozma: { min: 0, max: 0.9, adim: 0.01 }, basiklik: { min: 0.2, max: 2, adim: 0.01 },
  },
  kur(b, a) {
    const m = meshKur(b.sahne, "kaya", kayaGeometrisi(a, b.yukseklik, b.renk(a.renk), b.renk(a.koyu)));
    const malzeme = b.malzeme("kaya", "isikli");
    m.material = malzeme;
    m.freezeWorldMatrix();
    b.golge(m, { atar: true, alir: true });
    return { meshler: [m], yokEt() { m.dispose(); malzeme.dispose(); } };
  },
};
