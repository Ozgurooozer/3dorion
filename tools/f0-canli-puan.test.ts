// tools/f0-canli-puan.test.ts — Canlı yol puanı köprünün davranışıyla aynı mı (gerçek ham çıktılarla).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { canliYol } from "./f0-canli-puan.ts";
import { OZERK_ARACLAR } from "../bridge/araclar.ts";

test("gemma şablonundaki poz çağrısı kurtarılır ve sesli söz OLMAZ", () => {
  const y = canliYol([], 'dunya_poz{poz:<|"|>duruyor<|"|>}', OZERK_ARACLAR);
  assert.deepEqual(y, { cagrilar: [{ ad: "dunya_poz", girdi: { poz: "duruyor" } }], sesli: "" });
});

test("özerk turda sunulmayan yapısal çağrı düşer", () => {
  assert.deepEqual(canliYol([{ ad: "dunya_sor", girdi: { ne: "onumde" } }], "", OZERK_ARACLAR).cagrilar, []);
});

test("Türkçe düz metin sesli söylenir", () => {
  assert.equal(canliYol([], "Merhaba Ozyn, sabahın hayırlı olsun.", OZERK_ARACLAR).sesli, "Merhaba Ozyn, sabahın hayırlı olsun.");
});
