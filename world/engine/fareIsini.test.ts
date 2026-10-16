// world/engine/fareIsini.test.ts — ekran pikseli → dünya ışını (NullEngine, gerçek kamera).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";

const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
const { Scene } = await import("@babylonjs/core/scene.js");
const { FreeCamera } = await import("@babylonjs/core/Cameras/freeCamera.js");
const { Vector3 } = await import("@babylonjs/core/Maths/math.vector.js");
const { fareIsini } = await import("./fareIsini.ts");

function kur() {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const kamera = new FreeCamera("k", new Vector3(1, 2, 3), sahne);
  kamera.setTarget(new Vector3(1, 2, 13));   // +Z'ye bakar
  sahne.activeCamera = kamera;
  return { motor, sahne, kamera };
}

test("ekranın ORTASINDAKİ piksel kameranın baktığı yöne gider; kaynak kamera konumu", () => {
  const { motor, sahne, kamera } = kur();
  try {
    const r = fareIsini(sahne, kamera, motor.getRenderWidth() / 2, motor.getRenderHeight() / 2);
    assert.ok(Math.abs(r.yon.z - 1) < 1e-3 && Math.abs(r.yon.x) < 1e-3 && Math.abs(r.yon.y) < 1e-3, `yon ${JSON.stringify(r.yon)}`);
    assert.ok(Math.abs(r.kaynak.x - 1) < 1e-6 && Math.abs(r.kaynak.y - 2) < 1e-6, `kaynak ${JSON.stringify(r.kaynak)}`);
    assert.ok(r.kaynak.z >= 3 && r.kaynak.z <= 3 + kamera.minZ + 1e-6, `kaynak.z ${r.kaynak.z} (kamera 3, minZ ${kamera.minZ})`);
  } finally { motor.dispose(); }
});

test("yön BİRİM uzunlukta (isinAabb bunu ister)", () => {
  const { motor, sahne, kamera } = kur();
  try {
    const r = fareIsini(sahne, kamera, 10, 20);
    assert.ok(Math.abs(Math.hypot(r.yon.x, r.yon.y, r.yon.z) - 1) < 1e-9);
  } finally { motor.dispose(); }
});

test("ekranın SAĞINDAKİ piksel sağa (+X) bakar, SOLUNDAKİ sola", () => {
  const { motor, sahne, kamera } = kur();
  try {
    const y = motor.getRenderHeight() / 2;
    const sag = fareIsini(sahne, kamera, motor.getRenderWidth() * 0.9, y);
    const sol = fareIsini(sahne, kamera, motor.getRenderWidth() * 0.1, y);
    assert.ok(sag.yon.x > 0 && sol.yon.x < 0, `sag.x=${sag.yon.x} sol.x=${sol.yon.x}`);
  } finally { motor.dispose(); }
});

test("ekranın ÜSTÜNDEKİ piksel yukarı (+Y) bakar", () => {
  const { motor, sahne, kamera } = kur();
  try {
    const ust = fareIsini(sahne, kamera, motor.getRenderWidth() / 2, motor.getRenderHeight() * 0.1);
    assert.ok(ust.yon.y > 0, `ust.y=${ust.yon.y}`);
  } finally { motor.dispose(); }
});
