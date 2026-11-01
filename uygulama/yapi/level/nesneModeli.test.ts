// uygulama/yapi/level/nesneModeli.test.ts — nesneler paneli satırları (spec 43 A5): kimliksiz atlanır, ad/arama, tavan.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import type { LevelTanimi, NesneYeri } from "../../../world/level/cekirdek/levelTanimi.ts";
import { ornekTanim } from "../../../world/level/cekirdek/ornekTanim.ts";
import { kisaVarlikAdi, nesneListesi, NESNE_LISTE_AZAMI } from "./nesneModeli.ts";

const nesne = (o: Partial<NesneYeri> & { varlik: string }): NesneYeri => ({ konum: [0, 0, 0], donus: 0, olcek: 1, ...o });
const tanim = (nesneler: NesneYeri[]): LevelTanimi => { const t = ornekTanim(); t.nesneler = nesneler; return t; };

test("kısa varlık adı: son parça, uzantısız; uzantısız ad aynen", () => {
  assert.equal(kisaVarlikAdi("kit/agac.glb"), "agac");
  assert.equal(kisaVarlikAdi("a/b/sandik.v2.glb"), "sandik.v2");
  assert.equal(kisaVarlikAdi(String.raw`a\b\sandik.glb`), "sandik", "Windows ayracı");
  assert.equal(kisaVarlikAdi("duz"), "duz");
  assert.equal(kisaVarlikAdi(".gizli"), ".gizli");
});

test("liste: kimliksiz nesne yok; ad yoksa varlığın kısa adı; gizli/kilitli/graf taşınır", () => {
  const r = nesneListesi(tanim([
    nesne({ varlik: "kit/agac.glb" }),
    nesne({ id: "n1", varlik: "kit/agac.glb" }),
    nesne({ id: "n2", varlik: "kit/sandik.glb", ad: "Büyük sandık", gizli: true, kilitli: true, graf: "ac" }),
  ]));
  assert.deepEqual(r.satirlar.map((s) => [s.id, s.ad, s.gizli, s.kilitli, s.graf]), [["n1", "agac", false, false, null], ["n2", "Büyük sandık", true, true, "ac"]]);
  assert.equal(r.toplam, 2);
});

test("arama: ad ya da kimlikte, büyük/küçük harf ve Türkçe İ duyarsız; boş arama hepsi", () => {
  const t = tanim([nesne({ id: "n1", varlik: "x/Işık.glb" }), nesne({ id: "kapi-2", varlik: "x/kapi.glb" })]);
  assert.deepEqual(nesneListesi(t, "IŞIK").satirlar.map((s) => s.id), ["n1"]);
  assert.deepEqual(nesneListesi(t, "kapi-2").satirlar.map((s) => s.id), ["kapi-2"]);
  assert.equal(nesneListesi(t, "  ").satirlar.length, 2);
  assert.equal(nesneListesi(t, "yok").satirlar.length, 0);
});

test("tavan: NESNE_LISTE_AZAMI'dan fazlası kesilir, toplam gerçek sayıyı söyler", () => {
  const cok = Array.from({ length: NESNE_LISTE_AZAMI + 5 }, (_, i) => nesne({ id: `n${i}`, varlik: "a.glb" }));
  const r = nesneListesi(tanim(cok));
  assert.equal(r.satirlar.length, NESNE_LISTE_AZAMI);
  assert.equal(r.toplam, NESNE_LISTE_AZAMI + 5);
  assert.equal(r.kesildi, true);
  assert.equal(nesneListesi(tanim(cok.slice(0, 3))).kesildi, false);
});

test("sınırlar: boş ad varlığın kısa adına düşer; gizli:false/kilitli:false açık yazılsa da false; tam tavan sayısı kesilmiş SAYILMAZ", () => {
  const r = nesneListesi(tanim([nesne({ id: "n1", varlik: "kit/agac.glb", ad: "", gizli: false, kilitli: false })]));
  assert.deepEqual(r.satirlar.map((s) => [s.ad, s.gizli, s.kilitli]), [["agac", false, false]]);
  const tam = Array.from({ length: NESNE_LISTE_AZAMI }, (_, i) => nesne({ id: `n${i}`, varlik: "a.glb" }));
  const t = nesneListesi(tanim(tam));
  assert.deepEqual([t.satirlar.length, t.toplam, t.kesildi], [NESNE_LISTE_AZAMI, NESNE_LISTE_AZAMI, false]);
});

