// world/level/ova/ovaGeometri.ts — Ova'nın geometrisi, SAF diziler olarak (spec 17).
//
// Babylon'suz: konum/renk/normal/indeks dizileri burada üretilir, mesh'e sarma ova.ts'te. Böylece üçgen
// bütçesi, normallerin yönü ve renklerin paletten geldiği sahnesiz test edilir.
//
// LOWPOLY = FLAT: her üçgenin kendi köşeleri var (paylaşım yok), normal üçgenin yüz normalidir. Renk de
// üçgen başına — lekeli çayır, kademeli gök ve "pişmiş" gölgeli bulut bu yüzden shader'sız da sanatlı
// görünür; ileride toon/piksel shader aynı dizileri okur.
"use strict";
import { OVA, PALET, gokRengi, yukseklik, zeminRengi, karistir, type Renk } from "./ovaVerisi.ts";

export interface Geometri {
  konum: Float32Array;
  renk: Float32Array;   // rgba
  normal: Float32Array;
  indeks: Uint32Array;
}

type V3 = [number, number, number];

/** Üçgen listesinden flat geometri kurar. `yon` verilirse normal o yöne bakacak şekilde çevrilir. */
function flatGeometri(ucgenler: { a: V3; b: V3; c: V3; renk: Renk; yon?: V3 }[]): Geometri {
  const n = ucgenler.length;
  const konum = new Float32Array(n * 9), renk = new Float32Array(n * 12), normal = new Float32Array(n * 9);
  const indeks = new Uint32Array(n * 3);
  ucgenler.forEach((u, i) => {
    let [a, b, c] = [u.a, u.b, u.c];
    const e1: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    if (u.yon && nx * u.yon[0] + ny * u.yon[1] + nz * u.yon[2] < 0) { nx = -nx; ny = -ny; nz = -nz; [b, c] = [c, b]; }
    // Babylon sol elli: ön yüz, normale bakan göze göre SAAT YÖNÜNDE sıralı köşedir — çapraz çarpımın verdiği
    // sıranın tersi. Bu yüzden köşeler a, c, b yazılır (ilk sürüm a, b, c yazdı: zemin üstten, gök içeriden
    // ayıklanıp görünmedi — ekran görüntüsünde yakalandı).
    [a, c, b].forEach((p, k) => {
      konum.set(p, i * 9 + k * 3);
      normal.set([nx, ny, nz], i * 9 + k * 3);
      renk.set([u.renk[0], u.renk[1], u.renk[2], 1], i * 12 + k * 4);
      indeks[i * 3 + k] = i * 3 + k;
    });
  });
  return { konum, renk, normal, indeks };
}

