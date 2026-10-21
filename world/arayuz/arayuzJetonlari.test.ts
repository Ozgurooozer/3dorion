// world/arayuz/arayuzJetonlari.test.ts — Jetonlar Yapı çubuğu ve Hafıza sekmesindeki düz değerlerle AYNI kalsın (ayrışınca kırılır).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { YAPI_RENK, YAPI_YAZI } from "./arayuzJetonlari.ts";

const KOK = path.resolve(import.meta.dirname, "..", "..");
const kaynaklar = ["world/arayuz/altCubuk.ts", "uygulama/yapi/hafizaSekmesi.ts"].map((d) => fs.readFileSync(path.join(KOK, d), "utf8")).join("\n");

test("her renk jetonu Yapı çubuğu ya da Hafıza sekmesi CSS'inde aynen geçiyor", () => {
  assert.deepEqual(Object.entries(YAPI_RENK).filter(([, v]) => !kaynaklar.includes(v)).map(([k]) => k), []);
});

test("yazı jetonları Yapı çubuğu CSS'inde aynen geçiyor", () => {
  assert.deepEqual(Object.entries(YAPI_YAZI).filter(([, v]) => !kaynaklar.includes(v)).map(([k]) => k), []);
});
