// tools/ithaller.ts — Bekçilerin TEK import ayrıştırıcısı ve klasör yürüyücüsü.
//
// Önceden iki kopyaydı (`tools/mimari.test.ts` ve `world/bagimlilik.test.ts`, ikisi de aynı
// STATIK/YAN_ETKI/DINAMIK düzenli ifadeleri). Biri düzelir öbürü eski kalırsa iki bekçi aynı
// kaynağı farklı okur (CLAUDE.md "Kopya kod: kural değil bekçi"). Artık katman bekçisi, K4 bekçisi
// ve alt-sistem bekçisi (`tools/altSistem.test.ts`) bunu kullanır; mimari raporu A3, 2026-10-14.
//
// Bir `*.test.ts` dosyası değil: test dosyasını import etmek onun testlerini ikinci kez koşturur.
// Yalnız bekçiler (testler) import eder; üretim kodu tools/'u import etmez (altSistem.test.ts sınar).
"use strict";
import fs from "node:fs";
import path from "node:path";

/** Depo kökü. */
export const KOK = path.resolve(import.meta.dirname, "..");

const UZANTILAR = new Set([".ts", ".js", ".cjs", ".mjs"]);

// Satır başındaki `import … from` / `export … from` (çok satırlı da), yan etki importu ve her
// yerde `import()` / `require()`. Yorum satırındaki örnek kod sayılmaz: statik desen satır başına
// bağlı, dinamikte satırın yorum olup olmadığına bakılır. Şablon dizgili dinamik import
// (giris'teki senaryo yükleyici) bilerek görülmez: hedefi çalışma anında belli olur.
const STATIK = /^\s*(import|export)\b([^;]*?)\bfrom\s*["']([^"']+)["']/gm;
const YAN_ETKI = /^\s*import\s*["']([^"']+)["']/gm;
const DINAMIK = /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g;

export interface Ithal { yol: string; tipMi: boolean }

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

/**
 * Klasörün kaynak dosyaları (`.ts .js .cjs .mjs`; `node_modules` ve el yazımı `.d.ts` hariç).
 * `testler: false` → `*.test.*` dosyaları da hariç (katman ve alt-sistem bekçisi: bir test iki
 * katmanı birlikte sınayabilir); `true` → dahil (K4: dünya testi de beyni tanımaz).
 */
export function kaynaklar(klasor: string, secenek: { testler: boolean; atla?: readonly string[] }): string[] {
  if (!fs.existsSync(klasor)) return [];
  return fs.readdirSync(klasor, { withFileTypes: true }).flatMap((g) => {
    const tam = path.join(klasor, g.name);
    if (secenek.atla?.includes(tam)) return [];
    if (g.isDirectory()) return g.name === "node_modules" ? [] : kaynaklar(tam, secenek);
    if (!UZANTILAR.has(path.extname(g.name)) || g.name.endsWith(".d.ts")) return [];
    return secenek.testler || !/\.test\./.test(g.name) ? [tam] : [];
  });
}

/**
 * İç yön bekçileri (`tools/grafYonBekcisi.test.ts`, `tools/sekansYonBekcisi.test.ts`) için: dosya → metin haritasında, çözülen yolu `yasak` öneklerinden
 * biriyle başlayan her import (tip dahil) "kaynak → hedef" olarak. Önce graf bekçisindeydi; sekans bekçisi ikinci kopyayı yazmasın diye buraya alındı.
 */
export function yasakIthaller(metinler: ReadonlyMap<string, string>, yasak: readonly string[]): string[] {
  const cikti: string[] = [];
  for (const [dosya, metin] of metinler) {
    for (const i of ithaller(metin)) {
      const hedef = path.posix.normalize(path.posix.join(path.posix.dirname(dosya), i.yol));
      if (yasak.some((y) => hedef.startsWith(y))) cikti.push(`${dosya} → ${hedef}`);
    }
  }
  return cikti;
}

/** Klasörün üretim dosyaları (test hariç) → metin, depo yoluyla. */
export const klasorMetinleri = (klasor: string): Map<string, string> => new Map(
  kaynaklar(path.join(KOK, klasor), { testler: false }).map((f) => [depoYolu(f), fs.readFileSync(f, "utf8")] as const));

/** Depo köküne göre POSIX yol ("world/avatar/index.ts"). */
export function depoYolu(dosya: string): string {
  return path.relative(KOK, dosya).split(path.sep).join("/");
}
