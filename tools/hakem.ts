// tools/hakem.ts — HAKEM: LLM'e Orion gibi davranmasını değil, kapının sorusunu doğrudan sorar.
//
// NEDEN VAR (brain-lab/LAB-DEFTERI.md, 2026-09-27, T0/T0b). "Uyandırılsaydın bir
// şey yapar mıydın?" sorusu öğretmen olamadı: tek bir algıyla uyandırılan model
// (qwen2.5 de, Haiku da) uyandırılmayı bir görev sayıp gürültüye bile konuşuyor.
// Uyandırılmak kendisi bir sinyal. Hakem aynı algıyı başka bir soruyla görür:
// "Bu algı Orion'un ana zihnini uyandırmaya değer mi?" Tek kelime: YES ya da NO.
//
// Soru bilerek KURAL VERMEZ ("hatalar önemlidir" gibi): kural verirse hakem
// içgüdüleri tekrar eder ve öğrenen kapı yeni bir şey öğrenmez. Yalnız kapının
// amacını söyler: Ozyn şimdi Orion'un bunu fark edip tepki vermesini ister mi.
//
// İki arka uç:
//   ollama  — yerel model, /api/chat, araçsız, sıcaklık 0.
//   claude  — `claude -p`, tools/claude-beyin.ts ile AYNI güvenlik bayraklarıyla
//             (araç yok, MCP yok, kullanıcı ayarı yok, düşünme kapalı). Bayraklar
//             bekçi testle o dosyadakilerle karşılaştırılır (hakem.test.ts).
//
// Kullanım:
//   node --experimental-strip-types tools/hakem.ts kalibre --arka=claude|ollama [--model=…] [--tekrar=3] [--cikti=…]
"use strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ozetle, type Algi } from "../protocol/algi.ts";
import { KUME } from "../mind/refleksKumesi.ts";
import { BAGLAMLAR, SABIT, cogunluk, durumdanAlgi, kalibrasyonOzeti, type KalibrasyonSatiri } from "./ogretmen.ts";

export const HAKEM_TALIMATI = [
  "You are the attention gate of Orion. Orion is an embodied AI who shares a workroom with Ozyn:",
  "it sees the room and the terminal on the desk, where Ozyn works.",
  "Waking Orion's main mind is expensive, and every time it is woken it tends to speak.",
  "Your only job: decide whether the perception below deserves waking Orion's main mind now —",
  "would Ozyn want Orion to notice this and react (say something, suggest something, act)?",
  "Answer with exactly one word: YES or NO.",
].join(" ");

/** Hakemin kullanıcı metni: oda, dünya durumu, algının özeti (köprünün özetiyle aynı). */
export function hakemMetni(a: Algi, dunya: string): string {
  return `${SABIT}\nNow: ${dunya}\nPerception: ${ozetle(a)}\nWake Orion's main mind? Answer YES or NO.`;
}

/** Cevabın ilk kelimesi: YES/EVET → true, NO/HAYIR → false, başka → null. */
export function hakemCevabi(metin: string): boolean | null {
  const ilk = /\p{L}+/u.exec(metin.trim())?.[0]?.toLocaleUpperCase("en-US");
  if (ilk === "YES" || ilk === "EVET") return true;
  if (ilk === "NO" || ilk === "HAYIR") return false;
  return null;
}

/** `claude -p` güvenlik bayrakları — tools/claude-beyin.ts ile aynı olmalı (bekçi testli). */
export const CLAUDE_BAYRAKLARI = [
  "--tools", "", "--strict-mcp-config", "--setting-sources", "",
  "--disable-slash-commands", "--no-session-persistence",
] as const;

const CLAUDE_EXE = process.env.ORION_CLAUDE_EXE
  ?? path.join(process.env.APPDATA ?? "", "npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe");

async function claudeSor(sistem: string, kullanici: string, model: string): Promise<string> {
  const bos = fs.mkdtempSync(path.join(os.tmpdir(), "orion-hakem-"));
  const istem = path.join(bos, "sistem.txt");
  fs.writeFileSync(istem, sistem, "utf8");
  try {
    return await new Promise((coz, reddet) => {
      const p = spawn(CLAUDE_EXE, ["-p", "--model", model, "--output-format", "json", ...CLAUDE_BAYRAKLARI, "--system-prompt-file", istem], {
        cwd: bos, windowsHide: true, env: { ...process.env, MAX_THINKING_TOKENS: "0" },
      });
      let cikti = "", hata = "";
      p.stdout.on("data", (d) => { cikti += d; });
      p.stderr.on("data", (d) => { hata += d; });
      p.on("error", reddet);
      p.on("close", (kod) => {
        try {
          const s = JSON.parse(cikti) as { result?: string; is_error?: boolean };
          if (s.is_error) return reddet(new Error(`claude hata: ${String(s.result).slice(0, 200)}`));
          coz(s.result ?? "");
        } catch { reddet(new Error(`claude çıkış ${kod}: ${(hata || cikti).slice(0, 200)}`)); }
      });
      p.stdin.end(kullanici, "utf8");
    });
  } finally {
    fs.rmSync(bos, { recursive: true, force: true });
  }
}

