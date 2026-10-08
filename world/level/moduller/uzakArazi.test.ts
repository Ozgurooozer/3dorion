// world/level/moduller/uzakArazi.test.ts — Uzak arazinin boyaması ve GERÇEK varlık dosyasının bekçisi.
//
// Bekçi kısmı assets/ova-arazi.glb'yi okur: Blender betiği değişip glb yeniden üretilince biçim sözleşmesi
// (adlar, halka nerede, normaller dışa, bütçe) burada denetlenir.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { glbOku, type GlbNesnesi } from "../cekirdek/glb.ts";
import type { Renk } from "../cekirdek/renk.ts";
import type { V3 } from "../cekirdek/geometri.ts";
import { araziUcgenleri, UZAK_ARAZI_VARSAYILAN, ARAZI_DOSYASI, type UzakAraziAyari } from "./uzakArazi.ts";

const YOL = new URL(`../../../assets/${ARAZI_DOSYASI}`, import.meta.url);
const nesneler = glbOku(fs.readFileSync(YOL));
const RENKLER: Record<string, Renk> = { cimOrta: [0, 1, 0], cimKoyu: [0, 0.5, 0], toprak: [0.5, 0.3, 0], kaya: [0.6, 0.6, 0.6], kayaKoyu: [0.3, 0.3, 0.3], gokUfuk: [0.7, 0.8, 1] };
const renk = (ad: string): Renk => { const r = RENKLER[ad]; if (!r) throw new Error(ad); return r; };
/** Boyama kuralını tek başına sınamak için: hava, pus, titreme kapalı. */
const SADE: UzakAraziAyari = { ...UZAK_ARAZI_VARSAYILAN, havaGuc: 0, pus: 0, titreme: 0, bantGurultu: 0, dik: "kayaKoyu" };
const yuz = (ad: string, ucgen: [V3, V3, V3]): GlbNesnesi => ({ ad, ucgenler: [ucgen] });
const DUZ: [V3, V3, V3] = [[0, 30, 0], [0, 30, 1], [1, 30, 0]];   // yukarı bakar, y = 30
const DIK: [V3, V3, V3] = [[0, 0, 0], [0, 1, 0], [0, 0, 1]];      // yana bakar

// ── varlık bekçisi ──
test("arazi glb: tepe halkası var, masa ve kaya nesneleri adlı", () => {
  const adlar = nesneler.map((n) => n.ad);
  assert.ok(adlar.includes("tepeler") && adlar.some((a) => a.startsWith("masa")) && adlar.some((a) => a.startsWith("kaya")), adlar.join(","));
});

test("arazi glb: tepe halkası yürünen yerden uzakta ve gök kubbesinin (480 m) içinde", () => {
  const r = nesneler.find((n) => n.ad === "tepeler")!.ucgenler.flat().map((p) => Math.hypot(p[0], p[2]));
  assert.ok(Math.min(...r) > 150 && Math.max(...r) < 470, `${Math.min(...r)}–${Math.max(...r)}`);
});

test("arazi glb: tepe halkasının yüzleri yukarı bakar (sarım dışa — Babylon'da görünür)", () => {
  const yukari = nesneler.find((n) => n.ad === "tepeler")!.ucgenler.filter((t) => {
    const [a, b, c] = t;
    return (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 0;
  }).length;
  assert.equal(yukari, nesneler.find((n) => n.ad === "tepeler")!.ucgenler.length);
});

test("arazi glb: kapalı gövdelerin (masa, kaya) yüzleri merkezden dışa bakar", () => {
  for (const n of nesneler.filter((x) => x.ad !== "tepeler")) {
    const k = n.ucgenler.flat(), m = [0, 1, 2].map((i) => k.reduce((t, p) => t + p[i]!, 0) / k.length);
    for (const [a, b, c] of n.ucgenler) {
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nn = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
      const d = [0, 1, 2].map((i) => (a[i]! + b[i]! + c[i]!) / 3 - m[i]!);
      assert.ok(nn[0]! * d[0]! + nn[1]! * d[1]! + nn[2]! * d[2]! > 0, n.ad);
    }
  }
});

test("arazi glb: bütçe — 8 bin üçgen ve 1 MB altı", () => {
  const ucgen = nesneler.reduce((t, n) => t + n.ucgenler.length, 0);
  assert.ok(ucgen < 8000, String(ucgen));
  assert.ok(fs.statSync(YOL).size < 1_000_000);
});

// ── boyama ──
test("boyama: düz yüz yüksekliğin bandından renk alır (30 m → 20–42 bandı: toprak)", () => {
  assert.deepEqual(araziUcgenleri([yuz("tepeler", DUZ)], SADE, renk, () => 0)[0]!.renk, RENKLER["toprak"]);
});

test("boyama: dik yüz `dik` rengini alır", () => {
  assert.deepEqual(araziUcgenleri([yuz("tepeler", DIK)], SADE, renk, () => 0)[0]!.renk, RENKLER["kayaKoyu"]);
});

test("boyama: `kaya*` nesnesinin düz yüzü kaya rengi alır (bant değil)", () => {
  assert.deepEqual(araziUcgenleri([yuz("kaya_1", DUZ)], SADE, renk, () => 0)[0]!.renk, RENKLER["kaya"]);
});

test("oturtma: `masa*` zemin yüksekliği kadar kalkar, `tepeler` yerinde kalır", () => {
  const zemin = () => 2;
  const [masa, tepe] = araziUcgenleri([yuz("masa_1", DUZ), yuz("tepeler", DUZ)], SADE, renk, zemin);
  assert.deepEqual([masa!.a[1], tepe!.a[1]], [32, 30]);
});

test("hava perspektifi: uzak yüz ufuk rengine yakın, yakın yüz değil", () => {
  const a = { ...SADE, havaGuc: 0.8 };
  const uzak = DUZ.map((p) => [p[0] + 420, p[1], p[2]]) as [V3, V3, V3];
  const [y, u] = araziUcgenleri([yuz("tepeler", DUZ), yuz("tepeler", uzak)], a, renk, () => 0);
  const fark = (r: Renk) => Math.abs(r[2] - RENKLER["gokUfuk"]![2]);
  assert.ok(fark(u!.renk) < fark(y!.renk));
});

test("renkler/esikler uyuşmazsa hata", () => {
  assert.throws(() => araziUcgenleri([], { ...SADE, esikler: [1] }, renk, () => 0), /renkler.length/);
});
