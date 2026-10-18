// uygulama/assetListesi.test.ts — menü için asset grupları: Türkçe ad, kısa ad, çakışma ayırt etme, sıralama, kategori birleştirme.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { assetGruplari, assetKartlari } from "./assetListesi.ts";
import type { Katalog, Varlik } from "../world/level/cekirdek/katalog.ts";
import type { AnlamSozlugu } from "../world/level/cekirdek/anlam.ts";

const v = (ad: string, kategori: string): Varlik => ({ ad, kategori, dosya: `${ad}.glb`, onizleme: "", boyut: [1, 1, 1], ucgen: 0, bayt: 0 });
const kat = (...varliklar: Varlik[]): Katalog => ({ surum: 1, kaynak: "t", varliklar });
const anlam = (varliklar: AnlamSozlugu["varliklar"]): AnlamSozlugu => ({ surum: 1, kategoriler: {}, varliklar });

test("görünen ad: anlam sözlüğündeki Türkçe ad; yoksa kısa ad", () => {
  const g = assetGruplari(kat(v("PROP_TrafficCone_SM", "esya"), v("PROP_Bench_MD", "esya")), anlam({ PROP_Bench_MD: { ad: "Bank" } }));
  assert.deepEqual(g[0]!.ogeler.map((o) => o.ad), ["Bank", "TrafficCone SM"]);
});

test("öğe, yerleştirmeye gidecek katalog adını (varlik) taşır", () => {
  const g = assetGruplari(kat(v("PROP_Bench_MD", "esya")), anlam({ PROP_Bench_MD: { ad: "Bank" } }));
  assert.deepEqual(g[0]!.ogeler[0], { varlik: "PROP_Bench_MD", ad: "Bank" });
});

test("kategori kodu görünen ada çevrilir; bilinmeyen kod olduğu gibi kalır", () => {
  const g = assetGruplari(kat(v("A", "bina"), v("B", "yenikod")), null);
  assert.deepEqual(g.map((x) => x.ad).sort(), ["binalar", "yenikod"]);
});

test("aynı kategoride çakışan görünen ad kısa adla ayırt edilir (menü yolu çakışmasın)", () => {
  const g = assetGruplari(kat(v("PROP_Lamp_A", "esya"), v("PROP_Lamp_B", "esya")), anlam({ PROP_Lamp_A: { ad: "Lamba" }, PROP_Lamp_B: { ad: "Lamba" } }));
  const adlar = g[0]!.ogeler.map((o) => o.ad);
  assert.equal(new Set(adlar).size, 2);
  assert.ok(adlar.every((a) => a.startsWith("Lamba ")), adlar.join("|"));
});

test("ayırt edici ek de çakışırsa tam katalog adı eklenir: yol HİÇBİR durumda çakışmaz", () => {
  // İki farklı varlığın hem Türkçe adı hem kısa adı aynı: "ABC_Tree" ve "XYZ_Tree" → kisaAd ikisi de "Tree"
  const g = assetGruplari(kat(v("ABC_Tree", "esya"), v("XYZ_Tree", "esya")), anlam({ ABC_Tree: { ad: "Ağaç" }, XYZ_Tree: { ad: "Ağaç" } }));
  const adlar = g[0]!.ogeler.map((o) => o.ad);
  assert.equal(new Set(adlar).size, 2, adlar.join("|"));
});

test("farklı kategorideki aynı ad çakışma sayılmaz (ayrı alt menüler)", () => {
  const g = assetGruplari(kat(v("A_Lamba", "esya"), v("B_Lamba", "detay")), anlam({ A_Lamba: { ad: "Lamba" }, B_Lamba: { ad: "Lamba" } }));
  assert.deepEqual(g.flatMap((x) => x.ogeler.map((o) => o.ad)), ["Lamba", "Lamba"]);
});

test("aynı görünen kategori adına düşen kodlar tek grupta birleşir", () => {
  const g = assetGruplari(kat(v("A", "bina"), v("B", "bina"), v("C", "binalar")), null);
  assert.equal(g.filter((x) => x.ad === "binalar").length, 1);
  assert.equal(g.find((x) => x.ad === "binalar")!.ogeler.length, 3);
});

test("gruplar ve öğeler Türkçe sıralı; boş katalog boş liste", () => {
  const g = assetGruplari(kat(v("Z", "esya"), v("A", "bina")), null);
  assert.deepEqual(g.map((x) => x.ad), ["binalar", "eşya"]);
  assert.deepEqual(assetGruplari(kat(), null), []);
});

test("kartlar: menüyle AYNI görünen ad ve kategori; önizleme ve boyut taşınır; ada göre sıralı", () => {
  const k = kat({ ...v("PROP_Bench_MD", "esya"), onizleme: "o/bank.png", boyut: [2, 1, 0.5] }, v("PROP_Cone", "esya"));
  const s = anlam({ PROP_Bench_MD: { ad: "Bank" } });
  const kartlar = assetKartlari(k, s);
  assert.deepEqual(kartlar.map((c) => c.ad), ["Bank", "Cone"]);
  assert.deepEqual(kartlar[0], { varlik: "PROP_Bench_MD", ad: "Bank", kategori: "eşya", onizleme: "o/bank.png", boyut: [2, 1, 0.5] });
  const menu = assetGruplari(k, s);
  assert.deepEqual(kartlar.map((c) => [c.varlik, c.ad, c.kategori]).sort(), menu.flatMap((g) => g.ogeler.map((o) => [o.varlik, o.ad, g.ad])).sort());
});

test("kartlar: çakışan görünen ad menüdeki gibi ayırt edilir", () => {
  const kartlar = assetKartlari(kat(v("PROP_Lamp_A", "esya"), v("PROP_Lamp_B", "esya")), anlam({ PROP_Lamp_A: { ad: "Lamba" }, PROP_Lamp_B: { ad: "Lamba" } }));
  assert.equal(new Set(kartlar.map((c) => c.ad)).size, 2);
});

test("kartlar: boş katalog boş liste", () => {
  assert.deepEqual(assetKartlari(kat(), null), []);
});
