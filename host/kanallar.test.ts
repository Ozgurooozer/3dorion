// host/kanallar.test.ts — IPC kanal bekçisi: `kanallar.cjs`'teki her kanal hem preload'da (renderer'a açılır) hem main.js'te (işlenir/gönderilir) geçer.
// Neden: kanallar.cjs'in doğuş hatası buydu — `sesVarMi` main'e yazılmadı, `ipcMain.handle(undefined, …)` sessizce hiçbir şey kaydetmedi (dosya başı).
// Metin araması kaba ama yeterli: amaç "unutulan taraf"ı yakalamak; imza/tip uyumu host/kopru.ts ile typecheck'te.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { CAGRI, OLAY } = require("./kanallar.cjs") as { CAGRI: Record<string, string>; OLAY: Record<string, string> };
const kaynak = (ad: string) => fs.readFileSync(path.join(import.meta.dirname, ad), "utf8");

test("her CAGRI kanalı preload'da renderer'a açılıyor", () => {
  const preload = kaynak("preload.cjs");
  assert.deepEqual(Object.keys(CAGRI).filter((k) => !preload.includes(`CAGRI.${k}`)), []);
});

test("her CAGRI kanalı main.js'te işleniyor", () => {
  const main = kaynak("main.js");
  assert.deepEqual(Object.keys(CAGRI).filter((k) => !main.includes(`CAGRI.${k}`)), []);
});

test("her OLAY kanalı preload'da dinlenebiliyor ve main.js'ten gönderiliyor", () => {
  const preload = kaynak("preload.cjs"), main = kaynak("main.js");
  assert.deepEqual(Object.keys(OLAY).filter((k) => !preload.includes(`OLAY.${k}`) || !main.includes(`OLAY.${k}`)), []);
});
