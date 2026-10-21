// host/mdDosyalari.test.ts — Orion'un md dosyaları: ad kuralı, atomik yazım, yok/var ayrımı, aktif/pasif ayarı, bozuk ayar, tohum.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MD_BOYUT_SINIRI, SISTEM_DOSYALARI, mdAdiGecerli, mdAktifYap, mdDizini, mdListe, mdOku, mdTohumla, mdYaz, mdYeni } from "./mdDosyalari.js";

function gecici(): string { return fs.mkdtempSync(path.join(os.tmpdir(), "orion-md-test-")); }
const kod = (f: () => unknown): string | undefined => { try { f(); } catch (e) { return (e as { kod?: string }).kod; } return undefined; };

test("ad kuralı: yalnız .md; klasör gezme, nokta ile başlama, çok uzun ad yasak; Türkçe harf serbest", () => {
  for (const iyi of ["persona.md", "anlik-hafiza.md", "Ozyn hakkında.md", "not_1.md", "çalışma.md"]) assert.equal(mdAdiGecerli(iyi), true, iyi);
  for (const kotu of ["", "x.txt", "../x.md", "a/b.md", "a\b.md", ".gizli.md", "x..md", `${"a".repeat(70)}.md`, "persona", 5, null]) assert.equal(mdAdiGecerli(kotu), false, String(kotu));
});

test("dizin: env > senaryo (geçici) > kullanıcı verisi", () => {
  assert.equal(mdDizini({ ORION_MD_DIZINI: "/x" }, "/u", "/t"), "/x");
  assert.equal(mdDizini({ ORION_SMOKE: "1" }, "/u", "/t"), path.join("/t", "orion-md-deneme"));
  assert.equal(mdDizini({}, "/u", "/t"), path.join("/u", "orion-md"));
});

test("tohum: boş klasörde persona (pasif) ve anlık hafıza (aktif) yazılır; doluysa dokunulmaz", () => {
  const d = gecici();
  assert.deepEqual(mdTohumla(d).sort(), ["anlik-hafiza.md", "persona.md"]);
  const l = mdListe(d);
  assert.deepEqual(l.map((x) => [x.ad, x.aktif, x.sistem]), [["anlik-hafiza.md", true, true], ["persona.md", false, false]]);
  assert.deepEqual(mdTohumla(d), []);
});

test("yeni: pasif başlar; varsa 409 (var); geçersiz ad reddedilir; içerik okunur", () => {
  const d = gecici();
  mdYeni(d, "notlar.md", "# merhaba");
  assert.equal(mdOku(d, "notlar.md"), "# merhaba");
  assert.equal(mdListe(d)[0]!.aktif, false);
  assert.equal(kod(() => mdYeni(d, "notlar.md", "x")), "var");
  assert.equal(kod(() => mdYeni(d, "../kacis.md", "x")), "gecersiz-ad");
  assert.equal(fs.readdirSync(d).includes("kacis.md"), false);
});

test("yaz: var olanı günceller; yoksa 404 (yanlış adla yeni dosya doğmaz); .tmp artığı kalmaz", () => {
  const d = gecici();
  mdYeni(d, "a.md", "bir");
  mdYaz(d, "a.md", "iki");
  assert.equal(mdOku(d, "a.md"), "iki");
  assert.equal(kod(() => mdYaz(d, "yok.md", "x")), "yok");
  assert.deepEqual(fs.readdirSync(d).filter((f) => f.endsWith(".tmp")), []);
});

test("boyut sınırı: aşan içerik reddedilir, dosya değişmez; metin olmayan içerik reddedilir", () => {
  const d = gecici();
  mdYeni(d, "a.md", "kalsın");
  assert.equal(kod(() => mdYaz(d, "a.md", "x".repeat(MD_BOYUT_SINIRI + 1))), "cok-buyuk");
  assert.equal(mdOku(d, "a.md"), "kalsın");
  assert.equal(kod(() => mdYaz(d, "a.md", 5 as unknown as string)), "gecersiz-icerik");
});

test("oku: olmayan dosya 'yok' koduyla", () => {
  assert.equal(kod(() => mdOku(gecici(), "yok.md")), "yok");
});

test("aktif yap: ayara yazılır, listede görünür, yeniden açılışta kalır; sistem dosyası pasife çekilebilir", () => {
  const d = gecici();
  mdTohumla(d);
  mdAktifYap(d, "persona.md", true);
  mdAktifYap(d, "anlik-hafiza.md", false);
  assert.deepEqual(mdListe(d).map((x) => [x.ad, x.aktif]), [["anlik-hafiza.md", false], ["persona.md", true]]);
  assert.equal(kod(() => mdAktifYap(d, "yok.md", true)), "yok");
  assert.equal(kod(() => mdAktifYap(d, "persona.md", "evet" as unknown as boolean)), "gecersiz-icerik");
});

test("liste: ayar dosyası ve md olmayanlar görünmez; sistem dosyaları önce, sonra ada göre", () => {
  const d = gecici();
  mdYeni(d, "zeta.md"); mdYeni(d, "alfa.md"); mdYeni(d, "anlik-hafiza.md");
  fs.writeFileSync(path.join(d, "baska.txt"), "x");
  mdAktifYap(d, "alfa.md", true);
  assert.deepEqual(mdListe(d).map((x) => x.ad), ["anlik-hafiza.md", "alfa.md", "zeta.md"]);
});

test("bozuk ayar sessizce 'hepsi pasif' sayılmaz: HATA verir ve dosya kenara taşınır", () => {
  const d = gecici();
  mdYeni(d, "a.md", "x");
  fs.writeFileSync(path.join(d, "_ayar.json"), "{bozuk");
  assert.equal(kod(() => mdListe(d)), "bozuk-ayar");
  assert.equal(fs.readdirSync(d).some((f) => f.startsWith("_ayar.json.bozuk-")), true);
  assert.deepEqual(mdListe(d).map((x) => x.ad), ["a.md"]);   // taşındıktan sonra temiz başlar
});

test("bozuk ayar: yanlış tür de bozuk sayılır", () => {
  const d = gecici();
  mdYeni(d, "a.md");
  fs.writeFileSync(path.join(d, "_ayar.json"), JSON.stringify({ aktif: { "a.md": "evet" } }));
  assert.equal(kod(() => mdListe(d)), "bozuk-ayar");
});

test("sistem dosyaları listesi: anlık hafıza sistem dosyasıdır", () => {
  assert.deepEqual([...SISTEM_DOSYALARI], ["anlik-hafiza.md"]);
});

test("tohum şablonları: kullanım açıklaması HTML yorumunda (bağlama giden metinde yalnız Ozyn'in yazdığı kalır)", async () => {
  const d = gecici();
  mdTohumla(d);
  const { temizle } = await import("../mind/mdBaglami.ts");
  const anlik = temizle(mdOku(d, "anlik-hafiza.md"));
  assert.doesNotMatch(anlik, /Orion'a gitmez|sistem sürekli/);
  assert.match(anlik, /# Anlık hafıza/);
  assert.doesNotMatch(temizle(mdOku(d, "persona.md")), /PASİF|Kısa tut/);
});
