// tools/ogret.ts — ÖĞRET: Ozyn, Orion'un kapı kararlarını terminalden düzeltir.
//
// Toplantı 2026-09-27 K1: öğretmen Ozyn; ilk kanal bu araç, sonra zihin duvarı
// paneli (ikisi aynı öğretim satırını yazar). K5: kural hafızası kayıttaki öğretim
// satırlarından yeniden kurulur — bu araç da hafızayı öyle kurar ve gösterir.
//
// Kullanım (kayıt varsayılan olarak %APPDATA%/3dorion/karar-kaydi):
//   npm run ogret   ya da   3dorion.bat ogret          (= gozden: günlük öğretim)
//   node --experimental-strip-types tools/ogret.ts gozden [--son=20] [--kayit=klasör|dosya]
//   node --experimental-strip-types tools/ogret.ts liste [--son=20] [--kayit=klasör|dosya]
//   node --experimental-strip-types tools/ogret.ts ogret <oturum/algı> <uyan|sus> [--kayit=…]
//   node --experimental-strip-types tools/ogret.ts hafiza [--kayit=…]
//
// Öğretim `ogretim.jsonl` dosyasına eklenir (kaydın klasöründe; sabit dosya
// verilirse onun yanında). Orion açıksa host dosyayı izler ve dersi yeniden
// başlatmadan canlı hafızaya uygular.
//
// Bekçi (K5): yalnızca kayıtta var olan, öğrenilebilir bir algı öğretilebilir;
// güvenlik içgüdüsünün kararı öğretilemez (mind/ogretim.ts `ogretimKur`).
"use strict";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { kayitOku, uyanisEyleme, zincirKur, type KararZinciri } from "../mind/kararZinciri.ts";
import type { AlgiSatiri, KararSatiri, OgretimSatiri } from "../mind/kararKaydi.ts";
import { kuralHafizasiKur, ogretimKur } from "../mind/ogretim.ts";
import type { KapiYonu, KuralHafizasi } from "../mind/kuralHafizasi.ts";

export interface KayitYeri {
  /** Okunacak kayıt dosyaları. */
  dosyalar: string[];
  /** Öğretimin ekleneceği dosya. */
  ogretimDosyasi: string;
}

/** Klasör verilirse içindeki her .jsonl; dosya verilirse o dosya ve yanındaki ogretim.jsonl. */
export function kayitYeri(kayit: string): KayitYeri {
  if (fs.existsSync(kayit) && fs.statSync(kayit).isDirectory()) {
    const dosyalar = fs.readdirSync(kayit).filter((f) => f.endsWith(".jsonl")).sort().map((f) => path.join(kayit, f));
    return { dosyalar, ogretimDosyasi: path.join(kayit, "ogretim.jsonl") };
  }
  const ogretimDosyasi = path.join(path.dirname(kayit), "ogretim.jsonl");
  return { dosyalar: [kayit, ogretimDosyasi].filter((d, i, a) => a.indexOf(d) === i && fs.existsSync(d)), ogretimDosyasi };
}

export function kayitYukle(yer: KayitYeri): { zincir: KararZinciri; satirlar: KararSatiri[] } {
  const satirlar: KararSatiri[] = [];
  let bozuk = 0;
  for (const d of yer.dosyalar) {
    const r = kayitOku(fs.readFileSync(d, "utf8"));
    satirlar.push(...r.satirlar);
    bozuk += r.bozuk;
  }
  return { zincir: zincirKur(satirlar, bozuk), satirlar };
}

export interface ListeSatiri {
  anahtar: string;
  algi: AlgiSatiri;
  /** Algı LLM'i uyandırdıysa o uyanışta ne oldu: "eylem: soyle+bak" / "sustu" / "hata"; düştüyse null. */
  sonra: string | null;
  /** Bu algıya verilmiş son ders (varsa). */
  ders: KapiYonu | null;
  /** Kayıttaki gölge (algı anındaki hafıza). */
  golge: string;
  /** Bugünkü hafızanın bu algı için kararı. */
  simdi: string;
}

