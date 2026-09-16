// world/surfaces/ciktiFarki.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ciktiFarki, kesildiMi, AZAMI_SATIR } from "./ciktiFarki.ts";

test("değişiklik yoksa fark boştur", () => {
  const k = "satir1\nsatir2\nsatir3";
  assert.equal(ciktiFarki(k, k), "");
});

test("kayan pencerede yalnızca yeni satırlar döner", () => {
  const once = "A\nB\nC\nD";
  const sonra = "C\nD\nE\nF";       // A,B yukarı kaydı; E,F yeni
  assert.equal(ciktiFarki(once, sonra), "E\nF");
});

test("pencere kaymadan sona eklenirse yalnızca ek döner", () => {
  assert.equal(ciktiFarki("A\nB", "A\nB\nC"), "C");
});

test("ilk örnekte (önceki boş) her şey yenidir", () => {
  assert.equal(ciktiFarki("", "A\nB"), "A\nB");
});

test("ekran temizlenirse örtüşme aranmaz, her şey yeni sayılır", () => {
  assert.equal(ciktiFarki("A\nB\nC", "X\nY"), "X\nY");
});

test("sondaki boş satırlar gürültü saymaz", () => {
  assert.equal(ciktiFarki("A\nB\n\n\n", "A\nB\n\n\n\n"), "");
  assert.equal(ciktiFarki("A\n\n\n", "A\nB\n\n\n"), "B");
});

test("yeni içerik yoksa ama tampon boşaldıysa boş döner", () => {
  assert.equal(ciktiFarki("A\nB", "\n\n\n"), "");
});

test("satır tavanı uygulanır ve kesilme GÖRÜNÜR olur", () => {
  const cok = Array.from({ length: AZAMI_SATIR + 25 }, (_, i) => `satir${i}`).join("\n");
  const f = ciktiFarki("", cok);
  assert.ok(kesildiMi(f), "kesilme işaretlenmeli");
  assert.equal(f.split("\n").length, AZAMI_SATIR + 1, "başa eklenen … ile birlikte tavan kadar");
  assert.ok(f.includes(`satir${AZAMI_SATIR + 24}`), "SON satırlar korunmalı, ilkler değil");
});

test("karakter tavanı uygulanır", () => {
  const uzun = "x".repeat(5000);
  const f = ciktiFarki("", uzun);
  assert.ok(f.length < 2000);
  assert.ok(kesildiMi(f));
});

test("tekrarlı satırlar yanlış örtüşmeyle içerik yutmaz", () => {
  // Aynı satır tekrar ediyor; en uzun örtüşme kuralı doğru olanı seçmeli.
  const once = "ilerleme\nilerleme\nilerleme";
  const sonra = "ilerleme\nilerleme\nilerleme\nbitti";
  assert.equal(ciktiFarki(once, sonra), "bitti");
});

test("gerçek biçim: npm çıktısı kayarken yalnızca yeni satır gider", () => {
  const t1 = ["$ npm test", "> 3dorion@0.1.0 test", "ℹ tests 151"].join("\n");
  const t2 = ["$ npm test", "> 3dorion@0.1.0 test", "ℹ tests 151", "ℹ pass 151", "ℹ fail 0"].join("\n");
  assert.equal(ciktiFarki(t1, t2), "ℹ pass 151\nℹ fail 0");
});
