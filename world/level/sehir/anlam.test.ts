// world/level/sehir/anlam.test.ts — Şehir kitinin Orion için anlam sözlüğü (assets/sehir/anlam.json) bekçisi (spec 23 B).
// Katalog yeniden üretilip varlık eklenince/çıkınca sözlük geride kalmasın: her varlığın ve kategorinin satırı var,
// fazlası yok, alanlar geçerli, her varlığın Türkçe adı var.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { anlamSozluguOku } from "../cekirdek/anlam.ts";
import { katalogOku } from "../cekirdek/katalog.ts";

const ASSETS = new URL("../../../assets/", import.meta.url);
const oku = (goreli: string): unknown => JSON.parse(fs.readFileSync(new URL(goreli, ASSETS), "utf8"));
const katalog = katalogOku(oku("sehir/katalog.json"));
const sozluk = anlamSozluguOku(oku("sehir/anlam.json"));

test("sözlük geçerli (alanlar ve eylemler protokol sözlüğünden)", () => { assert.ok(sozluk.surum === 1); });
test("katalogdaki her varlığın sözlükte satırı var", () => {
  assert.deepEqual(katalog.varliklar.map((v) => v.ad).filter((a) => !(a in sozluk.varliklar)), []);
});
test("sözlükte katalogda olmayan varlık yok (geride kalan satır)", () => {
  const adlar = new Set(katalog.varliklar.map((v) => v.ad));
  assert.deepEqual(Object.keys(sozluk.varliklar).filter((a) => !adlar.has(a)), []);
});
test("katalogdaki her kategorinin sözlükte varsayılanı var", () => {
  assert.deepEqual([...new Set(katalog.varliklar.map((v) => v.kategori))].filter((k) => !(k in sozluk.kategoriler)), []);
});
test("her varlığın Türkçe adı var (Orion kısa İngilizce adı söylemesin)", () => {
  assert.deepEqual(Object.entries(sozluk.varliklar).filter(([, a]) => !a.ad).map(([v]) => v), []);
});
