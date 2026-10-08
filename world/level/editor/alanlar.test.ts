// world/level/editor/alanlar.test.ts — Level tanımının düzenlenebilir alanları.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { alanlar, alanTuru, yolaYaz, yoldanOku } from "./alanlar.ts";

const PALET = new Set(["cim", "gok"]);

test("türler: sayı, mantık, renk, palet adı, metin, diziler", () => {
  assert.deepEqual([3, true, "#a0b0c0", "cim", "serbest", [1, 2], ["cim", "gok"]].map((v) => alanTuru(v, PALET)),
    ["sayi", "mantik", "renk", "paletAdi", "metin", "sayiDizisi", "metinDizisi"]);
});

test("iç içe nesne ve dizi yapraklara iner", () => {
  const a = alanlar({ isik: { siddet: 1 }, katmanlar: [{ ayar: { sayi: 9 } }] }, PALET);
  assert.deepEqual(a.map((x) => x.yol.join(".")), ["isik.siddet", "katmanlar.0.ayar.sayi"]);
});

test("sayı dizisi tek alan sayılır (yön vektörü)", () => {
  assert.deepEqual(alanlar({ yon: [0, 1, 0] }, PALET).map((x) => x.tur), ["sayiDizisi"]);
});

test("yola yazmak yeni kopya döner, kök değişmez", () => {
  const kok = { a: { b: 1 }, c: [1, 2] };
  const yeni = yolaYaz(kok, ["a", "b"], 5);
  assert.deepEqual([kok.a.b, yeni.a.b, yeni.c === kok.c], [1, 5, true]);
});

test("diziye indeksle yazılır", () => {
  assert.deepEqual(yolaYaz({ k: [{ x: 1 }, { x: 2 }] }, ["k", 1, "x"], 9), { k: [{ x: 1 }, { x: 9 }] });
});

test("olmayan yola yazmak hata verir (yazım hatası yeni alan açmaz)", () => {
  assert.throws(() => yolaYaz({ a: 1 }, ["b"], 2), /yol yok/);
});

test("yoldan okunur", () => {
  assert.equal(yoldanOku({ k: [{ x: 7 }] }, ["k", 0, "x"]), 7);
});
