"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { araclariUret, cagriyiNiyete, turCoz, yuzeyMaliyeti, ARAC_TABLOSU } from "./araclar.ts";
import { POZLAR } from "../protocol/niyet.ts";

// Elle tutulan liste: protokole yeni tür eklenip araç tablosuna eklenmezse
// test kırmızı yanar. Yeni yeteneğin modele görünmez kalmasını engeller.
const BEKLENEN_TURLER = [
  "poz", "jest", "bak", "git", "otur", "kalk", "soyle",
  "yaz", "al", "birak", "odaklan", "dur", "sor",
];

test("her niyet türünün bir aracı var — sessizce görünmez yetenek yok", () => {
  assert.deepEqual(Object.keys(ARAC_TABLOSU).sort(), [...BEKLENEN_TURLER].sort());
});

test("araç adları ASCII ve önekli, açıklamalar dolu", () => {
  for (const a of araclariUret()) {
    assert.match(a.ad, /^dunya_[a-z]+$/, `ASCII dışı veya öneksiz ad: ${a.ad}`);
    assert.ok(a.aciklama.length > 15, `açıklama çok kısa: ${a.ad}`);
  }
});

test("araç çağrısı doğrulanmış niyete dönüşür", () => {
  const r = cagriyiNiyete("dunya_git", { hedef: { tip: "capa", ad: "tahta" } });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.deger.tur, "git");
});

test("uydurma araç adı reddedilir ve geçerli listeyi söyler", () => {
  const r = cagriyiNiyete("dunya_ucmak", {});
  assert.equal(r.ok, false);
  if (!r.ok) { assert.match(r.hata, /bilinmeyen araç/); assert.match(r.hata, /dunya_git/); }
});

test("önek olmadan çağrı reddedilir", () => {
  assert.equal(cagriyiNiyete("git", { hedef: { tip: "oyuncu" } }).ok, false);
  assert.equal(turCoz("git"), null);
  assert.equal(turCoz("dunya_git"), "git");
});

test("doğrulama atlanmıyor: sözlük dışı poz araç yolundan da geçmez", () => {
  const r = cagriyiNiyete("dunya_poz", { poz: "zıplıyor" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.hata, new RegExp(POZLAR[0]));
});

test("bak: hedef alanı hiç verilmezse serbest bakış sayılır", () => {
  const r = cagriyiNiyete("dunya_bak", {});
  assert.equal(r.ok, true);
  if (r.ok && r.deger.tur === "bak") assert.equal(r.deger.hedef, null);
});

test("argümansız araçlar boş ve null girdiyle çalışır", () => {
  for (const ad of ["dunya_kalk", "dunya_birak", "dunya_dur"]) {
    assert.equal(cagriyiNiyete(ad, {}).ok, true, ad);
    assert.equal(cagriyiNiyete(ad, null).ok, true, `${ad} (null girdi)`);
  }
});

test("bozuk girdi türleri çökertmez", () => {
  for (const kotu of [null, undefined, 42, "metin", []]) {
    assert.equal(cagriyiNiyete("dunya_soyle", kotu).ok, false, `${String(kotu)} kabul edildi`);
  }
});

test("dizi girdisi nesne sayılmaz", () => {
  assert.equal(cagriyiNiyete("dunya_git", [{ tip: "oyuncu" }]).ok, false);
});

test("araç yüzeyi token bütçesi makul", () => {
  const m = yuzeyMaliyeti();
  assert.ok(m > 100, `şüpheli küçük yüzey: ${m}`);
  assert.ok(m < 1500, `araç yüzeyi çok pahalı: ~${m} token/tur`);
});
