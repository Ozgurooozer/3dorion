// world/player/oyuncuBeden.test.ts — Ozyn'in giysili bedeninin glb sözleşmesi (assets/oyuncu-beden.glb, üretim: tools/avatar-blender/oyuncu_giysi.py).
// Yükleyici klipleri ve iskeleti AD'la arar (`yuru`, `bosta`); dosya yeniden üretilince bunlar kaybolursa beden sessizce kayardı.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

interface Gltf { animations?: { name: string }[]; materials?: { name: string }[]; skins?: { joints: unknown[] }[] }

function glbOku(yol: string): Gltf {
  const b = readFileSync(new URL(yol, import.meta.url));
  assert.equal(b.toString("utf8", 0, 4), "glTF");
  return JSON.parse(b.toString("utf8", 20, 20 + b.readUInt32LE(12))) as Gltf;
}

const beden = glbOku("../../assets/oyuncu-beden.glb");
const orion = glbOku("../../assets/orion-lowpoly.glb");

test("beden: Orion'la AYNI klipler (yürüme/boşta/oturma) — oyuncu bedeni onların adıyla çalar", () => {
  const ad = (g: Gltf) => (g.animations ?? []).map((a) => a.name).sort();
  assert.deepEqual(ad(beden), ad(orion));
  for (const k of ["yuru", "bosta"]) assert.ok(ad(beden).includes(k), k);
});

test("beden: Orion'la aynı iskelet (52 kemik) — klipler aynı kemiklere bağlı", () => {
  assert.equal(beden.skins?.[0]?.joints.length, orion.skins?.[0]?.joints.length);
});

test("beden: giysi parçalarının her biri ayrı malzeme (pantolon, gömlek, ceket, ayakkabı, ten) — Orion beyazından farklı", () => {
  const adlar = (beden.materials ?? []).map((m) => m.name);
  for (const m of ["oyuncu_ten", "oyuncu_gomlek", "oyuncu_pantolon", "oyuncu_ayakkabi", "oyuncu_ceket"]) assert.ok(adlar.includes(m), m);
  assert.ok(!adlar.includes("orion_beyaz"), "Orion'un beyaz malzemesi kalmamalı");
});
