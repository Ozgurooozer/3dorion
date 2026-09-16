// tools/beyin-tekrar.ts — Kaydedilmiş GERÇEK girdileri bir beyne oynatır.
//
// NEDEN VAR: beyni denemek için Babylon'u, Electron'u, 3D sahneyi açmak
// zorunda kalmak, denemeyi dakikalara çıkarıyor ve fikir denemeyi öldürüyor.
// Bu araç sahneyi tamamen atlar: fixture → beyin → sonuç, saniyeler içinde.
//
// Python'da (ya da başka bir dilde) beyin yazarken asıl döngün bu olmalı:
//   1. `dusun()` içini değiştir
//   2. `node --experimental-strip-types tools/beyin-tekrar.ts`
//   3. sonuca bak, 1'e dön
//
// Kullanım:
//   node --experimental-strip-types tools/beyin-tekrar.ts [--beyin=dis|opencode]
//                                                         [--klasor=fixtures/beyin]
//                                                         [--adres=http://...]
//
// Fixture biçimi: `KayitBeyni`nin ürettiği `{ sira, beyin, girdi, cikti?, hata? }`.
// `cikti` varsa KARŞILAŞTIRMA yapılır: yeni beyin eskisiyle aynı eylemleri mi
// üretiyor? Bu, beyin değiştirirken gerileme yakalamanın en ucuz yolu.
"use strict";
import fs from "node:fs";
import path from "node:path";
import { DisBeyin } from "../bridge/disBeyin.ts";
import { OpenCodeBeyni } from "../bridge/opencode.ts";
import type { Beyin, BeyinGirdisi } from "../bridge/beyin.ts";

function arg(ad: string, varsayilan?: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${ad}=`));
  return p ? p.slice(ad.length + 3) : varsayilan;
}

const klasor = arg("klasor", "fixtures/beyin")!;
const tur = arg("beyin", "dis")!;
const adres = arg("adres");

const beyin: Beyin = tur === "opencode"
  ? new OpenCodeBeyni({ adres, modelID: arg("model") ?? undefined, zamanAsimiMs: 90_000 })
  : new DisBeyin({ adres, zamanAsimiMs: 30_000 });

if (!fs.existsSync(klasor)) {
  console.error(`fixture klasoru yok: ${klasor}\n`
    + `once kayit al: ORION_KAYIT=1 ... > gunluk.txt && node tools/beyin-ayikla.mjs gunluk.txt`);
  process.exit(2);
}
const dosyalar = fs.readdirSync(klasor).filter((f) => f.endsWith(".json")).sort();
if (dosyalar.length === 0) {
  console.error(`fixture bulunamadi: ${klasor}`);
  process.exit(2);
}

if (!(await beyin.hazirMi())) {
  console.error(`beyin ayakta degil: ${beyin.ad}`);
  if (tur === "dis") console.error("  python tools/ornek-beyin.py");
  process.exit(1);
}

console.log(`beyin   : ${beyin.ad}`);
console.log(`fixture : ${dosyalar.length} adet (${klasor})\n`);

interface Kayit { sira?: number; girdi: BeyinGirdisi; cikti?: { cagrilar?: { ad: string }[] }; hata?: string }

let ayni = 0, farkli = 0, karsilastirilan = 0, patlayan = 0;

for (const d of dosyalar) {
  const k = JSON.parse(fs.readFileSync(path.join(klasor, d), "utf8")) as Kayit;
  const ozet = (k.girdi.ozetler ?? [])[0] ?? (k.girdi.gecmis ?? []).at(-1)?.metin ?? "(bos)";
  const t0 = Date.now();

  try {
    const c = await beyin.dusun(k.girdi);
    const yeni = c.cagrilar.map((x) => x.ad).join(",") || "(eylem yok)";
    console.log(`${d}  ${String(Date.now() - t0).padStart(6)} ms`);
    console.log(`   girdi : ${ozet.replace(/\s+/g, " ").slice(0, 90)}`);
    console.log(`   yeni  : ${yeni}`);

    // Eski çıktı varsa karşılaştır — beyin değiştirirken gerileme yakalanır.
    if (k.cikti?.cagrilar) {
      karsilastirilan++;
      const eski = k.cikti.cagrilar.map((x) => x.ad).join(",") || "(eylem yok)";
      if (eski === yeni) { ayni++; console.log(`   eski  : ${eski}  ✓ ayni`); }
      else { farkli++; console.log(`   eski  : ${eski}  ✗ FARKLI`); }
    } else if (k.hata) {
      console.log(`   eski  : HATA (${k.hata.slice(0, 60)})`);
    }
  } catch (e) {
    patlayan++;
    console.log(`${d}  ${String(Date.now() - t0).padStart(6)} ms`);
    console.log(`   girdi : ${ozet.replace(/\s+/g, " ").slice(0, 90)}`);
    console.log(`   HATA  : ${(e as Error).message.slice(0, 100)}`);
  }
  console.log("");
}

console.log(`sonuc: ${dosyalar.length} fixture`
  + (karsilastirilan ? ` | karsilastirilan ${karsilastirilan}: ${ayni} ayni, ${farkli} farkli` : "")
  + (patlayan ? ` | patlayan ${patlayan}` : ""));

// `process.exit()` DEĞİL: fetch'in tuttuğu yuvalar kapanırken zorla çıkmak
// Windows'ta libuv iddiasını tetikliyordu ("UV_HANDLE_CLOSING"). Sonucu
// etkilemiyordu ama her koşunun sonunda çöp bir satır bırakıyordu.
// Çıkış kodunu ayarlayıp node'un kendi kendine kapanmasını bekliyoruz.
process.exitCode = farkli > 0 || patlayan > 0 ? 1 : 0;
