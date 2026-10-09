// world/level/shader/shader.test.ts — Özel shader'lar (spec 20): zaman, palet, sözleşme ve GLSL bekçileri.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { gunesYonuSaatten, durumuSaateGoreYaz, dunyaDurumuYap, paletZamanda, saatSar, zamanIlerle, ZAMAN_VARSAYILAN } from "./dunyaDurumu.ts";
import { DUNYA_PALETLERI, dunyaPaleti } from "./paletler.ts";
import { SHADERLAR } from "./moduller/index.ts";
import { shaderlariNormallestir } from "./shaderSistemi.ts";
import { DUNYA_KOSE_GLSL, DUNYA_ISIK_ONCESI_GLSL, DUNYA_SIS_ONCESI_GLSL, DunyaEklentisi } from "./dunyaEklentisi.ts";
import { patlama } from "./moduller/hataImzasi.ts";
import { ayarBirlestir } from "../cekirdek/modul.ts";
import { hex } from "../cekirdek/renk.ts";
import { malzemeKur } from "../cekirdek/malzeme.ts";
import { dunyaUniformlariYap } from "./dunyaEklentisi.ts";
import type { LevelModulu } from "../cekirdek/modul.ts";
import type { ModulKaydi } from "../cekirdek/levelKur.ts";

const yakin = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

// ── zaman ──
test("öğlen güneş en yüksekte (y en büyük)", () => {
  const ys = [8, 10, 12, 14, 16].map((s) => gunesYonuSaatten(s, 35)[1]);
  assert.equal(Math.max(...ys), ys[2]);
});
test("gece yarısı güneş ufkun altında", () => {
  assert.ok(gunesYonuSaatten(0, 35)[1] < 0);
});
test("06:00 güneş ufukta, doğuda (+X)", () => {
  const [x, y] = gunesYonuSaatten(6, 35);
  assert.ok(yakin(y, 0) && yakin(x, 1));
});
test("saat 24'lük döngü: 25 → 1, −1 → 23", () => {
  assert.deepEqual([saatSar(25), saatSar(-1)], [1, 23]);
});
test("gece oranı: gece yarısı ≈ 1, öğlen ≈ 0", () => {
  const d = dunyaDurumuYap();
  durumuSaateGoreYaz(d, 0, 35); const gece = d.gece;
  durumuSaateGoreYaz(d, 12, 35);
  assert.deepEqual([gece > 0.99, d.gece < 0.01], [true, true]);
});
test("zaman akarken saat hız × dt kadar ilerler", () => {
  const d = dunyaDurumuYap(); d.saat = 10;
  zamanIlerle(d, { ...ZAMAN_VARSAYILAN, akiyor: true, hiz: 2 }, 0.5, dunyaPaleti(0).kareler);
  assert.ok(yakin(d.saat, 11));
});
test("zaman durunca saat sabit", () => {
  const d = dunyaDurumuYap(); d.saat = 10;
  zamanIlerle(d, { ...ZAMAN_VARSAYILAN, akiyor: false }, 5, dunyaPaleti(0).kareler);
  assert.equal(d.saat, 10);
});

// ── palet zaman çizelgesi ──
const K = [{ saat: 6, renkler: { a: "#000000" } }, { saat: 18, renkler: { a: "#ffffff" } }];
test("palet karede tam o karenin rengi", () => {
  assert.deepEqual(paletZamanda(K, 6)["a"], [0, 0, 0]);
});
test("palet iki kare arasında doğrusal (12:00 → yarı)", () => {
  assert.ok(yakin(paletZamanda(K, 12)["a"]![0], 0.5));
});
test("palet gece yarısını sarar (18 → 6 arası 00:00 yarı yolda)", () => {
  assert.ok(yakin(paletZamanda(K, 0)["a"]![0], 0.5));
});
const L = (h: string) => { const r = hex(h); return 0.299 * r[0] + 0.587 * r[1] + 0.114 * r[2]; };
test("her dünya karesinde gerekli adlar var (gök, ışık, dolgu, rampa)", () => {
  const gerekli = ["gokZenit", "gokUfuk", "isik", "dolgu", "r0", "r1", "r2", "r3", "r4"];
  const eksik = DUNYA_PALETLERI.flatMap((d) => d.kareler.flatMap((k) => gerekli.filter((g) => !(g in k.renkler)).map((g) => `${d.ad}@${k.saat}:${g}`)));
  assert.deepEqual(eksik, []);
});
test("her rampa koyudan açığa (palet haritası parlaklıkla eşler)", () => {
  const bozuk = DUNYA_PALETLERI.flatMap((d) => d.kareler.filter((k) => {
    const l = [0, 1, 2, 3, 4].map((i) => L(k.renkler[`r${i}`]!));
    return l.some((v, i) => i > 0 && v < l[i - 1]!);
  }).map((k) => `${d.ad}@${k.saat}`));
  assert.deepEqual(bozuk, []);
});
test("dünya dizini sarılır (seçim sayıyla)", () => {
  assert.equal(dunyaPaleti(DUNYA_PALETLERI.length).ad, DUNYA_PALETLERI[0]!.ad);
});

