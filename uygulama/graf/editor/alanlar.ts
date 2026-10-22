// uygulama/graf/editor/alanlar.ts — DÜĞÜM AYAR ALANLARI (spec 35 dilim 2b): hangi ayar hangi girdiyle düzenlenir ve yazılan metin hangi değere döner. SAF.
//
// İki yerde kullanılır, tek kuraldan: düğümün içindeki SATIR İÇİ değer alanı (bağlı olmayan veri girişinin yanında) ve sağdaki Ayrıntılar paneli.
//   • Alan listesi = düğüm türünün ayar tanımları (`AyarTanimi`: tür, aralık, seçenekler) + ayar tanımı OLMAYAN bağsız veri girişleri (Söyle'nin
//     `metin`i: yorumlayıcı bağsız girişi aynı adlı ayardan okur, tanımı olmasa da). Pin türü sayı/metin/bool/herhangi ise alan olur; nesne/ajan/konum
//     bağ ister (yazıyla girilmez).
//   • Seçenekler ÇALIŞMA ANINDA (`secenekleriCoz`): "Ajan seç"in listesi ajan defteridir, Flash sonradan gelir.
//   • Sayı ayrıştırma `Number`'dır, ASLA eval değil (LiteGraph'ın sayı alanı ifadeyi eval ediyordu, spec 35 §5): "1+1" HATADIR. Türkçe ondalık virgül
//     kabul edilir ("2,5" → 2.5). Aralık dışı ve seçenek dışı değer YAZILMAZ, nedeni döner (alan eski değerine döner).
//   • Boş metin AYARI SİLER (bağsız giriş varsayılana ya da denetimin "ayarı yok" hatasına döner) — seçenekli alanda boş bir seçenekse ("tür: hepsi") değerdir.
"use strict";
import { GRAF_SINIRLARI, type GrafDegeri, type PinTanimi } from "../../../protocol/graf.ts";
import type { Sonuc } from "../../../protocol/dogrula.ts";
import { secenekleriCoz, type DugumPinleri, type DugumTanimi, type PinOrtami } from "../dugumKaydi.ts";
import { sayiMetniCoz } from "../../duzenleyici/sayiAlani.ts";

export interface AlanTanimi {
  ad: string;
  tip: "sayi" | "metin" | "bool";
  secenekler: readonly string[] | null;
  en?: number;
  cok?: number;
  varsayilan?: GrafDegeri;
  aciklama?: string;
  /** Ayar tanımından mı, yoksa tanımsız bir veri girişinden mi türedi. */
  kaynak: "ayar" | "pin";
}

/** Yazıyla girilebilen pin türleri ve alanları (`herhangi` metin olarak yazılır: Söyle'nin metni). Listede olmayan tür bağ ister. */
const PIN_ALAN_TIPI: Readonly<Partial<Record<PinTanimi["tip"], AlanTanimi["tip"]>>> = { sayi: "sayi", metin: "metin", bool: "bool", herhangi: "metin" };
const pinAlanTipi = (p: PinTanimi): AlanTanimi["tip"] | null => PIN_ALAN_TIPI[p.tip] ?? null;

/** Düğümün düzenlenebilir alanları: önce ayar tanımları (sırasıyla), sonra tanımsız veri girişleri. */
export function dugumAlanlari(t: DugumTanimi<unknown>, pinler: DugumPinleri | null, ortam: PinOrtami): AlanTanimi[] {
  const l: AlanTanimi[] = (t.ayarlar ?? []).map((a) => ({
    ad: a.ad, tip: a.tip, secenekler: secenekleriCoz(a, ortam),
    ...(a.en !== undefined ? { en: a.en } : {}), ...(a.cok !== undefined ? { cok: a.cok } : {}),
    ...(a.varsayilan !== undefined ? { varsayilan: a.varsayilan } : {}), ...(a.aciklama ? { aciklama: a.aciklama } : {}),
    kaynak: "ayar" as const,
  }));
  for (const p of pinler?.girisler ?? []) {
    if (l.some((x) => x.ad === p.ad)) continue;
    const tip = pinAlanTipi(p);
    if (tip) l.push({ ad: p.ad, tip, secenekler: null, aciklama: `'${p.ad}' girişinin değeri (bağ yoksa)`, kaynak: "pin" });
  }
  return l;
}

/** Bir giriş pininin satır içi alanı (yoksa null: bağ ister). */
export const pinAlani = (alanlar: readonly AlanTanimi[], pin: string): AlanTanimi | null => alanlar.find((a) => a.ad === pin) ?? null;

/**
 * Yazılanı değere çevirir. `undefined` = ayarı sil. Hata = YAZILMAZ (neden döner). Bool alan onay kutusundan `boolean` alır.
 */
export function alanDegeriCoz(a: AlanTanimi, ham: string | boolean): Sonuc<GrafDegeri | undefined> {
  if (a.tip === "bool") {
    if (typeof ham === "boolean") return { ok: true, deger: ham };
    if (ham === "true" || ham === "false") return { ok: true, deger: ham === "true" };
    return { ok: false, hata: `${a.ad}: doğru/yanlış olmalı` };
  }
  const s = String(ham);
  // Sayı kuralı (eval yok, virgül, aralık) sekans editörüyle ORTAK: `uygulama/duzenleyici/sayiAlani.ts`.
  if (a.tip === "sayi") return sayiMetniCoz(a.ad, s, { ...(a.en !== undefined ? { en: a.en } : {}), ...(a.cok !== undefined ? { cok: a.cok } : {}) });
  if (a.secenekler) {
    if (!a.secenekler.includes(s)) return { ok: false, hata: `${a.ad}: '${s}' geçersiz (seçenekler: ${a.secenekler.map((x) => x || "(boş)").join(", ") || "yok"})` };
    return { ok: true, deger: s };
  }
  if (s === "") return { ok: true, deger: undefined };
  if (s.length > GRAF_SINIRLARI.metin) return { ok: false, hata: `${a.ad}: çok uzun (en çok ${GRAF_SINIRLARI.metin} karakter)` };
  return { ok: true, deger: s };
}

/** Alanda gösterilecek metin (sayı JSON gibi, null/yok boş). */
export const alanYazisi = (v: GrafDegeri | undefined): string => (v === undefined || v === null ? "" : typeof v === "string" ? v : String(v));
