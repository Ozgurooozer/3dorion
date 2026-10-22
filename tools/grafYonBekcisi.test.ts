// tools/grafYonBekcisi.test.ts — GRAF MOTORUNUN İÇ KATMANLARI (uygulama/ içinde; spec 35 §35b modülerlik denetimi).
//
// Tek yön: yapi/ (arayüz) → graf/ (program motoru) → ajanlar/ (ajan kavramı). Tersi yasak:
//   • `ajanlar/` graf motorunu bilmez (ajan kaydı/Flash bağlantısı program motorundan bağımsız; gövde tipi ve okuma süresi `ajanlar/ajanGovdesi.ts`te);
//   • `graf/` (editör mantığı `graf/editor/` dahil) arayüzü (`yapi/`) ve DOM'u bilmez: motor ve editör MANTIĞI saf kalır, başsız testlenir.
// Bugünkü ihlal sayısı SIFIR; liste yok (yeni ihlal doğrudan kırmızı).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { KOK, depoYolu, ithaller, kaynaklar } from "./ithaller.ts";

/** `klasor` altındaki üretim dosyalarından, çözülen yolu `yasak` önekiyle başlayan her import'u (tip dahil) listeler. */
export function ihlaller(metinler: ReadonlyMap<string, string>, yasak: readonly string[]): string[] {
  const cikti: string[] = [];
  for (const [dosya, metin] of metinler) {
    for (const i of ithaller(metin)) {
      const hedef = path.posix.normalize(path.posix.join(path.posix.dirname(dosya), i.yol));
      if (yasak.some((y) => hedef.startsWith(y))) cikti.push(`${dosya} → ${hedef}`);
    }
  }
  return cikti;
}

const oku = (klasor: string): Map<string, string> => new Map(
  kaynaklar(path.join(KOK, klasor), { testler: false }).map((f) => [depoYolu(f), fs.readFileSync(f, "utf8")] as const));

test("bekçi kalibrasyonu: ajan dosyası graf'tan içe aktarırsa (tip de olsa) yakalanır; yorumdaki örnek sayılmaz", () => {
  const m = new Map([
    ["uygulama/ajanlar/a.ts", 'import type { X } from "../graf/grafYetenegi.ts";'],
    ["uygulama/ajanlar/b.ts", '// import { Y } from "../graf/dugumKaydi.ts";\nimport { Z } from "./ajanKaydi.ts";'],
  ]);
  assert.deepEqual(ihlaller(m, ["uygulama/graf/"]), ["uygulama/ajanlar/a.ts → uygulama/graf/grafYetenegi.ts"]);
});

test("ajanlar/ graf motorunu içe aktarmaz (tek yön: graf → ajanlar)", () => {
  assert.deepEqual(ihlaller(oku("uygulama/ajanlar"), ["uygulama/graf/"]), []);
});

test("graf/ (motor ve editör mantığı) arayüzü (yapi/) içe aktarmaz; DOM'a dokunmaz", () => {
  const graf = oku("uygulama/graf");
  assert.deepEqual(ihlaller(graf, ["uygulama/yapi/"]), []);
  const domKullanan = [...graf].filter(([, metin]) => /\b(document|window)\s*\.(?!kopru)/.test(metin.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""))).map(([d]) => d);
  assert.deepEqual(domKullanan, []);
});
