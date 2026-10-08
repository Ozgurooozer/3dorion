// world/level/editor/aralik.test.ts — Panel kaydırıcı aralıkları ve etiketler.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { aralikBul, turetilmisAralik, etiket } from "./aralik.ts";

test("modülün aralığı önce gelir", () => {
  assert.deepEqual(aralikBul(["katmanlar", 3, "ayar", "sayi"], 9, { sayi: { min: 0, max: 50, adim: 1 } }), { min: 0, max: 50, adim: 1 });
});

test("ışık alanı sabit tablodan (yolun son iki parçası)", () => {
  assert.equal(aralikBul(["isik", "gunes", "golge", "koyuluk"], 0.35).max, 1);
});

test("dizi elemanı dizinin aralığını alır (güneş yönü)", () => {
  assert.deepEqual(aralikBul(["isik", "gunes", "yon", 0], -0.55), { min: -1, max: 1, adim: 0.01 });
});

test("bilinmeyen tamsayı alanı tamsayı adımıyla türetilir", () => {
  assert.deepEqual(turetilmisAralik(4), { min: 0, max: 12, adim: 1 });
});

test("türetilmiş aralık değeri her zaman içerir", () => {
  for (const v of [0.0042, 0.35, 2.2, 55, -0.7, 480]) {
    const a = turetilmisAralik(v);
    assert.ok(a.min <= v && v <= a.max, String(v));
  }
});

test("etiket: bilinen ad Türkçe, bilinmeyen camelCase ayrışır", () => {
  assert.deepEqual([etiket("siddet"), etiket("yeniAlanAdi"), etiket(2)], ["şiddet", "yeni alan adi", "2"]);
});
