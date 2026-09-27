// tools/ogret.ts — ÖĞRET: Ozyn, Orion'un kapı kararlarını terminalden düzeltir.
//
// Toplantı 2026-09-27 K1: öğretmen Ozyn; ilk kanal bu araç, sonra zihin duvarı
// paneli (ikisi aynı öğretim satırını yazar). K5: kural hafızası kayıttaki öğretim
// satırlarından yeniden kurulur — bu araç da hafızayı öyle kurar ve gösterir.
//
// Kullanım (kayıt varsayılan olarak %APPDATA%/3dorion/karar-kaydi):
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
      const k = hafiza.karar(a.isaret!);
      return {
        anahtar, algi: a,
        sonra: a.kapi.gecti ? (uyanisi.get(anahtar) ?? "uyanış kaydı yok") : null,
        ders: dersler.get(anahtar) ?? null,
        golge: golgeMetni(a.golge),
        simdi: k ? `${k.yon} (${k.noron.id})` : "—",
      };
    });
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

const tek = (s: string, n: number) => s.replace(/\s+/g, " ").slice(0, n);
const saat = (t: number) => new Date(t).toLocaleTimeString("tr-TR");

function calistir(): void {
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
    const s = ogretimKur(a, yon, "ogret-araci", Date.now());
    if ("hata" in s) { console.error(s.hata); process.exit(1); }
    ogretimYaz(yer.ogretimDosyasi, s);
    const yeni = kuralHafizasiKur([...satirlar, s]).hafiza;
    const k = yeni.karar(s.isaret);
    console.log(`ders yazıldı: ${anahtar} → ${yon}  (${yer.ogretimDosyasi})`);
    console.log(`  algı: ${tek(a.ozet, 100)}`);
    console.log(k ? `  hafıza artık: ${k.yon} — ${k.noron.id}: ${k.noron.kosul.join(" ∧ ")}` : "  hafıza bu durumda henüz emin değil (çelişen dersler)");
    return;
  }

  if (komut === "hafiza") {
    for (const satir of hafizaMetni(hafiza)) console.log(satir);
    return;
  }

  console.error("kullanım: ogret.ts liste [--son=20] | ogret <oturum/algı> <uyan|sus> | hafiza   [--kayit=klasör|dosya]");
  process.exit(2);
}

if (import.meta.main) calistir();