const golgeMetni = (g: { yon: KapiYonu; noron: string } | null | undefined): string => (g ? `${g.yon} (${g.noron})` : "—");
const tek = (s: string, n: number) => s.replace(/\s+/g, " ").slice(0, n);
const saat = (t: number) => new Date(t).toLocaleTimeString("tr-TR");

/** Bugünkü hafızanın bir durum kodu için kararı, okunur: "sus (K2)" ya da "—". */
function simdiMetni(hafiza: KuralHafizasi, isaret: readonly string[]): string {
  const k = hafiza.karar(isaret);
  return k ? `${k.yon} (${k.noron.id})` : "—";
}

/** Son `son` öğrenilebilir algı, eskiden yeniye. */
export function ogrenilebilirListe(zincir: KararZinciri, hafiza: KuralHafizasi, son: number): ListeSatiri[] {
  const uyanisi = new Map<string, string>();
  for (const z of zincir.uyanislar) {
    const u = z.uyanis;
    const ne = u.hata ? "hata" : uyanisEyleme(u) ? `eylem: ${u.niyetler.map((n) => n.tur).join("+") || "konuştu"}` : "sustu";
    for (const a of z.tetikleyenler) uyanisi.set(`${a.o}/${a.id}`, ne);
  }
  const dersler = new Map<string, KapiYonu>();
  for (const o of zincir.ogretimler) dersler.set(`${o.hedef.o}/${o.hedef.id}`, o.yon);
  return zincir.algilar
    .filter((a) => a.isaret && a.isaret.length > 0)
    .slice(-son)
    .map((a) => {
      const anahtar = `${a.o}/${a.id}`;
      return {
        anahtar, algi: a,
        sonra: a.kapi.gecti ? (uyanisi.get(anahtar) ?? "uyanış kaydı yok") : null,
        ders: dersler.get(anahtar) ?? null,
        golge: golgeMetni(a.golge),
        simdi: simdiMetni(hafiza, a.isaret!),
      };
    });
}

// ── Gözden geçirme (Ozyn'in günlük öğretimi) ─────────────────────────────────
//
// `liste` + `ogret` iki adımlıydı: anahtarı kopyala, komutu yaz. Her gün ders
// vermenin asıl engeli buydu (gelen yorum, 2026-09-27: "asıl risk veri").
// `gozden` öğretilmemiş son kararları tek tek gösterir; tek tuşla ders olur.

/** Gözden geçirmede bir cevap: öğretilen yön, geç ya da çık. */
export type GozdenCevabi = KapiYonu | "gec" | "cik";

/** Tuşu cevaba çevirir: u uyan, s sus, g ya da Enter geç, ç/c/q çık. Tanınmayan null (yeniden sorulur). */
export function cevapCoz(girdi: string): GozdenCevabi | null {
  const t = girdi.trim().toLocaleLowerCase("tr-TR");
  if (t === "u") return "uyan";
  if (t === "s") return "sus";
  if (t === "" || t === "g") return "gec";
  if (t === "ç" || t === "c" || t === "q") return "cik";
  return null;
}

/** Gözden geçirilecekler: henüz dersi olmayan öğrenilebilir kararlar, eskiden yeniye. */
export function gozdenListesi(liste: readonly ListeSatiri[]): ListeSatiri[] {
  return liste.filter((s) => s.ders === null);
}

/** Bir kararın gözden geçirme metni: ne oldu, kapı ne dedi, LLM ne yaptı, hafıza ne diyor. */
export function gozdenMetni(s: ListeSatiri, sira: number, toplam: number): string[] {
  const a = s.algi;
  return [
    `[${sira}/${toplam}] ${saat(a.t)}  ${a.algi}  ${a.kapi.gecti ? "GEÇTİ" : "düştü"} (${a.kapi.kural})${s.sonra ? ` → ${s.sonra}` : ""}`,
    `  gölge: ${s.golge} · şimdi: ${s.simdi}`,
    ...a.ozet.split("\n").slice(0, 6).map((l) => `  │ ${l.slice(0, 120)}`),
  ];
}

