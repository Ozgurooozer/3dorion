// tools/kapi-yakala.test.ts — Komut kümeleri: taze havuz gerçekten taze mi?
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KUMELER, komutSatiri, kumeKomutlari } from "./kapi-yakala.ts";

// Kayıtta geçici yol yerine görünen adlar durur (yakala()); kümeler bu adlarla karşılaştırılır.
const YOLLAR = { patlak: "patlak.test.mjs", patlak2: "metin.test.mjs", patlak3: "tarih.test.mjs", patlak4: "sirala.test.mjs" };

test("kümeler ayrık: hiçbir komut iki kümede (ya da bir kümede iki kez) yok", () => {
  const nerede = new Map<string, string[]>();
  for (const k of KUMELER) for (const [, komut] of kumeKomutlari(k, YOLLAR)) nerede.set(komut, [...(nerede.get(komut) ?? []), k]);
  const tekrar = [...nerede].filter(([, k]) => k.length > 1).map(([komut, k]) => `${komut} (${k.join(",")})`);
  assert.deepEqual(tekrar, []);
});

test("dördüncü küme 8 aile × 5 komut", () => {
  const aileler = new Map<string, number>();
  for (const [aile] of kumeKomutlari("4", YOLLAR)) aileler.set(aile, (aileler.get(aile) ?? 0) + 1);
  assert.deepEqual([...aileler.values()], [5, 5, 5, 5, 5, 5, 5, 5]);
});

test("bilinmeyen küme hata verir: sessizce birinci kümeye dönmez", () => {
  assert.throws(() => kumeKomutlari("5", YOLLAR), /bilinmeyen küme: 5/);
});

test("komut kendi satırında: kodlama satırı önce, çıkış kodu satırı sonra", () => {
  const satirlar = komutSatiri("git status").split("\n");
  assert.deepEqual({ adet: satirlar.length, komut: satirlar[1] }, { adet: 3, komut: "git status" });
});
