// tools/orion-ajan.ts — odadaki Claude'u Orion'un bedenine bağlar (spec 05 Aşama 3).
//
// `claude -p` başsız bir ajan döngüsü başlatır: skill'in gövdesi istem olur,
// ajan `dunya_bekle` → `dunya_*` → `dunya_bekle` diye döner.
//
// GÜVENLİK — R2, spec 05'in "geçilmesi zorunlu kapısı":
//   Orion'a bash'li bir Claude vermek onay kapısını sessizce iptal eder.
//   Bu bir SKILL TALİMATI DEĞİL, İZİN AYARI: skill güvenlik sınırı değildir.
//     --tools ""              yerleşik araç YOK (Bash, Edit, Write, Read…)
//     --strict-mcp-config     kullanıcının diğer MCP sunucuları yüklenmez
//     --allowedTools          yalnızca Orion'un dünya araçları önceden onaylı
//     --setting-sources ""    kullanıcı ayarları/eklentileri/CLAUDE.md sızmaz
//   Kanıt her koşuda basılır: açılış olayındaki araç listesi (`[R2]` satırı).
//
// İstem skill dosyasından OKUNUR, burada yazılmaz: aynı metnin iki kopyası
// er geç ayrışır (bu repoda ölçülmüş bir hata sınıfı).
//
// DENETLEYİCİ DÖNGÜ — R1 (spec 05): model döngüyü sürdürmüyor. Ölçüldü: 25 sn
// "quiet" alınca oturumu BİTİRDİ, skill "asla bırakma" demesine rağmen.
// Talimat güvence değil; oturum biterse burada yeniden başlatılır. Her yeni
// oturum MCP `initialize` ile başlar ve dünya talimatı yeniden gönderir.
//
// Kullanım:
//   node --experimental-strip-types tools/orion-ajan.ts [--model=haiku] [--tur=60]
//        [--adres=http://127.0.0.1:4800/mcp] [--yeniden=50] [--istem="ek talimat"]
"use strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = (ad: string, v?: string) =>
  process.argv.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3) ?? v;

const KOK = path.resolve(import.meta.dirname, "..");
const EXE = process.env.ORION_CLAUDE_EXE
  ?? path.join(process.env.APPDATA ?? "", "npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe");
const ADRES = arg("adres", "http://127.0.0.1:4800/mcp")!;
const MODEL = arg("model", "haiku")!;
const TUR = arg("tur", "60")!;
const YENIDEN_AZAMI = Number(arg("yeniden", "50"));

// Skill gövdesi (ön madde hariç) → istem.
const skill = fs.readFileSync(path.join(KOK, ".claude/skills/orion-beden/SKILL.md"), "utf8");
const govde = skill.replace(/^---[\s\S]*?---\s*/, "");
const istem = [govde, arg("istem")].filter(Boolean).join("\n\n");

// MCP yapılandırması geçici dosyada; çalışma dizini BOŞ (repo dosyalarını görmesin).
const calisma = fs.mkdtempSync(path.join(os.tmpdir(), "orion-ajan-"));
const mcpDosya = path.join(calisma, "mcp.json");
fs.writeFileSync(mcpDosya, JSON.stringify({ mcpServers: { orion: { type: "http", url: ADRES } } }));

const argv = [
  "-p", istem,
  "--model", MODEL,
  "--max-turns", TUR,
  "--output-format", "stream-json", "--verbose",
  "--mcp-config", mcpDosya,
  "--strict-mcp-config",
  "--tools", "",
  "--allowedTools", "mcp__orion__*",
  "--setting-sources", "",
  "--disable-slash-commands",
  "--no-session-persistence",
];

console.log(`[ajan] ${EXE} · model=${MODEL} · azami tur=${TUR} · uc=${ADRES} · yeniden<=${YENIDEN_AZAMI}`);

let durdur = false;
let oturum = 0;
let cocuk: ReturnType<typeof spawn> | null = null;

function oturumBaslat(): void {
  oturum++;
  console.log(`[ajan] oturum #${oturum}`);
  const c = spawn(EXE, argv, {
    cwd: calisma,
    stdio: ["ignore", "pipe", "pipe"],
    // Düşünme kapalı: ölçümde (spec 06 §6.5) 10–75 sn sürüyor ve cevabı bozuyordu.
    env: {
      ...process.env,
      MAX_THINKING_TOKENS: "0",
      // dunya_bekle 120 sn'ye kadar bekliyor; araç zaman aşımı onun üstünde olsun.
      MCP_TOOL_TIMEOUT: "180000",
    },
  });
  cocuk = c;

  let artik = "";
  c.stdout.setEncoding("utf8");
  c.stdout.on("data", (p: string) => {
    artik += p;
    let i;
    while ((i = artik.indexOf("\n")) >= 0) {
      const satir = artik.slice(0, i).trim();
      artik = artik.slice(i + 1);
      if (!satir) continue;
      let o: any;
      try { o = JSON.parse(satir); } catch { continue; }
      if (o.type === "system" && o.subtype === "init") {
        // R2 KANITI: ajanın gördüğü araçların TAMAMI.
        const araclar: string[] = o.tools ?? [];
        const yabanci = araclar.filter((a) => !a.startsWith("mcp__orion__"));
        console.log(`[R2] araclar (${araclar.length}): ${araclar.join(", ")}`);
        console.log(`[R2] ${yabanci.length === 0 ? "GECTI" : "KALDI"} — Orion disi arac: ${yabanci.join(", ") || "yok"}`);
        const mcp = (o.mcp_servers ?? []).map((s: any) => `${s.name}=${s.status}`).join(", ");
        console.log(`[ajan] mcp: ${mcp}`);
      } else if (o.type === "assistant") {
        for (const b of o.message?.content ?? []) {
          if (b.type === "tool_use") console.log(`[ajan] → ${b.name.replace("mcp__orion__", "")} ${JSON.stringify(b.input).slice(0, 120)}`);
          // Düz metin odaya ULAŞMAZ (konuşmak bir eylemdir) — ama görünmeli:
          // ajan araç yerine metin yazıyorsa sebebi buradan okunur.
          else if (b.type === "text" && b.text?.trim()) console.log(`[ajan] metin: ${b.text.replace(/\s+/g, " ").slice(0, 200)}`);
        }
      } else if (o.type === "result") {
        console.log(`[ajan] bitti: ${o.subtype} · tur=${o.num_turns} · ${o.duration_ms} ms · $${o.total_cost_usd ?? "?"}`);
      }
    }
  });
  c.stderr.setEncoding("utf8");
  c.stderr.on("data", (p: string) => process.stderr.write(`[ajan:err] ${p}`));
  c.on("exit", (kod) => {
    cocuk = null;
    console.log(`[ajan] oturum #${oturum} bitti, kod=${kod}`);
    if (durdur || oturum >= YENIDEN_AZAMI) return son();
    // Hemen değil: dünya kapalıysa ya da hata tekrarlıyorsa dönüp durmasın.
    setTimeout(oturumBaslat, kod === 0 ? 1000 : 5000);
  });
}

function son(): void {
  fs.rmSync(calisma, { recursive: true, force: true });
  console.log(`[ajan] durdu · ${oturum} oturum`);
  process.exit(0);
}

for (const sinyal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinyal, () => { durdur = true; if (cocuk) cocuk.kill(); else son(); });
}

oturumBaslat();
