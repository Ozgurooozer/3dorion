// world/level/depo/levelDeposu.test.ts — Level adı → klasör adı (spec 23 A). host/levelDosyasi.js kuralına uymalı.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { adDuzelt } from "./levelDeposu.ts";
import { levelAdiGecerli } from "../../../host/levelDosyasi.js";

test("Türkçe harfler sadeleşir", () => { assert.equal(adDuzelt("Işıklı Çarşı Gölü"), "isikli-carsi-golu"); });
test("büyük İ ve I doğru küçülür", () => { assert.equal(adDuzelt("İSTANBUL IŞIK"), "istanbul-isik"); });
test("simge ve boşluk tek tireye iner, uçlardaki tire atılır", () => { assert.equal(adDuzelt("  liman -- gece!! "), "liman-gece"); });
test("harf ya da rakam yoksa boş", () => { assert.equal(adDuzelt("!!! ---"), ""); });
test("en çok 48 karakter, sonda tire kalmaz", () => { assert.equal(adDuzelt(`${"a".repeat(47)} b`).length <= 48 && !adDuzelt(`${"a".repeat(47)} b`).endsWith("-"), true); });
test("sadeleşen her ad dosya katmanının kuralına uyar", () => {
  const ornekler = ["Ova", "Liman Gece", "Şehir 2", "çöl-üstü", "a".repeat(80), "Ğ Ü Ş İ Ö Ç"];
  assert.deepEqual(ornekler.map((o) => levelAdiGecerli(adDuzelt(o))), ornekler.map(() => true));
});
