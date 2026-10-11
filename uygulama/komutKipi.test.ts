// uygulama/komutKipi.test.ts — Komut kipi kararı: her kip × her risk seviyesi tablosu (spec 26 F2).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { komutKipiCoz, onaysizCalissinMi, KOMUT_KIPI_VARSAYILAN, type KomutKipi } from "./komutKipi.ts";
import type { RiskSeviyesi } from "../mind/komutRiski.ts";

const TABLO: [KomutKipi, RiskSeviyesi, boolean][] = [
  ["otomatik", "okur", true], ["otomatik", "degistirir", true], ["otomatik", "yikici", false],
  ["tam", "okur", true], ["tam", "degistirir", true], ["tam", "yikici", true],
  ["onayli", "okur", false], ["onayli", "degistirir", false], ["onayli", "yikici", false],
];
for (const [kip, seviye, beklenen] of TABLO) {
  test(`kip ${kip} · risk ${seviye} → ${beklenen ? "onaysız çalışır" : "onay bekler"}`, () => {
    assert.equal(onaysizCalissinMi(kip, seviye), beklenen);
  });
}

test("varsayılan kip otomatik (Ozyn'in kararı); boş/eksik değer varsayılandır ve geçerli sayılır", () => {
  assert.equal(KOMUT_KIPI_VARSAYILAN, "otomatik");
  assert.deepEqual(komutKipiCoz(null), { kip: "otomatik", gecerli: true });
  assert.deepEqual(komutKipiCoz(""), { kip: "otomatik", gecerli: true });
});

test("bilinen kipler olduğu gibi çözülür; bilinmeyen değer varsayılana düşer AMA geçersiz diye işaretlenir", () => {
  assert.deepEqual(komutKipiCoz("tam"), { kip: "tam", gecerli: true });
  assert.deepEqual(komutKipiCoz("onayli"), { kip: "onayli", gecerli: true });
  assert.deepEqual(komutKipiCoz("serbest"), { kip: "otomatik", gecerli: false });
});
