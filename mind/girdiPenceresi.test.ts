// mind/girdiPenceresi.test.ts — Girdi sayacı: pencere, boş pencere, içerik yok.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GirdiPenceresi } from "./girdiPenceresi.ts";
import { KARAR_ONEKI, KararKaydi, type KararSatiri } from "./kararKaydi.ts";

test("pencere dolunca sayılar tek kayıt olarak verilir ve sayaç sıfırlanır", () => {
  const p = new GirdiPenceresi(60_000);
  p.say("tus", 1000); p.say("tus", 2000); p.say("fare", 3000); p.say("soz", 4000);
  assert.equal(p.tikle(60_999), null, "pencere dolmadan");
  assert.deepEqual(p.tikle(61_000), { bas: 1000, pencereMs: 60_000, tus: 2, fare: 1, soz: 1 });
  assert.equal(p.tikle(200_000), null, "sıfırlandıktan sonra boş");
});

test("girdi yoksa hiç kayıt yok (boş pencere yazılmaz)", () => {
  const p = new GirdiPenceresi(60_000);
  for (let t = 0; t < 10 * 60_000; t += 1000) assert.equal(p.tikle(t), null);
});

test("dolmuş pencereden sonra gelen girdi önce eski pencereyi verir, sonra yenisini açar", () => {
  const p = new GirdiPenceresi(60_000);
  p.say("tus", 0);
  assert.deepEqual(p.say("fare", 90_000), { bas: 0, pencereMs: 60_000, tus: 1, fare: 0, soz: 0 });
  assert.deepEqual(p.tikle(150_000), { bas: 90_000, pencereMs: 60_000, tus: 0, fare: 1, soz: 0 });
});

test("karar kaydındaki girdi satırı yalnız sayı taşır", () => {
  const satirlar: KararSatiri[] = [];
  const k = new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))), simdi: () => 5 });
  k.girdi({ bas: 0, pencereMs: 60_000, tus: 3, fare: 7, soz: 1 });
  assert.deepEqual(Object.keys(satirlar[0]!).sort(), ["bas", "fare", "o", "pencereMs", "soz", "t", "tur", "tus"]);
});
