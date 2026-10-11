// tools/f0-olc.ts — F0 yetenek bataryası koşucusu (spec 26 §3 F0). Sahne yok, Electron yok.
//
// Girdi CANLI köprünün kurduğu gibi kurulur (`talimatUret`, `ornekUret`, `araclariUret`; elle kopya talimat yok —
// `eylem-olc.ts` ile aynı ilke). Senaryolar fixtures/f0/senaryolar.json, puanlama tools/f0.ts.
//
// Kullanım:
//   node --experimental-strip-types tools/f0-olc.ts --beyin=ollama:qwen2.5:7b [--n=1] [--kume=beden,terminal] [--id=t1,t5]
//        [--etiket=taban] [--cikar=dunya_al,dunya_birak]
//   node --experimental-strip-types tools/f0-olc.ts --beyin=dis [--adres=http://127.0.0.1:4701]   (claude-beyin.ts çalışıyor olmalı = Haiku;
//        4700 = satır kipi, `claude-beyin.ts --mod=yapisal --port=4701` = yapısal kip)
//
// Her koşu docs/olcum/f0-<etiket>-<beyin>.jsonl'a SENARYO başına bir satır yazar (ham çağrılar dahil): özet sayı
// aletin yanlış saydığını gizler, ham çıktı HER ZAMAN saklanır.
"use strict";
import fs from "node:fs";
import { OllamaBeyni } from "../bridge/ollama.ts";
import { DisBeyin } from "../bridge/disBeyin.ts";
import { yetenekleriCoz, OLLAMA_VARSAYILAN_ADRES } from "../bridge/ollamaKatalog.ts";
import { talimatUret } from "../bridge/talimat.ts";
import { ornekUret } from "../bridge/ornekler.ts";
import { araclariUret, turIcinAraclar } from "../bridge/araclar.ts";
import { baglamMetni } from "../bridge/baglam.ts";
import type { Beyin, BeyinGirdisi } from "../bridge/beyin.ts";
import { CAPALAR, CAPA_ETIKETLERI } from "../protocol/temel.ts";
import { f0Puanla, soylenen, type F0Beklenti } from "./f0.ts";

interface Senaryo {
  id: string; kume: string; durum: string; bekle: F0Beklenti;
  soz?: string; olay?: string; gordum?: string; terminal?: string; anilar?: string[];
}
interface Fixture { durumlar: Record<string, string>; terminal: Record<string, string>; senaryolar: Senaryo[] }

const arg = (ad: string, v?: string) => process.argv.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3) ?? v;
const liste = (s?: string) => (s ?? "").split(",").filter(Boolean);

const beyinAdi = arg("beyin", "ollama:qwen2.5:7b")!;
const n = Number(arg("n", "1"));
const etiket = arg("etiket", "deneme")!;
const kumeler = new Set(liste(arg("kume")));
const idler = new Set(liste(arg("id")));
const cikar = new Set(liste(arg("cikar")));
const araclar = araclariUret().filter((a) => !cikar.has(a.ad));
const f = JSON.parse(fs.readFileSync(arg("fixture", "fixtures/f0/senaryolar.json")!, "utf8")) as Fixture;

async function beyinKur(): Promise<Beyin> {
  if (beyinAdi === "dis") return new DisBeyin({ zamanAsimiMs: 90_000, ad: "claude:haiku", adres: arg("adres") });
  const model = beyinAdi.replace(/^ollama:/, "");
  const goster = await fetch(`${OLLAMA_VARSAYILAN_ADRES}/api/show`, { method: "POST", body: JSON.stringify({ model }) });
  return new OllamaBeyni({ model, yetenekler: goster.ok ? yetenekleriCoz(await goster.json()) : null, zamanAsimiMs: 120_000 });
}

const sabit = `In the room: ${CAPALAR.map((c) => CAPA_ETIKETLERI[c]).join(", ")}.`;

