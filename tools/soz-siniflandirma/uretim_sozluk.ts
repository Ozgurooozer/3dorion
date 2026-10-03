// tools/soz-siniflandirma/uretim_sozluk.ts — ÜRETİM komut sözlüğünü (mind/komutSozlugu.ts `komutCoz`) toplu çalıştırır.
// Neden: Tur 5 sınıflandırma ölçümü, benim oyuncak B0'ım yerine gerçek bileşeni ölçer; ikisi aynı veride karşılaştırılır.
// Kullanım: node --experimental-strip-types tools/soz-siniflandirma/uretim_sozluk.ts girdi.json  (girdi: ["söz", …])
// Çıktı: stdout'a JSON [{soz, program, adimlar}] — program eşleşmediyse null. Mantık YOK: yalnız `komutCoz`u çağırır.
"use strict";
import fs from "node:fs";
import { komutCoz } from "../../mind/komutSozlugu.ts";

const sozler: string[] = JSON.parse(fs.readFileSync(process.argv[2] ?? "", "utf8"));
const cikti = sozler.map((soz) => {
  const e = komutCoz(soz);
  return { soz, program: e?.program ?? null, adimlar: e ? e.adimlar.map((n) => n.tur) : null };
});
process.stdout.write(JSON.stringify(cikti));
