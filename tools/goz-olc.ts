// tools/goz-olc.ts — Spec 25 V0: Orion'un gözünden 22 kare (oda 12, ova 10), yerel görme modelleri (gemma4:e2b, e4b)
// hangi nesnelerin göründüğünü doğru söylüyor mu. Ön kayıt: docs/specs/25-orion-gorsun.md §1 — eşikler orada.
//
//   npm run dev   (ayrı uçbirimde; :5273)  ·  ollama açık
//   node --experimental-strip-types --import ./tools/babylon-cozucu.mjs tools/goz-olc.ts [--model gemma4:e2b,gemma4:e4b]
//
// Kareler uygulama AÇIKKEN çekilir ve modeller uygulama hâlâ açıkken sorulur (H4: bellek tepesi gerçek koşulda).
// Ham kayıt: docs/olcum/goz-v0.jsonl (kare başına model yanıtı, gerçek sınıflar, süre); kareler GOZ_KARE klasörüne (varsayılan
// işletim sisteminin geçici klasörü) — depoya girmez. Çıkış kodu: koşu tamamlandıysa 0 (hipotez sonucu metindedir, deney).
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tumCapalar } from "../world/level/capalar.ts";
import { gecitVarisi, levelYuksekligi } from "../world/yer/levelYeri.ts";
import type { LevelTanimi } from "../world/level/cekirdek/levelTanimi.ts";
import { odaPozlari, ovaPozlari, type GozPozu } from "../uygulama/gozPozlari.ts";

const ADRES = process.env.GOZ_ADRES ?? "http://localhost:5273/index.html?sessiz=1";
const OLLAMA = process.env.OLLAMA_ADRES ?? "http://127.0.0.1:11434";
const ai = process.argv.indexOf("--model");
const MODELLER = (ai > 0 ? process.argv[ai + 1]! : "gemma4:e2b,gemma4:e4b").split(",");
const KARE_KLASORU = process.env.GOZ_KARE ?? fs.mkdtempSync(path.join(os.tmpdir(), "goz-v0-"));
const KAYIT = path.resolve("docs/olcum/goz-v0.jsonl");
const EN = 896, BOY = 504;
const BELIRGIN = 0.02;   // ön kayıt: görünür ve alan ≥ %2 → beklenen "evet"
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Pozlar (ön kayıt §1: sabit, 22; tek kaynak uygulama/gozPozlari.ts — V1 aynılarını kullanır) ──
type Poz = GozPozu;
const OVA: LevelTanimi = JSON.parse(fs.readFileSync("world/level/ova/ova.level.json", "utf8"));
const pozlar: Poz[] = [...odaPozlari(tumCapalar()), ...ovaPozlari(gecitVarisi(OVA.gecitler![0]!, levelYuksekligi(OVA)).konum)];

