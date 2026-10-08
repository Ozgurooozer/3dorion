// mind/takipSozu.test.ts — "Beni takip et" sözleri.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { TAKIP_IFADELERI, takipEylemi, type TakipEylemi } from "./takipSozu.ts";
import { komutCoz } from "./komutSozlugu.ts";

for (const [e, ifadeler] of Object.entries(TAKIP_IFADELERI) as [TakipEylemi, readonly string[]][]) {
  for (const i of ifadeler) test(`"${i}" → ${e}`, () => { assert.equal(takipEylemi(i), e); });
}

test("seslenme, rica ve noktalama önemsiz", () => {
  assert.equal(takipEylemi("Orion, beni takip et lütfen!"), "basla");
});

test("Türkçe harfler sadeleşir", () => {
  assert.equal(takipEylemi("Peşimden gel"), "basla");
});

test("ifadeler başlat/bırak arasında çakışmaz", () => {
  const hepsi = Object.values(TAKIP_IFADELERI).flat();
  assert.equal(new Set(hepsi).size, hepsi.length);
});

// Çıplak "dur" komut sözlüğünün programıdır (durdurur + takibi bitirir); burada YAKALANMAMALI.
for (const s of ["dur", "otur", "tahtaya git", "beni takip etti mi", "takip", "bana gel"]) {
  test(`takip sözü olmayan: "${s}"`, () => { assert.equal(takipEylemi(s), null); });
}

test("'dur' komut sözlüğünde bir programdır (takibi o yoldan biter)", () => {
  assert.equal(komutCoz("dur")?.program, "komut:dur");
});
