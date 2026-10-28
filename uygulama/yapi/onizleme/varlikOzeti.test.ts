// uygulama/yapi/onizleme/varlikOzeti.test.ts — GERÇEK GLB'DEN özet (spec 39 D5): assets/orion-lowpoly.glb başsız NullEngine'de yüklenir, sayılar sahne nesneleriyle tutarlı olmalı.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { varlikOzetle } from "./varlikOzeti.ts";

const Z = { timeout: 120_000 };

test("orion-lowpoly.glb özeti: mesh/üçgen/köşe sahneyle aynı, iskelet-kemik sayıları tutarlı, kemik ağacı ata önce, boyut insan ölçeğinde, malzeme adlı", Z, async () => {
  const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
  const { Scene } = await import("@babylonjs/core/scene.js");
  const { ImportMeshAsync } = await import("@babylonjs/core/Loading/sceneLoader.js");
  await import("@babylonjs/loaders/glTF/index.js");
  const motor = new NullEngine(), sahne = new Scene(motor);
  const u = console.warn; console.warn = () => {};
  try {
    const url = `data:model/gltf-binary;base64,${readFileSync(new URL("../../../assets/orion-lowpoly.glb", import.meta.url)).toString("base64")}`;
    const r = await ImportMeshAsync(url, sahne, { pluginExtension: ".glb" });
    const o = varlikOzetle(r);
    const cizilebilir = r.meshes.filter((m) => m.getTotalVertices() > 0);
    assert.ok(o.meshler.length >= 1 && o.meshler.length === cizilebilir.length, "yalnız köşesi olan meshler");
    assert.equal(o.kose, cizilebilir.reduce((t, m) => t + m.getTotalVertices(), 0));
    assert.equal(o.ucgen, cizilebilir.reduce((t, m) => t + Math.floor(m.getTotalIndices() / 3), 0));
    assert.ok(o.ucgen > 1000, `üçgen=${o.ucgen}`);
    assert.equal(o.meshler.reduce((t, m) => t + m.ucgen, 0), o.ucgen);
    assert.ok(o.iskeletler.length >= 1);
    const kemikToplam = r.skeletons.reduce((t, s) => t + s.bones.length, 0);
    assert.equal(o.iskeletler.reduce((t, s) => t + s.kemik, 0), kemikToplam);
    assert.ok(kemikToplam >= 20, `kemik=${kemikToplam}`);
    assert.equal(o.kemikler.length, new Set(r.skeletons.flatMap((s) => s.bones.map((b) => b.name))).size, "her ad bir kez");
    const gorulen = new Set<string>();
    for (const k of o.kemikler) { assert.ok(k.ust === null || gorulen.has(k.ust) || k.derinlik === 0, `ata önce: ${k.ad}`); gorulen.add(k.ad); }
    assert.ok(o.meshler.some((m) => m.kemikli), "gövde meshi iskelete bağlı");
    assert.ok(o.boyut[1] > 0.5 && o.boyut[1] < 3 && o.boyut[0] > 0.1 && o.boyut[2] > 0.02, `boyut=${o.boyut.join(",")}`);
    assert.ok(o.malzemeler.length >= 1 && o.malzemeler.every((m) => m.ad && m.tur));
    for (const a of o.animasyonlar) assert.ok(a.ad && a.saniye >= 0);
    assert.equal(o.animasyonlar.length, r.animationGroups.length);
  } finally { console.warn = u; sahne.dispose(); motor.dispose(); }
});

test("boş yükleme (mesh/iskelet/animasyon yok): sıfırlı özet, çökmez", () => {
  const o = varlikOzetle({ meshes: [], skeletons: [], animationGroups: [] });
  assert.deepEqual(o, { meshler: [], ucgen: 0, kose: 0, iskeletler: [], kemikler: [], malzemeler: [], animasyonlar: [], boyut: [0, 0, 0] });
});
