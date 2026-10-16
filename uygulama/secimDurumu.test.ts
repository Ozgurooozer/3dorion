// uygulama/secimDurumu.test.ts — seçili nesne: seç/kaldır, aynısını yeniden seçme, yerden kalkma, bildirim.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { secimDurumuKur } from "./secimDurumu.ts";
import type { Nesne } from "../world/level/nesneKaydi.ts";

const nesne = (id: string): Nesne => ({ id, ad: id, tur: "mobilya", capa: null, kutu: { x: 0, y: 0, z: 0, g: 1, yuk: 1, d: 1 } });
const BANK = nesne("bank"), RAF = nesne("raf");

function duzenek() {
  const yer = { nesneler: [BANK, RAF] as Nesne[] };
  const bildirim: (string | null)[] = [];
  const s = secimDurumuKur({ nesneler: () => yer.nesneler, degisti: (n) => { bildirim.push(n?.id ?? null); } });
  return { s, yer, bildirim };
}

test("başlangıçta seçili yok", () => {
  assert.equal(duzenek().s.oku(), null);
});

test("seçilen nesne okunur ve değişiklik bildirilir", () => {
  const { s, bildirim } = duzenek();
  assert.equal(s.sec(BANK), true);
  assert.deepEqual([s.oku()?.id, bildirim], ["bank", ["bank"]]);
});

test("aynı nesneyi yeniden seçmek değişiklik DEĞİL: bildirim yok", () => {
  const { s, bildirim } = duzenek();
  s.sec(BANK);
  assert.equal(s.sec(BANK), false);
  assert.deepEqual(bildirim, ["bank"]);
});

test("başka nesne seçilince seçim değişir", () => {
  const { s, bildirim } = duzenek();
  s.sec(BANK); s.sec(RAF);
  assert.deepEqual([s.oku()?.id, bildirim], ["raf", ["bank", "raf"]]);
});

test("null seçimi kaldırır; seçili yokken null değişiklik değildir", () => {
  const { s, bildirim } = duzenek();
  assert.equal(s.sec(null), false);
  s.sec(BANK);
  assert.equal(s.sec(null), true);
  assert.deepEqual([s.oku(), bildirim], [null, ["bank", null]]);
});

test("yerde olmayan nesne SEÇİLMEZ", () => {
  const { s } = duzenek();
  assert.equal(s.sec(nesne("hayalet")), false);
  assert.equal(s.oku(), null);
});

test("seçili nesne yerden kalkarsa (yer değişti) oku() onu temizler ve bildirir", () => {
  const { s, yer, bildirim } = duzenek();
  s.sec(BANK);
  yer.nesneler = [RAF];
  assert.equal(s.oku(), null);
  assert.deepEqual(bildirim, ["bank", null]);
});
