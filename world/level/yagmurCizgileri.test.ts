// world/level/yagmurCizgileri.test.ts — Pencere yağmurunun çizgi üreticisi (spec 11, Faz 3).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { yagmurCizgileri } from "./yagmurCizgileri.ts";

test("aynı tohum aynı çizgileri verir (ekran görüntüsü karşılaştırması tekrarlanabilsin)", () => {
  assert.deepEqual(yagmurCizgileri(7, 40), yagmurCizgileri(7, 40));
});

test("farklı tohum farklı çizgiler verir", () => {
  assert.notDeepEqual(yagmurCizgileri(7, 40), yagmurCizgileri(8, 40));
});

test("istenen sayıda çizgi üretilir", () => {
  assert.equal(yagmurCizgileri(1, 0).length, 0);
  assert.equal(yagmurCizgileri(1, 120).length, 120);
});

test("her çizgi doku içinde başlar, boyu ve opaklığı sınırlı", () => {
  for (const c of yagmurCizgileri(3, 500)) {
    assert.ok(c.x >= 0 && c.x < 1, `x=${c.x}`);
    assert.ok(c.y >= 0 && c.y < 1, `y=${c.y}`);
    assert.ok(c.boy > 0 && c.boy <= 0.25, `boy=${c.boy}`);
    assert.ok(c.opaklik > 0 && c.opaklik <= 1, `opaklık=${c.opaklik}`);
  }
});

test("çizgiler dokunun tamamına yayılır (bir yarıya yığılmaz)", () => {
  const c = yagmurCizgileri(5, 400);
  const sol = c.filter((k) => k.x < 0.5).length;
  // 400 düzgün örnekte sol yarı ~200; ±60 = ~6 standart sapma, sahte kırmızı olmaz.
  assert.ok(Math.abs(sol - 200) < 60, `sol yarıda ${sol}/400`);
});
