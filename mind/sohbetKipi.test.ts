// mind/sohbetKipi.test.ts — Sohbet kipleri ve onları açan sözler (spec 16 F5b).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { SOHBET_IFADELERI, sohbetEylemi, sonrakiKip, type SohbetEylemi } from "./sohbetKipi.ts";

for (const [e, ifadeler] of Object.entries(SOHBET_IFADELERI) as [SohbetEylemi, readonly string[]][]) {
  for (const i of ifadeler) {
    test(`"${i}" → ${e}`, () => { assert.equal(sohbetEylemi(i), e); });
  }
}

test("Türkçe harf, büyük harf ve noktalama önemsiz", () => {
  assert.equal(sohbetEylemi("Temiz sohbetten çık!"), "normal");
});

test("ifadeler eylemler arasında çakışmaz", () => {
  const hepsi = Object.values(SOHBET_IFADELERI).flat();
  assert.equal(new Set(hepsi).size, hepsi.length);
});

for (const s of ["yeni sohbet nasıl açılır", "bu yeni sohbet mi", "temiz", "sohbet", "otur", "clean the board"]) {
  test(`tam eşleşmeyen söz kip değiştirmez: "${s}"`, () => { assert.equal(sohbetEylemi(s), null); });
}

test("yeni sohbet ve normal standarda, temiz sohbet temize geçer", () => {
  assert.deepEqual([sonrakiKip("yeni"), sonrakiKip("normal"), sonrakiKip("temiz")], ["standart", "standart", "temiz"]);
});
