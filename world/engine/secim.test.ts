// world/engine/secim.test.ts — TIKLAMA gerçekten doğru nesneyi mi buluyor?
//
// `giris.ts` odaktayken `sahne.pick(e.offsetX, e.offsetY)` ile tıklanan yüzeyi
// bulup oraya geçiyor. Buradaki varsayım sessiz: `offsetX/Y` (CSS pikseli,
// tuvale göre) ile Babylon'un beklediği koordinat sisteminin AYNI olması.
//
// Yanlışsa hiçbir hata çıkmaz — tıklama sadece ıskalar ve özellik "çalışmıyor"
// görünür. Gözle ayırt etmesi de zor: "tam üstüne tıklamadım herhalde" denir.
// O yüzden koordinat sözleşmesi burada sabitleniyor.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";

const g = globalThis as unknown as Record<string, unknown>;
g.document ??= { pointerLockElement: null, addEventListener() {}, removeEventListener() {}, exitPointerLock() {} };
g.addEventListener ??= () => {};
g.removeEventListener ??= () => {};

const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
const { Scene } = await import("@babylonjs/core/scene.js");
const { Vector3 } = await import("@babylonjs/core/Maths/math.vector.js");
const { FreeCamera } = await import("@babylonjs/core/Cameras/freeCamera.js");
const { CreatePlane } = await import("@babylonjs/core/Meshes/Builders/planeBuilder.js");
// Picking YAN ETKİSİ. Bu satır olmadan `sahne.pick` sessizce `hit:false`
// döner ve "tıklama çalışmıyor" gibi görünür — testin ilk koşusunda tam
// olarak bu oldu ve gerçek bir kırılganlığı ortaya çıkardı.
await import("@babylonjs/core/Culling/ray.js");

/** Kameranın tam karşısına, metadata'lı bir düzlem koyar. */
function duzenek() {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const kamera = new FreeCamera("k", new Vector3(0, 0, 0), sahne);
  kamera.rotationQuaternion = null;
  kamera.rotation.set(0, 0, 0);          // -Z yönüne bakar
  sahne.activeCamera = kamera;

  // Kameranın 3 m önünde, ona dönük bir yüzey.
  const yuzey = CreatePlane("hedef", { width: 2, height: 2 }, sahne);
  yuzey.position.set(0, 0, 3);
  yuzey.metadata = { capa: "monitor" };

  // Matrisler ilk render'da hesaplanıyor; öncesinde pick anlamsız.
  sahne.render();

  return { motor, sahne, kamera, yuzey,
    orta: () => [motor.getRenderWidth() / 2, motor.getRenderHeight() / 2] as const };
}

test("EKRAN ORTASINA tıklamak tam karşıdaki yüzeyi bulur", () => {
  const d = duzenek();
  try {
    const [x, y] = d.orta();
    const p = d.sahne.pick(x, y);
    assert.ok(p?.hit, "isin hicbir seye carpmadi — koordinat sozlesmesi yanlis olabilir");
    assert.equal(p.pickedMesh?.name, "hedef");
  } finally { d.motor.dispose(); }
});

test("metadata.capa okunabiliyor — geçiş tablosu buna bakıyor", () => {
  const d = duzenek();
  try {
    const [x, y] = d.orta();
    const capa = (d.sahne.pick(x, y)?.pickedMesh?.metadata as { capa?: string } | undefined)?.capa;
    assert.equal(capa, "monitor");
  } finally { d.motor.dispose(); }
});

test("KÖŞEYE tıklamak yüzeyi bulmaz — ıska ıska olmalı", () => {
  const d = duzenek();
  try {
    const p = d.sahne.pick(2, 2);          // sol üst köşe: 2x2 düzlem oraya düşmez
    assert.ok(!p?.hit || p.pickedMesh?.name !== "hedef",
      "kosede yuzey bulundu — pick cok gevsek");
  } finally { d.motor.dispose(); }
});

test("ARKADAKİ yüzey seçilmez — kameranın gerisi tıklanamaz", () => {
  const d = duzenek();
  try {
    d.yuzey.position.set(0, 0, -3);        // kameranın arkasına al
    // Dünya matrisi ÖNBELLEKLİ: taşıdıktan sonra yeniden hesaplanmazsa ışın
    // hâlâ eski konumu görür ve test yanlış yere "geçti/kaldı" der.
    d.yuzey.computeWorldMatrix(true);
    const [x, y] = d.orta();
    const p = d.sahne.pick(x, y);
    assert.ok(!p?.hit || p.pickedMesh?.name !== "hedef", "arkadaki yuzey secilmemeli");
  } finally { d.motor.dispose(); }
});

test("isPickable=false olan yüzey seçilmez — oyuncu gövdesi böyle", () => {
  const d = duzenek();
  try {
    d.yuzey.isPickable = false;
    const [x, y] = d.orta();
    const p = d.sahne.pick(x, y);
    assert.ok(!p?.hit || p.pickedMesh?.name !== "hedef", "isPickable=false secilmemeli");
  } finally { d.motor.dispose(); }
});
