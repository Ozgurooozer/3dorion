// tools/kapi-yakala.ts — Öğrenen kapı kıyası (toplantı 2026-09-27 K6) için GERÇEK terminal çıktıları.
//
// Her komut bu depoda, ayrı bir PowerShell sürecinde GERÇEKTEN çalıştırılır. Çıkış
// kodu Orion'un kabuğundaki istem fonksiyonuyla AYNI kuralla hesaplanır (host/main.js):
//   $k = if ($?) { 0 } else { 1 }; LASTEXITCODE sıfırdan farklıysa o.
// Çıktı Orion'un gördüğü biçimde kurulur: istem satırı + çıktının son satırları + yeni istem.
//
// Neden elle yazılmış metin değil: Orion'un kendi dersi (spec 01) — kural süzgeci
// elle yazılmış kümede %100 aldı, gerçek çıktıda tökezledi.
//
// Komutlar kaynak dosyalara yazmaz ve ağa çıkmaz. `vite build` yalnız `dist/` derleme
// çıktısını yeniler; başarısız test dosyası geçici klasöre yazılıp silinir.
//
// Kullanım: node --experimental-strip-types tools/kapi-yakala.ts [--kume=1|2] [--cikti=brain-lab/data/kapi/terminal.json]
//   --kume=2: ikinci, TAZE komut kümesi (H-K1 sınaması; bu kümede ayar yapılmaz).
"use strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface YakalananKomut {
  /** Kabaca aile: yazım hatası, git, liste, node, test, derleme, npm, ps. */
  aile: string;
  komut: string;
  kod: number;
  sureMs: number;
  /** Orion'un ekran kuyruğu biçiminde: istem + komut, çıktının son satırları, yeni istem. */
  kuyruk: string;
}

const ISTEM = "PS C:\\Users\\ozigo\\3dorion>";

/**
 * Orion'un kabuk kuralıyla çıkış kodu: $? ve LASTEXITCODE.
 *
 * Komut KENDİ SATIRINDA: PowerShell hata bağlamında satırı olduğu gibi gösterir
 * ("+ boyle_bir_komut_yok"). Tek satıra sarılınca kodlama ve çıkış kodu satırları
 * da hata metnine sızıyordu — Orion'un terminalinde öyle görünmez.
 */
export function komutSatiri(komut: string): string {
  return [
    "[Console]::OutputEncoding = [Text.Encoding]::UTF8",
    komut,
    "$k = if ($?) { 0 } else { 1 }; if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) { $k = $LASTEXITCODE }; exit $k",
  ].join("\n");
}

/** Ekran kuyruğu: istem + komut, çıktının son `satir` satırı, yeni istem. */
export function kuyrukKur(komut: string, cikti: string, satir = 20): string {
  const govde = cikti.replace(/\r\n/g, "\n").split("\n").map((s) => s.replace(/\s+$/, "")).filter((s, i, a) => s !== "" || (i > 0 && a[i - 1] !== ""));
  const son = govde.slice(-satir).join("\n").trim();
  return `${ISTEM} ${komut}\n${son ? `${son}\n` : ""}${ISTEM}`;
}

function arg(ad: string, varsayilan: string): string {
  const p = process.argv.find((a) => a.startsWith(`--${ad}=`));
  return p ? p.slice(ad.length + 3) : varsayilan;
}

