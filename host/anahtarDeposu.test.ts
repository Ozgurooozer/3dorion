// host/anahtarDeposu.test.ts — API anahtarı: şifreli, hatırlanır, renderer'a ve log'a çıkmaz (spec 13 Faz 3).
//
// Sahte şifreleyici ters çevirir + önek koyar: "şifreli" bayt düz anahtarı İÇERMEZ,
// böylece "dosyada düz anahtar yok" testi gerçek bir şey ölçer.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { anahtarDeposuKur, adresHatasi, type Sifreleyici } from "./anahtarDeposu.js";

const ANAHTAR = "nvapi-TEST-0123456789abcdef";
const NVIDIA = "https://integrate.api.nvidia.com/v1";

const sahteSifre = (kullanilabilir = true): Sifreleyici => ({
  kullanilabilir: () => kullanilabilir,
  sifrele: (m) => Buffer.from("SIFRE:" + [...m].reverse().join("")),
  coz: (b) => [...b.toString().slice(6)].reverse().join(""),
});

function yer(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "orion-anahtar-")), "anahtarlar.json");
}

test("durum anahtarın KENDİSİNİ içermez — renderer'a giden tek görünüm", () => {
  const d = anahtarDeposuKur({ yol: yer(), sifreleyici: sahteSifre() });
  d.kaydet("nvidia", NVIDIA, ANAHTAR);
  assert.ok(!JSON.stringify(d.durum()).includes(ANAHTAR), JSON.stringify(d.durum()));
});

test("durum hangi sağlayıcıda anahtar olduğunu söyler", () => {
  const d = anahtarDeposuKur({ yol: yer(), sifreleyici: sahteSifre() });
  d.kaydet("nvidia", NVIDIA, ANAHTAR);
  assert.deepEqual(d.durum(), [{ ad: "nvidia", adres: NVIDIA, anahtarVar: true, kalici: true }]);
});

test("dosyada düz anahtar YOK", () => {
  const y = yer();
  anahtarDeposuKur({ yol: y, sifreleyici: sahteSifre() }).kaydet("nvidia", NVIDIA, ANAHTAR);
  assert.ok(!fs.readFileSync(y, "utf8").includes(ANAHTAR));
});

test("hatırlanır: yeni açılışta aynı anahtar çözülür", () => {
  const y = yer();
  anahtarDeposuKur({ yol: y, sifreleyici: sahteSifre() }).kaydet("nvidia", NVIDIA, ANAHTAR);
  assert.equal(anahtarDeposuKur({ yol: y, sifreleyici: sahteSifre() }).anahtar("nvidia")?.anahtar, ANAHTAR);
});

test("sil: anahtar bellekten ve dosyadan gider", () => {
  const y = yer();
  const d = anahtarDeposuKur({ yol: y, sifreleyici: sahteSifre() });
  d.kaydet("nvidia", NVIDIA, ANAHTAR);
  d.sil("nvidia");
  assert.deepEqual({ bellek: d.anahtar("nvidia"), yeniden: anahtarDeposuKur({ yol: y, sifreleyici: sahteSifre() }).durum() },
    { bellek: null, yeniden: [] });
});

test("şifreleme yoksa anahtar diske HİÇ yazılmaz, yalnız bu oturumda kalır ve bu söylenir", () => {
  const y = yer();
  const d = anahtarDeposuKur({ yol: y, sifreleyici: sahteSifre(false) });
  const s = d.kaydet("nvidia", NVIDIA, ANAHTAR);
  assert.deepEqual({ s, dosya: fs.existsSync(y), bellek: d.anahtar("nvidia")?.anahtar }, { s: { ok: true, kalici: false }, dosya: false, bellek: ANAHTAR });
});

test("düz HTTP ile başka makineye anahtar gönderilmez", () => {
  const d = anahtarDeposuKur({ yol: yer(), sifreleyici: sahteSifre() });
  const s = d.kaydet("x", "http://ornek.com/v1", ANAHTAR);
  assert.equal(s.ok, false);
});

test("adres ızgarası: https ve yerel http geçer, gerisi geçmez", () => {
  const izgara: [string, boolean][] = [
    [NVIDIA, true], ["http://127.0.0.1:8080/v1", true], ["http://localhost/v1", true],
    ["http://ornek.com/v1", false], ["ftp://ornek.com", false], ["bozuk", false],
  ];
  for (const [adres, gecer] of izgara) assert.equal(adresHatasi(adres) === "", gecer, adres);
});

test("boş, boşluklu ya da çok uzun anahtar reddedilir; hata metni anahtarı içermez", () => {
  const d = anahtarDeposuKur({ yol: yer(), sifreleyici: sahteSifre() });
  for (const a of ["", "  ", "iki parca", "x".repeat(600)]) {
    const s = d.kaydet("nvidia", NVIDIA, a);
    assert.equal(s.ok, false, JSON.stringify(a));
    assert.ok(s.ok || !s.hata.includes(a.trim() || "\u0000"), s.ok ? "" : s.hata);
  }
});

test("geçersiz sağlayıcı adı reddedilir (dosya anahtarı olamaz)", () => {
  const d = anahtarDeposuKur({ yol: yer(), sifreleyici: sahteSifre() });
  assert.equal(d.kaydet("../kotu", NVIDIA, ANAHTAR).ok, false);
});

test("bozuk dosya açılışı durdurmaz: boş başlar", () => {
  const y = yer();
  fs.writeFileSync(y, "{bozuk");
  assert.deepEqual(anahtarDeposuKur({ yol: y, sifreleyici: sahteSifre() }).durum(), []);
});
