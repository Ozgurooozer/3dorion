// world/level/odaEsyalari.test.ts — Blender'dan gelen oda modelinin (assets/oda-esyalar.glb)
// kod tarafındaki ölçülerle (olculer.ts) AYNI odayı anlattığının bekçisi (spec 11).
//
// Neden: model Blender betiğiyle üretilir, ölçüler olculer.ts'de yaşar. Biri değişip glb
// yeniden üretilmezse masa kodda bir yerde, ekranda başka yerde durur — Orion masaya
// yürür, havaya yazar. Bu test glb'yi Babylon'suz açar (GLB başlığı + JSON parçası) ve
// parçaların yerini olculer.ts'den türeyen beklentiyle karşılaştırır.
//
// Koordinat: Blender betiği Babylon noktasını (X, Y, Z) → glTF (−X, Y, Z) olarak yazar;
// Babylon glTF yükleyicisinin sağ-el → sol-el dönüşümü x'i geri çevirir. Burada da
// glTF x'i eksiyle çarpılarak Babylon'a dönülür.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MASA, ODA, BERJER, YIGIN, carpisiyorMu } from "./olculer.ts";
import { odaKipi, ODA_MODELI } from "./odaKipi.ts";

const GLB = new URL(`../../assets/${ODA_MODELI}`, import.meta.url);

interface GltfJson {
  nodes: { name: string; mesh?: number; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  meshes: { primitives: { attributes: { POSITION: number }; indices?: number }[] }[];
  accessors: { min?: number[]; max?: number[]; count: number }[];
  images?: { bufferView: number; mimeType: string }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
}

function glbOku(): { json: GltfJson; bin: Buffer; boyut: number } {
  const b = fs.readFileSync(GLB);
  assert.equal(b.readUInt32LE(0), 0x46546c67, "dosya GLB değil (magic 'glTF' yok)");
  const jsonUzunluk = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonUzunluk).toString("utf8")) as GltfJson;
  const binBas = 20 + jsonUzunluk;
  const bin = b.subarray(binBas + 8, binBas + 8 + b.readUInt32LE(binBas));
  return { json, bin, boyut: b.length };
}

type Uclu = [number, number, number];
interface Kutu3 { min: Uclu; max: Uclu }

/** Diziden üç sayı; eksikse anlaşılır hata. */
function uclu(d: number[] | undefined, ne: string): Uclu {
  assert.ok(d && d.length === 3, `${ne}: üç sayı bekleniyordu`);
  return [d[0] ?? NaN, d[1] ?? NaN, d[2] ?? NaN];
}

/** Düğümün Babylon dünya koordinatında kutusu (yalnız öteleme destekli — betik dönüş yazmaz). */
function babylonKutusu(json: GltfJson, ad: string): Kutu3 {
  const dugum = json.nodes.find((n) => n.name === ad);
  assert.ok(dugum && dugum.mesh !== undefined, `glb'de ${ad} düğümü yok`);
  assert.ok(!dugum.rotation && !dugum.scale, `${ad} dönüş/ölçek taşıyor; betik dünya koordinatında yazmalı`);
  const [tx, ty, tz] = uclu(dugum.translation ?? [0, 0, 0], `${ad} öteleme`);
  const mesh = json.meshes[dugum.mesh];
  assert.ok(mesh, `${ad}: mesh ${dugum.mesh} yok`);
  let [x0, y0, z0, x1, y1, z1] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of mesh.primitives) {
    const a = json.accessors[p.attributes.POSITION];
    assert.ok(a, `${ad}: POSITION erişimcisi yok`);
    const [ax0, ay0, az0] = uclu(a.min, `${ad} POSITION min`);
    const [ax1, ay1, az1] = uclu(a.max, `${ad} POSITION max`);
    x0 = Math.min(x0, ax0 + tx); y0 = Math.min(y0, ay0 + ty); z0 = Math.min(z0, az0 + tz);
    x1 = Math.max(x1, ax1 + tx); y1 = Math.max(y1, ay1 + ty); z1 = Math.max(z1, az1 + tz);
  }
  // glTF → Babylon: x eksi (yukarıdaki not).
  return { min: [-x1, y0, z0], max: [-x0, y1, z1] };
}

