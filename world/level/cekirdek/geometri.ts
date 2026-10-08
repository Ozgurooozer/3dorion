// world/level/cekirdek/geometri.ts — Lowpoly (flat) geometri: saf diziler + Babylon mesh'e sarma.
//
// LOWPOLY = FLAT: her üçgenin kendi köşeleri var (paylaşım yok), normal üçgenin yüz normali, renk üçgen
// başına. Modüller üçgen listesi verir; buradaki iki fonksiyon onu diziye ve mesh'e çevirir. Saf kısım
// (`flatGeometri`) sahnesiz test edilir.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Renk } from "./renk.ts";

export type V3 = [number, number, number];

export interface Geometri {
  konum: Float32Array;
  renk: Float32Array;   // rgba
  normal: Float32Array;
  indeks: Uint32Array;
}

export interface Ucgen {
  a: V3; b: V3; c: V3;
  renk: Renk;
  /** Normalin bakması gereken yön (ör. zemin: yukarı, gök: içe). Verilmezse köşe sırasından. */
  yon?: V3;
}

/** Üçgen listesinden flat geometri. */
export function flatGeometri(ucgenler: readonly Ucgen[]): Geometri {
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
    // Babylon sol elli: ön yüz, normale bakan göze göre köşe sırası çapraz çarpımın tersi → a, c, b.
    // (İlk sürüm a, b, c yazdı: zemin üstten, gök içeriden ayıklanıp görünmedi — ekran görüntüsünde yakalandı.)
    [a, c, b].forEach((p, k) => {
      konum.set(p, i * 9 + k * 3);
      normal.set([nx, ny, nz], i * 9 + k * 3);
      renk.set([u.renk[0], u.renk[1], u.renk[2], 1], i * 12 + k * 4);
      indeks[i * 3 + k] = i * 3 + k;
    });
  });
  return { konum, renk, normal, indeks };
}

/** Geometrinin üçgen sayısı. */
export const ucgenSayisi = (g: Geometri) => g.indeks.length / 3;

/** Geometriyi mesh'e sarar (seçilemez; seçim gerekiyorsa modül açar). */
export function meshKur(sahne: Scene, ad: string, g: Geometri): Mesh {
  const m = new Mesh(ad, sahne);
  const v = new VertexData();
  v.positions = g.konum; v.colors = g.renk; v.normals = g.normal; v.indices = g.indeks;
  v.applyToMesh(m, false);
  m.isPickable = false;
  return m;
}