function girdiKur(s: Senaryo): BeyinGirdisi {
  const ozetler = [
    ...(s.terminal ? [f.terminal[s.terminal]!] : []),
    ...(s.gordum ? [`You looked (with your eyes): ${s.gordum}`] : []),
    ...(s.olay ? [s.olay] : []),
    ...(s.soz ? [`Ozyn said: "${s.soz}"`] : []),
  ];
  return {
    talimat: talimatUret({ konusma: !!s.soz, terminal: !!s.terminal, anilar: !!s.anilar, olay: !!s.olay, gordum: !!s.gordum }),
    ornekler: ornekUret({ terminal: !!s.terminal, konusma: !!s.soz }),
    anilar: s.anilar ?? [],
    // Tur kuralı köprüyle AYNI işlevden (canlıda gordum-yalnız turda `sor` yok).
    ozetler, dunya: f.durumlar[s.durum] ?? "", sabit, gecmis: [],
    araclar: turIcinAraclar(araclar, new Set([s.soz ? "duydum" : "", s.gordum ? "gordum" : "", s.olay ? "olay" : "", s.terminal ? "terminal" : ""].filter(Boolean))),
  };
}

const beyin = await beyinKur();
if (!(await beyin.hazirMi())) { console.error(`beyin hazır değil: ${beyinAdi}`); process.exit(1); }
const secili = f.senaryolar.filter((s) => (!kumeler.size || kumeler.has(s.kume)) && (!idler.size || idler.has(s.id)));
const dosya = `docs/olcum/f0-${etiket}-${beyinAdi.replace(/[^a-z0-9.]+/gi, "_")}.jsonl`;
fs.mkdirSync("docs/olcum", { recursive: true });
fs.writeFileSync(dosya, "");
console.log(`beyin ${beyinAdi} · ${secili.length} senaryo × ${n} · araç ${araclar.length} · → ${dosya}\n`);

const kume: Record<string, { gecti: number; toplam: number; ms: number }> = {};
for (const s of secili) {
  for (let i = 1; i <= n; i++) {
    const g = girdiKur(s);
    const t0 = Date.now();
    let kayit: Record<string, unknown>;
    try {
      const c = await beyin.dusun(g);
      const ms = Date.now() - t0;
      const p = f0Puanla(c.cagrilar, c.metin, s.bekle);
      const bm = baglamMetni(g);
      kayit = { id: s.id, kume: s.kume, i, gecti: p.gecti, nedenler: p.nedenler, ms, baglamKr: bm.sistem.length + bm.kullanici.length,
                cagrilar: c.cagrilar.map((x) => ({ ad: x.ad, girdi: x.girdi })), metin: c.metin, soylenen: soylenen(c.cagrilar, c.metin) };
    } catch (e) {
      kayit = { id: s.id, kume: s.kume, i, gecti: false, nedenler: [`HATA ${(e instanceof Error ? e.message : String(e)).slice(0, 100)}`], ms: Date.now() - t0 };
    }
    fs.appendFileSync(dosya, JSON.stringify(kayit) + "\n");
    const k = (kume[s.kume] ??= { gecti: 0, toplam: 0, ms: 0 });
    k.toplam++; k.ms += Number(kayit["ms"]); if (kayit["gecti"]) k.gecti++;
    const ne = ((kayit["cagrilar"] as { ad: string; girdi: unknown }[] | undefined) ?? [])
      .map((x) => `${x.ad.replace("dunya_", "")}${JSON.stringify(x.girdi)}`).join(" + ") || `METİN "${String(kayit["metin"] ?? "").slice(0, 40)}"`;
    console.log(`${kayit["gecti"] ? "GEÇTİ " : "KALDI "} ${s.id.padEnd(3)} ${String(kayit["ms"]).padStart(6)} ms | ${ne.replace(/\s+/g, " ").slice(0, 110)}${kayit["gecti"] ? "" : `\n        ↳ ${(kayit["nedenler"] as string[]).join("; ")}`}`);
  }
}
console.log("\n| küme | geçen | ort ms |\n|---|---|---|");
let G = 0, T = 0;
for (const [ad, k] of Object.entries(kume)) { G += k.gecti; T += k.toplam; console.log(`| ${ad} | ${k.gecti}/${k.toplam} | ${Math.round(k.ms / k.toplam)} |`); }
console.log(`\nTOPLAM ${G}/${T} (%${Math.round((100 * G) / T)})`);
