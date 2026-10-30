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

test("arama yalnız KİMLİKTE eşleşse de bulur (ad farklı)", () => {
  const r = nesneListesi(tanim([nesne({ id: "kapi-7", varlik: "x/duvar.glb" })]), "kapi-7");
  assert.deepEqual(r.satirlar.map((s) => s.id), ["kapi-7"]);
});
