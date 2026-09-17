// tools/claude-beyin.ts — Claude'u (varsayılan Haiku) Orion'un dış beyni yapar.
//
// Spec 06 Faz 1b / K11. Dış beyin HTTP sözleşmesini (spec 04: `GET /saglik`,
// `POST /dusun`) başsız `claude -p` ile karşılar. Odada seçicinin `dis`
// seçeneğiyle takılır; ölçümde `tools/sadakat-olc.ts --beyin=dis`.
//
// GÜVENLİK — onay kapısının anlamı buna bağlı (spec 05 R2):
//   --tools ""            Claude Code'un hiçbir aracı yok: bash, dosya, web.
//                         Orion'un terminale tek yolu `dunya_komut` → onay kapısı.
//   --strict-mcp-config   MCP sunucusu yüklenmez.
//   --setting-sources ""  kullanıcı/proje ayarı yok → eklenti ve hook yok
//                         (ponytail'in ~1.300 tokenlık enjeksiyonu dahil).
// Ölçüldü (2026-09-17): açılış olayında tools/mcp/plugins/slash hepsi boş,
// küçük istemde giriş 527 token (Claude Code'un kendi asgari çerçevesi).
//
// `claude.exe` doğrudan başlatılır: `.cmd` kısayolu Windows'ta kabuk ister ve
// kabuk, tırnak ve satır sonu içeren sistem istemini bozar. İstem dosyadan,
// kullanıcı metni stdin'den gider — hiçbir içerik komut satırına girmez.
//
// Kullanım:
//   node --experimental-strip-types tools/claude-beyin.ts [--port=4700] [--model=haiku]
"use strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { baglamMetni, hamdanCikti } from "../bridge/baglam.ts";
import type { BeyinGirdisi } from "../bridge/beyin.ts";

const arg = (ad: string, v: string) =>
  process.argv.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3) ?? v;

const PORT = Number(arg("port", "4700"));
const MODEL = arg("model", "haiku");
const EXE = process.env.ORION_CLAUDE_EXE
  ?? path.join(process.env.APPDATA ?? "", "npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe");
// Boş çalışma dizini: bir üst dizindeki CLAUDE.md bağlama sızmasın.
const BOS = fs.mkdtempSync(path.join(os.tmpdir(), "orion-claude-beyin-"));

interface Sonuc { result?: string; is_error?: boolean; num_turns?: number; usage?: { input_tokens?: number } }

function claudeCalistir(sistem: string, kullanici: string): Promise<Sonuc> {
  const istemDosyasi = path.join(BOS, `sistem-${process.hrtime.bigint()}.txt`);
  fs.writeFileSync(istemDosyasi, sistem, "utf8");
  return new Promise((coz, reddet) => {
    const p = spawn(EXE, [
      "-p", "--model", MODEL, "--output-format", "json",
      "--tools", "", "--strict-mcp-config", "--setting-sources", "",
      "--disable-slash-commands", "--no-session-persistence",
      "--system-prompt-file", istemDosyasi,
    ], {
      cwd: BOS, windowsHide: true,
      // DÜŞÜNME KAPALI — ölçüldü (2026-09-17, aynı gerçek istem, B fixture'ı):
      //   açık:  10–75 sn, 674–9.439 düşünme tokenı; 4 cevabın 3'ü "Sessiz kalıyorum"
      //   `--effort low`: 50–65 sn, güvenilir bir düşüş yok
      //   kapalı: 2,8–2,9 sn, 4 cevabın 4'ü gözlemi söyledi
      // Uzun düşünme bu istemde hem yavaşlatıyor hem cevabı bozuyor.
      env: { ...process.env, MAX_THINKING_TOKENS: "0" },
    });
    let cikti = "", hata = "";
    p.stdout.on("data", (d) => { cikti += d; });
    p.stderr.on("data", (d) => { hata += d; });
    p.on("error", reddet);
    p.on("close", (kod) => {
      fs.rmSync(istemDosyasi, { force: true });
      try {
        const s = JSON.parse(cikti) as Sonuc;
        if (s.is_error) return reddet(new Error(`claude hata: ${String(s.result).slice(0, 200)}`));
        coz(s);
      } catch {
        reddet(new Error(`claude cikis ${kod}: ${(hata || cikti).slice(0, 200)}`));
      }
    });
    p.stdin.end(kullanici, "utf8");
  });
}

const sunucu = http.createServer(async (istek, yanit) => {
  const gonder = (kod: number, govde: unknown) => {
    yanit.writeHead(kod, { "Content-Type": "application/json; charset=utf-8" });
    yanit.end(JSON.stringify(govde));
  };
  if (istek.method === "GET" && istek.url === "/saglik") {
    return gonder(fs.existsSync(EXE) ? 200 : 503, { beyin: `claude:${MODEL}` });
  }
  if (istek.method !== "POST" || istek.url !== "/dusun") return gonder(404, { hata: "yok" });

  let ham = "";
  for await (const parca of istek) ham += parca;
  const t0 = Date.now();
  try {
    const girdi = JSON.parse(ham) as BeyinGirdisi;
    // Durumsuz: her tur yeni `claude -p`, geçmiş metne girer.
    const { sistem, kullanici } = baglamMetni(girdi, { gecmis: true });
    const s = await claudeCalistir(sistem, kullanici);
    const c = hamdanCikti(s.result ?? "", {
      model: `claude:${MODEL}`, sureMs: Date.now() - t0,
      girisToken: s.usage?.input_tokens, tur: s.num_turns,
    });
    console.log(`[claude-beyin] ${Date.now() - t0} ms · ${s.usage?.input_tokens} tok · ${c.cagrilar.map((x) => x.ad).join(",") || "-"}`);
    gonder(200, c);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error(`[claude-beyin] ${m}`);
    gonder(502, { hata: m });
  }
});

sunucu.listen(PORT, "127.0.0.1", () =>
  console.log(`[claude-beyin] http://127.0.0.1:${PORT} · model=${MODEL} · exe=${EXE}`));
