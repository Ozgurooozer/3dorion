// tools/karar-ozet.ts — Karar kaydının özeti: bugünkü kapının TABAN ÇİZGİSİ (spec 08).
//
// Soru: Orion'un elle yazılmış kapısı (içgüdüler) LLM'i ne sıklıkla, neyle
// uyandırıyor ve uyandırdığında LLM bir şey yapıyor mu? Öğrenen kapı (KT2)
// ancak bu sayılara karşı ölçülebilir; ölçmeden "daha iyi" denemez.
//
// Kullanım:
//   node --experimental-strip-types tools/karar-ozet.ts [dosya|klasör …] [--json]
// Argüman yoksa gerçek kullanımın kaydı okunur: %APPDATA%/3dorion/karar-kaydi.
//
// Bağ kurma mind/kararZinciri.ts'te — öğrenen kapı da aynı bağı kullanır.
"use strict";
import fs from "node:fs";
import path from "node:path";
import { kayitOku, uyanisEyleme, zincirKur, type KararZinciri } from "../mind/kararZinciri.ts";
import type { KararSatiri } from "../mind/kararKaydi.ts";

export interface KuralSatiri { kural: string; adet: number; gecti: number }
export interface TetikSatiri { kural: string; uyanis: number; eylem: number }

export interface KararOzeti {
  oturum: number;
  algi: number;
  uyanis: number;
  bozuk: number;
  /** Algı türü → [toplam, geçen]. */
  turler: Record<string, { toplam: number; gecti: number }>;
  /** Kapı kararlarını veren içgüdüler, çoktan aza. */
  kurallar: KuralSatiri[];
  eylemliUyanis: number;
  hataliUyanis: number;
  reddedilenCagri: number;
  kurtarilanCagri: number;
  /** Beyin süresi (ms): ortanca ve %90'lık. Uyanış yoksa null. */
  sureOrtanca: number | null;
  sure90: number | null;
  koken: Record<string, number>;
  takip: number;
  anili: number;
  /**
   * Uyanışı tetikleyen içgüdüye göre: kaç uyanış, kaçı eylemle bitti.
   * Bir uyanışı birden çok algı tetikleyebilir; her tetikleyicinin kuralı ayrı sayılır.
   */
  tetikleyenler: TetikSatiri[];
  niyetTurleri: Record<string, number>;
  /** Niyetlerin akıbeti: bitti / hata / iptal / yok (sonuç gelmedi). */
  akibet: Record<string, number>;
  /** Komut önerileri: onaylandı (bitti) / reddedildi (hata) / düştü (iptal) / yok. */
  onay: Record<string, number>;
  /** Eylemli uyanışların kaçından sonra Ozyn pencere içinde konuştu. */
  tepkili: number;
  /** Refleks turları (spec 10, Faz D: LLM'e sormadan yürütülen söz), bitişe göre. */
  refleks: Record<string, number>;
}

/** En yakın sıra yöntemiyle yüzdelik: sıralı dizinin ⌈p·n⌉'inci elemanı. */
function yuzdelik(sirali: number[], p: number): number | null {
  if (sirali.length === 0) return null;
  return sirali[Math.max(0, Math.ceil(p * sirali.length) - 1)]!;
}

/** Zincirden taban çizgisi sayılarını çıkarır. Saf. */
export function ozetCikar(z: KararZinciri): KararOzeti {
  const turler: KararOzeti["turler"] = {};
  const kuralHaritasi = new Map<string, KuralSatiri>();
  for (const a of z.algilar) {
    const t = (turler[a.algi] ??= { toplam: 0, gecti: 0 });
    t.toplam++;
    if (a.kapi.gecti) t.gecti++;
    const k = kuralHaritasi.get(a.kapi.kural) ?? { kural: a.kapi.kural, adet: 0, gecti: 0 };
    k.adet++;
    if (a.kapi.gecti) k.gecti++;
    kuralHaritasi.set(a.kapi.kural, k);
  }

  const sureler = z.uyanislar.map((u) => u.uyanis.sureMs).sort((x, y) => x - y);
  const koken: Record<string, number> = {};
  const tetik = new Map<string, TetikSatiri>();
  const niyetTurleri: Record<string, number> = {};
  const akibet: Record<string, number> = {};
  const onay: Record<string, number> = {};
  let eylemli = 0, hatali = 0, reddedilen = 0, kurtarilan = 0, takip = 0, anili = 0, tepkili = 0;

  for (const zu of z.uyanislar) {
    const u = zu.uyanis;
    const eylem = uyanisEyleme(u);
    if (eylem) eylemli++;
    if (u.hata) hatali++;
    reddedilen += u.reddedilen;
    kurtarilan += u.kurtarilan;
    koken[u.koken] = (koken[u.koken] ?? 0) + 1;
    if (u.takip) takip++;
    if (u.anilar > 0) anili++;
    if (eylem && zu.tepki) tepkili++;
    for (const kural of new Set(zu.tetikleyenler.map((a) => a.kapi.kural))) {
      const s = tetik.get(kural) ?? { kural, uyanis: 0, eylem: 0 };
      s.uyanis++;
      if (eylem) s.eylem++;
      tetik.set(kural, s);
    }
    for (const n of zu.niyetler) {
      niyetTurleri[n.tur] = (niyetTurleri[n.tur] ?? 0) + 1;
      const d = n.durum ?? "yok";
      akibet[d] = (akibet[d] ?? 0) + 1;
      if (n.tur === "komut") {
        const o = n.durum === "bitti" ? "onaylandi" : n.durum === "hata" ? "reddedildi" : n.durum === "iptal" ? "dustu" : "yok";
        onay[o] = (onay[o] ?? 0) + 1;
      }
    }
  }

  return {
    oturum: z.oturumlar.length, algi: z.algilar.length, uyanis: z.uyanislar.length, bozuk: z.bozuk,
    turler,
    kurallar: [...kuralHaritasi.values()].sort((a, b) => b.adet - a.adet || a.kural.localeCompare(b.kural)),
    eylemliUyanis: eylemli, hataliUyanis: hatali, reddedilenCagri: reddedilen, kurtarilanCagri: kurtarilan,
    sureOrtanca: yuzdelik(sureler, 0.5), sure90: yuzdelik(sureler, 0.9),
    koken, takip, anili,
    tetikleyenler: [...tetik.values()].sort((a, b) => b.uyanis - a.uyanis || a.kural.localeCompare(b.kural)),
    niyetTurleri, akibet, onay, tepkili,
    refleks: sayim(z.refleksler.map((r) => r.refleks.bitis)),
  };
}

