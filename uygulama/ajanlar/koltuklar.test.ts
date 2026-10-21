// uygulama/ajanlar/koltuklar.test.ts — koltuk defteri (spec 33 dilim 3).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Koltuklar } from "./koltuklar.ts";

test("başka bir bedenin tuttuğu koltuk doludur ve sahibinin adı döner", () => {
  const k = new Koltuklar();
  k.kaydet("Orion", () => "sandalye");
  assert.equal(k.dolu("sandalye", "Flash"), "Orion");
});

test("bedenin kendi koltuğu kendisine dolu görünmez", () => {
  const k = new Koltuklar();
  k.kaydet("Orion", () => "sandalye");
  assert.equal(k.dolu("sandalye", "Orion"), null);
});

test("başka koltuktaki beden bu koltuğu doldurmaz", () => {
  const k = new Koltuklar();
  k.kaydet("Orion", () => "bank");
  assert.equal(k.dolu("sandalye", "Flash"), null);
});

test("koltuk bedenden ANINDA okunur: kalkınca boşalır", () => {
  const k = new Koltuklar();
  let koltuk: string | null = "sandalye";
  k.kaydet("Orion", () => koltuk);
  koltuk = null;
  assert.equal(k.dolu("sandalye", "Flash"), null);
});

test("okuma hatası veren bedenin koltuğu boş sayılmaz (dolu der)", () => {
  const k = new Koltuklar();
  k.kaydet("Orion", () => { throw new Error("beden yok"); });
  assert.equal(k.dolu("sandalye", "Flash"), "Orion");
});

test("silinen beden koltuk tutmaz", () => {
  const k = new Koltuklar();
  k.kaydet("Orion", () => "sandalye");
  k.sil("Orion");
  assert.equal(k.dolu("sandalye", "Flash"), null);
});
