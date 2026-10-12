// tools/sikistir-olc.ts — Hafıza sıkıştırmasını (mind/sikistir.ts) GERÇEK modelle bir hafıza dosyasının KOPYASINDA ölçer
// (ön-kayıt 001 H5; Orion Beyin Ofisi). SALT OKUMA: hafıza dosyasına yazmaz, yalnız bellekte planlar ve modeli çağırır.
//
// Kullanım:
//   node --experimental-strip-types tools/sikistir-olc.ts --beyin=ollama:qwen2.5:7b [--n=3] [--hafiza=yol.json] [--etiket=h5]
//   node --experimental-strip-types tools/sikistir-olc.ts --beyin=dis --adres=http://127.0.0.1:4701   (claude-beyin.ts --mod=yapisal)
//
// Puan: (1) ÇÖZÜLDÜ = geçerli bir SUMMARY satırı (köprü yalnız özeti uygular); (2) KANITLI = her FACT değerinin içerik kelimelerinden en az biri
// plana giren ham satırlarda geçiyor (uydurma denetimi, kaba ama belirleyici). Ham çıktı HER ZAMAN saklanır.
"use strict";
import fs from "node:fs";
import { OllamaBeyni } from "../bridge/ollama.ts";
import { DisBeyin } from "../bridge/disBeyin.ts";
import { yetenekleriCoz, OLLAMA_VARSAYILAN_ADRES } from "../bridge/ollamaKatalog.ts";
import type { Beyin } from "../bridge/beyin.ts";
import { Hafiza, type Ani } from "../mind/hafiza.ts";
import { sikistirmaCoz, sikistirmaPlani, sikistirmaSorusu, SIKISTIR_TALIMATI } from "../mind/sikistir.ts";
import { sadelestir } from "../mind/hafizaYonlendirici.ts";

const arg = (ad: string, v?: string) => process.argv.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3) ?? v;
const beyinAdi = arg("beyin", "ollama:qwen2.5:7b")!;
const n = Number(arg("n", "3"));
const etiket = arg("etiket", "h5")!;
const hafizaYolu = arg("hafiza", `${process.env["APPDATA"]}/3dorion/orion-hafiza.json`)!;

const ham = JSON.parse(fs.readFileSync(hafizaYolu, "utf8")) as Ani[] | { kayitlar: Ani[] };
const aniler = Array.isArray(ham) ? ham : ham.kayitlar;
const h = new Hafiza({ kapasite: 10_000 });
h.yukle(aniler);
const simdi = Date.now();
const plan = sikistirmaPlani(h.dok(), simdi);
const soru = sikistirmaSorusu(plan, h.olgular(4000));
const planMetni = sadelestir(plan.map((a) => a.metin).join(" "));
const DURAK = new Set(["ozyn", "said", "orion", "icin", "gibi", "daha", "bir", "ben", "sen", "the", "and", "you", "with", "that", "this", "from", "have"]);
const icerikKelimeleri = (s: string) => sadelestir(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !DURAK.has(w));

async function beyinKur(): Promise<Beyin> {
  if (beyinAdi === "dis") return new DisBeyin({ zamanAsimiMs: 120_000, ad: "claude:haiku", adres: arg("adres") });
  const model = beyinAdi.replace(/^ollama:/, "");
  const goster = await fetch(`${OLLAMA_VARSAYILAN_ADRES}/api/show`, { method: "POST", body: JSON.stringify({ model }) });
  return new OllamaBeyni({ model, yetenekler: goster.ok ? yetenekleriCoz(await goster.json()) : null, zamanAsimiMs: 180_000 });
}

const beyin = await beyinKur();
if (!(await beyin.hazirMi())) { console.error(`beyin hazır değil: ${beyinAdi}`); process.exit(1); }
const dosya = `docs/olcum/${etiket}-${beyinAdi.replace(/[^a-z0-9.]+/gi, "_")}.jsonl`;
fs.mkdirSync("docs/olcum", { recursive: true });
fs.writeFileSync(dosya, "");
console.log(`beyin ${beyinAdi} · plan ${plan.length} ham kayıt (toplam ${aniler.length}) · soru ${soru.length} karakter · n=${n} → ${dosya}`);

let cozulen = 0, olguToplam = 0, olguKanitli = 0;
for (let i = 1; i <= n; i++) {
  const t0 = Date.now();
  let kayit: Record<string, unknown>;
  try {
    const c = await beyin.dusun({ ozetler: [soru], dunya: "", gecmis: [], araclar: [], talimat: SIKISTIR_TALIMATI });
    const metin = c.metin || c.cagrilar.map((x) => (x.girdi as { metin?: string } | null)?.metin ?? "").join("\n");
    const s = sikistirmaCoz(metin);
    const olgular = s?.olgular ?? [];
    const kanitli = olgular.filter((o) => icerikKelimeleri(o.deger).some((w) => planMetni.includes(w)));
    if (s?.ozet) cozulen++;   // köprü yalnız ÖZETİ uygular (olgu yazılmaz: mind/sikistir.ts, H5)
    olguToplam += olgular.length; olguKanitli += kanitli.length;
    kayit = { i, ms: Date.now() - t0, cozuldu: !!s?.ozet, olgu: olgular.length, kanitli: kanitli.length, atilan: s?.atilan ?? null,
              ozet: s?.ozet ?? null, olgular, ham: metin.slice(0, 1500) };
  } catch (e) {
    kayit = { i, ms: Date.now() - t0, cozuldu: false, hata: (e instanceof Error ? e.message : String(e)).slice(0, 120) };
  }
  fs.appendFileSync(dosya, JSON.stringify(kayit) + "\n");
  console.log(`${kayit["cozuldu"] ? "ÇÖZÜLDÜ" : "ÇÖZÜLEMEDİ"} #${i} ${kayit["ms"]} ms · olgu ${kayit["olgu"] ?? "-"} (kanıtlı ${kayit["kanitli"] ?? "-"}) · özet: ${String(kayit["ozet"] ?? "-").slice(0, 110)}`);
}
console.log(`\nÖZET ${beyinAdi}: çözülme ${cozulen}/${n} · kanıtlı olgu ${olguKanitli}/${olguToplam}${olguToplam ? ` (%${Math.round((100 * olguKanitli) / olguToplam)})` : ""}`);
