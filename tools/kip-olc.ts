// tools/kip-olc.ts — Düşünme kipi ölçümü (spec 40 E5): kapalı / Çözücü / Doğrulayıcı kolları, GERÇEK köprü + GERÇEK yerel model + SAHTE belirlenimli dünya.
//
// Ön kayıt (eşik, sözler, "iyi son", karar kuralı): docs/olcum/on-kayit-dusunme-kipi.md — ölçümden ÖNCE yazıldı; sonuca bakıp değiştirilmez.
// Bu dosyadaki sabitler (SOZLER, YERLER, ESIK) o belgenin kopyası DEĞİL uygulamasıdır; ayrışırsa belge kazanır.
//
// Kullanım:
//   node --experimental-strip-types tools/kip-olc.ts [--model=gemma4:e2b] [--n=5] [--kol=kapali,cozucu,dogrulayici] [--cikti=docs/olcum/kip-olc-<tarih>.json]
// Ücretli beyin YOK: yalnız yerel Ollama. Ham koşular HER ZAMAN basılır (özet sayı aletin yanlış saydığını gizler).
"use strict";
import fs from "node:fs";
import { OllamaBeyni } from "../bridge/ollama.ts";
import { yetenekleriCoz, OLLAMA_VARSAYILAN_ADRES } from "../bridge/ollamaKatalog.ts";
import { Kopru } from "../bridge/kopru.ts";
import type { KopruKancasi } from "../bridge/kopruKancalari.ts";
import { KARAR_ONEKI, KararKaydi, type UyanisSatiri } from "../mind/kararKaydi.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { dusunmeKipiKur, KIP_COZUCU, KIP_DOGRULAYICI } from "../uygulama/eklentiler/dusunmeKipi/dusunmeKipi.ts";

const arg = (ad: string, v?: string) => process.argv.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3) ?? v;
const model = arg("model", "gemma4:e2b")!;
const n = Number(arg("n", "5"));
const kollar = arg("kol", "kapali,cozucu,dogrulayici")!.split(",");
const TUZAK2 = arg("senaryo", "") === "tuzak2";

const YERLER = ["beyaz tahta", "pencere", "kapı", "masa"];
const SESSIZLIK_MS = 2500, TAVAN_MS = 40_000, DUNYA_GECIKMESI_MS = 80;
/** Ön kayıtlı karar kuralı (puan = yüzde puanı). */
const ESIK = { dogrulayici: { b: 15, a: -5, c: 1.25 }, cozucu: { a: 10, b: -5, c: 1.1 } } as const;

type Grup = "gecerli" | "tuzak";
interface Soz { soz: string; grup: Grup; iyi(k: Kayit): boolean }
interface Gonderilen { n: Niyet; durum: "bitti" | "hata" | "bekliyor" }
interface Kayit { gonderilen: Gonderilen[]; hata: number; tavan: boolean; tur: number; ret: number; ms: number }

const ad = (h: unknown): string => (h && typeof h === "object" && "ad" in h ? String((h as { ad: unknown }).ad) : "").toLocaleLowerCase("tr");
const bitenHedef = (k: Kayit, tur: string, yer: string): boolean => k.gonderilen.some((g) => g.n.tur === tur && g.durum === "bitti" && "hedef" in g.n && ad(g.n.hedef) === yer);
const soyledi = (k: Kayit): boolean => k.gonderilen.some((g) => g.n.tur === "soyle");

const SOZLER: Soz[] = [
  { soz: "beyaz tahtaya git", grup: "gecerli", iyi: (k) => bitenHedef(k, "git", "beyaz tahta") },
  { soz: "pencereye bak", grup: "gecerli", iyi: (k) => bitenHedef(k, "bak", "pencere") },
  { soz: "merhaba nasılsın", grup: "gecerli", iyi: (k) => soyledi(k) && k.hata === 0 },
  { soz: "Pipe Wall Cluster'a bak", grup: "tuzak", iyi: (k) => k.hata <= 1 && soyledi(k) && !k.tavan },
  { soz: "pixel", grup: "tuzak", iyi: (k) => k.hata <= 1 && !k.tavan },
];

/** Sahte dünya: yerler listesinde olmayan çapa/nesne hedefi hata, gerisi bitti. */
function dunyaSonucu(niyet: Niyet): { durum: "bitti" | "hata"; not?: string } {
  if ((niyet.tur === "git" || niyet.tur === "bak" || niyet.tur === "odaklan") && "hedef" in niyet && niyet.hedef && typeof niyet.hedef === "object") {
    const h = niyet.hedef as { tip?: string; ad?: string };
    if ((h.tip === "capa" || h.tip === "nesne") && h.ad !== undefined && !YERLER.includes(h.ad.toLocaleLowerCase("tr"))) return { durum: "hata", not: `bilinmeyen çapa/nesne: '${h.ad}'.` };
  }
  return { durum: "bitti" };
}

