"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Saat, TIK_MS, TIK_HZ } from "./tik.ts";

test("20 Hz: 1 saniyelik ilerleme 20 tick üretir", () => {
  const s = new Saat();
  for (let i = 0; i < 20; i++) s.ilerle(TIK_MS); // 20 kare × 50ms
  assert.equal(s.tikSayisi, 20);
  assert.ok(Math.abs(s.t - 1) < 1e-9, `t=${s.t}`);
});

// 60 × (1000/60) = 999.99...ms → 19 tam tick + artık birikim. Bu doğru davranış:
// eksik kalan süre düşürülmez, sonraki karede tamamlanır. Tolerans 1 tick.
test("kesirli kare süreleri birikir, tick kaybolmaz", () => {
  const s = new Saat();
  for (let i = 0; i < 60; i++) s.ilerle(1000 / 60); // ~1 sn @ 60fps
  assert.ok(Math.abs(s.tikSayisi - TIK_HZ) <= 1, `tick=${s.tikSayisi}`);
  // artık birikim kaybolmadı: bir kare daha, eksik tick gelir
  s.ilerle(1000 / 60);
  assert.equal(s.tikSayisi, TIK_HZ);
});

test("yüksek FPS'te de 20 Hz kalır — render'a bağlı değil", () => {
  const s = new Saat();
  for (let i = 0; i < 144; i++) s.ilerle(1000 / 144);
  assert.ok(Math.abs(s.tikSayisi - TIK_HZ) <= 1, `tick=${s.tikSayisi}`);
});

test("uzun koşuda ölçülen frekans 20 Hz ± %5 — K1", () => {
  const s = new Saat();
  // 30 sn'lik dünya zamanı, 144 fps kare süreleriyle
  const kare = 1000 / 144;
  for (let i = 0; i < 144 * 30; i++) s.ilerle(kare);
  const beklenen = TIK_HZ * 30;
  const sapma = Math.abs(s.tikSayisi - beklenen) / beklenen;
  assert.ok(sapma < 0.05, `sapma %${(sapma * 100).toFixed(2)} (tick=${s.tikSayisi})`);
  assert.equal(s.atlanan, 0, "düzgün kare akışında tick düşmemeli");
});

test("dev dt sınırlanır: spiral of death yok", () => {
  const s = new Saat();
  s.ilerle(60_000); // pencere 1 dakika donmuş
  assert.ok(s.tikSayisi <= 5, `telafi patladı: ${s.tikSayisi}`);
  assert.ok(s.atlanan > 0, "düşürülen tick kaydedilmedi");
});

test("dinleyici hatası dünyayı durdurmaz, diğerleri çalışır", () => {
  const s = new Saat();
  let ikinci = 0;
  const sessiz = console.error;
  console.error = () => {};
  s.dinle(() => { throw new Error("patla"); });
  s.dinle(() => { ikinci++; });
  s.ilerle(TIK_MS * 3);
  console.error = sessiz;
  assert.equal(ikinci, 3);
});

test("abonelikten çıkma çalışır", () => {
  const s = new Saat();
  let n = 0;
  const cik = s.dinle(() => { n++; });
  s.ilerle(TIK_MS);
  cik();
  s.ilerle(TIK_MS * 5);
  assert.equal(n, 1);
});
