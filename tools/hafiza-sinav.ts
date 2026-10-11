// tools/hafiza-sinav.ts — Hafıza GETİRME sınavı (spec 26 F3-A). Model yok: yalnız "doğru anı ilk k sonuçta mı" (hit@k).
//
// Yöntemler: K2 mevcut `Hafiza.getir` (kelime örtüşmesi + tazelik + önem) · K2k yalnız kelime ilgisi ·
// K3 yalnız gömme (nomic-embed-text, kosinüs) · K3b `Hafiza.getir` ama ilgi = gömme (tazelik+önem+gömme birlikte).
// K1 "hepsi bağlamda": getirme YOK; bağlama sığıyorsa doğru anı her zaman oradadır → burada yalnız boyutu raporlanır.
// Kullanım: node --experimental-strip-types tools/hafiza-sinav.ts [--model=nomic-embed-text]
"use strict";
import fs from "node:fs";
import { Hafiza, kelimeIlgisi, type AniTuru } from "../mind/hafiza.ts";
import { OLLAMA_VARSAYILAN_ADRES } from "../bridge/ollamaKatalog.ts";

interface Ani { id: string; tur: string; onem: number; yasSaat: number; metin: string }
interface Soru { id: string; soru: string; altin: string[] }
const f = JSON.parse(fs.readFileSync("fixtures/hafiza/sinav.json", "utf8")) as { anilar: Ani[]; sorular: Soru[] };
const model = process.argv.find((a) => a.startsWith("--model="))?.slice(8) ?? "nomic-embed-text";

async function göm(metin: string): Promise<number[]> {
  const y = await fetch(`${OLLAMA_VARSAYILAN_ADRES}/api/embeddings`, { method: "POST", body: JSON.stringify({ model, prompt: metin }) });
  if (!y.ok) throw new Error(`gömme ${y.status}`);
  return ((await y.json()) as { embedding: number[] }).embedding;
}
const kos = (a: number[], b: number[]) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i]! * b[i]!; x += a[i]! ** 2; y += b[i]! ** 2; } return d / (Math.sqrt(x * y) || 1); };

const vek = new Map<string, number[]>();
for (const a of f.anilar) vek.set(a.metin, await göm("search_document: " + a.metin));
for (const s of f.sorular) vek.set(s.soru, await göm("search_query: " + s.soru));
const gomIlgi = (q: string, m: string) => Math.max(0, kos(vek.get(q)!, vek.get(m)!));

const SIMDI = 1_800_000_000_000;
const idOf = new Map(f.anilar.map((a) => [a.metin, a.id]));
function hafizaKur(ilgi?: (q: string, m: string) => number): Hafiza {
  const h = new Hafiza({ simdi: () => SIMDI, kapasite: 500, ...(ilgi ? { ilgiOlcer: ilgi } : {}) } as never);
  h.yukle(f.anilar.map((a) => ({ metin: a.metin, tur: (a.tur === "olgu" ? "konusma" : a.tur) as AniTuru, onem: a.onem, olusma: SIMDI - a.yasSaat * 3.6e6, sonErisim: SIMDI - a.yasSaat * 3.6e6 })));
  return h;
}
const siralamalar: Record<string, (s: Soru) => string[]> = {
  "K2  Hafiza.getir (kelime+tazelik+önem)": (s) => hafizaKur().getir(s.soru, 10).map((r) => idOf.get(r.ani.metin)!),
  "K2k yalnız kelime ilgisi": (s) => [...f.anilar].sort((a, b) => kelimeIlgisi(s.soru, b.metin) - kelimeIlgisi(s.soru, a.metin)).map((a) => a.id),
  "K3  yalnız gömme (kosinüs)": (s) => [...f.anilar].sort((a, b) => gomIlgi(s.soru, b.metin) - gomIlgi(s.soru, a.metin)).map((a) => a.id),
  "K3b Hafiza.getir + gömme ilgisi": (s) => hafizaKur(gomIlgi).getir(s.soru, 10).map((r) => idOf.get(r.ani.metin)!),
};

console.log(`model ${model} · ${f.anilar.length} anı · ${f.sorular.length} soru\n`);
console.log("| yöntem | hit@1 | hit@3 | hit@5 | MRR |\n|---|---|---|---|---|");
const ham: Record<string, { soru: string; altin: string[]; ilk: string[] }[]> = {};
for (const [ad, sirala] of Object.entries(siralamalar)) {
  let h1 = 0, h3 = 0, h5 = 0, mrr = 0;
  ham[ad] = [];
  for (const s of f.sorular) {
    const sira = sirala(s);
    const rank = sira.findIndex((id) => s.altin.includes(id)) + 1;
    if (rank >= 1 && rank <= 1) h1++; if (rank >= 1 && rank <= 3) h3++; if (rank >= 1 && rank <= 5) h5++;
    mrr += rank ? 1 / rank : 0;
    ham[ad]!.push({ soru: s.id, altin: s.altin, ilk: sira.slice(0, 3) });
  }
  const n = f.sorular.length, o = (x: number) => (x / n).toFixed(2);
  console.log(`| ${ad} | ${o(h1)} | ${o(h3)} | ${o(h5)} | ${(mrr / n).toFixed(2)} |`);
}
const damitik = f.anilar.filter((a) => a.tur !== "konusma");
console.log(`\nK1 hepsi-bağlamda: damıtılmış (olgu+olay) ${damitik.length} anı = ${damitik.reduce((t, a) => t + a.metin.length, 0)} karakter · hepsi ${f.anilar.reduce((t, a) => t + a.metin.length, 0)} karakter`);
fs.mkdirSync("docs/olcum", { recursive: true });
fs.writeFileSync("docs/olcum/f3-getirme.json", JSON.stringify({ model, ham }, null, 1));