const goster = await fetch(`${OLLAMA_VARSAYILAN_ADRES}/api/show`, { method: "POST", body: JSON.stringify({ model }) });
const yetenekler = goster.ok ? yetenekleriCoz(await goster.json()) : null;
const beyin = new OllamaBeyni({ model, yetenekler, zamanAsimiMs: 120_000 });
if (!(await beyin.hazirMi())) { console.error(`model yok: ${model}`); process.exit(1); }

function kancalarKur(kol: string): (() => readonly KopruKancasi[]) | undefined {
  if (kol === "kapali") return undefined;
  const secim = kol === "cozucu" ? KIP_COZUCU : KIP_DOGRULAYICI;
  const kip = dusunmeKipiKur({ acikMi: () => true, secenek: () => secim });
  return () => kip.kancalar();
}

/** TUZAK-2 (ön kayıt ek bölümü): oda tarifi dünyanın REDDETTİĞİ hedefleri görünür gösterir. */
const TUZAK_ODASI = "You see: Pipe Wall Cluster (ahead), AC Unit MD (right), bank (left). Places you can go to: beyaz tahta, pencere, kapı, masa.";
const TUZAK_SOZLERI = ["Pipe Wall Cluster'a bak", "olmadı, tekrar bak", "bir daha bak"];

async function kos(kol: string, sozler: readonly string[], oda = "oda"): Promise<Kayit> {
  const k: Kayit = { gonderilen: [], hata: 0, tavan: false, tur: 0, ret: 0, ms: 0 };
  const uyanislar: UyanisSatiri[] = [];
  let sonHareket = Date.now();
  const kancalar = kancalarKur(kol);
  const kopru: Kopru = new Kopru({
    komutYetkisi: false, beyin, toplamaMs: 5, dunyaDurumu: () => oda, yerAdlari: () => YERLER,
    kararKaydi: new KararKaydi({ yaz: (s) => { const o = JSON.parse(s.slice(KARAR_ONEKI.length + 1)); if (o.tur === "uyanis") { uyanislar.push(o as UyanisSatiri); sonHareket = Date.now(); } } }),
    ...(kancalar ? { kancalar } : {}),
    niyetGonder: (niyet, id) => {
      sonHareket = Date.now();
      const kayit: Gonderilen = { n: niyet, durum: "bekliyor" };
      k.gonderilen.push(kayit);
      const s = dunyaSonucu(niyet);
      setTimeout(() => {
        kayit.durum = s.durum; if (s.durum === "hata") k.hata++;
        kopru.algi({ tur: "sonuc", sonuc: { niyet_id: id, durum: s.durum, ...(s.not ? { not: s.not } : {}) } });
        sonHareket = Date.now();
      }, DUNYA_GECIKMESI_MS);
    },
  });
  const t0 = Date.now();
  for (const soz of sozler) {
    const ts = Date.now(); sonHareket = ts;
    kopru.algi({ tur: "duydum", metin: soz, kesin: true });
    while (Date.now() - ts < TAVAN_MS) {
      await new Promise((r) => setTimeout(r, 200));
      if (Date.now() - sonHareket > SESSIZLIK_MS && !kopru.dusunuyorMu) break;
    }
    if (Date.now() - ts >= TAVAN_MS) k.tavan = true;
  }
  k.ms = Date.now() - t0; k.tur = uyanislar.length; k.ret = uyanislar.reduce((t, u) => t + (u.kancaReddi ?? 0), 0);
  kopru.durdur();
  return k;
}

interface Ham { kol: string; soz: string; grup: Grup; tekrar: number; iyi: boolean; tur: number; ret: number; hata: number; tavan: boolean; ms: number; niyetler: string[] }
const ham: Ham[] = [];
if (TUZAK2) {
  const satir: { kol: string; tekrar: number; H: number; S: boolean; C: number; R: number; tavan: boolean; ms: number; niyetler: string[] }[] = [];
  console.log(`TUZAK-2 · model: ${model} · n=${n} · kollar: ${kollar.join(", ")}\n`);
  for (const kol of kollar) for (let i = 1; i <= n; i++) {
    const k = await kos(kol, TUZAK_SOZLERI, TUZAK_ODASI);
    const niyetler = k.gonderilen.map((g) => `${g.n.tur}${"hedef" in g.n ? `(${ad(g.n.hedef)})` : ""}:${g.durum}`);
    satir.push({ kol, tekrar: i, H: k.hata, S: soyledi(k), C: k.tur, R: k.ret, tavan: k.tavan, ms: k.ms, niyetler });
    console.log(`  [${kol}] #${i} H=${k.hata} S=${soyledi(k) ? "evet" : "hayir"} tur=${k.tur} ret=${k.ret}${k.tavan ? " TAVAN" : ""} ${k.ms}ms | ${niyetler.join(" ").slice(0, 170)}`);
  }
  const ort = (kol: string, f: (x: (typeof satir)[number]) => number): number => { const r2 = satir.filter((x) => x.kol === kol); return r2.length ? r2.reduce((t, x) => t + f(x), 0) / r2.length : NaN; };
  const t2 = kollar.map((kol) => ({ kol, H: ort(kol, (x) => x.H), S: 100 * ort(kol, (x) => (x.S ? 1 : 0)), C: ort(kol, (x) => x.C), R: satir.filter((x) => x.kol === kol).reduce((t, x) => t + x.R, 0) }));
  console.log("\n| kol | H ort hata | S söyledi % | C ort tur | R toplam ret |\n|---|---|---|---|---|");
  for (const o of t2) console.log(`| ${o.kol} | ${o.H.toFixed(2)} | ${o.S.toFixed(0)} | ${o.C.toFixed(2)} | ${o.R} |`);
  const kp = t2.find((o) => o.kol === "kapali"), dg = t2.find((o) => o.kol === "dogrulayici");
  const karar2 = kp && dg ? (dg.R === 0 ? "BELIRSIZ (R=0: tuzak kurulamadı)" : dg.H <= kp.H - 1 && dg.S >= kp.S - 10 && dg.C <= kp.C * 1.5 ? "KABUL" : "RED") : "kıyaslanacak kol yok";
  console.log(`\nÖN KAYITLI KARAR (tuzak-2, Doğrulayıcı, kapalıya göre): ${karar2} · Çözücü: yalnız gözlem`);
  const c2 = arg("cikti", `docs/olcum/kip-olc-tuzak2-${new Date().toISOString().slice(0, 10)}.json`)!;
  fs.writeFileSync(c2, JSON.stringify({ senaryo: "tuzak2", model, n, tarih: new Date().toISOString(), ozet: t2, karar: karar2, ham: satir }, null, 1));
  console.log(`ham veri: ${c2}`);
  process.exit(0);
}