/** Değerleri sayar: ["a", "b", "a"] → { a: 2, b: 1 }. */
function sayim(degerler: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of degerler) out[d] = (out[d] ?? 0) + 1;
  return out;
}

/** Dosya ya da klasör listesinden tüm .jsonl satırlarını okur. */
export function dosyalardanOku(yollar: string[]): { satirlar: KararSatiri[]; bozuk: number; dosyalar: string[] } {
  const dosyalar: string[] = [];
  for (const y of yollar) {
    if (!fs.existsSync(y)) continue;
    if (fs.statSync(y).isDirectory()) {
      for (const f of fs.readdirSync(y).filter((f) => f.endsWith(".jsonl")).sort()) dosyalar.push(path.join(y, f));
    } else dosyalar.push(y);
  }
  const satirlar: KararSatiri[] = [];
  let bozuk = 0;
  for (const f of dosyalar) {
    const r = kayitOku(fs.readFileSync(f, "utf8"));
    satirlar.push(...r.satirlar);
    bozuk += r.bozuk;
  }
  return { satirlar, bozuk, dosyalar };
}

const yuzde = (pay: number, payda: number) => (payda === 0 ? "—" : `%${Math.round((100 * pay) / payda)}`);

function yazdir(o: KararOzeti, dosyalar: string[]): void {
  const p = (s = "") => console.log(s);
  p(`Karar kaydı özeti — ${dosyalar.length} dosya, ${o.oturum} oturum, ${o.algi} algı, ${o.uyanis} uyanış${o.bozuk ? `, ${o.bozuk} bozuk satır` : ""}`);
  p();
  p("KAPI — algı türüne göre");
  p("| tür | toplam | geçti | oran |");
  p("|---|---:|---:|---:|");
  for (const [t, s] of Object.entries(o.turler).sort((a, b) => b[1].toplam - a[1].toplam)) p(`| ${t} | ${s.toplam} | ${s.gecti} | ${yuzde(s.gecti, s.toplam)} |`);
  p();
  p("KAPI — kararı veren içgüdü");
  p("| içgüdü | adet | geçirdi |");
  p("|---|---:|---:|");
  for (const k of o.kurallar) p(`| ${k.kural} | ${k.adet} | ${k.gecti} |`);
  p();
  p("UYANIŞ");
  p(`- eylemle biten: ${o.eylemliUyanis}/${o.uyanis} (${yuzde(o.eylemliUyanis, o.uyanis)}); boşa: ${o.uyanis - o.eylemliUyanis}`);
  p(`- beyin süresi: ortanca ${o.sureOrtanca ?? "—"} ms, %90 ${o.sure90 ?? "—"} ms`);
  p(`- köken: ${Object.entries(o.koken).map(([k, n]) => `${k} ${n}`).join(", ") || "—"}; takip turu ${o.takip}; anı getirilen ${o.anili}`);
  p(`- hata ${o.hataliUyanis}; reddedilen çağrı ${o.reddedilenCagri}; metinden kurtarılan ${o.kurtarilanCagri}`);
  p();
  p("UYANIŞ — tetikleyen içgüdüye göre (boşa uyanışın kaynağı)");
  p("| tetikleyen içgüdü | uyanış | eylemle biten | oran |");
  p("|---|---:|---:|---:|");
  for (const t of o.tetikleyenler) p(`| ${t.kural} | ${t.uyanis} | ${t.eylem} | ${yuzde(t.eylem, t.uyanis)} |`);
  p();
  p(`NİYET: ${Object.entries(o.niyetTurleri).map(([k, n]) => `${k} ${n}`).join(", ") || "—"}`);
  p(`AKIBET: ${Object.entries(o.akibet).map(([k, n]) => `${k} ${n}`).join(", ") || "—"}`);
  p(`ONAY (komut önerisi): ${Object.entries(o.onay).map(([k, n]) => `${k} ${n}`).join(", ") || "—"}`);
  p(`TEPKİ: eylemli uyanıştan sonra Ozyn konuştu ${o.tepkili}/${o.eylemliUyanis}`);
  p(`REFLEKS (LLM'siz yürütülen söz, spec 10): ${Object.entries(o.refleks).map(([k, n]) => `${k} ${n}`).join(", ") || "—"}`);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const yollar = argv.filter((a) => a !== "--json");
  const varsayilan = path.join(process.env.APPDATA ?? "", "3dorion", "karar-kaydi");
  const { satirlar, bozuk, dosyalar } = dosyalardanOku(yollar.length ? yollar : [varsayilan]);
  if (dosyalar.length === 0) {
    console.error(`kayıt dosyası yok: ${(yollar.length ? yollar : [varsayilan]).join(", ")}`);
    process.exit(1);
  }
  const ozet = ozetCikar(zincirKur(satirlar, bozuk));
  if (json) console.log(JSON.stringify(ozet, null, 2));
  else yazdir(ozet, dosyalar);
}
