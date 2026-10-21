// world/arayuz/ayarPaneliModeli.test.ts — Ajan ayar paneli modeli (spec 34): bölüm kaydı, ajan süzgeci, akordeon, kalıcılık.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { ayarPaneliModeliKur, type BolumBilgisi } from "./ayarPaneliModeli.ts";

const ORION = { id: "orion", ad: "Orion" };
const FLASH = { id: "flash", ad: "Flash" };
const b = (id: string, sira: number, ek: Partial<BolumBilgisi> = {}): BolumBilgisi => ({ id, ad: id, simge: "•", sira, ...ek });

function kur(...bolumler: BolumBilgisi[]) {
  const m = ayarPaneliModeliKur();
  for (const x of bolumler) m.ekle(x);
  return m;
}

test("bölümler sıraya göre; eşit sırada ekleme sırası", () => {
  const m = kur(b("ses", 20), b("beyin", 10), b("notlar", 20));
  assert.deepEqual(m.bolumler("orion").map((x) => x.id), ["beyin", "ses", "notlar"]);
});

test("aynı kimlik iki kez eklenemez", () => {
  const m = kur(b("ses", 10));
  assert.throws(() => m.ekle(b("ses", 20)), /zaten ekli/);
});

test("ajan süzgeci: `ajanlar` verilen bölüm yalnız o ajanda görünür", () => {
  const m = kur(b("beyin", 10, { ajanlar: ["orion"] }), b("kisayol", 90));
  assert.deepEqual(m.bolumler("flash").map((x) => x.id), ["kisayol"]);
});

test("bölümü olmayan ajanın paneli açılmaz (boş pencere yok)", () => {
  const m = kur(b("beyin", 10, { ajanlar: ["orion"] }));
  assert.deepEqual([m.ac(FLASH), m.durum().acik], [false, false]);
});

test("aç/kapat: hangi ajanın paneli olduğu durumda", () => {
  const m = kur(b("beyin", 10));
  m.ac(ORION);
  assert.deepEqual(m.durum(), { acik: true, ajan: ORION });
});

test("aynı ajanı yeniden açmak olay yaymaz", () => {
  const m = kur(b("beyin", 10));
  m.ac(ORION);
  let olay = 0;
  m.dinle(() => { olay++; });
  m.ac(ORION);
  assert.equal(olay, 0);
});

test("akordeon: bölümler bağımsız; birini açmak ötekini kapatmaz", () => {
  const m = kur(b("beyin", 10, { acik: true }), b("ses", 20));
  m.bolumAyarla("ses", true);
  assert.deepEqual([m.bolumAcikMi("beyin"), m.bolumAcikMi("ses")], [true, true]);
});

test("akordeon: ilk hâl bölümün `acik` alanından, verilmezse kapalı", () => {
  const m = kur(b("beyin", 10, { acik: true }), b("ses", 20));
  assert.deepEqual([m.bolumAcikMi("beyin"), m.bolumAcikMi("ses")], [true, false]);
});

test("bilinmeyen bölüm HATA", () => {
  const m = kur(b("beyin", 10));
  assert.throws(() => m.bolumDegistir("yok"), /bölüm yok/);
});

test("kalıcılık: bölümlerin hâli yazılıp başka modelde geri okunur", () => {
  const m = kur(b("beyin", 10, { acik: true }), b("ses", 20));
  m.bolumDegistir("beyin"); m.bolumDegistir("ses");
  const m2 = kur(b("beyin", 10, { acik: true }), b("ses", 20));
  m2.yukle(m.yaz());
  assert.deepEqual([m2.bolumAcikMi("beyin"), m2.bolumAcikMi("ses")], [false, true]);
});

test("kalıcılık: panelin kendisi açık kaydedilmez (seçim olmadan panel yok)", () => {
  const m = kur(b("beyin", 10));
  m.ac(ORION);
  const m2 = kur(b("beyin", 10));
  m2.yukle(m.yaz());
  assert.equal(m2.durum().acik, false);
});

test("kalıcılık: kaldırılmış bölümün kaydı sessizce düşer", () => {
  const m = kur(b("beyin", 10));
  m.yukle(JSON.stringify({ surum: 1, bolumler: { eski: true, beyin: true } }));
  assert.equal(m.bolumAcikMi("beyin"), true);
});

test("kalıcılık: bozuk kayıt HATA (çağıran uyarır, varsayılanla devam eder)", () => {
  const m = kur(b("beyin", 10));
  assert.throws(() => m.yukle(JSON.stringify({ surum: 1, bolumler: { beyin: "evet" } })), /açık\/kapalı değil/);
});