async function ollamaSor(sistem: string, kullanici: string, model: string): Promise<string> {
  const y = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false, options: { temperature: 0 }, messages: [{ role: "system", content: sistem }, { role: "user", content: kullanici }] }),
  });
  if (!y.ok) throw new Error(`ollama ${y.status}`);
  const d = await y.json() as { message?: { content?: string } };
  return d.message?.content ?? "";
}

export type HakemArka = "claude" | "ollama";

/** Hakeme bir algıyı sorar. Ham cevap da döner: anlaşılmayan cevap görünür kalsın. */
export async function hakemSor(arka: HakemArka, model: string, a: Algi, dunya: string): Promise<{ karar: boolean | null; ham: string }> {
  const kullanici = hakemMetni(a, dunya);
  const ham = arka === "claude" ? await claudeSor(HAKEM_TALIMATI, kullanici, model) : await ollamaSor(HAKEM_TALIMATI, kullanici, model);
  return { karar: hakemCevabi(ham), ham: ham.trim().slice(0, 80) };
}

function arg(ad: string, varsayilan: string): string {
  const p = process.argv.find((a) => a.startsWith(`--${ad}=`));
  return p ? p.slice(ad.length + 3) : varsayilan;
}

/** Aynı 31'lik küme; hakem köprüden geçmediği için dikkatin düşürdükleri de sorulur ama ayrı sayılır. */
async function kalibre(): Promise<void> {
  const arka = arg("arka", "claude") as HakemArka;
  const model = arg("model", arka === "claude" ? "haiku" : "qwen2.5:7b");
  const tekrar = Number(arg("tekrar", "3"));
  const cikti = arg("cikti", "");
  console.log(`hakem kalibrasyonu — ${arka}:${model}, her durum ${tekrar} kez, bağlam "masada"`);
  // T0 ile aynı sayım: dikkatin güvenlik içgüdüsünün düşürdüğü durumlar sayıma girmez.
  const DIKKATIN_DUSURDUGU = new Set(["kamera_degisti", "ipucu"]);
  const satirlar: KalibrasyonSatiri[] = [];
  for (const [sira, d] of KUME.entries()) {
    const algi = durumdanAlgi(d);
    if (!algi) continue;
    const dustu = (algi.tur === "olay" && DIKKATIN_DUSURDUGU.has(algi.ad)) || (algi.tur === "sonuc" && algi.sonuc.durum !== "hata");
    const oylar: (boolean | null)[] = [];
    const hamlar: string[] = [];
    for (let i = 0; i < tekrar; i++) {
      const c = await hakemSor(arka, model, algi, BAGLAMLAR.masada);
      oylar.push(c.karar);
      hamlar.push(c.ham);
    }
    const s: KalibrasyonSatiri = {
      sira, grup: d.grup, beklenen: d.beklenen, ozet: d.ozet.replace(/\n/g, " ⏎ ").slice(0, 70),
      oylar, cogunluk: cogunluk(oylar.filter((x): x is boolean => x !== null)),
      niyetTurleri: dustu ? oylar.map(() => "dustu:dikkat") : hamlar, sureMs: [],
    };
    satirlar.push(s);
    console.log(`#${sira} ${d.grup.padEnd(8)} insan=${d.beklenen ? "UYAN" : "sus "} hakem=${s.cogunluk === null ? "?" : s.cogunluk ? "UYAN" : "sus "}${dustu ? " (dikkat düşürürdü)" : ""} [${hamlar.join(" | ")}] ${s.ozet}`);
    if (cikti) fs.appendFileSync(cikti, `${JSON.stringify(s)}\n`);
  }
  const o = kalibrasyonOzeti(satirlar);
  console.log(`\nsorulan ${o.sorulan} (konuşma ve dikkatin düşürdükleri hariç; ${o.sorulamayan} ayrı) · uyuşan ${o.uyusan} (%${Math.round((100 * o.uyusan) / Math.max(1, o.sorulan))}) · kaçırılan ${o.kacirilan} · boşa ${o.bosa} · kararsız ${o.kararsiz} · oybirliği ${o.oybirligi}`);
  console.log("done");
}

if (import.meta.main) {
  if (process.argv[2] === "kalibre") await kalibre();
  else { console.error("kullanım: hakem.ts kalibre --arka=claude|ollama [--model=…] [--tekrar=3] [--cikti=…]"); process.exit(2); }
}
