// tools/eylem-olc.ts — sözlü komutları bir beyne N kez verip "YAPTI mı" sayar.
//
// Spec 12 Faz 0. Sahne yok, Electron yok. Girdi CANLI köprünün kurduğu gibi
// kurulur (`talimatUret`, `ornekUret`, `araclariUret`): talimatı ya da örneği
// değiştiren bir düzeltme, bu ölçüye kendiliğinden yansır. Elle kopyalanmış
// talimat metni yok — kopyası canlıdan ayrışırdı.
//
// Koşullar:
//   temiz  — geçmiş boş
//   canli  — 2026-10-02 testindeki GERÇEK geçmiş, eski köprünün yazdığı haliyle
//            (soyle ve düz metin dolu, hiç beden eylemi yok)
//   faz1   — aynı turlar, Faz 1 köprüsünün yazacağı haliyle (spec 13): düz metin
//            yok, beden niyetleri araç olarak var
//
// Kullanım:
//   node --experimental-strip-types tools/eylem-olc.ts --model=qwen2.5:7b [--n=5] [--kosul=temiz,canli]
//        [--cikar=dunya_al,dunya_birak]   (spec 16 F6: araç alt kümesi kolu — bu araçlar modele gitmez)
//
// Ham çıktı HER ZAMAN basılır: özet sayı aletin yanlış saydığını gizler.
"use strict";
import fs from "node:fs";
import { OllamaBeyni } from "../bridge/ollama.ts";
import { yetenekleriCoz, OLLAMA_VARSAYILAN_ADRES } from "../bridge/ollamaKatalog.ts";
import { talimatUret } from "../bridge/talimat.ts";
import { ornekUret } from "../bridge/ornekler.ts";
import { araclariUret } from "../bridge/araclar.ts";
import type { BeyinGirdisi } from "../bridge/beyin.ts";
import { CAPALAR, CAPA_ETIKETLERI } from "../protocol/temel.ts";
import { eylemPuanla, type EylemBeklentisi } from "./eylem.ts";

interface Komut { soz: string; durum: string; bekle: EylemBeklentisi }
interface Fixture {
  durumlar: Record<string, string>;
  canliGecmis: BeyinGirdisi["gecmis"];
  canliFaz1Gecmis: BeyinGirdisi["gecmis"];
  komutlar: Komut[];
}

const arg = (ad: string, v?: string) =>
  process.argv.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3) ?? v;

const model = arg("model", "qwen2.5:7b")!;
const n = Number(arg("n", "5"));
const kosullar = arg("kosul", "temiz,faz1,canli")!.split(",");
const cikar = new Set((arg("cikar", "") ?? "").split(",").filter(Boolean));
const araclar = araclariUret().filter((a) => !cikar.has(a.ad));
if (cikar.size) console.log(`araç kolu: ${araclar.length} araç (çıkarılan: ${[...cikar].join(", ")}) · ${JSON.stringify(araclar).length} kr`);
const f = JSON.parse(fs.readFileSync(arg("fixture", "fixtures/eylem/komutlar.json")!, "utf8")) as Fixture;

// Yetenekler canlıdaki gibi katalogdan: düşünen modele `think:false` gitsin.
// Yetenek bilinmeden kurulursa model uzun iç monolog üretir ve ölçü canlıdan ayrışır.
const goster = await fetch(`${OLLAMA_VARSAYILAN_ADRES}/api/show`, { method: "POST", body: JSON.stringify({ model }) });
const yetenekler = goster.ok ? yetenekleriCoz(await goster.json()) : null;
const beyin = new OllamaBeyni({ model, yetenekler, zamanAsimiMs: 120_000 });
if (!(await beyin.hazirMi())) { console.error(`model yok: ${model}`); process.exit(1); }

// Canlıdaki `sabitBilgi` ile aynı biçim (world/giris.ts).
const sabit = `In the room: ${CAPALAR.map((c) => CAPA_ETIKETLERI[c]).join(", ")}.`;
console.log(`model: ${model} · yetenekler: ${yetenekler?.join(",") ?? "?"} · n=${n}\n`);

const ozet: string[] = [];
for (const kosul of kosullar) {
  let toplamDogru = 0, toplamSoz = 0, toplam = 0, sure = 0;
  const satirlar: string[] = [];
  for (const k of f.komutlar) {
    let dogru = 0, soz = 0;
    for (let i = 1; i <= n; i++) {
      const girdi: BeyinGirdisi = {
        talimat: talimatUret({ konusma: true, terminal: false, anilar: false, olay: false }),
        ornekler: ornekUret({ terminal: false, konusma: true }),
        anilar: [],
        ozetler: [`Ozyn said: "${k.soz}"`],
        dunya: f.durumlar[k.durum] ?? "",
        sabit,
        gecmis: kosul === "canli" ? f.canliGecmis : kosul === "faz1" ? f.canliFaz1Gecmis : [],
        araclar,
      };
      const t0 = Date.now();
      try {
        const c = await beyin.dusun(girdi);
        sure += Date.now() - t0;
        const p = eylemPuanla(c.cagrilar, k.bekle);
        if (p.dogru) dogru++;
        if (p.yalnizSoz) soz++;
        const ne = c.cagrilar.map((x) => `${x.ad.replace("dunya_", "")}${JSON.stringify(x.girdi)}`).join(" + ") || `METIN "${c.metin}"`;
        console.log(`  [${kosul}] ${k.soz} #${i} ${p.dogru ? "DOGRU" : p.yalnizSoz ? "SOZ  " : "-    "} | ${ne.replace(/\s+/g, " ").slice(0, 150)}`);
      } catch (e) {
        console.log(`  [${kosul}] ${k.soz} #${i} HATA | ${(e instanceof Error ? e.message : String(e)).slice(0, 120)}`);
      }
      toplam++;
    }
    toplamDogru += dogru; toplamSoz += soz;
    satirlar.push(`| ${k.soz} | ${dogru}/${n} | ${soz}/${n} |`);
  }
  const gecen = satirlar.filter((s) => Number(s.split("|")[2]!.trim().split("/")[0]) >= Math.ceil(0.8 * n)).length;
  ozet.push(
    `\n### ${model} · ${kosul}\n\n| söz | doğru | yalnız söz |\n|---|---|---|\n${satirlar.join("\n")}\n` +
    `\ntoplam doğru ${toplamDogru}/${toplam} · yalnız söz ${toplamSoz}/${toplam} · ≥%80 doğru olan komut ${gecen}/${f.komutlar.length}` +
    ` · ort ${toplam ? Math.round(sure / toplam) : 0} ms`,
  );
}
console.log(ozet.join("\n"));
