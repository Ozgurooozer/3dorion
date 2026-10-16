// uygulama/dunyaDurumu.test.ts — beynin bağlamındaki SEÇİLİ NESNE satırı (spec 28): yalnız seçiliyken girer, yalnız uygun eylemler yazılır.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { seciliSatiri, seciliDurumu } from "./dunyaDurumu.ts";

const BANK = { ad: "bank", capa: "bank" as string | null, kutu: { x: 4.6, z: 6.6 } };
const KUTU = { ad: "kutu yığını", capa: null as string | null, kutu: { x: -4.04, z: 2.449 } };

test("seçili yokken satır BOŞ (bağlama yalnız gerekli satır girer, spec 16)", () => {
  assert.equal(seciliSatiri(null), "");
});

test("çapalı nesne: adı, çapası ve 'this/here' göndermesi satırda", () => {
  const s = seciliSatiri(seciliDurumu(BANK, [{ kimlik: "orion.git", uygun: true }]));
  assert.match(s, /pointed at "bank" \(anchor: bank\)/);
  assert.match(s, /"this" or "here"/);
});

test("çapasız nesne: konum (x,z) satırda, çapa yok", () => {
  const s = seciliSatiri(seciliDurumu(KUTU, [{ kimlik: "orion.git", uygun: true }]));
  assert.match(s, /\(at -4\.0,2\.4\)/);
  assert.doesNotMatch(s, /anchor/);
});

test("yalnız UYGUN eylemler 'You can'a girer: gri 'otur' önerilmez", () => {
  const s = seciliSatiri(seciliDurumu(BANK, [
    { kimlik: "orion.git", uygun: true }, { kimlik: "orion.bak", uygun: true }, { kimlik: "orion.otur", uygun: false },
  ]));
  assert.match(s, /You can: go there, look at it\./);
  assert.doesNotMatch(s, /sit on it/);
});

test("uygun eylem yoksa 'You can' hiç yazılmaz", () => {
  assert.doesNotMatch(seciliSatiri(seciliDurumu(BANK, [{ kimlik: "orion.otur", uygun: false }])), /You can/);
});

test("bilinmeyen eylem kimliği sessizce atılır (uydurma metin yok)", () => {
  assert.deepEqual(seciliDurumu(BANK, [{ kimlik: "orion.yaz", uygun: true }]).yapabilir, []);
});

test("odaklan ve otur doğru söze çevrilir", () => {
  assert.deepEqual(seciliDurumu(BANK, [{ kimlik: "orion.otur", uygun: true }, { kimlik: "orion.odaklan", uygun: true }]).yapabilir, ["sit on it", "focus on it"]);
});
