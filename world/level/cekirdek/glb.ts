// world/level/cekirdek/glb.ts — glb'den YALNIZ BİÇİM okur (konum + üçgen), Babylon koordinatında. Saf.
//
// Neden Babylon'un glTF yükleyicisi değil: level modülleri biçimi kendi flat geometrisine (cekirdek/geometri.ts)
// çevirip PALETTEN boyuyor; malzeme, doku, normal gerekmiyor. Saf ayrıştırıcı sahnesiz test edilir (bekçi testi
// gerçek varlık dosyasını okur) ve yükleyici paketini level'in import ağacına sokmaz.
//
// Koordinat: glTF sağ elli (+Y yukarı); Babylon sol elli. Babylon'un yükleyicisiyle AYNI sonuç: (x, y, z) →
// (-x, y, z) (kök düğümün 180° Y dönüşü × Z aynası). Ayna sarımı ters çevirir: glTF'te dışa bakan (CCW) üçgen
// burada b↔c değiştirilerek verilir — `Ucgen` sözleşmesi: (b−a)×(c−a) dışa baksın (geometri.ts).
"use strict";
import type { V3 } from "./geometri.ts";

export interface GlbNesnesi {
  /** Düğüm adı (Blender nesne adı). */
  ad: string;
  /** Babylon dünya koordinatında üçgenler (her biri 3 köşe), dışa bakan sarımla. */
  ucgenler: [V3, V3, V3][];
}

const JSON_PARCA = 0x4e4f534a, BIN_PARCA = 0x004e4942;
const BILESEN: Record<number, { boy: number; oku: (d: DataView, o: number) => number }> = {
  5121: { boy: 1, oku: (d, o) => d.getUint8(o) },
  5123: { boy: 2, oku: (d, o) => d.getUint16(o, true) },
  5125: { boy: 4, oku: (d, o) => d.getUint32(o, true) },
  5126: { boy: 4, oku: (d, o) => d.getFloat32(o, true) },
};
const TUR_BOYU: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

interface Gltf {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: { name?: string; mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  meshes?: { primitives: { attributes: Record<string, number>; indices?: number; mode?: number }[] }[];
  accessors?: { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string }[];
  bufferViews?: { byteOffset?: number; byteLength: number; byteStride?: number }[];
}

type M4 = number[]; // sütun öncelikli (glTF)
const BIRIM: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const carp = (a: M4, b: M4): M4 => Array.from({ length: 16 }, (_, i) => {
  const s = i >> 2, r = i & 3;
  return a[r]! * b[s * 4]! + a[4 + r]! * b[s * 4 + 1]! + a[8 + r]! * b[s * 4 + 2]! + a[12 + r]! * b[s * 4 + 3]!;
});
function trs(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]): M4 {
  const [x, y, z, w] = q as [number, number, number, number];
  const [sx, sy, sz] = s as [number, number, number];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    t[0]!, t[1]!, t[2]!, 1,
  ];
}
const uygula = (m: M4, p: V3): V3 => [
  m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!,
  m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!,
  m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!,
];

/** glb baytlarından mesh'li düğümler. Bozuk/desteklenmeyen dosya HATA verir (sessiz boş sonuç yok). */
export function glbOku(veri: ArrayBuffer | Uint8Array): GlbNesnesi[] {
  const u8 = veri instanceof Uint8Array ? veri : new Uint8Array(veri);
  const d = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (u8.byteLength < 20 || d.getUint32(0, true) !== 0x46546c67) throw new Error("glb değil (sihirli sayı yok)");
  if (d.getUint32(4, true) !== 2) throw new Error("glb sürümü 2 değil");
  let gltf: Gltf | null = null, bin: DataView | null = null;
  for (let o = 12; o + 8 <= u8.byteLength;) {
    const boy = d.getUint32(o, true), tur = d.getUint32(o + 4, true);
    if (tur === JSON_PARCA) gltf = JSON.parse(new TextDecoder().decode(u8.subarray(o + 8, o + 8 + boy))) as Gltf;
    if (tur === BIN_PARCA) bin = new DataView(u8.buffer, u8.byteOffset + o + 8, boy);
    o += 8 + boy;
  }
  if (!gltf) throw new Error("glb: JSON parçası yok");
  const g = gltf;

  const erisimci = (i: number): number[] => {
    const a = g.accessors?.[i];
    if (!a || a.bufferView === undefined || !bin) throw new Error(`glb: erişimci ${i} okunamıyor`);
    const bv = g.bufferViews![a.bufferView]!;
    const b = BILESEN[a.componentType], n = TUR_BOYU[a.type];
    if (!b || !n) throw new Error(`glb: desteklenmeyen erişimci türü ${a.componentType}/${a.type}`);
    const adim = bv.byteStride ?? b.boy * n, bas = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out: number[] = [];
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out.push(b.oku(bin, bas + k * adim + c * b.boy));
    return out;
  };

  const sonuc: GlbNesnesi[] = [];
  const gez = (i: number, ust: M4) => {
    const n = g.nodes?.[i];
    if (!n) throw new Error(`glb: düğüm ${i} yok`);
    const m = carp(ust, n.matrix ?? trs(n.translation, n.rotation, n.scale));
    if (n.mesh !== undefined) {
      const ucgenler: [V3, V3, V3][] = [];
      for (const p of g.meshes![n.mesh]!.primitives) {
        if ((p.mode ?? 4) !== 4) throw new Error(`glb: "${n.name}" üçgen olmayan çizim kipi ${p.mode}`);
        const konum = erisimci(p.attributes["POSITION"]!);
        const kose = (k: number): V3 => { const q = uygula(m, [konum[k * 3]!, konum[k * 3 + 1]!, konum[k * 3 + 2]!]); return [-q[0], q[1], q[2]]; };
        const indeks = p.indices !== undefined ? erisimci(p.indices) : Array.from({ length: konum.length / 3 }, (_, k) => k);
        for (let t = 0; t + 2 < indeks.length; t += 3) ucgenler.push([kose(indeks[t]!), kose(indeks[t + 2]!), kose(indeks[t + 1]!)]);
      }
      sonuc.push({ ad: n.name ?? `dugum_${i}`, ucgenler });
    }
    for (const c of n.children ?? []) gez(c, m);
  };
  for (const i of g.scenes?.[g.scene ?? 0]?.nodes ?? []) gez(i, BIRIM);
  return sonuc;
}
