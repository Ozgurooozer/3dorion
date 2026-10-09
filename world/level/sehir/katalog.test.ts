// world/level/sehir/katalog.test.ts — Şehir kitinin varlık kataloğunun (assets/sehir/katalog.json) bekçisi.
//
// Katalog ve dosyalar assets/kaynak/sehir-kiti.py ile Blender'dan üretilir. Betik değişip kit yeniden
// dışa aktarılınca sözleşme burada denetlenir: her satırın glb'si ve önizlemesi var, glb gerçekten glTF ikili,
// kategori bilinen kümeden, adlar tekil, boyutlar pozitif, bütçe (toplam < 8 MB, tek glb < 1 MB) aşılmamış.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

type Varlik = {
  ad: string;
  kategori: string;
  dosya: string;
  onizleme: string;
  boyut: [number, number, number];
  ucgen: number;
  bayt: number;
};
type Katalog = { surum: number; kaynak: string; varliklar: Varlik[] };

const ASSETS = new URL("../../../assets/", import.meta.url);
const yol = (goreli: string): URL => new URL(goreli, ASSETS);
const katalog = JSON.parse(fs.readFileSync(yol("sehir/katalog.json"), "utf8")) as Katalog;
const varliklar = katalog.varliklar;

const KATEGORILER = new Set(["bina", "modul", "detay", "yukseltilmis", "liman", "altyapi", "neon", "esya", "yol", "tabela"]);
const GLTF_BUYU = 0x46546c67; // "glTF", küçük-sonlu uint32
const MB = 1024 * 1024;

test("katalog: sürüm 1 ve boş olmayan varlık listesi", () => {
  assert.ok(katalog.surum === 1 && Array.isArray(varliklar) && varliklar.length > 0, JSON.stringify(katalog.surum));
});

test("katalog: her satırın glb dosyası var", () => {
  const eksik = varliklar.filter((v) => !fs.existsSync(yol(v.dosya))).map((v) => v.dosya);
  assert.deepEqual(eksik, []);
});

test("katalog: her satırın önizleme png'si var", () => {
  const eksik = varliklar.filter((v) => !fs.existsSync(yol(v.onizleme))).map((v) => v.onizleme);
  assert.deepEqual(eksik, []);
});

test("katalog: her glb glTF büyülü sayısıyla başlar (ikili glTF)", () => {
  const bozuk = varliklar.filter((v) => fs.readFileSync(yol(v.dosya)).readUInt32LE(0) !== GLTF_BUYU).map((v) => v.ad);
  assert.deepEqual(bozuk, []);
});

test("katalog: kayıtlı bayt glb dosyasının gerçek boyutuyla aynı", () => {
  const uyusmaz = varliklar.filter((v) => fs.statSync(yol(v.dosya)).size !== v.bayt).map((v) => v.ad);
  assert.deepEqual(uyusmaz, []);
});

test("katalog: kategoriler izinli kümeden", () => {
  const yabanci = varliklar.filter((v) => !KATEGORILER.has(v.kategori)).map((v) => `${v.ad}:${v.kategori}`);
  assert.deepEqual(yabanci, []);
});

test("katalog: adlar tekil", () => {
  assert.equal(new Set(varliklar.map((v) => v.ad)).size, varliklar.length);
});

test("katalog: boyutlar (x, y, z) üç pozitif sayı", () => {
  const kotu = varliklar.filter((v) => v.boyut.length !== 3 || v.boyut.some((b) => !(b > 0))).map((v) => v.ad);
  assert.deepEqual(kotu, []);
});

test("katalog: yol parçası yatık — ROAD_Main_4Lane_Straight yüksekliği (boyut[1]) ≈ 0.28 m", () => {
  const yolParca = varliklar.find((v) => v.ad === "ROAD_Main_4Lane_Straight");
  assert.ok(yolParca !== undefined && Math.abs(yolParca.boyut[1] - 0.28) < 0.01, JSON.stringify(yolParca?.boyut));
});

test("katalog: kategori, sonra ad sırasında", () => {
  const anahtar = varliklar.map((v) => `${v.kategori}\u0000${v.ad}`);
  assert.deepEqual(anahtar, [...anahtar].sort());
});

test("bütçe: glb toplamı 8 MB altı", () => {
  const toplam = varliklar.reduce((t, v) => t + fs.statSync(yol(v.dosya)).size, 0);
  assert.ok(toplam < 8 * MB, String(toplam));
});

test("bütçe: tek glb 1 MB altı", () => {
  const buyuk = varliklar.filter((v) => fs.statSync(yol(v.dosya)).size >= MB).map((v) => v.ad);
  assert.deepEqual(buyuk, []);
});