// ── başsız Chrome + CDP ──
const port = 9300 + Math.floor(Math.random() * 400);
const profil = fs.mkdtempSync(path.join(os.tmpdir(), "goz-olc-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, "--window-size=1280,720",
  "--ignore-gpu-blocklist", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
let wsAdres: string | undefined;
for (let i = 0; i < 60 && !wsAdres; i++) {
  try { wsAdres = ((await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as { type: string; webSocketDebuggerUrl: string }[]).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* açılıyor */ }
  await bekle(200);
}
if (!wsAdres) { console.error("Chrome açılmadı"); chrome.kill(); process.exit(99); }
const ws = new WebSocket(wsAdres);
let sira = 0;
const bekleyen = new Map<number, (m: { result?: { result?: { value?: unknown }; exceptionDetails?: { exception?: { description?: string } } } }) => void>();
const loglar: string[] = [];
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && bekleyen.has(m.id)) { bekleyen.get(m.id)!(m); bekleyen.delete(m.id); }
  else if (m.method === "Runtime.consoleAPICalled") loglar.push(m.params.args.map((a: { value?: unknown; description?: string }) => a.value ?? a.description).join(" "));
};
await new Promise((r) => { ws.onopen = r; });
const g = (method: string, params: object = {}) => new Promise<{ result?: { result?: { value?: unknown }; exceptionDetails?: { exception?: { description?: string } } } }>((r) => { const i = ++sira; bekleyen.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const deg = async <T>(ifade: string): Promise<T> => {
  const r = await g("Runtime.evaluate", { expression: ifade, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "değerlendirme hatası");
  return r.result?.result?.value as T;
};
const kapat = () => { try { ws.close(); } catch { /* */ } chrome.kill(); try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: "ignore" }); } catch { /* */ } };

await g("Runtime.enable"); await g("Page.enable");
await g("Page.navigate", { url: ADRES });
for (let i = 0; i < 120 && !loglar.some((l) => l.includes("[ORION] avatar hazır")); i++) await bekle(500);
if (!loglar.some((l) => l.includes("[ORION] avatar hazır"))) { console.error("Orion'un bedeni yüklenmedi"); kapat(); process.exit(98); }
await bekle(3000);

// ── Kareler ──
interface Gercek { id: string; ad: string; gorunur: boolean; alan: number }
interface Kare { poz: Poz; dosya: string; gercek: Gercek[] }
const kareler: Kare[] = [];
for (const yer of ["oda", "ova"] as const) {
  if (yer === "ova") {
    if (!(await deg<boolean>("dunya.ovayaCik()"))) { console.error("ovaya çıkılamadı"); kapat(); process.exit(97); }
    await bekle(3000);
  }
  for (const p of pozlar.filter((x) => x.yer === yer)) {
    const r = await deg<{ png: string; gercek: Gercek[] } | null>(`dunya.orionGozu(${p.x}, ${p.z}, ${p.yaw}, ${EN}, ${BOY})`);
    if (!r) { console.error("kare çekilemedi:", p.ad); kapat(); process.exit(96); }
    const dosya = path.join(KARE_KLASORU, `${String(kareler.length + 1).padStart(2, "0")}-${p.ad.replace(/[^a-z0-9+-]+/gi, "_")}.png`);
    fs.writeFileSync(dosya, Buffer.from(r.png, "base64"));
    kareler.push({ poz: p, dosya, gercek: r.gercek });
    await bekle(400);
  }
}
console.log(`${kareler.length} kare → ${KARE_KLASORU}`);
// --kare: yalnız kareleri çek ve gerçeği yaz (modele sormadan önce düzeneğin gözle denetimi).
if (process.argv.includes("--kare")) {
  for (const k of kareler) {
    const g = k.gercek.filter((n) => n.alan > 0).map((n) => `${n.ad}${n.gorunur ? "" : "(örtülü)"} ${(n.alan * 100).toFixed(0)}%`);
    console.log(`${path.basename(k.dosya)}: ${g.join(", ") || "-"}`);
  }
  kapat();
  process.exit(0);
}

// ── Gerçek sınıfları (ad başına; aynı adlı nesneler birleşir) ──
type Sinif = "belirgin" | "yok" | "ara";
function siniflar(k: Kare): Map<string, Sinif> {
  const m = new Map<string, Sinif[]>();
  for (const n of k.gercek) {
    const s: Sinif = n.gorunur && n.alan >= BELIRGIN ? "belirgin" : (n.alan === 0 || !n.gorunur) ? "yok" : "ara";
    m.set(n.ad, [...(m.get(n.ad) ?? []), s]);
  }
  return new Map([...m].map(([ad, l]) => [ad, l.includes("belirgin") ? "belirgin" : l.every((x) => x === "yok") ? "yok" : "ara"]));
}

// ── Modeller ──
const vramOku = () => { try { return Number(execSync("nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits").toString().trim()); } catch { return -1; } };
async function ollama(govde: object): Promise<{ response?: string; error?: string; total_duration?: number }> {
  const r = await fetch(`${OLLAMA}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) });
  return r.json() as Promise<{ response?: string; error?: string; total_duration?: number }>;
}
const KAPALI = (adlar: string[]) => "Bu kare, 3D bir dünyada senin gözünden görülen bir kare. Aşağıdakilerin her biri bu karede " +
  "açıkça görünüyor mu? Görmüyorsan ya da emin değilsen false.\n" + adlar.map((a) => `- ${a}`).join("\n");
const ACIK = "Bu kare, 3D bir dünyada senin gözünden. Ne görüyorsun? Türkçe, en fazla 2 kısa cümle.";

fs.mkdirSync(path.dirname(KAYIT), { recursive: true });
const satirlar: string[] = [];
interface Ozet { model: string; dogruEvet: number; belirgin: number; yanlisEvet: number; yok: number; sureler: number[]; vramTepe: number; bozukYanit: number;
  yerde: Record<string, { dogruEvet: number; belirgin: number; yanlisEvet: number; yok: number }> }
const ozetler: Ozet[] = [];
for (const model of MODELLER) {
  for (const m of MODELLER) if (m !== model) await ollama({ model: m, keep_alive: 0 });   // öbürünü boşalt
  const o: Ozet = { model, dogruEvet: 0, belirgin: 0, yanlisEvet: 0, yok: 0, sureler: [], vramTepe: 0, bozukYanit: 0, yerde: {} };
  let tepe = 0;
  const izle = setInterval(() => { tepe = Math.max(tepe, vramOku()); }, 400);
  // Isınma (süreye girmez): modeli yükle, görme kodlayıcısını ısıt.
  await ollama({ model, prompt: ACIK, images: [fs.readFileSync(kareler[0]!.dosya).toString("base64")], stream: false, think: false, options: { num_ctx: 4096, temperature: 0, num_predict: 8 } });
  for (const k of kareler) {
    const sinif = siniflar(k);
    const adlar = [...sinif.keys()];
    const img = fs.readFileSync(k.dosya).toString("base64");
    const sema = { type: "object", properties: Object.fromEntries(adlar.map((a) => [a, { type: "boolean" }])), required: adlar };
    const bas = Date.now();
    const r = await ollama({ model, prompt: KAPALI(adlar), images: [img], stream: false, think: false, format: sema, options: { num_ctx: 4096, temperature: 0 } });
    const sure = (Date.now() - bas) / 1000;
    o.sureler.push(sure);
    let yanit: Record<string, boolean> = {};
    try { yanit = JSON.parse(r.response ?? "{}"); } catch { o.bozukYanit++; }
    const y = (o.yerde[k.poz.yer] ??= { dogruEvet: 0, belirgin: 0, yanlisEvet: 0, yok: 0 });
    for (const [ad, s] of sinif) {
      const evet = yanit[ad] === true;
      if (s === "belirgin") { o.belirgin++; y.belirgin++; if (evet) { o.dogruEvet++; y.dogruEvet++; } }
      else if (s === "yok") { o.yok++; y.yok++; if (evet) { o.yanlisEvet++; y.yanlisEvet++; } }
    }
    const betim = await ollama({ model, prompt: ACIK, images: [img], stream: false, think: false, options: { num_ctx: 4096, temperature: 0, num_predict: 90 } });
    satirlar.push(JSON.stringify({ model, kare: path.basename(k.dosya), poz: k.poz, sure: +sure.toFixed(2), yanit, gercek: Object.fromEntries(sinif), betim: betim.response?.trim(), hata: r.error }));
    console.log(`${model} · ${k.poz.yer} · ${k.poz.ad} · ${sure.toFixed(1)} sn`);
  }
  clearInterval(izle);
  o.vramTepe = Math.max(tepe, vramOku());
  ozetler.push(o);
}
fs.writeFileSync(KAYIT, satirlar.join("\n") + "\n");
kapat();

// ── Rapor (ön kayıt eşikleriyle) ──
const ortanca = (l: number[]) => { const s = [...l].sort((a, b) => a - b); return s.length ? (s[(s.length - 1) >> 1]! + s[s.length >> 1]!) / 2 : NaN; };
const oran = (a: number, b: number) => (b ? a / b : NaN);
console.log("\n── SONUÇ (ön kayıt: docs/specs/25 §1) ──");
for (const o of ozetler) {
  const duy = oran(o.dogruEvet, o.belirgin), yy = oran(o.yanlisEvet, o.yok);
  console.log(`${o.model}: duyarlılık ${duy.toFixed(2)} (${o.dogruEvet}/${o.belirgin}) · yanlış evet ${yy.toFixed(2)} (${o.yanlisEvet}/${o.yok}) · ` +
    `ortanca ${ortanca(o.sureler).toFixed(2)} sn (en çok ${Math.max(...o.sureler).toFixed(1)}) · VRAM tepe ${o.vramTepe} MiB · bozuk yanıt ${o.bozukYanit}`);
  for (const [yer, y] of Object.entries(o.yerde)) {
    console.log(`   ${yer}: duyarlılık ${oran(y.dogruEvet, y.belirgin).toFixed(2)} (${y.dogruEvet}/${y.belirgin}) · yanlış evet ${oran(y.yanlisEvet, y.yok).toFixed(2)} (${y.yanlisEvet}/${y.yok})`);
  }
}
const e2b = ozetler.find((o) => o.model === "gemma4:e2b"), e4b = ozetler.find((o) => o.model === "gemma4:e4b");
if (e2b) {
  const duy = oran(e2b.dogruEvet, e2b.belirgin), yy = oran(e2b.yanlisEvet, e2b.yok);
  console.log(`H1 (e2b duyarlılık ≥ 0,70 ve yanlış evet ≤ 0,15): ${duy >= 0.7 && yy <= 0.15 ? "TUTTU" : "TUTMADI"}`);
  console.log(`H2 (e2b ortanca ≤ 2,0 sn): ${ortanca(e2b.sureler) <= 2 ? "TUTTU" : "TUTMADI"}`);
}
if (e2b && e4b) {
  const fark = oran(e4b.dogruEvet, e4b.belirgin) - oran(e2b.dogruEvet, e2b.belirgin);
  const yyKotu = oran(e4b.yanlisEvet, e4b.yok) > oran(e2b.yanlisEvet, e2b.yok);
  console.log(`H3 (e4b duyarlılık farkı ≥ 0,10 ve yanlış evet kötü değil): fark ${fark.toFixed(2)} → ${fark >= 0.1 && !yyKotu ? "TUTTU" : "TUTMADI"}`);
}
for (const o of ozetler) console.log(`H4 ${o.model} (bellek tepesi ≤ 7,6 GB): ${o.vramTepe} MiB → ${o.vramTepe <= 7600 ? "TUTTU" : "TUTMADI"}`);
console.log(`ham kayıt: ${KAYIT}`);
