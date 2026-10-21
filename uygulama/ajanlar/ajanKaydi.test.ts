// uygulama/ajanlar/ajanKaydi.test.ts — ajan defteri ve hedef çözücü (spec 33 dilim 1).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AjanDefteri, HEPSI, hedefCoz, type AjanKaydi } from "./ajanKaydi.ts";

/** Algısı hiçbir şey yapmayan kayıt (çözücü yalnız kimliğe ve kümeye bakar). */
function ajan(id: string, kume: string | null = null): AjanKaydi {
  return { id, ad: id, renk: "#ffffff", kume, algi: () => {} };
}

const ORION = ajan("orion");
const FLASH = ajan("flash");
const KASA = ajan("kasa", "destek/kasa");
const DANISMA = ajan("danisma", "destek");
const DESTEKCI = ajan("destekci", "destekci");
const ikiAjan = [ORION, FLASH];

test("hedef 'orion' yalnız Orion'u verir", () => {
  assert.deepEqual(hedefCoz(ikiAjan, "orion").map((a) => a.id), ["orion"]);
});

test("hedef 'flash' yalnız Flash'ı verir", () => {
  assert.deepEqual(hedefCoz(ikiAjan, "flash").map((a) => a.id), ["flash"]);
});

test("hedef HEPSI bütün ajanları defter sırasıyla verir", () => {
  assert.deepEqual(hedefCoz(ikiAjan, HEPSI).map((a) => a.id), ["orion", "flash"]);
});

test("bilinmeyen kimlik kimseyi vermez (sessizce Orion'a düşmez)", () => {
  assert.deepEqual(hedefCoz(ikiAjan, "yok"), []);
});

test("küme seçimi kümenin kendisini ve alt kümelerini verir, adı benzeyen başka kümeyi vermez", () => {
  assert.deepEqual(hedefCoz([ORION, KASA, DANISMA, DESTEKCI], { kume: "destek" }).map((a) => a.id), ["kasa", "danisma"]);
});

test("kümesiz ajan küme seçimine girmez", () => {
  assert.deepEqual(hedefCoz(ikiAjan, { kume: "destek" }), []);
});

test("defter: aynı kimlik iki kez kaydedilemez", () => {
  const d = new AjanDefteri();
  d.kaydet(ORION);
  assert.throws(() => d.kaydet(ajan("orion")), /zaten kayıtlı/);
});

test("defter: 'hepsi' kimliği ayrılmıştır, kaydedilemez", () => {
  assert.throws(() => new AjanDefteri().kaydet(ajan(HEPSI)), /ayrılmış/);
});

test("defter: kayıt sırası korunur", () => {
  const d = new AjanDefteri();
  d.kaydet(FLASH); d.kaydet(ORION);
  assert.deepEqual(d.hepsi().map((a) => a.id), ["flash", "orion"]);
});

test("defter: silinen ajan artık hedef olmaz", () => {
  const d = new AjanDefteri();
  d.kaydet(ORION); d.kaydet(FLASH);
  d.sil("flash");
  assert.deepEqual(hedefCoz(d.hepsi(), HEPSI).map((a) => a.id), ["orion"]);
});

test("defter: kayıt değişince dinleyici çağrılır", () => {
  const d = new AjanDefteri();
  let n = 0;
  d.dinle(() => { n++; });
  d.kaydet(ORION); d.sil("orion");
  assert.equal(n, 2);
});
