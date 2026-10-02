// world/surfaces/hafizaBulutu.test.ts — Hafıza bulutunun yerleşimi (spec 13 Faz 5). Babylon'suz.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bulutYerlesimi, KABUK_YARICAPI, type BulutKelimesi } from "./hafizaBulutu.ts";

const k = (kabuk: 0 | 1 | 2, metin: string): BulutKelimesi => ({ kabuk, metin, not: "", boyut: 0.5, soluk: 0, sayi: "1" });
const KELIMELER = [k(0, "kayit"), k(0, "onay.insan"), k(1, "git → tahta"), k(2, "tahtaya git"), k(2, "otur"), k(2, "bana gel")];

test("belirleyici: aynı kelimeler ve açı → aynı yerleşim", () => {
  assert.deepEqual(bulutYerlesimi(KELIMELER, 0.4, -0.18, 100, 100, 50), bulutYerlesimi(KELIMELER, 0.4, -0.18, 100, 100, 50));
});

test("her kelime tam bir kez yerleşir", () => {
  const y = bulutYerlesimi(KELIMELER, 0.4, -0.18, 100, 100, 50);
  assert.deepEqual(y.map((p) => p.i).sort(), [0, 1, 2, 3, 4, 5]);
});

test("arkadan öne sıralı (derinlik artan): öndekiler üstte çizilsin", () => {
  const d = bulutYerlesimi(KELIMELER, 1.1, -0.18, 100, 100, 50).map((p) => p.derinlik);
  assert.deepEqual(d, [...d].sort((a, b) => a - b));
});

test("kabuklar iç içe: döndürmeden önce merkezden uzaklık kabuk yarıçapıyla orantılı", () => {
  // Dönme yok, perspektif etkisini ortadan kaldırmak için ölçek bölünür.
  const y = bulutYerlesimi(KELIMELER, 0, 0, 0, 0, 100);
  const uzaklik = (i: number) => { const p = y.find((q) => q.i === i)!; return Math.hypot(p.x, p.y) / p.olcek; };
  assert.ok(Math.max(uzaklik(0), uzaklik(1)) <= KABUK_YARICAPI[0] * 100 + 1e-6, "SABİT en içte");
  assert.ok(Math.max(uzaklik(3), uzaklik(4), uzaklik(5)) <= KABUK_YARICAPI[2] * 100 + 1e-6, "DERİN dışta");
});

test("boş liste boş yerleşim", () => {
  assert.deepEqual(bulutYerlesimi([], 0, 0, 0, 0, 10), []);
});
