// uygulama/takip.test.ts — "Beni takip et" denetleyicisi, sahte bedenle.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Takipci, UZAK_M, YAKIN_M } from "./takip.ts";
import type { Niyet, NiyetSonucu } from "../protocol/niyet.ts";

function kur(mesafe: number) {
  const giden: Niyet[] = [];
  let bitir: (() => void) | null = null;
  const t = new Takipci({
    orionKonumu: () => ({ x: 0, z: 0 }),
    ozynKonumu: () => ({ x: mesafe, z: 0 }),
    bedenAdimi: (n) => { giden.push(n); return new Promise<NiyetSonucu>((coz) => { bitir = () => coz({ niyet_id: "p", durum: "bitti" }); }); },
  });
  return { t, giden, bitir: () => bitir?.(), uzaklas: (m: number) => { mesafe = m; } };
}
const bekle = () => new Promise((r) => setTimeout(r, 0));

test("takip kapalıyken uzaklaşma yürütmez", () => {
  const { t, giden } = kur(UZAK_M + 2);
  t.tik();
  assert.equal(giden.length, 0);
});

test("Ozyn uzaklaşınca yanına (oyuncuya, YAKIN_M) yürür", () => {
  const { t, giden } = kur(UZAK_M + 1);
  t.baslat(); t.tik();
  assert.deepEqual(giden, [{ tur: "git", hedef: { tip: "oyuncu" }, mesafe: YAKIN_M }]);
});

test("Ozyn yakındaysa yürümez (histerezis)", () => {
  const { t, giden } = kur(UZAK_M - 0.1);
  t.baslat(); t.tik();
  assert.equal(giden.length, 0);
});

test("yürürken ikinci yürüyüş başlamaz", () => {
  const { t, giden } = kur(UZAK_M + 1);
  t.baslat(); t.tik(); t.tik(); t.tik();
  assert.equal(giden.length, 1);
});

test("yürüyüş bitince tekrar bakar", async () => {
  const k = kur(UZAK_M + 1);
  k.t.baslat(); k.t.tik();
  k.bitir(); await bekle();
  k.t.tik();
  assert.equal(k.giden.length, 2);
});

test("bırakılınca yürümez", () => {
  const { t, giden } = kur(UZAK_M + 1);
  t.baslat(); t.birak(); t.tik();
  assert.equal(giden.length, 0);
});

test("yakın mesafe uzak eşikten küçüktür (yoksa her adımda kıpırdanır)", () => {
  assert.ok(YAKIN_M < UZAK_M);
});
