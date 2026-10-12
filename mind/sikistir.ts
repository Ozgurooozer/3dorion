// mind/sikistir.ts — Hafıza SIKIŞTIRMA: ham anıları olgulara + kısa özete çevirir (spec 26 F3-C; `/compact`).
//
// NEDEN: kalıcı hafızada 273 anının 228'i ham cümleydi (nasılsın, aynı hata…). Getirme yöntemi sorun değildi, SAKLANAN
// şey çöptü (spec 26 §7). Sıkıştırma eski ham kayıtları LLM'e bir kez özettirir: kalıcı bilgi `olgu` olur (aynı anahtar
// eskiyi günceller), geri kalanı tek bir özet anısına iner, ham kayıtlar silinir.
//
// GÜVENLİK İLKELERİ (her biri testli):
//   • Model cevabı çözülemezse, boşsa ya da ne olgu ne özet içeriyorsa HİÇBİR ŞEY silinmez.
//   • `olgu` anılarına ve en yeni `KORU` kayda dokunulmaz; son `TAZE_MS` içindeki kayıt sıkışmaz.
//   • Silmeden önce kopya (yedek) alınır — uygulama katmanı (köprü) yapar; burada saf plan var.
//
// SAF: ağ yok, zaman dışarıdan. Model çağrısı köprüdedir.
"use strict";
import type { Ani } from "./hafiza.ts";
import { sadelestir } from "./hafizaYonlendirici.ts";

/** Ozyn'in "şimdi sıkıştır" demesi: TAM eşleşme, LLM uyanmaz (sohbetKipi ile aynı ilke). */
export const SIKISTIR_IFADELERI: readonly string[] = ["compact", "compact memory", "sikistir", "hafizayi sikistir", "hafizani sikistir", "hafizayi topla"];

const normal = (m: string) => sadelestir(m).replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
export const sikistirmaIstegi = (metin: string): boolean => SIKISTIR_IFADELERI.includes(normal(metin));

/** Orion'un sabit cümleleri (model uyanmaz). */
export const SIKISTIR_SOZLERI = {
  yok: "Sıkıştıracak kadar ham kayıt yok; hafızam zaten derli toplu.",
  basarisiz: "Hafızayı sıkıştıramadım; hiçbir kaydı silmedim.",
  tamam: (silinen: number, olgu: number) => `Hafızamı topladım: ${silinen} ham kayıt ${olgu ? `${olgu} olguya ve ` : ""}kısa bir özete indi.`,
} as const;

export const KORU = 30;                 // en yeni bu kadar ham kayda dokunulmaz
export const TAZE_MS = 3600_000;        // son 1 saatteki kayıt sıkışmaz
export const EN_AZ_PLAN = 25;           // bundan azı için model çağrılmaz
export const OTO_ESIK = 100;            // otomatik: ham kayıt sayısı bunu aşınca
export const OTO_ARALIK_MS = 15 * 60_000; // otomatik: iki sıkıştırma arası en az
export const PLAN_AZAMI = 80;           // tek çağrıda modele giden en çok kayıt
const OLGU_AZAMI_SAYI = 8;
const OZET_AZAMI = 400;

const HAM_TURLER: ReadonlySet<string> = new Set(["konusma", "olay", "terminal", "sonuc", "dusunce"]);
export const hamMi = (a: Pick<Ani, "tur">): boolean => HAM_TURLER.has(a.tur);

/** Sıkışacak kayıtlar: ham olanlar, en yeni KORU ve son TAZE_MS hariç, en eskiden PLAN_AZAMI tane. */
export function sikistirmaPlani(aniler: readonly Ani[], simdi: number): Ani[] {
  const ham = aniler.filter(hamMi).sort((a, b) => a.olusma - b.olusma);
  const adaylar = ham.slice(0, Math.max(0, ham.length - KORU)).filter((a) => simdi - a.olusma >= TAZE_MS);
  return adaylar.slice(0, PLAN_AZAMI);
}

/** Otomatik tetik: ham kayıt eşiği aşıldı ve son sıkıştırmadan yeterince zaman geçti. */
export function otoSikistirmaGerekli(aniler: readonly Ani[], sonSikistirma: number, simdi: number): boolean {
  if (simdi - sonSikistirma < OTO_ARALIK_MS) return false;
  return aniler.filter(hamMi).length > OTO_ESIK && sikistirmaPlani(aniler, simdi).length >= EN_AZ_PLAN;
}

export const SIKISTIR_TALIMATI = [
  "You compact the memory of Orion, an assistant living in Ozyn's 3D room.",
  "Input: numbered raw memory lines (Ozyn's words, terminal results, errors). Output ONLY lines in this exact format:",
  "FACT <key>: <value>   — a lasting fact about Ozyn or the world (key: lowercase_snake_case ≤ 40 chars; value ≤ 160 chars, English).",
  "SUMMARY: <≤ 350 chars, English, what happened overall and what is still open>",
  "Rules: at most 8 FACT lines, exactly one SUMMARY line. Skip greetings, repeats and one-off errors. Never invent: use only what the lines say.",
  "Existing facts are listed; reuse their key if a line updates them. No other text.",
].join("\n");

/** Modele giden kullanıcı metni: mevcut olgular + numaralı ham kayıtlar. */
export function sikistirmaSorusu(plan: readonly Ani[], mevcutOlgular: readonly { anahtar: string; metin: string }[]): string {
  const olgu = mevcutOlgular.length ? mevcutOlgular.map((o) => `- ${o.anahtar}: ${o.metin}`).join("\n") : "(none)";
  const satirlar = plan.map((a, i) => `${i + 1}. [${a.tur}] ${a.metin.replace(/\s+/g, " ").slice(0, 200)}`).join("\n");
  return `Existing facts:\n${olgu}\n\nRaw memory lines:\n${satirlar}`;
}

export interface SikistirmaSonucu { olgular: { anahtar: string; deger: string }[]; ozet: string }

/** Model cevabını çözer. Geçersiz satırlar sessizce atılmaz: sayılır (`atilan`). Hiç geçerli içerik yoksa null. */
export function sikistirmaCoz(ham: string): (SikistirmaSonucu & { atilan: number }) | null {
  const olgular: SikistirmaSonucu["olgular"] = [];
  let ozet = "", atilan = 0;
  for (const satir of ham.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
    const f = satir.match(/^FACT\s+([a-z0-9_]{1,40})\s*:\s*(.+)$/i);
    const s = satir.match(/^SUMMARY\s*:\s*(.+)$/i);
    if (f) {
      if (olgular.length >= OLGU_AZAMI_SAYI) { atilan++; continue; }
      olgular.push({ anahtar: f[1]!.toLowerCase(), deger: f[2]!.trim().slice(0, 160) });
    } else if (s && !ozet) ozet = s[1]!.trim().slice(0, OZET_AZAMI);
    else atilan++;
  }
  if (!olgular.length && !ozet) return null;
  return { olgular, ozet, atilan };
}
