// world/level/ova/ovaVerisi.test.ts — Ova'nın saf verisi (spec 17): belirleyicilik, sınırlar, palet.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PALET, OVA, BUTCE, hex, rastgele, gurultu, yukseklik, gokRengi, zeminRengi, karistir } from "./ovaVerisi.ts";

test("hex rengi 0..1 aralığına çevrilir", () => {
  assert.deepEqual(hex("#ff8000"), [1, 128 / 255, 0]);
});

test("paletteki her renk 0..1 aralığında", () => {
  for (const [ad, r] of Object.entries(PALET)) assert.ok(r.every((v) => v >= 0 && v <= 1), ad);
});

test("aynı tohum aynı diziyi üretir (ova her açılışta aynı)", () => {
  const a = rastgele(42), b = rastgele(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test("farklı tohum farklı dizi üretir", () => {
  assert.notEqual(rastgele(1)(), rastgele(2)());
});

test("rastgele [0,1) aralığında", () => {
  const r = rastgele(7);
  for (let i = 0; i < 1000; i++) { const v = r(); assert.ok(v >= 0 && v < 1); }
});

test("gürültü belirleyici ve [0,1) aralığında", () => {
  assert.equal(gurultu(3.3, -7.1), gurultu(3.3, -7.1));
  for (let i = 0; i < 200; i++) { const v = gurultu(i * 0.37, -i * 0.71); assert.ok(v >= 0 && v < 1); }
});

test("gürültü süreklidir (komşu noktalar arasında sıçrama yok)", () => {
  assert.ok(Math.abs(gurultu(5.5, 2.5) - gurultu(5.501, 2.5)) < 0.01);
});

test("yükseklik tepe sınırını aşmaz", () => {
  for (let i = 0; i < 400; i++) {
    const h = yukseklik((i % 20) * 31 - 300, Math.floor(i / 20) * 31 - 300);
    assert.ok(Math.abs(h) <= OVA.tepeYukseklik + 1e-9, String(h));
  }
});

test("merkez (yürünen yer) neredeyse düz: uzaktakinden en az dört kat sakin", () => {
  const sapma = (r: number) => Math.max(...Array.from({ length: 36 }, (_, i) => Math.abs(yukseklik(Math.cos(i) * r, Math.sin(i) * r))));
  assert.ok(sapma(2) * 4 <= OVA.tepeYukseklik, `merkez=${sapma(2)}`);
});

test("gök gradyanı ufukta ufuk rengi, tepede zenit rengi", () => {
  assert.deepEqual([gokRengi(0), gokRengi(1)], [PALET.gokUfuk, PALET.gokZenit]);
});

test("zemin rengi daima paletten gelir", () => {
  const cimler = [PALET.cimKoyu, PALET.cimOrta, PALET.cimAcik, PALET.cimUc];
  for (let i = 0; i < 100; i++) assert.ok(cimler.includes(zeminRengi(i * 3.1, -i * 1.7) as typeof PALET.cimKoyu));
});

test("karışım uçlarda kendisini verir ve sınırı aşmaz", () => {
  assert.deepEqual([karistir(PALET.gunes, PALET.bulut, 0), karistir(PALET.gunes, PALET.bulut, 2)], [PALET.gunes, PALET.bulut]);
});

test("gök kubbesi kameranın uzak düzleminin içinde (yoksa kırpılır)", () => {
  assert.ok(OVA.gokYaricap < OVA.kameraUzak);
});

test("güneş yönü birim vektör ve ufkun üstünde", () => {
  const [x, y, z] = OVA.gunesYonu;
  assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 0.02 && y > 0);
});

test("bütçe ön kaydı: oda tavanıyla aynı çizim sınırı", () => {
  assert.equal(BUTCE.cizim, 150);
});