const merkez = (k: Kutu3): Uclu => [(k.min[0] + k.max[0]) / 2, (k.min[1] + k.max[1]) / 2, (k.min[2] + k.max[2]) / 2];

test("oda kipi: varsayılan yeni oda, ?oda=klasik eski kutu oda", () => {
  assert.equal(odaKipi(""), "yeni");
  assert.equal(odaKipi("?oda=klasik"), "klasik");
  assert.equal(odaKipi("?sessiz=1&oda=klasik"), "klasik");
  assert.equal(odaKipi("?oda=bilinmeyen"), "yeni");
});

test("berjer ve kutu yığını yürüme engelidir", () => {
  assert.equal(carpisiyorMu(BERJER.x, BERJER.z), true, "berjerin içinden yürünebiliyor");
  assert.equal(carpisiyorMu(YIGIN.x, YIGIN.z), true, "kutu yığınının içinden yürünebiliyor");
});

test("glb: masanın yeşil deri üstü MASA ölçüsünün üstünde duruyor", () => {
  const { json } = glbOku();
  const k = babylonKutusu(json, "oda_deri_yesil");
  const [x, y, z] = merkez(k);
  // Deri, masa üstünün ortasında, 4 cm öne kaydırılmış (betik: mz + 0.04); tolerans 2 cm.
  assert.ok(Math.abs(x - MASA.x) < 0.02, `deri x=${x.toFixed(3)}, masa x=${MASA.x}`);
  assert.ok(Math.abs(z - (MASA.z + 0.04)) < 0.02, `deri z=${z.toFixed(3)}, beklenen ${(MASA.z + 0.04).toFixed(3)}`);
  assert.ok(Math.abs(y - MASA.ustYuzey) < 0.02, `deri y=${y.toFixed(3)}, masa üstü ${MASA.ustYuzey}`);
});

test("glb: kırmızı berjer BERJER ölçüsünün yerinde", () => {
  const { json } = glbOku();
  const [x, , z] = merkez(babylonKutusu(json, "oda_deri_kirmizi"));
  // Berjer dönük ve asimetrik (sırt arkada): kutu merkezi konumdan 25 cm'e kadar kayar.
  assert.ok(Math.hypot(x - BERJER.x, z - BERJER.z) < 0.25, `berjer (${x.toFixed(2)}, ${z.toFixed(2)}), beklenen (${BERJER.x}, ${BERJER.z})`);
});

test("glb: bütün parçalar odanın içinde (cam duvarın eğimi ve ışıklık kuyusu payıyla)", () => {
  const { json } = glbOku();
  for (const n of json.nodes.filter((d) => d.mesh !== undefined)) {
    const k = babylonKutusu(json, n.name);
    const pay = 0.25;
    assert.ok(k.min[0] >= -ODA.genislik / 2 - pay && k.max[0] <= ODA.genislik / 2 + pay, `${n.name} x dışarıda: ${k.min[0].toFixed(2)}..${k.max[0].toFixed(2)}`);
    assert.ok(k.min[2] >= -ODA.derinlik / 2 - 0.6 && k.max[2] <= ODA.derinlik / 2 + pay, `${n.name} z dışarıda: ${k.min[2].toFixed(2)}..${k.max[2].toFixed(2)}`);
    assert.ok(k.min[1] >= -0.01 && k.max[1] <= ODA.yukseklik + 0.6, `${n.name} y dışarıda: ${k.min[1].toFixed(2)}..${k.max[1].toFixed(2)}`);
  }
});

test("glb bütçesi: ≤ 50k üçgen, ≤ 4 MB, dokular ≤ 1024 px", () => {
  const { json, bin, boyut } = glbOku();
  let ucgen = 0;
  for (const m of json.meshes) for (const p of m.primitives) ucgen += (json.accessors[p.indices ?? p.attributes.POSITION]?.count ?? NaN) / 3;
  assert.ok(ucgen <= 50_000, `üçgen ${ucgen}`);
  assert.ok(boyut <= 4 * 1024 * 1024, `glb ${boyut} bayt`);
  for (const img of json.images ?? []) {
    assert.equal(img.mimeType, "image/png");
    const bv = json.bufferViews[img.bufferView];
    assert.ok(bv, `doku bufferView ${img.bufferView} yok`);
    const png = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    assert.ok(w <= 1024 && h <= 1024, `doku ${w}×${h}`);
  }
});
