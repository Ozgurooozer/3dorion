// bridge/baglamOlcusu.test.ts — Bağlam ölçüsü (spec 16 F0): her bölüm kendi kutusunda sayılır.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { baglamOlcusu } from "./baglamOlcusu.ts";
import { araclariUret } from "./araclar.ts";
import type { BeyinGirdisi } from "./beyin.ts";

/** Her bölümü ayırt edilebilir uzunlukta bir girdi. */
const GIRDI: BeyinGirdisi = {
  talimat: "t".repeat(100),
  sabit: "s".repeat(20),
  dunya: "d".repeat(30),
  anilar: ["a".repeat(7), "b".repeat(3)],
  ozetler: ["o".repeat(5)],
  gecmis: [
    { rol: "kullanici", metin: "otur" },
    { rol: "orion", metin: "", cagri: { ad: "dunya_otur", girdi: {} } },
  ],
  araclar: [],
};

test("talimat, sabit ve dünya kendi uzunluklarıyla sayılır", () => {
  const o = baglamOlcusu(GIRDI);
  assert.deepEqual([o.talimat, o.sabit, o.dunya], [100, 20, 30]);
});

test("anılar ve özetler toplanarak sayılır", () => {
  const o = baglamOlcusu(GIRDI);
  assert.deepEqual([o.anilar, o.ozetler], [10, 5]);
});

test("geçmişteki beden çağrısı araç adı + argüman JSON'u olarak sayılır", () => {
  // "otur" (4) + "dunya_otur" (10) + "{}" (2)
  assert.equal(baglamOlcusu(GIRDI).gecmis, 16);
});

test("geçmiş kayıt sayısı ayrıca verilir", () => {
  assert.equal(baglamOlcusu(GIRDI).gecmisKayit, 2);
});

test("araç ve örnek yoksa sıfır", () => {
  const o = baglamOlcusu(GIRDI);
  assert.deepEqual([o.araclar, o.ornekler], [0, 0]);
});

test("araçlar modele gittiği biçimde, JSON olarak sayılır", () => {
  const araclar = araclariUret().slice(0, 2);
  assert.equal(baglamOlcusu({ ...GIRDI, araclar }).araclar, JSON.stringify(araclar).length);
});

test("toplam, bölümlerin toplamıdır (kayıt sayısı hariç)", () => {
  const o = baglamOlcusu(GIRDI);
  assert.equal(o.toplam, 100 + 20 + 30 + 10 + 5 + 16);
});

test("token alanı ölçüde yoktur (yalnız beyin bildirirse köprü ekler)", () => {
  assert.equal("token" in baglamOlcusu(GIRDI), false);
});
