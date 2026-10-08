// world/level/cekirdek/glb.test.ts — glb biçim okuyucusu: koordinat, sarım, düğüm dönüşümü, bozuk dosya.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { glbOku } from "./glb.ts";
import type { V3 } from "./geometri.ts";

/** Tek üçgenli, tek düğümlü küçük glb (glTF koordinatında köşeler, CCW = +Z'ye bakan yüz). */
function glbYap(koseler: number[], dugum: Record<string, unknown> = {}): Uint8Array {
  const bin = new Uint8Array(new Float32Array(koseler).buffer);
  const json = {
    asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: "ucgen", mesh: 0, ...dugum }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: koseler.length / 3, type: "VEC3" }],
    bufferViews: [{ buffer: 0, byteLength: bin.byteLength }], buffers: [{ byteLength: bin.byteLength }],
  };
  let metin = JSON.stringify(json);
  while (metin.length % 4) metin += " ";
  const j = new TextEncoder().encode(metin);
  const toplam = 12 + 8 + j.length + 8 + bin.length;
  const out = new Uint8Array(toplam), d = new DataView(out.buffer);
  d.setUint32(0, 0x46546c67, true); d.setUint32(4, 2, true); d.setUint32(8, toplam, true);
  d.setUint32(12, j.length, true); d.setUint32(16, 0x4e4f534a, true); out.set(j, 20);
  const o = 20 + j.length;
  d.setUint32(o, bin.length, true); d.setUint32(o + 4, 0x004e4942, true); out.set(bin, o + 8);
  return out;
}

const UCGEN = [0, 0, 0, 1, 0, 0, 0, 1, 0]; // glTF'te +Z'ye bakar
const normal = ([a, b, c]: [V3, V3, V3]): V3 => {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
};

test("glb: x ekseni aynalanır (Babylon yükleyicisiyle aynı: x → -x)", () => {
  const [n] = glbOku(glbYap(UCGEN));
  assert.deepEqual(n!.ucgenler[0]!.map((p) => p[0] + 0).sort(), [-1, 0, 0]); // + 0: -0 → 0
});

test("glb: dışa bakan yüz dışa bakar kalır (+Z yüz → Babylon'da da +Z; ayna sarımı çevrilmiş)", () => {
  const [n] = glbOku(glbYap(UCGEN));
  assert.ok(normal(n!.ucgenler[0]!)[2] > 0);
});

test("glb: düğümün öteleme ve ölçeği köşelere uygulanır", () => {
  const [n] = glbOku(glbYap(UCGEN, { translation: [10, 2, 0], scale: [2, 2, 2] }));
  assert.deepEqual(n!.ucgenler[0]!.map((p) => p[1]).sort(), [2, 2, 4]);
});

test("glb: düğümün dönüşü uygulanır (Y çevresinde 90°: glTF +X → -Z)", () => {
  const s = Math.SQRT1_2;
  const [n] = glbOku(glbYap(UCGEN, { rotation: [0, s, 0, s] }));
  assert.ok(n!.ucgenler[0]!.some((p) => Math.abs(p[2] - -1) < 1e-6));
});

test("glb: düğüm adı korunur", () => {
  assert.equal(glbOku(glbYap(UCGEN))[0]!.ad, "ucgen");
});

test("glb değilse hata (sessiz boş sonuç yok)", () => {
  assert.throws(() => glbOku(new Uint8Array(40)), /glb değil/);
});
