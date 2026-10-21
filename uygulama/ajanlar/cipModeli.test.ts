// uygulama/ajanlar/cipModeli.test.ts — ajan çipleri modeli (spec 33 dilim 4–5).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { HEPSI } from "./ajanKaydi.ts";
import { CipSecimi, hedefCipleri, type Cip } from "./cipModeli.ts";

const ORION: Cip = { id: "orion", etiket: "Orion", renk: "#4fd8ff" };
const FLASH: Cip = { id: "flash", etiket: "Flash", renk: "#ffb347" };

test("istenen yoksa ilk seçenek etkindir", () => {
  assert.equal(new CipSecimi(() => [ORION, FLASH]).etkin(), "orion");
});

test("seçilen çip etkin olur", () => {
  const c = new CipSecimi(() => [ORION, FLASH]);
  c.sec("flash");
  assert.equal(c.etkin(), "flash");
});

test("bilinmeyen çip seçilmez", () => {
  assert.equal(new CipSecimi(() => [ORION]).sec("yok"), false);
});

test("hatırlanan seçim henüz yoksa ilk seçenek görünür (sözün gittiği yer = vurgulu çip)", () => {
  assert.equal(new CipSecimi(() => [ORION], "flash").etkin(), "orion");
});

test("hatırlanan seçim, ajan gelince geri döner", () => {
  const liste: Cip[] = [ORION];
  const c = new CipSecimi(() => liste, "flash");
  liste.push(FLASH);
  assert.equal(c.etkin(), "flash");
});

test("seçenek yoksa etkin null", () => {
  assert.equal(new CipSecimi(() => []).etkin(), null);
});

test("döngü uçta başa döner", () => {
  const c = new CipSecimi(() => [ORION, FLASH], "flash");
  assert.equal(c.dongu(1), "orion");
});

test("geri döngü baştan sona atlar", () => {
  const c = new CipSecimi(() => [ORION, FLASH]);
  assert.equal(c.dongu(-1), "flash");
});

test("seçim değişince dinleyici yeni kimliği alır", () => {
  const c = new CipSecimi(() => [ORION, FLASH]);
  const gelen: (string | null)[] = [];
  c.dinle((id) => { gelen.push(id); });
  c.sec("flash");
  assert.deepEqual(gelen, ["flash"]);
});

test("aynı çip yeniden seçilince dinleyici çağrılmaz", () => {
  const c = new CipSecimi(() => [ORION, FLASH]);
  let n = 0;
  c.dinle(() => { n++; });
  c.sec("orion");
  assert.equal(n, 0);
});

test("hedef çipleri: tek ajanda 'ikisi' çipi yok", () => {
  assert.deepEqual(hedefCipleri([{ id: "orion", ad: "Orion", renk: "#1" }]).map((c) => c.id), ["orion"]);
});

test("hedef çipleri: iki ajanda üçüncü çip 'İkisi' ve kimliği HEPSI", () => {
  const c = hedefCipleri([{ id: "orion", ad: "Orion", renk: "#1" }, { id: "flash", ad: "Flash", renk: "#2" }]);
  assert.deepEqual(c.map((x) => [x.id, x.etiket]), [["orion", "Orion"], ["flash", "Flash"], [HEPSI, "İkisi"]]);
});

test("hedef çipleri: üç ajanda ortak çip 'Hepsi'", () => {
  const c = hedefCipleri([{ id: "a", ad: "A", renk: "#1" }, { id: "b", ad: "B", renk: "#2" }, { id: "c", ad: "C", renk: "#3" }]);
  assert.equal(c.at(-1)?.etiket, "Hepsi");
});
