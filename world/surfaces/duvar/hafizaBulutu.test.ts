// world/surfaces/duvar/hafizaBulutu.test.ts — Hafıza bulutunun yerleşimi (spec 13 Faz 5). Babylon'suz.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bulutYerlesimi, etiketleriAyir, kabukSayilari, sigmayanSozu, KABUK_YARICAPI, type BulutKelimesi } from "./hafizaBulutu.ts";

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

// ── başlık sayıları (spec 16 F3) ──
const kel = (kabuk: 0 | 1 | 2): BulutKelimesi => ({ kabuk, metin: "x", not: "", boyut: 0.5, soluk: 0, sayi: "" });

test("başlık: DERİN'de gösterilen ve gerçek toplam birlikte yazılır", () => {
  assert.equal(kabukSayilari([kel(0), kel(1), kel(2), kel(2)], 174), "SABİT 1 · ANLIK 1 · DERİN 2 / 174");
});

test("başlık: toplam verilmezse yalnız gösterilen sayı", () => {
  assert.equal(kabukSayilari([kel(2)]), "SABİT 0 · ANLIK 0 · DERİN 1");
});

test("etiketleriAyir: üst üste binen iki etiketin yüksek öncelikli olanı yerinde kalır, diğeri kayar ya da gizlenir", () => {
  const k = etiketleriAyir([{ i: 0, x: 50, y: 50, g: 40, yuk: 10, oncelik: 1 }, { i: 1, x: 52, y: 50, g: 40, yuk: 10, oncelik: 9 }]);
  assert.deepEqual(k.get(1), { x: 52, y: 50 });
  assert.notDeepEqual(k.get(0), { x: 50, y: 50 });
});

test("etiketleriAyir: kabul edilen hiçbir iki etiket çakışmaz (kalabalık girdi)", () => {
  const ad = Array.from({ length: 60 }, (_, i) => ({ i, x: 100 + (i % 7) * 6, y: 100 + (i % 5) * 3, g: 40, yuk: 10, oncelik: i % 11 }));
  const k = etiketleriAyir(ad);
  const l = [...k.entries()].map(([i, p]) => ({ ...p, g: 40, yuk: 10, i }));
  for (let a = 0; a < l.length; a++) for (let b = a + 1; b < l.length; b++) {
    assert.ok(Math.abs(l[a]!.x - l[b]!.x) >= 40 || Math.abs(l[a]!.y - l[b]!.y) >= 10, `${l[a]!.i} ile ${l[b]!.i} çakışıyor`);
  }
  assert.ok(k.size < 60);
});

test("etiketleriAyir: belirleyici", () => {
  const ad = Array.from({ length: 20 }, (_, i) => ({ i, x: 80 + i, y: 80, g: 30, yuk: 10, oncelik: i % 3 }));
  assert.deepEqual([...etiketleriAyir(ad)], [...etiketleriAyir(ad)]);
});

test("sığmayan kelimeler kabuklara göre söylenir; hiç yoksa boş", () => {
  assert.deepEqual([sigmayanSozu([0, 2, 35]), sigmayanSozu([0, 0, 0])], ["37 nokta (anlık 2, derin 35)", ""]);
});
