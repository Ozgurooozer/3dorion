// tools/grafYonBekcisi.test.ts — GRAF MOTORUNUN İÇ KATMANLARI (uygulama/ içinde; spec 35 §35b modülerlik denetimi).
//
// Tek yön: yapi/ (arayüz) → graf/ (program motoru) → ajanlar/ (ajan kavramı). Tersi yasak:
//   • `ajanlar/` graf motorunu bilmez (ajan kaydı/Flash bağlantısı program motorundan bağımsız; gövde tipi ve okuma süresi `ajanlar/ajanGovdesi.ts`te);
//   • `graf/` (editör mantığı `graf/editor/` dahil) arayüzü (`yapi/`) ve DOM'u bilmez: motor ve editör MANTIĞI saf kalır, başsız testlenir.
// Bugünkü ihlal sayısı SIFIR; liste yok (yeni ihlal doğrudan kırmızı).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { klasorMetinleri, yasakIthaller } from "./ithaller.ts";

/** `klasor` altındaki üretim dosyalarından, çözülen yolu `yasak` önekiyle başlayan her import'u (tip dahil) listeler (ortak: tools/ithaller.ts, spec 36). */
const ihlaller = yasakIthaller;
const oku = klasorMetinleri;

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
