// world/bagimlilik.test.ts — K4 BEKÇİSİ: dünya beyni tanımaz.
//
// Spec 01 kabul ölçütü K4: "`world/` içinde `bridge`/`mind` import'u: 0". Bugüne
// kadar yalnızca bir kuraldı ("grep denetimi"). Kural unutulur, bekçi unutulmaz
// (CLAUDE.md, "Kopya kod — kural değil, bekçi").
//
// TEK İSTİSNA kompozisyon kökü `world/giris.ts`: beyni bedene o bağlar (köprüyü,
// refleksi, sesi kurar). Kök, Vite'ın giriş noktası olduğu için world/ içinde
// duruyor. Başka hiçbir world/ dosyası bridge/ ya da mind/'dan bir şey alamaz —
// yalnız tip bile: tip bağımlılığı da bedeni beynin şekline bağlar.
//
// Kapsam dışı: `host/` (Electron IPC tipleri, terminal-cekirdek.ts alıyor) ve
// `voice/` (ses, beyin değil). K4 yalnızca beyni sayar.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const KOK = path.resolve(import.meta.dirname, "..");
const KOMPOZISYON_KOKU = path.join(KOK, "world", "giris.ts");
// Bu dosya tarayıcının örneklerini METİN olarak taşır. Bugünkü örnekler bu
// dosyanın yerine göre depo dışına çözülür (bozma denemesinde dışlama eşdeğer
// çıktı); dışlama, ileride yazılacak tek seviyeli (`../mind/…`) örnekleri korur.
const BU_DOSYA = path.join(KOK, "world", "bagimlilik.test.ts");
const BEYIN = ["bridge", "mind"];
const UZANTILAR = new Set([".ts", ".js", ".cjs", ".mjs"]);

// Satır başındaki `import … from` / `export … from` (çok satırlı da), yan etki
// importu ve her yerde `import()` / `require()`. Yorum satırındaki örnek kod
// sayılmaz: statik desen satır başına bağlı, dinamikte satırın yorum olup
// olmadığına bakılır.
const STATIK = /^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gm;
const YAN_ETKI = /^\s*import\s*["']([^"']+)["']/gm;
const DINAMIK = /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g;

/** Bir kaynağın beyinden (bridge/, mind/) aldığı yollar. Göreli yollar dosyanın klasörüne göre ÇÖZÜLÜR. */
function beyinImportlari(dosya: string, metin: string): string[] {
  const yollar: string[] = [];
  for (const m of metin.matchAll(STATIK)) yollar.push(m[1]!);
  for (const m of metin.matchAll(YAN_ETKI)) yollar.push(m[1]!);
  for (const m of metin.matchAll(DINAMIK)) {
    const satirBasi = metin.lastIndexOf("\n", m.index) + 1;
    const satir = metin.slice(satirBasi, m.index).trimStart();
    if (satir.startsWith("//") || satir.startsWith("*")) continue;
    yollar.push(m[1]!);
  }
  return yollar.filter((y) => {
    if (!y.startsWith(".")) return false;
    const [ilk] = path.relative(KOK, path.resolve(path.dirname(dosya), y)).split(path.sep);
    return BEYIN.includes(ilk!);
  });
}

function kaynaklar(klasor: string): string[] {
  return fs.readdirSync(klasor, { withFileTypes: true }).flatMap((g) => {
    const tam = path.join(klasor, g.name);
    if (g.isDirectory()) return kaynaklar(tam);
    return UZANTILAR.has(path.extname(g.name)) ? [tam] : [];
  });
}

// ── Tarayıcının kendisi (sentetik kaynaklar) ─────────────────────────────────

const AVATAR = path.join(KOK, "world", "avatar", "ornek.ts");

test("tarayıcı: iki klasör yukarıdan mind/ importu yakalanır", () => {
  assert.deepEqual(beyinImportlari(AVATAR, `import { x } from "../../mind/refleks.ts";`), ["../../mind/refleks.ts"]);
});

test("tarayıcı: yalnız tip importu da yakalanır", () => {
  assert.deepEqual(beyinImportlari(AVATAR, `import type { Kopru } from "../../bridge/kopru.ts";`), ["../../bridge/kopru.ts"]);
});

test("tarayıcı: çok satırlı import ve export … from yakalanır", () => {
  const metin = `import {\n  a,\n  b,\n} from "../../mind/a.ts";\nexport { c } from "../../bridge/c.ts";`;
  assert.deepEqual(beyinImportlari(AVATAR, metin), ["../../mind/a.ts", "../../bridge/c.ts"]);
});

test("tarayıcı: dinamik import ve require yakalanır", () => {
  const metin = `const m = await import("../../mind/x.ts");\nconst b = require("../../bridge/y.js");`;
  assert.deepEqual(beyinImportlari(AVATAR, metin), ["../../mind/x.ts", "../../bridge/y.js"]);
});

test("tarayıcı: dolambaçlı yol çözülerek yakalanır", () => {
  assert.deepEqual(beyinImportlari(AVATAR, `import "../level/../../mind/x.ts";`), ["../level/../../mind/x.ts"]);
});

test("tarayıcı: yorumdaki örnek kod sayılmaz", () => {
  const metin = `// import { x } from "../../mind/x.ts";\n/*\n * require("../../bridge/y.js")\n */`;
  assert.deepEqual(beyinImportlari(AVATAR, metin), []);
});

test("tarayıcı: protokol, host tipi ve world içindeki klasörler serbest", () => {
  const metin = [
    `import type { Algi } from "../../protocol/algi.ts";`,
    `import type { PtyCikti } from "../../host/kopru.ts";`,
    `import { y } from "./mind/yerel.ts";`,
  ].join("\n");
  assert.deepEqual(beyinImportlari(AVATAR, metin), []);
});

// ── Gerçek tarama ────────────────────────────────────────────────────────────

test("K4: kompozisyon kökü dışında hiçbir world/ dosyası bridge/ ya da mind/'dan almaz", () => {
  const ihlal = kaynaklar(path.join(KOK, "world"))
    .filter((d) => d !== KOMPOZISYON_KOKU && d !== BU_DOSYA)
    .flatMap((d) => beyinImportlari(d, fs.readFileSync(d, "utf8")).map((y) => `${path.relative(KOK, d)} → ${y}`));
  assert.deepEqual(ihlal, []);
});

test("K4 taraması boş geçmez: world/ altında onlarca kaynak dosya okunur", () => {
  const sayi = kaynaklar(path.join(KOK, "world")).length;
  assert.ok(sayi >= 40, `yalnız ${sayi} dosya bulundu`);
});
