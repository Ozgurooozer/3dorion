// uygulama/kabuk.test.ts — Kabuk köprüsü erişimcisi ve KOPYA BEKÇİSİ: `globalThis as { kopru… }` dönüşümü yalnız kabuk.ts'te yazılır.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { kabukKoprusu } from "./kabuk.ts";

const BU = import.meta.dirname;
const globalKopru = globalThis as { kopru?: unknown };

test("kabuk dışında (köprü tanımsız) erişimci undefined döner", () => {
  const eski = globalKopru.kopru;
  delete globalKopru.kopru;
  try { assert.equal(kabukKoprusu(), undefined); } finally { if (eski !== undefined) globalKopru.kopru = eski; }
});

test("köprü globalThis'te varsa erişimci aynı nesneyi verir", () => {
  const eski = globalKopru.kopru;
  const sahte = { hafizaOku: () => [] };
  globalKopru.kopru = sahte;
  try { assert.equal(kabukKoprusu(), sahte); } finally { if (eski === undefined) delete globalKopru.kopru; else globalKopru.kopru = eski; }
});

test("kopya bekçisi: testsiz uygulama/ dosyalarında `globalThis as { kopru` yalnız kabuk.ts'te yazılır", () => {
  const dosyalar = fs.readdirSync(BU).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "kabuk.ts");
  const ihlal = dosyalar.filter((f) => /globalThis\s+as\s*\{\s*kopru/.test(fs.readFileSync(path.join(BU, f), "utf8")));
  assert.deepEqual(ihlal, []);
});
