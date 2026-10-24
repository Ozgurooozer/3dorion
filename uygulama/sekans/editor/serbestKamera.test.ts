// uygulama/sekans/editor/serbestKamera.test.ts — editör serbest kamerası: orbit, pan, zoom, uç (spec 38 §7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { EN_UZAK, EN_YAKIN } from "./kameraYardimcilari.ts";
import { kameraEksenleri, orbit, pan, serbestKameradan, serbestKonum, uc, zoom } from "./serbestKamera.ts";

const yakin = (a: number, b: number, t = 1e-6): void => assert.ok(Math.abs(a - b) < t, `${a} ≠ ${b}`);
const taban = () => serbestKameradan([0, 1.5, 3], [0, 1.5, 0], 50);

test("serbestKameradan ↔ serbestKonum gidiş-dönüş aynı konumu verir", () => {
  const k = serbestKameradan([2, 3, 4], [0.5, 1, -1], 45);
  const p = serbestKonum(k);
  yakin(p[0], 2); yakin(p[1], 3); yakin(p[2], 4);
});

test("kamera eksenleri: +Z'den hedefe bakınca ileri −Z, sağ −X?? (sol elli: +Z'ye bakarken sağ +X; −Z'ye bakınca sağ −X), yukarı +Y", () => {
  const e = kameraEksenleri(taban());
  yakin(e.ileri[2], -1); yakin(e.sag[0], -1); yakin(e.yukari[1], 1);
});

test("eksenler birbirine dik ve birim", () => {
  const e = kameraEksenleri(orbit(taban(), 80, -40));
  const nokta = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  yakin(nokta(e.ileri, e.sag), 0); yakin(nokta(e.ileri, e.yukari), 0); yakin(nokta(e.sag, e.yukari), 0);
  yakin(Math.hypot(...e.yukari), 1);
});

test("orbit: hedef ve mesafe korunur, sağa sürükleyince yatay açı azalır; yükselti ±85° ile sınırlı", () => {
  const k = orbit(taban(), 100, 0);
  yakin(k.yatay, -30); yakin(k.mesafe, 3); assert.deepEqual(k.hedef, [0, 1.5, 0]);
  yakin(orbit(taban(), 0, 10000).yukselti, 85); yakin(orbit(taban(), 0, -10000).yukselti, -85);
});

test("orbit sonrası konum hedefe aynı uzaklıkta", () => {
  const k = orbit(taban(), 123, 45), p = serbestKonum(k);
  yakin(Math.hypot(p[0] - k.hedef[0], p[1] - k.hedef[1], p[2] - k.hedef[2]), 3, 1e-9);
});

test("pan: hedef kamera düzleminde kayar (ileri eksende değil), sürüklenen yönün tersine; mesafe aynı", () => {
  const k = pan(taban(), 100, 0, 500);   // sağa sürükle → sahne sağa gelsin → kamera/hedef SOLA
  const e = kameraEksenleri(taban());
  const d = [k.hedef[0] - 0, k.hedef[1] - 1.5, k.hedef[2] - 0];
  yakin(d[0]! * e.ileri[0] + d[1]! * e.ileri[1] + d[2]! * e.ileri[2], 0);
  assert.ok(d[0]! * e.sag[0] + d[2]! * e.sag[2] < 0, "sağa sürükleme hedefi kamera sağının tersine alır");
  yakin(k.mesafe, 3);
});

test("pan ölçeği: yakın mesafede aynı piksel daha az metre", () => {
  const yak = pan({ ...taban(), mesafe: 1 }, 100, 0, 500), uz = pan({ ...taban(), mesafe: 4 }, 100, 0, 500);
  assert.ok(Math.abs(yak.hedef[0]) < Math.abs(uz.hedef[0]));
});

test("zoom: her adım %10, sınırlar 0,3–40 m", () => {
  yakin(zoom(taban(), 1).mesafe, 3.3); yakin(zoom(taban(), -1).mesafe, 3 / 1.1);
  yakin(zoom(taban(), -500).mesafe, EN_YAKIN); yakin(zoom(taban(), 500).mesafe, EN_UZAK);
});

test("uç: ileri tuşu hedefi ve konumu birlikte ilerletir (mesafe aynı); hareketsiz girdi aynı nesne", () => {
  const k = taban();
  assert.equal(uc(k, 0, 0, 0, 3, 0.1), k);
  const y = uc(k, 1, 0, 0, 3, 1);
  yakin(y.hedef[2], -3); yakin(y.mesafe, 3);
  yakin(serbestKonum(y)[2], 0, 1e-9);
});

test("uç: yukarı çıkış hedefi Y'de taşır, yan tuş kamera sağına", () => {
  const y = uc(taban(), 0, 1, 1, 2, 1);
  yakin(y.hedef[1], 3.5);
  yakin(y.hedef[0], -2);   // −Z'ye bakan kameranın sağı −X
});