function yakala(): void {
  const kok = path.resolve(import.meta.dirname, "..");
  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), "orion-kapi-"));
  const patlak = path.join(gecici, "patlak.test.mjs");
  fs.writeFileSync(patlak, [
    'import { test } from "node:test";',
    'import assert from "node:assert/strict";',
    'test("toplama", () => { assert.equal(1 + 1, 2); });',
    'test("carpma", () => { assert.equal(2 * 3, 7); });',
  ].join("\n"));
  const patlak2 = path.join(gecici, "metin.test.mjs");
  fs.writeFileSync(patlak2, [
    'import { test } from "node:test";',
    'import assert from "node:assert/strict";',
    'test("selamlama", () => { assert.equal("merhaba".toUpperCase(), "MERHABA"); });',
    'test("ters çevirme", () => { assert.equal([..."abc"].reverse().join(""), "cab"); });',
  ].join("\n"));

  // İKİNCİ KÜME (H-K1 sınaması için TAZE durumlar): birinci kümeden farklı komutlar.
  // Bu kümede hiçbir ayar yapılmaz; yalnız ön-kayıtlı hipotez sınanır.
  const ikinci: [string, string][] = [
    ["yazim", "gitt log"],
    ["yazim", "nmp --version"],
    ["yazim", "Get-Chlditem"],
    ["yazim", "cd olmayan_klasor"],
    ["yazim", "ndoe index.js"],
    ["git", "git status --porcelain"],
    ["git", "git rev-parse --short HEAD"],
    ["git", "git log -1 --format=%s"],
    ["git", "git log --oneline -3 -- mind"],
    ["git", "git diff --stat HEAD~3 HEAD~1"],
    ["git", "git branch"],
    ["liste", "dir tools"],
    ["liste", "dir bridge"],
    ["liste", "Get-ChildItem docs\\specs"],
    ["liste", "dir *.json"],
    ["node", "node -e \"console.log(JSON.stringify({a:1}))\""],
    ["node", "node -e \"console.error('bir sorun var')\""],
    ["node", "node -e \"process.exit(2)\""],
    ["node", "node -e \"null.x\""],
    ["node", "node -p \"1+1\""],
    ["test", "node --experimental-strip-types --test mind/zaman.test.ts mind/ajanda.test.ts"],
    ["test", "node --experimental-strip-types --test mind/kuralHafizasi.test.ts"],
    ["test", `node --test "${patlak2}"`],
    ["surum", "npx tsc --version"],
    ["surum", "npx vite --version"],
    ["npm", "npm run"],
    ["npm", "npm config get registry"],
    ["ps", "Get-Location"],
    ["ps", "Remove-Item olmayan.txt"],
    ["ps", "Get-Process -Name olmayan_surec"],
  ];

  const birinci: [string, string][] = [
    ["yazim", "boyle_bir_komut_yok"],
    ["yazim", "pyhton --version"],
    ["yazim", "gti status"],
    ["yazim", "npn test"],
    ["yazim", "nod -v"],
    ["git", "git status"],
    ["git", "git status --short"],
    ["git", "git log --oneline -5"],
    ["git", "git branch --show-current"],
    ["git", "git diff --stat HEAD~1"],
    ["git", "git show --stat --oneline HEAD"],
    ["liste", "dir"],
    ["liste", "dir mind"],
    ["liste", "Get-ChildItem tools | Select-Object -First 5"],
    ["node", "node --version"],
    ["node", "node -e \"console.log('merhaba')\""],
    ["node", "node -e \"process.exit(3)\""],
    ["node", "node -e \"throw new Error('patladi')\""],
    ["node", "node -e \"console.warn('uyari: bu API eskidi')\""],
    ["test", "node --experimental-strip-types --test mind/zaman.test.ts"],
    ["test", "node --experimental-strip-types --test mind/dikkat.test.ts"],
    ["test", `node --test "${patlak}"`],
    ["derleme", "npx tsc --noEmit -p ."],
    ["derleme", "npx vite build"],
    ["npm", "npm run olmayan_betik"],
    ["npm", "npm ls --depth=0"],
    ["npm", "npm --version"],
    ["ps", "Get-Item olmayan_dosya.txt"],
    ["ps", "Test-Path olmayan_klasor"],
    ["ps", "Get-Content package.json -TotalCount 3"],
  ];

  const komutlar = arg("kume", "1") === "2" ? ikinci : birinci;
  const sonuc: YakalananKomut[] = [];
  for (const [aile, komut] of komutlar) {
    const t0 = Date.now();
    const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", komutSatiri(komut)], {
      cwd: kok, encoding: "utf8", timeout: 180_000, windowsHide: true,
    });
    const sureMs = Date.now() - t0;
    const kod = r.status ?? 1;
    // Görünen komut, geçici yol yerine sabit bir ad taşısın: gerçek kayıtta da dosya adı görünür.
    const gorunen = komut.replace(patlak, "patlak.test.mjs").replace(patlak2, "metin.test.mjs");
    const cikti = `${r.stdout ?? ""}${r.stderr ? `\n${r.stderr}` : ""}`
      .split(pathToFileURL(patlak).href).join("patlak.test.mjs")
      .split(patlak).join("patlak.test.mjs")
      .split(pathToFileURL(patlak2).href).join("metin.test.mjs")
      .split(patlak2).join("metin.test.mjs");
    sonuc.push({ aile, komut: gorunen, kod, sureMs, kuyruk: kuyrukKur(gorunen, cikti) });
    console.log(`${aile.padEnd(8)} kod=${String(kod).padEnd(3)} ${String(sureMs).padStart(6)} ms  ${gorunen}`);
  }
  fs.rmSync(gecici, { recursive: true, force: true });
  const cikti = arg("cikti", "brain-lab/data/kapi/terminal.json");
  fs.mkdirSync(path.dirname(cikti), { recursive: true });
  fs.writeFileSync(cikti, JSON.stringify(sonuc, null, 1));
  console.log(`yazıldı: ${cikti} (${sonuc.length} komut)`);
}

if (import.meta.main) yakala();