test("hiyerarşi: çocuk üstünün hemen altında, girintiyle; çocuk sayısı; level sırası kökler arasında korunur (spec 45 B7)", () => {
  const r = nesneListesi(tanim([
    nesne({ id: "n1", varlik: "a.glb" }),
    nesne({ id: "n4", varlik: "d.glb", ust: "n2" }),
    nesne({ id: "n2", varlik: "b.glb", ust: "n1" }),
    nesne({ id: "n3", varlik: "c.glb" }),
    nesne({ id: "n5", varlik: "e.glb", ust: "n2" }),
  ]));
  assert.deepEqual(r.satirlar.map((s) => [s.id, s.girinti, s.cocuk]), [["n1", 0, 1], ["n2", 1, 2], ["n4", 2, 0], ["n5", 2, 0], ["n3", 0, 0]]);
  assert.deepEqual(r.satirlar.map((s) => s.ust), [null, "n1", "n2", "n2", null]);
  assert.equal(r.toplam, 5);
});

test("hiyerarşi: üstü listede olmayan (ışık, beden, silinmiş) nesne kök gibi girintisiz ama üstünü söyler", () => {
  const r = nesneListesi(tanim([nesne({ id: "n1", varlik: "a.glb", ust: "i1" }), nesne({ id: "n2", varlik: "b.glb", ust: "beden:orion", soket: "el_sag" })]));
  assert.deepEqual(r.satirlar.map((s) => [s.id, s.girinti, s.ust]), [["n1", 0, "i1"], ["n2", 0, "beden:orion"]]);
});

test("hiyerarşi: arama varken liste DÜZ (süzülmüş ağaç yalan söylemesin)", () => {
  const t = tanim([nesne({ id: "n1", varlik: "araba.glb" }), nesne({ id: "n2", varlik: "tekerlek.glb", ust: "n1" })]);
  assert.deepEqual(nesneListesi(t, "tekerlek").satirlar.map((s) => [s.id, s.girinti, s.cocuk]), [["n2", 0, 0]]);
  assert.deepEqual(nesneListesi(t, "").satirlar.map((s) => [s.id, s.girinti]), [["n1", 0], ["n2", 1]]);
});

test("hiyerarşi: arama İKİ nesneyi de (üst ve çocuk) eşleştirse de liste düz kalır", () => {
  const t = tanim([nesne({ id: "n1", varlik: "araba.glb" }), nesne({ id: "n2", varlik: "araba-tekerlek.glb", ust: "n1" })]);
  assert.deepEqual(nesneListesi(t, "araba").satirlar.map((s) => [s.id, s.girinti, s.cocuk]), [["n1", 0, 0], ["n2", 0, 0]]);
});

test("hiyerarşi: üstü listede olmayan nesne level sırasındaki yerinde kalır (sona atılmaz)", () => {
  const r = nesneListesi(tanim([nesne({ id: "n0", varlik: "a.glb" }), nesne({ id: "n1", varlik: "b.glb", ust: "i1" }), nesne({ id: "n2", varlik: "c.glb" })]));
  assert.deepEqual(r.satirlar.map((s) => s.id), ["n0", "n1", "n2"]);
});

test("hiyerarşi: döngülü ham veri sonsuz döngüye girmez, hiçbir nesne kaybolmaz; kendi üstü kök sayılır", () => {
  const r = nesneListesi(tanim([
    nesne({ id: "n1", varlik: "a.glb", ust: "n2" }),
    nesne({ id: "n2", varlik: "b.glb", ust: "n1" }),
    nesne({ id: "n3", varlik: "c.glb", ust: "n3" }),
  ]));
  assert.deepEqual(r.satirlar.map((s) => s.id).sort(), ["n1", "n2", "n3"]);
  assert.equal(r.satirlar.find((s) => s.id === "n3")!.girinti, 0);
  assert.equal(r.satirlar.find((s) => s.id === "n3")!.cocuk, 0, "kendi kendinin çocuğu sayılmaz");
});

test("arama yalnız KİMLİKTE eşleşse de bulur (ad farklı)", () => {
  const r = nesneListesi(tanim([nesne({ id: "kapi-7", varlik: "x/duvar.glb" })]), "kapi-7");
  assert.deepEqual(r.satirlar.map((s) => s.id), ["kapi-7"]);
});
