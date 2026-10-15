// tools/stt-karar.ts — S1 (komut tutarlılığı): tanınan metin, söylenen metinle AYNI kararı veriyor mu? (docs/olcum/on-kayit-stt-turkce-1.md)
// `tools/stt-olc.py` çıktısını (JSON) okur; her cümlede Orion'un LLM'siz tanıma yolları (`komutCoz`, `takipEylemi`, `sohbetEylemi`) hem ham söze
// hem tanıma çıktısına uygulanır. Karar aynıysa tutarlıdır (ikisi de komut DEĞİLSE de tutarlı: sohbet yine LLM'e gider).
// Koşu: node --experimental-strip-types tools/stt-karar.ts <stt-olc.json>      (çıkış kodu 0 = S1 eşiği geçti: komut cümlelerinin ≥ %83'ü tutarlı)
"use strict";
import { readFileSync } from "node:fs";
import { komutCoz } from "../mind/komutSozlugu.ts";
import { takipEylemi } from "../mind/takipSozu.ts";
import { sohbetEylemi } from "../mind/sohbetKipi.ts";

interface Cumle { tur: "komut" | "sohbet"; ref: string; hyp: string }

const karar = (m: string): string => {
  const k = komutCoz(m);
  if (k) return `komut:${k.program}`;
  if (takipEylemi(m)) return "takip";
  if (sohbetEylemi(m)) return "sohbet-kipi";
  return "llm";
};

const dosya = process.argv[2];
if (!dosya) { console.error("kullanım: stt-karar.ts <stt-olc.json>"); process.exit(2); }
const veri = JSON.parse(readFileSync(dosya, "utf8")) as { model: string; cumleler: Cumle[] };
let tutarli = 0, toplam = 0;
const farklar: string[] = [];
for (const c of veri.cumleler.filter((x) => x.tur === "komut")) {
  toplam++;
  const a = karar(c.ref), b = karar(c.hyp);
  if (a === b) tutarli++; else farklar.push(`${JSON.stringify(c.ref)} (${a}) → ${JSON.stringify(c.hyp)} (${b})`);
}
// Yanlış-pozitif: sohbet cümlesi tanıma sonrası YANLIŞLIKLA komuta dönüştü mü (Orion istemeden bir şey yapar: en pahalı hata).
const yanlisKomut = veri.cumleler.filter((x) => x.tur === "sohbet" && karar(x.ref) === "llm" && karar(x.hyp) !== "llm")
  .map((c) => `${JSON.stringify(c.ref)} → ${JSON.stringify(c.hyp)} (${karar(c.hyp)})`);
console.log(`model=${veri.model}  S1 komut tutarlılığı: ${tutarli}/${toplam} (${Math.round((100 * tutarli) / toplam)}%)  eşik ≥ 10/12`);
for (const f of farklar) console.log(`  fark: ${f}`);
console.log(`yanlış komut (sohbetten türeyen): ${yanlisKomut.length}${yanlisKomut.length ? "\n  " + yanlisKomut.join("\n  ") : ""}`);
process.exit(tutarli / toplam >= 10 / 12 && yanlisKomut.length === 0 ? 0 : 1);
