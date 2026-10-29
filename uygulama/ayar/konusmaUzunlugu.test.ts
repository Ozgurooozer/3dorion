// uygulama/ayar/konusmaUzunlugu.test.ts — Konuşma uzunluğu ayarı: varsayılan kısa, geçerli seçim okunur, bozuk/erişilemez depo varsayılana düşer.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { konusmaUzunluguOku, konusmaUzunluguYaz } from "./konusmaUzunlugu.ts";

const sahteDepo = (ilk?: string) => { let v = ilk ?? null; return { getItem: () => v, setItem: (_k: string, y: string) => { v = y; } }; };

test("kayıt yoksa varsayılan kısa", () => assert.equal(konusmaUzunluguOku(sahteDepo()), "kisa"));
test("yazılan seçim geri okunur", () => {
  const d = sahteDepo();
  assert.equal(konusmaUzunluguYaz("uzun", d), true);
  assert.equal(konusmaUzunluguOku(d), "uzun");
});
test("bozuk kayıt (bilinmeyen ad, prototip adı) varsayılana düşer", () => {
  assert.equal(konusmaUzunluguOku(sahteDepo("sonsuz")), "kisa");
  assert.equal(konusmaUzunluguOku(sahteDepo("toString")), "kisa");
});
test("depo yok ya da atarsa: okuma varsayılan, yazma false", () => {
  const atan = { getItem: () => { throw new Error("yok"); }, setItem: () => { throw new Error("yok"); } };
  assert.equal(konusmaUzunluguOku(atan), "kisa");
  assert.equal(konusmaUzunluguYaz("orta", atan), false);
  assert.equal(konusmaUzunluguYaz("orta", null), false);
  assert.equal(konusmaUzunluguOku(null), "kisa");
});
