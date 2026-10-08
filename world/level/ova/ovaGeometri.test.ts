// world/level/ova/ovaGeometri.test.ts — Ova geometrisi sahnesiz: bütçe, normal yönleri, renkler (spec 17).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { zeminGeometrisi, gokGeometrisi, bulutGeometrisi, bulutYerleri, ucgenSayisi, type Geometri } from "./ovaGeometri.ts";
import { OVA, PALET, rastgele } from "./ovaVerisi.ts";

const normalY = (g: Geometri) => Array.from({ length: g.normal.length / 3 }, (_, i) => g.normal[i * 3 + 1]!);

test("zemin üçgen sayısı 2·bölüm²", () => {
  assert.equal(ucgenSayisi(zeminGeometrisi(10, 6)), 2 * 36);
});

test("zemin normalleri yukarı bakar (ışık üstten vursun)", () => {
  assert.ok(normalY(zeminGeometrisi(50, 12)).every((y) => y > 0));
});

test("zemin flat: her üçgenin kendi üç köşesi var (paylaşım yok)", () => {
  const g = zeminGeometrisi(10, 4);
  assert.equal(g.konum.length / 3, g.indeks.length);
});

test("zemin renkleri paletten", () => {
  const g = zeminGeometrisi(50, 8);
  const cimler = [PALET.cimKoyu, PALET.cimOrta, PALET.cimAcik, PALET.cimUc];
  // Float32'ye yazıldığı için tam eşitlik değil, 1e-6 yakınlık.
  const palettenMi = (i: number) => cimler.some((c) => c.every((v, k) => Math.abs(v - g.renk[i + k]!) < 1e-6));
  for (let i = 0; i < g.renk.length; i += 4) assert.ok(palettenMi(i));
});

test("gök normalleri İÇE bakar (içinden görülür)", () => {
  const g = gokGeometrisi(100, 8, 4);
  for (let i = 0; i < g.normal.length; i += 9) {
    const dot = g.normal[i]! * g.konum[i]! + g.normal[i + 1]! * g.konum[i + 1]! + g.normal[i + 2]! * g.konum[i + 2]!;
    assert.ok(dot < 0);
  }
});

test("gök ufkun biraz altından başlar (kenar görünmesin)", () => {
  const g = gokGeometrisi(100, 8, 4);
  assert.ok(Math.min(...Array.from({ length: g.konum.length / 3 }, (_, i) => g.konum[i * 3 + 1]!)) < 0);
});

test("gök kubbesinin tepesi zenit rengine yakın, alt bandı ufuk rengine yakın", () => {
  const g = gokGeometrisi();
  const y = Array.from({ length: g.konum.length / 3 }, (_, i) => g.konum[i * 3 + 1]!);
  const enUst = y.indexOf(Math.max(...y)), enAlt = y.indexOf(Math.min(...y));
  const mavilik = (i: number) => g.renk[i * 4 + 2]! - g.renk[i * 4]!;
  assert.ok(mavilik(enUst) > mavilik(enAlt));
});

test("bulutlar belirleyici: aynı tohum aynı geometri", () => {
  const a = bulutGeometrisi(bulutYerleri(rastgele(5), 3), rastgele(6));
  const b = bulutGeometrisi(bulutYerleri(rastgele(5), 3), rastgele(6));
  assert.deepEqual(Array.from(a.konum.slice(0, 30)), Array.from(b.konum.slice(0, 30)));
});

test("bulut yerleri ufka yakın halkada ve gök kubbesinin içinde", () => {
  for (const y of bulutYerleri(rastgele(9), 30)) {
    const r = Math.hypot(y.x, y.y, y.z) + y.olcek * 2;
    assert.ok(r < OVA.gokYaricap, `r=${r}`);
  }
});

test("bulutun alt yüzleri üst yüzlerinden koyu (pişmiş gölge)", () => {
  const g = bulutGeometrisi([{ x: 0, y: 0, z: 0, olcek: 10 }], rastgele(1));
  let ust = 0, alt = 0, nu = 0, na = 0;
  for (let i = 0; i < g.normal.length / 3; i++) {
    const p = g.renk[i * 4]!;
    if (g.normal[i * 3 + 1]! > 0.5) { ust += p; nu++; } else if (g.normal[i * 3 + 1]! < -0.5) { alt += p; na++; }
  }
  assert.ok(ust / nu > alt / na);
});

test("bütçe: zemin + gök + bulutlar 60 bin üçgenin altında", () => {
  const t = ucgenSayisi(zeminGeometrisi()) + ucgenSayisi(gokGeometrisi()) + ucgenSayisi(bulutGeometrisi(bulutYerleri(rastgele(OVA.tohum)), rastgele(OVA.tohum + 1)));
  assert.ok(t < 60_000, String(t));
});
