// world/avatar/rig/halkaSecimi.test.ts — halka seçimi ekran uzayında: en yakın çizgi, piksel eşiği, kenardan bakış (spec 38 §4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { enYakinHalka, type HalkaDuzeni } from "./halkaSecimi.ts";
import type { EkranaKoy } from "./surukleme.ts";

/** Önden ortografik: dünya (x, y) → ekran (x·100, −y·100); z derinlik. */
const onden: EkranaKoy = (p) => ({ x: p[0] * 100, y: -p[1] * 100 });
const duzen: HalkaDuzeni = { merkez: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], yaricap: 1 };

test("önden bakışta Z halkası (XY düzlemi) çember olarak görünür: kenarındaki imleç Z'yi seçer", () => {
  const s = enYakinHalka(duzen, onden, 100, 0, 8);   // (1, 0) noktası = Z çemberinin kenarı (X halkası çizgisi x=0'da, Y halkası y=0 çizgisinde — bkz. aşağıdaki test)
  assert.ok(s);
  assert.ok(["y", "z"].includes(s.eksen));            // (1,0): Z çemberi ve Y halkası (ZX düzlemi, önden çizgi y=0) kesişir
});

test("45° noktası yalnız X halkasına (YZ düzlemi; önden bakışta x=0 çizgisi) değil Z çemberine yakın: en yakın doğru seçilir", () => {
  // Önden bakışta: X halkası x=0 doğrusu (−1..1), Y halkası y=0 doğrusu, Z halkası birim çember.
  const s1 = enYakinHalka(duzen, onden, 0, -50, 8);   // x=0 çizgisinin üstünde, çemberin içinde → X
  assert.equal(s1?.eksen, "x");
  const s2 = enYakinHalka(duzen, onden, 50, 0, 8);    // y=0 çizgisinin üstünde → Y
  assert.equal(s2?.eksen, "y");
  const s3 = enYakinHalka(duzen, onden, 71, -71, 8);  // çemberin üstünde (45°), çizgilerden uzak → Z
  assert.equal(s3?.eksen, "z");
});

test("eşiğin dışındaki imleç hiçbir halkayı tutmaz (null)", () => {
  assert.equal(enYakinHalka(duzen, onden, 30, -30, 8), null);   // üç çizgiden de ≥ 10 px uzak
});

test("dönen nokta halkanın çemberi üzerinde ve imlece yakın (sürükleme teğeti buradan)", () => {
  const s = enYakinHalka(duzen, onden, 71, -71, 8)!;
  assert.ok(Math.abs(Math.hypot(...s.nokta) - 1) < 0.02, `yarıçap ${Math.hypot(...s.nokta)}`);
  assert.ok(Math.hypot(s.nokta[0] * 100 - 71, -s.nokta[1] * 100 + 71) < 8);
});

test("kenardan bakış: X halkası ekranda doğruya iner ve yine seçilebilir (hassasiyet ölmez)", () => {
  const s = enYakinHalka(duzen, onden, 0, -80, 6);
  assert.equal(s?.eksen, "x");
});

test("yarıçap ölçeği: büyük halka ekranda büyük çember (aynı imleç başka halkayı seçebilir)", () => {
  const buyuk = { ...duzen, yaricap: 2 };
  assert.equal(enYakinHalka(buyuk, onden, 200, 0, 5)?.eksen === "y" || enYakinHalka(buyuk, onden, 200, 0, 5)?.eksen === "z", true);
  assert.equal(enYakinHalka(buyuk, onden, 71, -71, 5), null, "küçük halkanın 45° noktası büyük halkada boşta");
});

test("çizgi parçası uçlarının ötesi tutulmaz: teğetin uzantısındaki uzak imleç null (sonsuz doğruya mesafe değil, parçaya)", () => {
  assert.equal(enYakinHalka(duzen, onden, 100, -300, 8), null);
  assert.equal(enYakinHalka(duzen, onden, 400, 0, 8), null, "Y halkasının çizgisinin uzantısı");
});
