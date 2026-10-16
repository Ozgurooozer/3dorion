// world/player/oturma.test.ts — oturma ve kalkma noktaları: bank (ova'ya bakar), sandalye (masaya bakar), yön yedeği.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { oturmaNoktasi, kalkmaNoktasi, KALCA_YUKSEKLIGI } from "./oturma.ts";
import { BANK_CAPASI } from "../level/bank.ts";
import { tumCapalar, type Capa } from "../level/capalar.ts";

const SANDALYE = tumCapalar().find((c) => c.ad === "sandalye")!;

test("bank: oturunca ayak konumu oturma yüzeyinden kalça yüksekliği kadar aşağıda", () => {
  assert.equal(oturmaNoktasi(BANK_CAPASI).y, BANK_CAPASI.konum.y - KALCA_YUKSEKLIGI);
});

test("bank: oturma noktasının x ve z'si çapanın oturma noktası", () => {
  const n = oturmaNoktasi(BANK_CAPASI);
  assert.deepEqual([n.x, n.z], [BANK_CAPASI.konum.x, BANK_CAPASI.konum.z]);
});

test("bank: oturan ova'ya bakar (+Z → yaw 0)", () => {
  assert.equal(oturmaNoktasi(BANK_CAPASI).yaw, 0);
});

test("sandalye: oturmaYonu yok, çapanın yönü kullanılır: masaya (−Z) bakar", () => {
  assert.equal(SANDALYE.oturmaYonu, undefined);
  assert.equal(oturmaNoktasi(SANDALYE).yaw, Math.PI);
});

test("yön yedeği: oturmaYonu varsa o, yoksa yon", () => {
  const taban: Capa = { ...BANK_CAPASI };
  const { oturmaYonu: _, ...yonsuz } = taban;
  assert.equal(oturmaNoktasi(yonsuz).yaw, Math.PI);   // yon = −Z
  assert.equal(oturmaNoktasi(taban).yaw, 0);          // oturmaYonu = +Z
});

test("kalkış: oyuncu çapanın durağına konur (bankın önü)", () => {
  assert.deepEqual(kalkmaNoktasi(BANK_CAPASI), { x: BANK_CAPASI.durak.x, z: BANK_CAPASI.durak.z });
});

test("oturan beden göz yüksekliği mantıklı: kalça yüzeyde, ayak yüzeyin altında", () => {
  const n = oturmaNoktasi(BANK_CAPASI);
  assert.ok(n.y < BANK_CAPASI.konum.y, "ayak oturma yüzeyinin altında olmalı (bacaklar gömülür)");
  assert.ok(Math.abs(n.y + KALCA_YUKSEKLIGI - BANK_CAPASI.konum.y) < 1e-12, "kalça tam oturma yüzeyinde");
});
