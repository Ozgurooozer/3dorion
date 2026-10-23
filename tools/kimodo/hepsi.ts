// tools/kimodo/hepsi.ts — TOPLU ÇEVİRİ (spec 37 §2): Kimodo çıktılarını `assets/sekans/kimodo_<ad>.json` olarak üretir ve `assets/sekans/liste.json`u günceller
// (örnek yükleyicisi yalnız listedekileri okur: uygulama/sekans/ornekler.ts). Kaynak BVH'ler repoda `assets/kaynak/kimodo/` (testler de onları okur);
// `--kaynak <klasör>` verilirse önce oradan buraya kopyalanır (Kimodo'nun `cikti/` klasörü).
//   npm run kimodo:hepsi                         (repodaki BVH'lerden)
//   npm run kimodo:hepsi -- --kaynak C:\Users\ozigo\kimodo-deneme\cikti
"use strict";
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { kimodoCevir, sekansMetni, type CeviriAyari } from "../kimodoCevir.ts";

/** Klip başına ayar: döngü (yürüme/koşma), yatay kök (oturma: kalça geriye kayar — yerinde kalırsa ayaklar öne kayardı), açıklama (Kimodo istemi). */
export const KLIP_AYARLARI: Record<string, Omit<CeviriAyari, "ad">> = {
  el_salla: { aciklama: "Kimodo: el sallama (sağ el)" },
  yuru: { dongu: true, aciklama: "Kimodo: 'a person walks forward at a normal pace' — adım döngüsü, yerinde" },
  kos: { dongu: true, aciklama: "Kimodo: 'a person runs forward' — adım döngüsü, yerinde" },
  zipla: { aciklama: "Kimodo: 'a person jumps up in place'" },
  onayla: { aciklama: "Kimodo: 'a person nods yes'" },
  bekle: { aciklama: "Kimodo: 'a person stands still and breathes'" },
  otur: { yerinde: false, aciklama: "Kimodo: 'a person sits down on a chair' — kalça geriye kayar (yatay kök açık); sandalye yok" },
  dusun: { aciklama: "Kimodo: 'a person puts a hand on the chin and thinks'" },
};

export const KOK = fileURLToPath(new URL("../../", import.meta.url));
export const BVH_KLASORU = join(KOK, "assets", "kaynak", "kimodo");
const SEKANS_KLASORU = join(KOK, "assets", "sekans");

function calistir(argv: string[]): void {
  const i = argv.indexOf("--kaynak");
  if (i >= 0) {
    const kaynak = argv[i + 1];
    if (!kaynak || !existsSync(kaynak)) throw new Error(`--kaynak klasörü yok: ${String(kaynak)}`);
    for (const f of readdirSync(kaynak).filter((x) => x.endsWith(".bvh"))) copyFileSync(join(kaynak, f), join(BVH_KLASORU, f));
  }
  const adlar = readdirSync(BVH_KLASORU).filter((f) => f.endsWith(".bvh")).map((f) => f.replace(/\.bvh$/, "")).sort();
  const listeYolu = join(SEKANS_KLASORU, "liste.json");
  const liste = JSON.parse(readFileSync(listeYolu, "utf8")) as string[];
  for (const a of adlar) {
    const ad = `kimodo_${a}`;
    const { sekans, rapor } = kimodoCevir(readFileSync(join(BVH_KLASORU, `${a}.bvh`), "utf8"), { ...(KLIP_AYARLARI[a] ?? {}), ad });
    writeFileSync(join(SEKANS_KLASORU, `${ad}.json`), sekansMetni(sekans));
    if (!liste.includes(ad)) liste.push(ad);
    process.stdout.write(`${ad}: ${rapor.kare} kare, ${rapor.iz} iz, ${rapor.anahtar} anahtar${rapor.dongu ? `, döngü ${rapor.dongu.bas}–${rapor.dongu.bit} (${rapor.dongu.benzerlik_cm} cm)` : ""}\n`);
    for (const u of rapor.uyarilar) process.stdout.write(`  uyarı: ${u}\n`);
  }
  writeFileSync(listeYolu, `${JSON.stringify(liste)}\n`);
  process.stdout.write(`liste.json: ${liste.length} örnek\n`);
}

if (process.argv[1] && /hepsi\.ts$/.test(process.argv[1])) {
  try { calistir(process.argv.slice(2)); }
  catch (err) { process.stderr.write(`kimodo:hepsi: ${err instanceof Error ? err.message : String(err)}\n`); process.exit(1); }
}
