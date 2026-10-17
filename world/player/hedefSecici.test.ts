// world/player/hedefSecici.test.ts — sağ tık hedefleri: ışın zemini nerede keser, Orion'un gövdesine ne zaman isabet eder.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { orionuVur, zeminNoktasi, ORION_KUTUSU } from "./hedefSecici.ts";

const duz = () => 0;
const asagi45 = { x: 0, y: -Math.SQRT1_2, z: Math.SQRT1_2 };

test("zemin: 45° aşağı bakan ışın 2 m yükseklikten 2 m ileride zemini keser", () => {
  const p = zeminNoktasi({ x: 0, y: 2, z: 0 }, asagi45, duz)!;
  assert.ok(Math.abs(p.z - 2) < 1e-9 && Math.abs(p.x) < 1e-9 && p.y === 0, JSON.stringify(p));
});

test("zemin: yukarı ya da yatay bakan ışın zemini kesmez (gökyüzü)", () => {
  assert.equal(zeminNoktasi({ x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: 1 }, duz), null);
  assert.equal(zeminNoktasi({ x: 0, y: 2, z: 0 }, { x: 0, y: 0.5, z: 0.5 }, duz), null);
});

test("zemin: menzilin ötesindeki zemin null (ufka yakın bakış)", () => {
  const yatayaYakin = { x: 0, y: -0.001, z: 1 };
  assert.equal(zeminNoktasi({ x: 0, y: 1.6, z: 0 }, yatayaYakin, duz), null);
});

test("zemin: yamaç (zemin yüksekliği konuma bağlı) kesişimde yükseklik OTURUR", () => {
  const rampa = (_x: number, z: number) => 0.1 * z;   // her metrede 10 cm yükselir
  const p = zeminNoktasi({ x: 0, y: 3, z: 0 }, asagi45, rampa)!;
  assert.ok(Math.abs(p.y - 0.1 * p.z) < 1e-3, `y=${p.y} z=${p.z}`);
});

test("Orion: ayakta duran gövdeye ön tarafından isabet; mesafe gövde yüzüne kadar", () => {
  const t = orionuVur({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 5 }, false)!;
  assert.ok(Math.abs(t - (5 - ORION_KUTUSU.derinlik / 2)) < 1e-9, String(t));
});

test("Orion: omzunun yanından geçen ışın vurmaz", () => {
  assert.equal(orionuVur({ x: 1, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 5 }, false), null);
});

test("Orion: oturunca kutu alçalır; baş hizasından geçen ışın artık vurmaz", () => {
  const isin = { kaynak: { x: 0, y: 1.7, z: 0 }, yon: { x: 0, y: 0, z: 1 } };
  assert.notEqual(orionuVur(isin.kaynak, isin.yon, { x: 0, y: 0, z: 5 }, false), null);
  assert.equal(orionuVur(isin.kaynak, isin.yon, { x: 0, y: 0, z: 5 }, true), null);
});

test("Orion: arkada kalan gövde (ışın ters yöne) vurulmaz; kaynak gövdenin içindeyse null", () => {
  assert.equal(orionuVur({ x: 0, y: 1, z: 10 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 5 }, false), null);
  assert.equal(orionuVur({ x: 0, y: 1, z: 5 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 5 }, false), null);
});