console.log(`model: ${model} · yetenekler: ${yetenekler?.join(",") ?? "?"} · n=${n} · kollar: ${kollar.join(", ")}\n`);
for (const kol of kollar) {
  for (const s of SOZLER) {
    for (let i = 1; i <= n; i++) {
      const k = await kos(kol, [s.soz]);
      const iyi = s.iyi(k);
      const niyetler = k.gonderilen.map((g) => `${g.n.tur}${"hedef" in g.n ? `(${ad(g.n.hedef)})` : ""}:${g.durum}`);
      ham.push({ kol, soz: s.soz, grup: s.grup, tekrar: i, iyi, tur: k.tur, ret: k.ret, hata: k.hata, tavan: k.tavan, ms: k.ms, niyetler });
      console.log(`  [${kol}] ${s.soz} #${i} ${iyi ? "IYI " : "KOTU"} tur=${k.tur} ret=${k.ret} hata=${k.hata}${k.tavan ? " TAVAN" : ""} ${k.ms}ms | ${niyetler.join(" ").slice(0, 150)}`);
    }
  }
}

const oran = (kol: string, grup: Grup): number => { const r = ham.filter((h) => h.kol === kol && h.grup === grup); return r.length ? (100 * r.filter((h) => h.iyi).length) / r.length : NaN; };
const ortTur = (kol: string): number => { const r = ham.filter((h) => h.kol === kol); return r.length ? r.reduce((t, h) => t + h.tur, 0) / r.length : NaN; };
const ozet = kollar.map((kol) => ({ kol, A: oran(kol, "gecerli"), B: oran(kol, "tuzak"), C: ortTur(kol), ret: ham.filter((h) => h.kol === kol).reduce((t, h) => t + h.ret, 0), tavan: ham.filter((h) => h.kol === kol && h.tavan).length }));
console.log("\n| kol | A geçerli iyi son % | B tuzak iyi son % | C ort tur | toplam ret | tavan |\n|---|---|---|---|---|---|");
for (const o of ozet) console.log(`| ${o.kol} | ${o.A.toFixed(0)} | ${o.B.toFixed(0)} | ${o.C.toFixed(2)} | ${o.ret} | ${o.tavan} |`);

const kapali = ozet.find((o) => o.kol === "kapali");
const karar: Record<string, string> = {};
if (kapali) {
  const d = ozet.find((o) => o.kol === "dogrulayici");
  if (d) { const e = ESIK.dogrulayici; karar.dogrulayici = d.B >= kapali.B + e.b && d.A >= kapali.A + e.a && d.C <= kapali.C * e.c ? "KABUL" : "RED"; }
  const c = ozet.find((o) => o.kol === "cozucu");
  if (c) { const e = ESIK.cozucu; karar.cozucu = c.A >= kapali.A + e.a && c.B >= kapali.B + e.b && c.C <= kapali.C * e.c ? "KABUL" : "RED"; }
  console.log(`\nÖN KAYITLI KARAR (kapalıya göre): ${Object.entries(karar).map(([k, v]) => `${k}=${v}`).join(" · ") || "kıyaslanacak kol yok"}`);
} else console.log("\n'kapali' kolu yok: karar kuralı uygulanamaz.");

const cikti = arg("cikti", `docs/olcum/kip-olc-${new Date().toISOString().slice(0, 10)}.json`)!;
fs.writeFileSync(cikti, JSON.stringify({ model, n, tarih: new Date().toISOString(), ozet, karar, ham }, null, 1));
console.log(`ham veri: ${cikti}`);
process.exit(0);
