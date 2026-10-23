// tools/kimodo/olcumRaporu.ts — Spec 37 §6'daki [ÖLÇÜLDÜ] tablosunu üretir: her klip çevrilir, gerçek VRM gövdesinde başsız oynatılır, kaynakla karşılaştırılır.
//   node --experimental-strip-types --import ./tools/babylon-cozucu.mjs tools/kimodo/olcumRaporu.ts [klip…]
"use strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { kimodoCevir, tablolariOku } from "../kimodoCevir.ts";
import { bvhCevir } from "./cevir.ts";
import { govdedeKarsilastir } from "./govdeKarsilastir.ts";
import { BVH_KLASORU, KLIP_AYARLARI } from "./hepsi.ts";
import { pearson } from "./govdeKarsilastir.ts";

const t = tablolariOku();
const adlar = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(KLIP_AYARLARI);
for (const a of adlar) {
  const metin = readFileSync(join(BVH_KLASORU, `${a}.bvh`), "utf8");
  const ayar = KLIP_AYARLARI[a] ?? {};
  const { sekans, rapor } = kimodoCevir(metin, { ...ayar, ad: `kimodo_${a}` }, t);
  // Döngülüde kaynak, döngü parçasının kaynağıdır: karşılaştırma döngüsüz çeviriyle (aynı matematik, kapanış yayması yok) yapılır.
  const s2 = ayar.dongu ? kimodoCevir(metin, { ...ayar, dongu: false, ad: `kimodo_${a}` }, t).sekans : sekans;
  const ham = bvhCevir(metin, t.tpoz, t.orion, { yerinde: ayar.yerinde ?? true });
  const o = await govdedeKarsilastir(s2, ham, t.tpoz);
  const kalcaK = pearson(o.kalcaY.orion, o.kalcaY.kaynak);
  process.stdout.write(`\n## ${a}: ${rapor.iz} iz, ${rapor.anahtar} anahtar, gecikme ${o.gecikmeTik} tik, ${o.tik} tik; kalça y korelasyonu ${kalcaK.toFixed(3)} (genlik ${((Math.max(...o.kalcaY.kaynak) - Math.min(...o.kalcaY.kaynak)) * 100).toFixed(1)} cm); ayak tabanı farkı ${o.ayakTabaniCm} cm\n`);
  for (const u of o.uclar) process.stdout.write(`  ${u.ad.padEnd(9)} hata ${u.hataCm.toFixed(2)} cm (%${(u.hataOrani * 100).toFixed(1)})  korelasyon ${JSON.stringify(u.korelasyon)}  genlik cm ${JSON.stringify(u.genlikCm)}\n`);
  if (rapor.dongu) process.stdout.write(`  döngü ${rapor.dongu.bas}–${rapor.dongu.bit}, benzerlik ${rapor.dongu.benzerlik_cm} cm\n`);
}
