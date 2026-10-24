// world/avatar/rig/surukleme.test.ts — halka sürükleme: fare farkı → açı, kamera kuralından bağımsız (spec 38 §4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { surukleAcisi, type EkranaKoy } from "./surukleme.ts";

/** Ortografik kamera: dünya (x, y) → ekran (x·100, −y·100) (y ekranda aşağı artar); z derinlik. */
const onden: EkranaKoy = (p) => ({ x: p[0] * 100, y: -p[1] * 100 });

test("Z ekseni halkası, sağ nokta: fare YUKARI (ekranda dy<0) → pozitif açı (sağ el kuralı, Z etrafında saat yönünün tersi)", () => {
  const a = surukleAcisi([0, 0, 0], [0, 0, 1], [0.2, 0, 0], onden, 0, -10);
  assert.ok(a > 0, String(a));
});

test("aynı sürükleme ters yöne → eksi açı", () => {
  const a = surukleAcisi([0, 0, 0], [0, 0, 1], [0.2, 0, 0], onden, 0, 10);
  assert.ok(a < 0, String(a));
});

test("halkanın karşı tarafındaki noktadan tutunca aynı fare hareketi ters açı verir (teğet ters yönde)", () => {
  const sag = surukleAcisi([0, 0, 0], [0, 0, 1], [0.2, 0, 0], onden, 0, -10);
  const sol = surukleAcisi([0, 0, 0], [0, 0, 1], [-0.2, 0, 0], onden, 0, -10);
  assert.ok(Math.sign(sag) === -Math.sign(sol));
});

test("açı fare farkıyla orantılı: iki kat fare, iki kat açı (sınır altında)", () => {
  const a = surukleAcisi([0, 0, 0], [0, 0, 1], [0.2, 0, 0], onden, 0, -2);
  const b = surukleAcisi([0, 0, 0], [0, 0, 1], [0.2, 0, 0], onden, 0, -4);
  assert.ok(Math.abs(b / a - 2) < 0.02, `${a} ${b}`);
});

test("büyük yarıçapta aynı piksel daha küçük açı verir (açı = yay uzunluğu / yarıçap)", () => {
  const k = surukleAcisi([0, 0, 0], [0, 0, 1], [0.1, 0, 0], onden, 0, -3);
  const b = surukleAcisi([0, 0, 0], [0, 0, 1], [0.4, 0, 0], onden, 0, -3);
  assert.ok(Math.abs(k / b - 4) < 0.05, `${k} ${b}`);
});

test("teğet kameraya dönükse (ekranda yön yok) 0 döner, NaN değil", () => {
  // Kamera Z boyunca bakıyor; X ekseni halkasında nokta (0, 0.2, 0)'da teğet = X × Y = Z → ekranda iz yok.
  const a = surukleAcisi([0, 0, 0], [1, 0, 0], [0, 0.2, 0], onden, 5, 5);
  assert.equal(a, 0);
});

test("tek olayda açı sınırlanır (en çok 0,35 rad ≈ 20°)", () => {
  const a = surukleAcisi([0, 0, 0], [0, 0, 1], [0.2, 0, 0], onden, 0, -5000);
  assert.equal(a, 0.35);
});

test("nokta merkezdeyse 0", () => {
  assert.equal(surukleAcisi([0, 0, 0], [0, 0, 1], [0, 0, 0], onden, 0, -5), 0);
});

test("taşı oku: sağa sürüklemek X okunda artı metre; piksel/metre ölçeği (100 px = 1 m)", async () => {
  const { surukleOtelemesi } = await import("./surukleme.ts");
  assert.ok(Math.abs(surukleOtelemesi([0, 0, 0], [1, 0, 0], onden, 20, 0) - 0.2) < 1e-9);
  assert.ok(Math.abs(surukleOtelemesi([0, 0, 0], [1, 0, 0], onden, -10, 0) + 0.1) < 1e-9);
  assert.ok(Math.abs(surukleOtelemesi([0, 0, 0], [0, 1, 0], onden, 0, -20) - 0.2) < 1e-9, "Y oku ekranda yukarı: fare yukarı = artı");
});

test("taşı oku: kameraya bakan eksende 0, tek olayda en çok 0,25 m", async () => {
  const { surukleOtelemesi } = await import("./surukleme.ts");
  assert.equal(surukleOtelemesi([0, 0, 0], [0, 0, 1], onden, 50, 50), 0);
  assert.equal(surukleOtelemesi([0, 0, 0], [1, 0, 0], onden, 5000, 0), 0.25);
});
