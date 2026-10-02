// tools/mimari.test.ts — KATMAN BEKÇİSİ: ön, arka, ortak, kabuk (spec 14 R1).
//
// Ozyn (2026-10-02): "kod mimarisini düzgünce front back gibi kategorilerine ayır,
// sağlamlaştır." Klasörler zaten katman (kararı: klasörler kalır, içleri bölünür):
//
//   ORTAK   protocol/        sözleşme — kimseyi import etmez
//   ÖN      world/ voice/    görünen — yalnız protocol/ (+ host/'tan YALNIZ tip: IPC)
//   ARKA    mind/ bridge/    beyin — protocol/; bridge/ ayrıca mind/
//   KABUK   host/            Electron ana süreç — kendisi (+ mind/'den YALNIZ tip)
//   UYGULAMA world/giris.ts, uygulama/  — ön ile arkayı bağlayan kök: herkesi
//
// Kural belgede unutulur, bekçide unutulmaz (CLAUDE.md "kural değil, bekçi"). world/ için
// eski bekçi (world/bagimlilik.test.ts) duruyor; bu, aynı ilkeyi bütün depoya yayar.
// Testler kapsam dışı: bir test iki katmanı birlikte sınayabilir.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const KOK = path.resolve(import.meta.dirname, "..");
const UZANTILAR = new Set([".ts", ".js", ".cjs", ".mjs"]);

/** Katman → izinli katmanlar (değer import) ve yalnız tip olarak izinliler. */
export const KURALLAR: Readonly<Record<string, { deger: readonly string[]; tip?: readonly string[] }>> = {
  protocol: { deger: [] },
  world: { deger: ["protocol"], tip: ["host"] },
  voice: { deger: ["protocol"] },
  mind: { deger: ["protocol"] },
  bridge: { deger: ["protocol", "mind"] },
  host: { deger: [], tip: ["mind"] },
};
/** Kompozisyon kökü: her katmanı görebilir. */
const KOKLER = [path.join("world", "giris.ts")];
const KOK_KLASORLERI = ["uygulama"];

const STATIK = /^\s*(import|export)\b([^;]*?)\bfrom\s*["']([^"']+)["']/gm;
const YAN_ETKI = /^\s*import\s*["']([^"']+)["']/gm;
const DINAMIK = /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g;

interface Ithal { yol: string; tipMi: boolean }

/** Kaynağın göreli importları; `import type` / `export type` tip sayılır. */
export function ithaller(metin: string): Ithal[] {
  const c: Ithal[] = [];
  for (const m of metin.matchAll(STATIK)) c.push({ yol: m[3]!, tipMi: /^\s*type\b/.test(m[2]!) });
  for (const m of metin.matchAll(YAN_ETKI)) c.push({ yol: m[1]!, tipMi: false });
  for (const m of metin.matchAll(DINAMIK)) {
    const satir = metin.slice(metin.lastIndexOf("\n", m.index) + 1, m.index).trimStart();
    if (!satir.startsWith("//") && !satir.startsWith("*")) c.push({ yol: m[1]!, tipMi: false });
  }
  return c.filter((i) => i.yol.startsWith("."));
}

function kaynaklar(klasor: string): string[] {
  if (!fs.existsSync(klasor)) return [];
  return fs.readdirSync(klasor, { withFileTypes: true }).flatMap((g) => {
    const tam = path.join(klasor, g.name);
    if (g.isDirectory()) return g.name === "node_modules" ? [] : kaynaklar(tam);
    return UZANTILAR.has(path.extname(g.name)) && !/\.test\./.test(g.name) && !g.name.endsWith(".d.ts") ? [tam] : [];
  });
}

/** Bir dosyanın katman ihlalleri: "dosya → hedef (tip?)". */
export function ihlaller(dosya: string, metin: string): string[] {
  const goreli = path.relative(KOK, dosya);
  const katman = goreli.split(path.sep)[0]!;
  const kural = KURALLAR[katman];
  if (!kural || KOKLER.includes(goreli)) return [];
  const cikti: string[] = [];
  for (const i of ithaller(metin)) {
    const hedef = path.relative(KOK, path.resolve(path.dirname(dosya), i.yol)).split(path.sep)[0]!;
    if (hedef === katman || hedef.startsWith("..") || !(hedef in KURALLAR || KOK_KLASORLERI.includes(hedef))) continue;
    if (kural.deger.includes(hedef)) continue;
    if (i.tipMi && kural.tip?.includes(hedef)) continue;
    cikti.push(`${goreli.split(path.sep).join("/")} → ${i.yol}${i.tipMi ? " (tip)" : ""}`);
  }
  return cikti;
}

test("KATMAN BEKÇİSİ: her katman yalnız izinli katmanları import eder (spec 14)", () => {
  const hepsi = Object.keys(KURALLAR).flatMap((k) => kaynaklar(path.join(KOK, k)))
    .flatMap((d) => ihlaller(d, fs.readFileSync(d, "utf8")));
  assert.deepEqual(hepsi, []);
});

test("bekçi kalibrasyonu: arka katman öne bağlanırsa yakalanır", () => {
  assert.deepEqual(ihlaller(path.join(KOK, "mind", "x.ts"), 'import { a } from "../world/surfaces/y.ts";'),
    ["mind/x.ts → ../world/surfaces/y.ts"]);
});

test("bekçi kalibrasyonu: ön katman beyni değer olarak alırsa yakalanır, host'tan tip serbest", () => {
  const d = path.join(KOK, "world", "surfaces", "x.ts");
  assert.deepEqual([
    ihlaller(d, 'import { Kopru } from "../../bridge/kopru.ts";'),
    ihlaller(d, 'import type { PtyCikti } from "../../host/kopru.ts";'),
    ihlaller(d, 'import { yaz } from "../../host/kopru.ts";'),
  ], [["world/surfaces/x.ts → ../../bridge/kopru.ts"], [], ["world/surfaces/x.ts → ../../host/kopru.ts"]]);
});

test("bekçi kalibrasyonu: sözleşme (protocol) hiçbir katmanı alamaz; kompozisyon kökü herkesi alır", () => {
  assert.equal(ihlaller(path.join(KOK, "protocol", "x.ts"), 'import { a } from "../mind/y.ts";').length, 1);
  assert.deepEqual(ihlaller(path.join(KOK, "world", "giris.ts"), 'import { Kopru } from "../bridge/kopru.ts";'), []);
});

test("bekçi kalibrasyonu: dinamik import da sayılır, yorumdaki örnek sayılmaz", () => {
  const d = path.join(KOK, "voice", "x.ts");
  assert.deepEqual([
    ihlaller(d, 'const m = await import("../mind/y.ts");').length,
    ihlaller(d, '// örnek: import("../mind/y.ts")').length,
  ], [1, 0]);
});
