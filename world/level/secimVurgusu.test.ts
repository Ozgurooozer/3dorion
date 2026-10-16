// world/level/secimVurgusu.test.ts — seçim çerçevesi: görünür/gizli, kutuya yerleşir ve ölçeklenir, ışına kapalı (NullEngine).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";

const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
const { Scene } = await import("@babylonjs/core/scene.js");
const { secimVurgusuKur, VURGU_SISMESI } = await import("./secimVurgusu.ts");

const KUTU = { x: 4.6, y: 0.39, z: 6.6, g: 1.6, yuk: 0.88, d: 0.5 };

function kur() {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const v = secimVurgusuKur(sahne);
  const cizgi = sahne.getMeshByName("secim_vurgusu")!;
  return { motor, sahne, v, cizgi };
}

test("başlangıçta çerçeve GİZLİ", () => {
  const { motor, cizgi } = kur();
  try { assert.equal(cizgi.isEnabled(), false); } finally { motor.dispose(); }
});

test("goster(kutu): çerçeve açılır, kutunun merkezine konur ve kutu + şişme kadar ölçeklenir", () => {
  const { motor, v, cizgi } = kur();
  try {
    v.goster(KUTU);
    assert.equal(cizgi.isEnabled(), true);
    assert.deepEqual([cizgi.position.x, cizgi.position.y, cizgi.position.z], [KUTU.x, KUTU.y, KUTU.z]);
    const s = 2 * VURGU_SISMESI;
    assert.ok(Math.abs(cizgi.scaling.x - (KUTU.g + s)) < 1e-9 && Math.abs(cizgi.scaling.y - (KUTU.yuk + s)) < 1e-9 && Math.abs(cizgi.scaling.z - (KUTU.d + s)) < 1e-9);
  } finally { motor.dispose(); }
});

test("goster(null): çerçeve gizlenir", () => {
  const { motor, v, cizgi } = kur();
  try { v.goster(KUTU); v.goster(null); assert.equal(cizgi.isEnabled(), false); assert.equal(v.sinir(), null); } finally { motor.dispose(); }
});

test("başka kutuya geçince çerçeve taşınır (mesh çoğalmaz)", () => {
  const { motor, sahne, v, cizgi } = kur();
  try {
    const once = sahne.meshes.length;
    v.goster(KUTU); v.goster({ x: 0, y: 1, z: 0, g: 1, yuk: 2, d: 1 });
    assert.equal(sahne.meshes.length, once);
    assert.deepEqual([cizgi.position.x, cizgi.position.y], [0, 1]);
  } finally { motor.dispose(); }
});

test("çerçeve ışına/tıklamaya KAPALI", () => {
  const { motor, cizgi } = kur();
  try { assert.equal(cizgi.isPickable, false); } finally { motor.dispose(); }
});

test("çerçeve bir küpün 12 kenarıdır: 24 köşe (kenar başına 2)", () => {
  const { motor, cizgi } = kur();
  try { assert.equal(cizgi.getTotalVertices(), 24); } finally { motor.dispose(); }
});

test("sinir(): kutunun şişirilmiş dünya sınırlarını verir", () => {
  const { motor, v } = kur();
  try {
    v.goster(KUTU);
    const s = v.sinir()!;
    assert.ok(Math.abs(s.min[0] - (KUTU.x - KUTU.g / 2 - VURGU_SISMESI)) < 1e-9 && Math.abs(s.max[1] - (KUTU.y + KUTU.yuk / 2 + VURGU_SISMESI)) < 1e-9);
  } finally { motor.dispose(); }
});
