// world/arayuz/arayuzJetonlari.test.ts — Yapı panelleri (dok) renk ve yazı jetonlarını TEK yerden okur; kopya geri gelirse bu test kırılır.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { YAPI_RENK, YAPI_YAZI } from "./arayuzJetonlari.ts";

const KOK = path.resolve(import.meta.dirname, "..", "..");
const oku = (d: string) => fs.readFileSync(path.join(KOK, d), "utf8");
const dokStili = oku("uygulama/yapi/ortak/dok/dokStili.ts");

test("dok CSS'i jetonları içe aktarır (Yapı panelleri kendi palet kopyasını taşımaz)", () => {
  assert.ok(dokStili.includes("arayuzJetonlari.ts"), "dokStili.ts arayuzJetonlari'ni içe aktarmalı");
  assert.ok(dokStili.includes("YAPI_RENK"), "dokStili.ts renkleri YAPI_RENK'ten almalı");
  assert.ok(dokStili.includes("YAPI_YAZI"), "dokStili.ts yazıları YAPI_YAZI'den almalı");
});