export interface DersSonucu {
  satir: OgretimSatiri;
  /** Ozyn'e gösterilecek satırlar: ne yazıldı, hafıza artık ne diyor. */
  metin: string[];
}

/**
 * Bir algıya ders verir: öğretim satırını kurar, dosyaya ekler, hafızanın yeni
 * kararını söyler. `ogret` ve `gozden` aynı yoldan geçer. Güvenlik içgüdüsünün
 * kararı öğretilemez: `ogretimKur` hata döner (bekçi, mind/ogretim.ts).
 */
export function dersVer(yer: KayitYeri, satirlar: readonly KararSatiri[], a: AlgiSatiri, yon: KapiYonu, t: number): DersSonucu | { hata: string } {
  const s = ogretimKur(a, yon, "ogret-araci", t);
  if ("hata" in s) return s;
  ogretimYaz(yer.ogretimDosyasi, s);
  const k = kuralHafizasiKur([...satirlar, s]).hafiza.karar(s.isaret);
  return {
    satir: s,
    metin: [
      `ders yazıldı: ${a.o}/${a.id} → ${yon}  (${yer.ogretimDosyasi})`,
      `  algı: ${tek(a.ozet, 100)}`,
      k ? `  hafıza artık: ${k.yon} — ${k.noron.id}: ${k.noron.kosul.join(" ∧ ")}` : "  hafıza bu durumda henüz emin değil (çelişen dersler)",
    ],
  };
}

/** "oturum/algı" anahtarıyla algıyı bulur. */
export function algiBul(zincir: KararZinciri, anahtar: string): AlgiSatiri | null {
  const i = anahtar.lastIndexOf("/");
  if (i <= 0) return null;
  const o = anahtar.slice(0, i), id = anahtar.slice(i + 1);
  return zincir.algilar.find((a) => a.o === o && a.id === id) ?? null;
}

/** Kural hafızasının okunur dökümü. */
export function hafizaMetni(hafiza: KuralHafizasi): string[] {
  if (hafiza.noronlar.length === 0) return ["(hafıza boş: henüz ders yok)"];
  return hafiza.noronlar.map((n) => {
    const yon = n.sayac.uyan >= n.sayac.sus ? "uyan" : "sus";
    return `${n.id}: ${n.kosul.join(" ∧ ")} → ${yon} (uyan ${n.sayac.uyan} · sus ${n.sayac.sus}) · kanıt ${n.kanit.length}: ${n.kanit.slice(-3).join(", ")}`;
  });
}

/** Öğretimi dosyaya ekler; satırı döner. */
export function ogretimYaz(dosya: string, satir: OgretimSatiri): void {
  fs.mkdirSync(path.dirname(dosya), { recursive: true });
  fs.appendFileSync(dosya, `${JSON.stringify(satir)}\n`, "utf8");
}

function arg(ad: string, varsayilan: string): string {
  const p = process.argv.find((a) => a.startsWith(`--${ad}=`));
  return p ? p.slice(ad.length + 3) : varsayilan;
}

