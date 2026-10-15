// uygulama/bedenKaydi.test.ts — Beden ayarı kalıcılığı: kaydet→yükle eşit, depo bozuk/yoksa beden yine çalışır.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { bedenAyariniYukle, bedenAyariniKaydet, BEDEN_ANAHTARI, type Depo } from "./bedenKaydi.ts";
import { ayariDuzelt } from "../world/player/bedenAyari.ts";

const sahteDepo = (): Depo & { veri: Map<string, string> } => {
  const veri = new Map<string, string>();
  return { veri, getItem: (k) => veri.get(k) ?? null, setItem: (k, v) => { veri.set(k, v); } };
};

test("kaydet → yükle: seçim ve renk aynen döner", () => {
  const d = sahteDepo();
  const a = ayariDuzelt({ secim: { ust: "gomlek_kisa", dis: "yok", alt: "pantolon_sort" }, renk: { ten: "#aa8866", alt: "#223344" } });
  assert.equal(bedenAyariniKaydet(a, d), true);
  assert.deepEqual(bedenAyariniYukle(d), a);
});

test("kayıt yokken varsayılan; bozuk kayıtta varsayılan (çöküş yok)", () => {
  const d = sahteDepo();
  assert.deepEqual(bedenAyariniYukle(d), ayariDuzelt(null));
  d.veri.set(BEDEN_ANAHTARI, "{bozuk json");
  assert.deepEqual(bedenAyariniYukle(d), ayariDuzelt(null));
});

test("depo fırlatırsa ya da hiç yoksa: yükleme varsayılan, kaydetme false (beden yine çalışır)", () => {
  const bozuk: Depo = { getItem: () => { throw new Error("yasak"); }, setItem: () => { throw new Error("dolu"); } };
  assert.deepEqual(bedenAyariniYukle(bozuk), ayariDuzelt(null));
  assert.equal(bedenAyariniKaydet(ayariDuzelt(null), bozuk), false);
  assert.equal(bedenAyariniKaydet(ayariDuzelt(null), null), false);
});
