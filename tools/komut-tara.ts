// tools/komut-tara.ts — Komut sözlüğü karar kaydındaki gerçek sözlere ne derdi? (spec 13 Faz 2b)
//
// Ozyn'in kararı (2026-10-02): komut programları "ölçüm geçince açık" — gerçek sözlerde
// yanlış eşleşme 0. Bu araç kayıttaki her `duydum` sözünü `komutCoz`dan geçirir ve
// İKİ listeyi de basar: eşleşenler (her biri elle okunur: gerçekten bir beden komutu mu?)
// ve eşleşmeyenler (LLM'e gidecekler). Sayı yalnız özet; karar listeye bakılarak verilir.
//
// Kullanım: node --experimental-strip-types tools/komut-tara.ts [klasör]
//   klasör varsayılanı %APPDATA%/3dorion/karar-kaydi
"use strict";
import { komutCoz } from "../mind/komutSozlugu.ts";
import { kararSozleri, varsayilanKlasor } from "./kararSozleri.ts";

const klasor = process.argv[2] ?? varsayilanKlasor();
const sozler = kararSozleri(klasor);

const eslesen: string[] = [], kalan: string[] = [];
for (const [soz, kez] of sozler) {
  const e = komutCoz(soz);
  if (e) eslesen.push(`  ${e.program.padEnd(17)} ${JSON.stringify(soz)} ×${kez} → ${JSON.stringify(e.adimlar)}`);
  else kalan.push(`  ${JSON.stringify(soz)} ×${kez}`);
}
console.log(`klasör: ${klasor}\nfarklı söz: ${sozler.size}, toplam: ${[...sozler.values()].reduce((a, b) => a + b, 0)}\n`);
console.log(`EŞLEŞEN (${eslesen.length}) — her biri gerçekten bir beden komutu mu? Değilse yanlış eşleşmedir:`);
console.log(eslesen.join("\n") || "  (yok)");
console.log(`\nLLM'E GİDEN (${kalan.length}):`);
console.log(kalan.join("\n"));