async function calistir(): Promise<void> {
  const komut = process.argv[2];
  const yer = kayitYeri(arg("kayit", path.join(process.env.APPDATA ?? "", "3dorion", "karar-kaydi")));
  const { zincir, satirlar } = kayitYukle(yer);
  const { hafiza } = kuralHafizasiKur(satirlar);

  if (komut === "liste") {
    const liste = ogrenilebilirListe(zincir, hafiza, Number(arg("son", "20")));
    if (liste.length === 0) { console.log("öğrenilebilir karar yok (kayıt boş ya da yalnız güvenlik içgüdüsü kararları)"); return; }
    for (const s of liste) {
      const a = s.algi;
      console.log(`${s.anahtar}  ${saat(a.t)}  ${a.algi}  ${a.kapi.gecti ? "GEÇTİ" : "düştü"} (${a.kapi.kural})`
        + `${s.sonra ? ` → ${s.sonra}` : ""}  gölge: ${s.golge}  şimdi: ${s.simdi}${s.ders ? `  ders: ${s.ders}` : ""}`);
      console.log(`      ${tek(a.ozet, 110)}`);
    }
    console.log(`\nDüzeltmek için: node --experimental-strip-types tools/ogret.ts ogret <oturum/algı> <uyan|sus>`);
    return;
  }

  if (komut === "ogret") {
    const [anahtar, yon] = [process.argv[3], process.argv[4]];
    if (!anahtar || (yon !== "uyan" && yon !== "sus")) { console.error("kullanım: ogret <oturum/algı> <uyan|sus>"); process.exit(2); }
    const a = algiBul(zincir, anahtar);
    if (!a) { console.error(`kayıtta yok: ${anahtar}`); process.exit(1); }
    const d = dersVer(yer, satirlar, a, yon, Date.now());
    if ("hata" in d) { console.error(d.hata); process.exit(1); }
    for (const satir of d.metin) console.log(satir);
    return;
  }

  if (komut === "gozden") return gozdenGecir(yer, satirlar, zincir, Number(arg("son", "20")));

  if (komut === "hafiza") {
    for (const satir of hafizaMetni(hafiza)) console.log(satir);
    return;
  }

  console.error("kullanım: ogret.ts gozden [--son=20] | liste [--son=20] | ogret <oturum/algı> <uyan|sus> | hafiza   [--kayit=klasör|dosya]");
  process.exit(2);
}

/**
 * Etkileşimli gözden geçirme. Girdi satır satır okunur: dosyadan ya da borudan
 * gelen cevaplar da çalışır, girdi bitince (EOF) çıkılır. Hafıza her dersten
 * sonra yeniden kurulur: sonraki kararın "şimdi"si o dersi de görür.
 */
async function gozdenGecir(yer: KayitYeri, satirlar: KararSatiri[], zincir: KararZinciri, son: number): Promise<void> {
  const liste = gozdenListesi(ogrenilebilirListe(zincir, kuralHafizasiKur(satirlar).hafiza, son));
  if (liste.length === 0) { console.log("gözden geçirilecek karar yok: son öğrenilebilir kararların hepsinin dersi var ya da kayıt boş"); return; }
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const satir = rl[Symbol.asyncIterator]();
  const yeni: KararSatiri[] = [];
  try {
    for (const [i, s] of liste.entries()) {
      const hafiza = kuralHafizasiKur([...satirlar, ...yeni]).hafiza;
      console.log("");
      for (const l of gozdenMetni({ ...s, simdi: simdiMetni(hafiza, s.algi.isaret!) }, i + 1, liste.length)) console.log(l);
      let cevap: GozdenCevabi | null = null;
      while (cevap === null) {
        process.stdout.write("  doğrusu? [u]yan · [s]us · [g]eç · [ç]ık: ");
        const r = await satir.next();
        cevap = r.done ? "cik" : cevapCoz(r.value);
      }
      if (cevap === "cik") break;
      if (cevap === "gec") continue;
      const d = dersVer(yer, [...satirlar, ...yeni], s.algi, cevap, Date.now());
      if ("hata" in d) { console.log(`  ${d.hata}`); continue; }
      yeni.push(d.satir);
      for (const l of d.metin) console.log(`  ${l}`);
    }
  } finally {
    rl.close();
  }
  console.log(`\n${yeni.length} ders verildi.${yeni.length ? " Orion açıksa dersler hemen uygulanır." : ""}`);
}

if (import.meta.main) await calistir();