// ── sözleşme ──
test("her shader modülünün varsayılanı kendi şemasından geçer", () => {
  for (const m of SHADERLAR.values()) assert.doesNotThrow(() => ayarBirlestir(m.tur, m.varsayilan, m.varsayilan), m.tur);
});
test("shader aralıkları varsayılanı içerir", () => {
  for (const m of SHADERLAR.values()) {
    for (const [k, a] of Object.entries(m.aralik ?? {})) {
      const v = m.varsayilan[k] as number;
      assert.ok(a && v >= a.min && v <= a.max, `${m.tur}.${k}`);
    }
  }
});
test("bilinmeyen shader türü hata verir", () => {
  assert.throws(() => shaderlariNormallestir([{ tur: "yok", acik: true, ayar: {} }], SHADERLAR), /bilinmeyen/);
});
test("shader girdisi varsayılanla tamamlanır", () => {
  const [s] = shaderlariNormallestir([{ tur: "zamanKirigi", acik: true, ayar: { yaricap: 5 } }], SHADERLAR);
  assert.deepEqual([s!.ayar["yaricap"], s!.ayar["saatFarki"]], [5, 12]);
});
test("hata patlaması belirleyici ve 0/1", () => {
  const z = [0, 0.4, 1.7, 3.3].map((t) => patlama(t, 0.3));
  assert.ok(z.every((v) => v === 0 || v === 1) && JSON.stringify(z) === JSON.stringify([0, 0.4, 1.7, 3.3].map((t) => patlama(t, 0.3))));
});
test("sıklık 0 → hiç patlama yok", () => {
  assert.ok([0, 1, 2, 3, 4, 5].every((t) => patlama(t * 0.37, 0) === 0));
});

// ── GLSL bekçisi: kod yalnız bildirilen uniform'ları ve yardımcıları kullanır (yazım hatası tarayıcıda sessiz kırılmasın) ──
test("dünya eklentisinin GLSL'i yalnız bildirilen d* adlarını kullanır", () => {
  const bilinen = new Set(["dZaman", "dGok1", "dGok2", "dGok3", "dGok4", "dKirik1", "dKirik2", "dKirik3", "dR0", "dR1", "dR2", "dR3", "dR4",
    "dHata1", "dHata2", "dHata3", "dHata4", "dFirca", "dNesne", "dKarma", "dHataKatsayi", "dh", "dk", "dot"]);
  const kod = DUNYA_KOSE_GLSL + DUNYA_ISIK_ONCESI_GLSL + DUNYA_SIS_ONCESI_GLSL;
  const bilinmeyen = [...new Set(kod.match(/\bd[A-Z][A-Za-z0-9]*\b/g) ?? [])].filter((a) => !bilinen.has(a));
  assert.deepEqual(bilinmeyen, []);
});
test("dünya eklentisi ışıklı ve pişmiş malzemeye takılır", () => {
  const sahne = new Scene(new NullEngine()), u = dunyaUniformlariYap();
  const takili = ["isikli", "pismis"].map((t) => !!malzemeKur(sahne, t, t as "isikli" | "pismis", { dunya: u }).pluginManager?.getPlugin("Dunya"));
  assert.deepEqual(takili, [true, true]);
});
test("dünya eklentisi tek argümanla kurulabilir (malzeme kopyası)", () => {
  const m = malzemeKur(new Scene(new NullEngine()), "x", "isikli");
  assert.doesNotThrow(() => new DunyaEklentisi(m));
});

// ── ön kayıt: zaman akarken tanım/katman YENİDEN KURULMAZ ──
test("zaman akarken katmanlar yeniden kurulmaz, saat ilerler", async () => {
  const { levelKur } = await import("../cekirdek/levelKur.ts");
  const { ornekTanim } = await import("../cekirdek/ornekTanim.ts");
  const { Mesh } = await import("@babylonjs/core/Meshes/mesh");
  let kurulum = 0;
  const modul: LevelModulu = { tur: "a", aciklama: "a", varsayilan: { deger: 1, renk: "mavi" }, kur(b) { kurulum++; const m = new Mesh("a", b.sahne); return { meshler: [m], yokEt() { m.dispose(); } }; } };
  const kayit: ModulKaydi = new Map([["a", modul]]);
  const t = { ...ornekTanim(), zaman: { ...ZAMAN_VARSAYILAN, saat: 10, hiz: 1, akiyor: true } };
  const level = levelKur(new Scene(new NullEngine()), t, kayit);
  const once = kurulum;
  for (let i = 0; i < 10; i++) level.guncelle(0.5);
  assert.deepEqual([kurulum - once, Math.round(level.dunya.saat)], [0, 15]);
});
