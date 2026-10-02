// tools/eylem.test.ts — EYLEM ÖLÇÜSÜNÜN KALİBRASYONU.
//
// Alete güvenmeden önce cevabı bilinen girdide koşulur. "GERÇEK" testler
// 2026-10-02 ortak canlı testin log satırlarıdır (oturum-kayitlari/2026-10-02-ofis-testi.log).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { eylemPuanla } from "./eylem.ts";

test("GERÇEK: 'otur' → yalnız 'Oturuyorum Ozyn.' dedi — doğru değil, yalnız söz", () => {
  const p = eylemPuanla([{ ad: "dunya_soyle", girdi: { metin: "Oturuyorum Ozyn." } }], { arac: "dunya_otur" });
  assert.deepEqual(p, { dogru: false, yalnizSoz: true });
});

test("GERÇEK: 'adını yaz tahtaya' → git + yaz — doğru", () => {
  const p = eylemPuanla([
    { ad: "dunya_git", girdi: { hedef: { tip: "capa", ad: "tahta" }, mesafe: 1.5 } },
    { ad: "dunya_yaz", girdi: { metin: "Orion", temizle: false } },
  ], { arac: "dunya_yaz" });
  assert.deepEqual(p, { dogru: true, yalnizSoz: false });
});

test("çapasız otur doğrudur (araç açıklaması: çapasız sandalyeye gider)", () => {
  assert.equal(eylemPuanla([{ ad: "dunya_otur", girdi: {} }], { arac: "dunya_otur" }).dogru, true);
});

test("'bana gel': hedef oyuncu olmalı", () => {
  const b = { arac: "dunya_git", hedefTip: "oyuncu" } as const;
  assert.equal(eylemPuanla([{ ad: "dunya_git", girdi: { hedef: { tip: "oyuncu" }, mesafe: 1.2 } }], b).dogru, true);
});

test("'bana gel': başka bir yere yürümek doğru değil", () => {
  const b = { arac: "dunya_git", hedefTip: "oyuncu" } as const;
  assert.equal(eylemPuanla([{ ad: "dunya_git", girdi: { hedef: { tip: "capa", ad: "masa" } } }], b).dogru, false);
});

test("çapa etiketle de tanınır: 'Pencere' ve iç ad aynı", () => {
  const b = { arac: "dunya_bak", capa: "pencere" } as const;
  assert.equal(eylemPuanla([{ ad: "dunya_bak", girdi: { hedef: { tip: "nesne", ad: "Pencere" } } }], b).dogru, true);
});

test("odaklan çapası 'monitör' etiketiyle de tanınır", () => {
  const b = { arac: "dunya_odaklan", capa: "monitor" } as const;
  assert.equal(eylemPuanla([{ ad: "dunya_odaklan", girdi: { capa: "monitör" } }], b).dogru, true);
});

test("yanlış çapa doğru değil", () => {
  const b = { arac: "dunya_bak", capa: "pencere" } as const;
  assert.equal(eylemPuanla([{ ad: "dunya_bak", girdi: { hedef: { tip: "capa", ad: "tahta" } } }], b).dogru, false);
});

test("hiç çağrı yoksa ne doğru ne 'yalnız söz' (sessizlik ayrı sayılır)", () => {
  assert.deepEqual(eylemPuanla([], { arac: "dunya_otur" }), { dogru: false, yalnizSoz: false });
});

test("bozuk girdi çökertmez", () => {
  const p = eylemPuanla([{ ad: "dunya_bak", girdi: "bozuk" }, { ad: "dunya_git", girdi: null }], { arac: "dunya_bak", capa: "pencere" });
  assert.equal(p.dogru, false);
});
