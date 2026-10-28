// uygulama/eklentiler/dusunmeKipi/dogrulayici.ts — "P ≠ NP" kipinin DOĞRULAYICISI (spec 40 §6): beynin ÖNERDİĞİ niyeti dünyaya gitmeden ucuz, kuralcı ve LLM'siz sınar. SAF.
//
// FİKİR (metafor, karmaşıklık iddiası değil): doğrulamak çözmekten ucuzdur. Beyin çözüm ADAYI üretir; bu dosya adayı sınar; reddedilirse sebep modele geri döner ve o
// kendini düzeltir (köprünün mevcut ret yolu, en çok 2 ardışık). Kurallar bilerek AZ ve ölçülebilir; faydası ölçülene dek varsayılan kip KAPALIDIR (spec 40 E5).
// Protokolün kendi doğrulaması (`protocol/dogrula.ts`: tür, alan, çapa adı) ÖNCE koşar; burada ONUN yakalamadığı üç şey var:
//   V1 tekrar-eylem  — aynı beden eylemi (git/bak/otur/kalk/odaklan/al/birak/poz/jest, aynı alanlarla) hemen önceki beden eylemiyle birebir ve yakın zamanda → ret (otur→kalk→otur tekrar sayılmaz).
//   V2 tekrar-söz    — aynı cümle son 3 sözden biriyle birebir ve yakın zamanda → ret (Orion kendini tekrar etmesin).
//   V3 komut-gerekçe — terminal önerisi (`komut`) anlamlı bir gerekçe taşımıyor (< 6 harf) → ret (Ozyn onaylarken ne için olduğunu okuyabilmeli).
// Ret metinleri İngilizce (modele giden çerçeve; spec 06 §6.8). Kabul edilen niyetler halkaya yazılır; ret yazılmaz.
"use strict";
import type { Niyet } from "../../../protocol/niyet.ts";
import type { KancaKarari } from "../../../bridge/kopruKancalari.ts";

export interface DogrulayiciAyari {
  /** Aynı beden eylemi bu süre içinde tekrar edilirse ret (ms). */
  eylemPenceresiMs?: number;
  /** Aynı söz bu süre içinde tekrar edilirse ret (ms). */
  sozPenceresiMs?: number;
}
export interface Dogrulayici {
  /** `yerler` verilirse tekrar retleri modele GEÇERLİ hedefleri de söyler (aynı hedefte ısrar etmesin). */
  dogrula(n: Niyet, simdi: number, yerler?: readonly string[]): KancaKarari;
  /** Halkayı boşalt (kip kapanıp açılınca eski kabuller sayılmasın). */
  sifirla(): void;
}

const GOVDE_TURLERI: ReadonlySet<string> = new Set(["git", "bak", "otur", "kalk", "odaklan", "al", "birak", "poz", "jest"]);
const EYLEM_HALKASI = 1, SOZ_HALKASI = 3, GEREKCE_ASGARI = 6;

/** Anahtar sırasından bağımsız kararlı metin. */
function kararli(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(kararli).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${kararli(o[k])}`).join(",")}}`;
}
/** Hedefli beden eylemlerinde (git/bak/odaklan) ret sonuna geçerli yerler eklenir (en çok 8); öteki eylem ya da yer listesi yoksa "". */
function gecerliHedefler(tur: string, yerler: readonly string[]): string {
  if (!yerler.length || (tur !== "git" && tur !== "bak" && tur !== "odaklan")) return "";
  return ` Valid targets: ${yerler.slice(0, 8).join(", ")}.`;
}
const soz = (m: string): string => m.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim().replace(/[.!?…]+$/g, "").trim();

export function dogrulayiciKur(ayar: DogrulayiciAyari = {}): Dogrulayici {
  const eylemMs = ayar.eylemPenceresiMs ?? 90_000, sozMs = ayar.sozPenceresiMs ?? 120_000;
  let eylemler: { k: string; an: number }[] = [];
  let sozler: { k: string; an: number }[] = [];
  const it = (liste: { k: string; an: number }[], k: string, an: number, azami: number): void => { liste.push({ k, an }); if (liste.length > azami) liste.shift(); };

  return {
    sifirla() { eylemler = []; sozler = []; },
    dogrula(n, simdi, yerler = []) {
      if (GOVDE_TURLERI.has(n.tur) && !(n.tur === "bak" && n.hedef === null)) {
        const k = kararli(n);
        if (eylemler.some((e) => e.k === k && simdi - e.an <= eylemMs)) return { ok: false, neden: `The same action (${n.tur}) just ran. If it did not work, pick a different action or tell Ozyn why; do not repeat it.${gecerliHedefler(n.tur, yerler)}` };
        it(eylemler, k, simdi, EYLEM_HALKASI);
        return { ok: true };
      }
      if (n.tur === "soyle") {
        const k = soz(n.metin);
        if (k && sozler.some((e) => e.k === k && simdi - e.an <= sozMs)) return { ok: false, neden: "You already said exactly that a moment ago. Say something new or stay quiet." };
        if (k) it(sozler, k, simdi, SOZ_HALKASI);
        return { ok: true };
      }
      if (n.tur === "komut" && n.gerekce.trim().length < GEREKCE_ASGARI) return { ok: false, neden: "Give the terminal command a concrete reason Ozyn can read before approving it." };
      return { ok: true };
    },
  };
}
