// mind/komutSozlugu.test.ts — Doğuştan komut programları (spec 13 Faz 2b).
//
// "GERÇEK" sözler karar kaydından (2026-09-27 → 10-02), Ozyn'in yazdığı gibi.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { komutCoz, sozuNormalle, yonelmeCapasi, GEL_MESAFESI } from "./komutSozlugu.ts";

const program = (soz: string) => komutCoz(soz)?.program ?? null;
const adimlar = (soz: string) => JSON.parse(JSON.stringify(komutCoz(soz)?.adimlar ?? null));

// ── Gerçek sözler: eşleşmesi gerekenler ─────────────────────────────────────

test("GERÇEK: 'otur' → otur", () => {
  assert.deepEqual(adimlar("otur"), [{ tur: "otur" }]);
});

test("GERÇEK: 'masaya git ve otur' → çapasız otur (sandalyeye yürür ve oturur)", () => {
  assert.deepEqual(adimlar("masaya git ve otur"), [{ tur: "otur" }]);
});

test("GERÇEK (ortak test 3): 'bilgisayara git otur' → çapasız otur", () => {
  for (const s of ["bilgisayara git otur", "masaya geç otur", "sandalyeye git ve otur"]) {
    assert.deepEqual(adimlar(s), [{ tur: "otur" }], s);
  }
});

test("oturulamayan yere 'git otur' programa girmez: 'tahtaya git otur'", () => {
  assert.equal(program("tahtaya git otur"), null);
});

test("GERÇEK: 'kalk' → kalk", () => {
  assert.deepEqual(adimlar("kalk"), [{ tur: "kalk" }]);
});

test("GERÇEK: 'bana gel' (çift boşluklu da) → Ozyn'e yürü, 1,2 m kala dur", () => {
  for (const s of ["bana gel", "bana  gel"]) {
    assert.deepEqual(adimlar(s), [{ tur: "git", hedef: { tip: "oyuncu" }, mesafe: GEL_MESAFESI }], s);
  }
});

test("GERÇEK: 'önündeki bilgisayari aç' ve 'bilgisayari kullan' → bilgisayar programı", () => {
  for (const s of ["önündeki bilgisayari aç", "önündeki bilgisayarı aç", "bilgisayari kullan"]) {
    assert.deepEqual(adimlar(s), [{ tur: "odaklan", capa: "monitor" }], s);
  }
});

test("GERÇEK: yer + git → o çapaya yürü", () => {
  const izgara: [string, string][] = [
    ["tahtaya git", "tahta"], ["pencereye git", "pencere"], ["masaya git", "masa"],
    ["bilgisayara git", "monitor"], ["kapıya git", "kapi"], ["beyaz tahtaya git", "tahta"],
    ["odanın ortasına git", "oda_ortasi"], ["sandalyeye git", "sandalye"], ["monitöre git", "monitor"],
  ];
  for (const [soz, capa] of izgara) {
    assert.deepEqual(adimlar(soz), [{ tur: "git", hedef: { tip: "capa", ad: capa } }], soz);
  }
});

test("yer + bak → o çapaya bak; 'bana bak' → Ozyn'e bak", () => {
  assert.deepEqual(adimlar("pencereye bak"), [{ tur: "bak", hedef: { tip: "capa", ad: "pencere" } }]);
  assert.deepEqual(adimlar("bana bak"), [{ tur: "bak", hedef: { tip: "oyuncu" } }]);
});

test("hitap ve nezaket atılır: 'Orion, otur lütfen!' → otur", () => {
  assert.equal(program("Orion, otur lütfen!"), "komut:otur");
});

// ── Gerçek sözler: LLM'e gitmesi gerekenler (yanlış eşleşme 0) ──────────────

test("GERÇEK: içerik isteyen yazma sözleri programa girmez (ne yazılacağını LLM bilir)", () => {
  for (const s of ["tahtaya adını yaz", "tahtaya yazı yaz", "birseyler yaz", "adını yaz tahtaya",
    "tahtaya basit bir matematik formülü yaz", "bide quantum formülü yaz sen yaz", "beyaz tahtaya yaz"]) {
    assert.equal(program(s), null, s);
  }
});

test("GERÇEK: sorular ve sohbet programa girmez", () => {
  for (const s of ["nasilsin orion", "ne yapıyorsun", "ne görüyorsun", "karşında ne var?", "ben neredeyim",
    "neredesin konumun ne", "neler yapabilirsin", "hareket edemiyorsun gibi", "naber", "ne oldu?",
    "şehri görmek istermisin?", "bareber yapıcaz onu", "sen seç", "odada başka neler var"]) {
    assert.equal(program(s), null, s);
  }
});

test("GERÇEK: belirsiz kullanım istekleri programa girmez", () => {
  for (const s of ["tahtayi kullan", "tahtyi kullan", "sırayla odada gezin", "can you go tahta", "use that", "open the monitor"]) {
    assert.equal(program(s), null, s);
  }
});

test("sözün bir PARÇASI kalıba uyuyorsa eşleşmez: 'otur ve bana anlat'", () => {
  for (const s of ["otur ve bana anlat", "neden oturdun", "hemen tahtaya git ve yaz", "otur mu dedim", "istersen tahtaya git"]) {
    assert.equal(program(s), null, s);
  }
});

test("bilinmeyen yer programa girmez: 'mutfağa git'", () => {
  assert.equal(program("mutfağa git"), null);
});

// ── Yardımcılar ─────────────────────────────────────────────────────────────

test("sozuNormalle: Türkçe katlama, noktalama ve çift boşluk", () => {
  assert.equal(sozuNormalle("  Önündeki BİLGİSAYARI   aç!! "), "onundeki bilgisayari ac");
});

test("yonelmeCapasi: ek yoksa çapa sayılmaz ('tahta git' değil 'tahtaya git')", () => {
  assert.equal(yonelmeCapasi("tahta"), null);
});
