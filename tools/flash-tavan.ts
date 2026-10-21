// tools/flash-tavan.ts — FLASH'IN TAVANI (spec 33 §0, ön kayıtlı): karar kaydındaki gerçek sözlerin kaçını Flash LLM'siz karşılar?
//
// Her söz Flash'ın GERÇEK köprüsünden geçer (flash/flashKur.ts; düzenek flash/flashTest.ts — testlerle aynı sahte beden, kopya değil);
// her söz için yeni köprü. Kapı kuralı Flash'ın kendi karar kaydından okunur. Sayılar ve listeler basılır; karar listeye bakılarak verilir
// (eşleşen her söz elle okunur: gerçekten bir beden komutu mu?).
//
// Kullanım: node --experimental-strip-types --import ./tools/babylon-cozucu.mjs tools/flash-tavan.ts [klasör]
"use strict";
import { flashDuzenegi, sozunKurali } from "../flash/flashTest.ts";
import { kararSozleri, varsayilanKlasor } from "./kararSozleri.ts";

const LLMSIZ = new Set(["kopru.komut", "kopru.takip", "kopru.sohbet"]);
const klasor = process.argv[2] ?? varsayilanKlasor();
const sozler = kararSozleri(klasor, { yalnizKesinAlgi: true });

interface Sonuc { soz: string; kez: number; kural: string; program: string; yapamaz: string[] }
const sonuclar: Sonuc[] = [];
// Köprü kendi günlüğünü (KOMUT/TAKIP/SOHBET satırları) konsola basar: ölçüm çıktısı okunur kalsın diye sustur.
const eskiLog = console.log, eskiUyari = console.warn;
console.log = () => {}; console.warn = () => {};
try {
  for (const [soz, kez] of sozler) {
    const d = flashDuzenegi();
    try { d.soyle(soz); await d.bekle(3); } finally { d.kapat(); }
    const program = d.satirlar.find((s) => s.tur === "program");
    sonuclar.push({
      soz, kez, kural: sozunKurali(d.satirlar, soz) ?? "(satır yok)",
      program: program?.tur === "program" ? program.program : "",
      yapamaz: d.yonler.filter((y) => y.yon === "yapamaz").map((y) => y.tur),
    });
  }
} finally { console.log = eskiLog; console.warn = eskiUyari; }

const toplam = (l: readonly Sonuc[]) => l.reduce((t, s) => t + s.kez, 0);
const karsilanan = sonuclar.filter((s) => LLMSIZ.has(s.kural));
const yapabildigi = karsilanan.filter((s) => s.yapamaz.length === 0);
const yuzde = (a: number, b: number) => `${b ? ((100 * a) / b).toFixed(1) : "0.0"}%`;
const T = toplam(sonuclar);

console.log(`klasör: ${klasor}`);
console.log(`farklı söz: ${sonuclar.length}, toplam söyleyiş: ${T}\n`);
console.log(`(1) olay oranı (BİRİNCİL): ${toplam(karsilanan)}/${T} = ${yuzde(toplam(karsilanan), T)}`);
console.log(`(2) tekil oran:            ${karsilanan.length}/${sonuclar.length} = ${yuzde(karsilanan.length, sonuclar.length)}`);
console.log(`(3) yapabildiği (olay):     ${toplam(yapabildigi)}/${T} = ${yuzde(toplam(yapabildigi), T)}`);
const kurallar = new Map<string, number>();
for (const s of sonuclar) kurallar.set(s.kural, (kurallar.get(s.kural) ?? 0) + s.kez);
console.log(`kapı kuralları (olay): ${[...kurallar].map(([k, n]) => `${k}=${n}`).join(", ")}\n`);

console.log(`KARŞILANAN (${karsilanan.length}) — her biri gerçekten bir beden/takip/sohbet komutu mu? Değilse yanlış eşleşmedir:`);
for (const s of karsilanan) console.log(`  ${s.kural.padEnd(12)} ${(s.program || "-").padEnd(18)} ${JSON.stringify(s.soz)} ×${s.kez}${s.yapamaz.length ? `  ← YAPAMAZ: ${s.yapamaz.join(",")}` : ""}`);
console.log(`\nBİLMİYORUM'A DÜŞEN (${sonuclar.length - karsilanan.length}):`);
for (const s of sonuclar.filter((x) => !LLMSIZ.has(x.kural))) console.log(`  ${JSON.stringify(s.soz)} ×${s.kez}${s.kural === "kopru.konusma" ? "" : `  (${s.kural})`}`);