/** Zemin: kare ızgara, hafif dalgalı, üçgen başına paletten renk. Üçgen sayısı 2·bölüm². */
export function zeminGeometrisi(r: number = OVA.zeminYaricap, bolum: number = OVA.zeminBolum): Geometri {
  const adim = (2 * r) / bolum;
  const nokta = (i: number, j: number): V3 => {
    const x = -r + i * adim, z = -r + j * adim;
    return [x, yukseklik(x, z), z];
  };
  const u: Parameters<typeof flatGeometri>[0] = [];
  for (let i = 0; i < bolum; i++) {
    for (let j = 0; j < bolum; j++) {
      const p00 = nokta(i, j), p10 = nokta(i + 1, j), p01 = nokta(i, j + 1), p11 = nokta(i + 1, j + 1);
      // Köşegen yönü dama tahtası gibi değişir: düzenli ızgara izi kırılır, lowpoly daha "el yapımı".
      const capraz = (i + j) % 2 === 0;
      const t1: [V3, V3, V3] = capraz ? [p00, p10, p11] : [p00, p10, p01];
      const t2: [V3, V3, V3] = capraz ? [p00, p11, p01] : [p10, p11, p01];
      for (const [a, b, c] of [t1, t2]) {
        const cx = (a[0] + b[0] + c[0]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
        u.push({ a, b, c, renk: zeminRengi(cx, cz), yon: [0, 1, 0] });
      }
    }
  }
  return flatGeometri(u);
}

/**
 * Gök kubbesi: içinden bakılan düşük poligonlu yarım küre (ufkun biraz altından başlar: kenar görünmesin).
 * Renk enlem bandına göre kademeli — gradyan yumuşak değil, BANTLI (sanat yönü). Normal içe bakar.
 */
export function gokGeometrisi(r: number = OVA.gokYaricap, boylam = 18, enlem = 7): Geometri {
  const enlemler = Array.from({ length: enlem + 1 }, (_, k) => -0.12 + (k / enlem) * (Math.PI / 2 + 0.12));
  const nokta = (bo: number, en: number): V3 => {
    const t = (bo / boylam) * Math.PI * 2;
    return [Math.cos(en) * Math.cos(t) * r, Math.sin(en) * r, Math.cos(en) * Math.sin(t) * r];
  };
  const u: Parameters<typeof flatGeometri>[0] = [];
  for (let k = 0; k < enlem; k++) {
    const renk = gokRengi(Math.sin(Math.max(0, (enlemler[k]! + enlemler[k + 1]!) / 2)));
    for (let b = 0; b < boylam; b++) {
      const a0 = nokta(b, enlemler[k]!), a1 = nokta(b + 1, enlemler[k]!);
      const u0 = nokta(b, enlemler[k + 1]!), u1 = nokta(b + 1, enlemler[k + 1]!);
      const merkez = (p: V3, q: V3, s: V3): V3 => [-(p[0] + q[0] + s[0]) / 3, -(p[1] + q[1] + s[1]) / 3, -(p[2] + q[2] + s[2]) / 3];
      u.push({ a: a0, b: a1, c: u1, renk, yon: merkez(a0, a1, u1) });
      if (k < enlem - 1) u.push({ a: a0, b: u1, c: u0, renk, yon: merkez(a0, u1, u0) });
    }
  }
  return flatGeometri(u);
}

/** İkosahedronun 12 köşesi ve 20 yüzü (birim). Bulut "topakları" bundan. */
const PHI = (1 + Math.sqrt(5)) / 2;
const IKO_K: V3[] = ([[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]] as V3[]).map((v) => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l] as V3; });
const IKO_Y: [number, number, number][] = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];

export interface BulutYeri { x: number; y: number; z: number; olcek: number }

/**
 * Bulutlar: her biri birkaç ikosahedron topağının kümesi (kümülüs). Gölge "pişmiş": yüz normali aşağı
 * baktıkça bulutGolge'ye kayar — ışıktan bağımsız, sanat yönü sabit. Tek geometri (tek çizim çağrısı).
 */
export function bulutGeometrisi(yerler: readonly BulutYeri[], rnd: () => number): Geometri {
  const u: Parameters<typeof flatGeometri>[0] = [];
  for (const y of yerler) {
    const topak = 5 + Math.floor(rnd() * 4);
    for (let t = 0; t < topak; t++) {
      const r = y.olcek * (0.55 + rnd() * 0.5);
      const cx = y.x + (rnd() - 0.5) * y.olcek * 2.4, cy = y.y + rnd() * y.olcek * 0.6, cz = y.z + (rnd() - 0.5) * y.olcek * 1.2;
      for (const [i, j, k] of IKO_Y) {
        const p = (v: V3): V3 => [cx + v[0] * r, cy + v[1] * r * 0.8, cz + v[2] * r];
        const a = p(IKO_K[i]!), b = p(IKO_K[j]!), c = p(IKO_K[k]!);
        const ny = (IKO_K[i]![1] + IKO_K[j]![1] + IKO_K[k]![1]) / 3;
        const yon: V3 = [(a[0] + b[0] + c[0]) / 3 - cx, (a[1] + b[1] + c[1]) / 3 - cy, (a[2] + b[2] + c[2]) / 3 - cz];
        u.push({ a, b, c, renk: karistir(PALET.bulutGolge, PALET.bulut, (ny + 0.35) / 0.9), yon });
      }
    }
  }
  return flatGeometri(u);
}

/** Bulutların yerleri: ufka yakın yüksek bir halkada, tohumlu. */
export function bulutYerleri(rnd: () => number, sayi: number = OVA.bulutSayisi): BulutYeri[] {
  return Array.from({ length: sayi }, () => {
    const aci = rnd() * Math.PI * 2, uzak = 170 + rnd() * 200;
    return { x: Math.cos(aci) * uzak, y: 55 + rnd() * 45, z: Math.sin(aci) * uzak, olcek: 14 + rnd() * 16 };
  });
}

/** Geometrinin üçgen sayısı. */
export const ucgenSayisi = (g: Geometri) => g.indeks.length / 3;
