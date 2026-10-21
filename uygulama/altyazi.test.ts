// uygulama/altyazi.test.ts — ajan cevaplarının altyazıda yığılması (spec 33): iki ajan aynı anda konuşunca biri ötekini ezmez.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { EN_FAZLA_SATIR, YIGMA_PENCERESI_MS, satirEkle, satirlariBicimle, type AjanSatiri } from "./altyazi.ts";

const s = (ad: string, metin: string, an: number, adHep = false): AjanSatiri => ({ ad, metin, adHep, an });

test("tek Orion satırı ADSIZ görünür (eski görünüm bozulmaz)", () => {
  assert.equal(satirlariBicimle([s("Orion", "Peşindeyim.", 0)]), "Peşindeyim.");
});

test("tek Flash satırı adıyla görünür (Flash hep 'Flash: …' dedi)", () => {
  assert.equal(satirlariBicimle([s("Flash", "Bunu bilmiyorum.", 0, true)]), "Flash: Bunu bilmiyorum.");
});

test("yakın iki ajan satırı alt alta yığılır ve ikisi de ADIYLA yazılır", () => {
  const y = satirEkle([s("Orion", "Tamam.", 0)], s("Flash", "Yapamadım.", 400, true));
  assert.equal(satirlariBicimle(y), "Orion: Tamam.\nFlash: Yapamadım.");
});

test("pencere dışındaki eski satır yığında KALMAZ (yeni cevap onu ezer)", () => {
  const y = satirEkle([s("Orion", "Eski.", 0)], s("Flash", "Yeni.", YIGMA_PENCERESI_MS + 1, true));
  assert.deepEqual(y.map((x) => x.ad), ["Flash"]);
});

test("aynı ajanın yeni cevabı kendi eski satırını DEĞİŞTİRİR (iki kez yığılmaz)", () => {
  const y = satirEkle([s("Orion", "Birinci.", 0), s("Flash", "x", 100, true)], s("Orion", "İkinci.", 500));
  assert.deepEqual(y.map((x) => `${x.ad}:${x.metin}`), ["Flash:x", "Orion:İkinci."]);
});

test("en çok EN_FAZLA_SATIR satır tutulur, en eskisi düşer", () => {
  let y: AjanSatiri[] = [];
  for (let i = 0; i < EN_FAZLA_SATIR + 2; i++) y = satirEkle(y, s(`a${i}`, `m${i}`, i * 10));
  assert.deepEqual(y.map((x) => x.ad), ["a2", "a3", "a4"]);
});
