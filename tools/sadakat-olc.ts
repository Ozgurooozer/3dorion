// tools/sadakat-olc.ts — kayıtlı gerçek girdiyi N kez bir beyne oynatıp SADAKAT sayar.
//
// Spec 06 Faz 1–2. Sahne yok: fixture → beyin → `dunya_soyle` metni → puan.
// Beyin DURUMSUZ çalışır (her tur temiz oturum, geçmiş metinde): bir turun
// cevabı sonrakinin ölçümüne sızmasın.
//
// Kullanım:
//   node --experimental-strip-types tools/sadakat-olc.ts \
//        --fixture=fixtures/sadakat/A.json,fixtures/sadakat/B.json \
//        --beyin=opencode|dis|yerel  [--n=10] [--model=...] [--adres=http://127.0.0.1:4700]
//
// Kota / hız sınırı hatasında DURUR ve o ana kadarki sonucu basar —
// yeniden denemek hem kotayı yer hem de ölçümü zamana yayıp bozar.
"use strict";
import fs from "node:fs";
import { OpenCodeBeyni } from "../bridge/opencode.ts";
import { DisBeyin } from "../bridge/disBeyin.ts";
import { OllamaBeyni } from "../bridge/ollama.ts";
import type { Beyin, BeyinGirdisi } from "../bridge/beyin.ts";
import { puanla, type Beklenti } from "./sadakat.ts";

const arg = (ad: string, v?: string) =>
  process.argv.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3) ?? v;

const fixtures = arg("fixture", "")!.split(",").filter(Boolean);
const n = Number(arg("n", "10"));
const tur = arg("beyin", "dis")!;
if (!fixtures.length) { console.error("--fixture=... gerekli"); process.exit(2); }

const beyin: Beyin = tur === "opencode"
  ? new OpenCodeBeyni({ durumsuz: true, zamanAsimiMs: 90_000, modelID: arg("model") })
  : tur === "yerel"
    // Yerel model bedava: bulut kotaları dolduğunda nedensellik sorusu
    // (anılar sebep mi?) yine de cevaplanabilir — soru modelle ilgili değil.
    ? new OllamaBeyni({ model: arg("model", "qwen2.5:7b"), zamanAsimiMs: 120_000 })
    : new DisBeyin({ adres: arg("adres"), zamanAsimiMs: 120_000 });

if (!(await beyin.hazirMi())) { console.error(`beyin ayakta degil: ${beyin.ad}`); process.exit(1); }
console.log(`beyin: ${beyin.ad} · n=${n}\n`);

const KOTA = /\b429\b|quota|per-day|rate.?limit|usage limit/i;
let durdu = "";

for (const dosya of fixtures) {
  const f = JSON.parse(fs.readFileSync(dosya, "utf8")) as { ad: string; girdi: BeyinGirdisi; beklenti: Beklenti };
  const say = { sadik: 0, soyledi: 0, hata: 0, tamam: 0, sure: 0 };
  const uydurma = new Map<string, number>();

  for (let i = 1; i <= n && !durdu; i++) {
    const t0 = Date.now();
    try {
      const c = await beyin.dusun(f.girdi);
      const soz = c.cagrilar.filter((x) => x.ad === "dunya_soyle")
        .map((x) => String((x.girdi as { metin?: unknown })?.metin ?? "")).join(" ") || c.metin;
      const p = puanla(soz, f.beklenti);
      say.tamam++; say.sure += Date.now() - t0;
      if (p.sadik) say.sadik++;
      if (p.soyledi) say.soyledi++;
      for (const u of p.uydurma) uydurma.set(u, (uydurma.get(u) ?? 0) + 1);
      // Ham çıktı HER ZAMAN basılır: özet sayıya bakıp ham metni görmemek,
      // aletin yanlış saydığını fark etmemek demek.
      console.log(`  ${f.ad} #${i} ${p.sadik ? "SADIK " : "      "}${p.uydurma.length ? `uydurma=[${p.uydurma}] ` : ""}| ${soz.replace(/\s+/g, " ").slice(0, 140)}`);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      say.hata++;
      console.log(`  ${f.ad} #${i} HATA | ${m.slice(0, 140)}`);
      if (KOTA.test(m)) durdu = m.slice(0, 120);
    }
  }

  const yuzde = (k: number) => say.tamam ? `${k}/${say.tamam} (%${Math.round(100 * k / say.tamam)})` : "-";
  console.log(`\n== ${f.ad}: sadik ${yuzde(say.sadik)} · soyledi ${yuzde(say.soyledi)} · hata ${say.hata}` +
    ` · ort ${say.tamam ? Math.round(say.sure / say.tamam) : 0} ms`);
  console.log(`   uydurma: ${[...uydurma].map(([k, v]) => `${k}=${v}`).join(" ") || "yok"}\n`);
}

if (durdu) { console.log(`DURDU — kota/hiz siniri: ${durdu}`); process.exit(3); }
