// mind/aniSuzgeci.ts — Uzun vadeli hafızaya NE yazılır (spec 16 F1). Saf.
//
// Bağlam küçük olmalı (yerel 7B model) ve hafızadan ne gelirse bağlama girer. Gereksiz anı iki kez
// zarar verir: getirmede gerçek anının yerini alır, budamada gerçek anıyı atar. Canlı hafıza
// (2026-10-08, 239 anı) bunu gösterdi:
//   - 60'ı (%25) "nobody has spoken for N minutes" inisiyatif dürtüsü — her N ayrı anı;
//   - `ozyn_yaklasti` gibi çıplak olay adları, tekrarla önem 10'a tırmanmış;
//   - terminal blokları kırpılmadan (24 satıra kadar), biri önem 10 ile dosya listesi;
//   - mikrofonun yanlış duyduğu cümleler ("Pendulum on a negative.") klavyedekiyle aynı önemde.
//
// KURALLAR
//   1. OLAY yazılmaz. Dünya olayları (`ozyn_*`) DURUMDUR: "Ozyn yaklaştı" bir sonraki dakika yanlış
//      olabilir (spec 06 K2: durum ≠ anı) — yeri durum defteri (spec 16 F2). İnisiyatif dürtüsü
//      kendi sessizliğimizin sayacı; hatırlanacak bir şey değil.
//   2. TERMINAL kırpılır: baş ve son satırlar kalır, arası "(… N satır …)" olur. Komut ve sonucu
//      (hata satırı çoğunlukla sondadır) korunur; kırpıldığı metinde yazılıdır, sessiz eksiltme yok.
//   3. MİKROFON sözü daha düşük önemle yazılır: tanıma yanlış olabilir (ölçüldü) ve güven skoru
//      yok. Doğru duyulan söz yine yazılır, yalnız klavyedekinin önüne geçmez.
// Algı yine bağlama (bu tur) ve sorguya girer; süzgeç yalnız KALICI hafızayı korur.
"use strict";
import type { Algi } from "../protocol/algi.ts";
import { kuralOnemi, type AniTuru } from "./hafiza.ts";
import { sadelestir } from "./hafizaYonlendirici.ts";
import { komutCoz } from "./komutSozlugu.ts";
import { takipEylemi } from "./takipSozu.ts";
import { sohbetEylemi } from "./sohbetKipi.ts";

/** Terminal anısında korunan satırlar. */
export const TERMINAL_BAS = 4;
export const TERMINAL_SON = 8;
/** Mikrofondan gelen sözün önemi (klavye: 8, `kuralOnemi`). */
export const MIKROFON_ONEMI = 6;

export interface AniKaydi { icerik: string; onem: number }

/**
 * SÖZ POLİTİKASI (Orion Beyin Ofisi T2-K7; canlı hafıza 2026-10-12: 228 sözün 101'i 1–2 kelime, 0 olgu):
 *   4. SELAM / SOHBET sözü ("merhaba orion", "nasılsın", "naber") uzun vadeli hafızaya YAZILMAZ: konuşma penceresinde ve
 *      karar kaydında yaşar; kimse "geçen hafta hangi selamları verdik" diye sormaz.
 *   5. DOĞUŞTAN KOMUT sözü (komut sözlüğü, takip, sohbet eylemi) YAZILIR ama düşük önemle (`KOMUT_ONEMI`): "dün ne
 *      konuştuk" onlardan cevaplanabilir, ama sıkıştırmada ve budamada İLK onlar gider (özete iner).
 *   6. HATA DERSİ normalleşir: "hata: bilinmeyen çapa/nesne: 'x'" gibi aynı dersin her örneği ayrı anı olmasın; ayrıntı
 *      (tırnak ve parantez içi) atılır, aynı metin tekrar gelince `Hafiza.ekle` onu TAZELER (tek ders).
 */
export const KOMUT_ONEMI = 3;

const SELAM_KELIMELERI: ReadonlySet<string> = new Set([
  "merhaba", "selam", "selamlar", "hey", "hi", "hello", "naber", "nbr", "nabr", "nasilsin", "nasilsiniz", "orion", "iyi",
  "gunler", "sabahlar", "aksamlar", "geceler", "how", "are", "you", "whats", "up", "good", "morning", "evening", "night",
  "gunaydin", "tesekkurler", "sagol", "tamam", "ok", "evet", "hayir",
]);

/** Söz yalnızca selam/sohbet mi (en çok 4 kelime, hepsi selam sözlüğünde). Tanınmayan kelime varsa HAYIR (yanlışlıkla silmek geri alınamaz). */
export function sohbetGurultusuMu(metin: string): boolean {
  const k = sadelestir(metin).replace(/[^\p{L}\p{N} ]+/gu, " ").split(/\s+/).filter(Boolean);
  return k.length > 0 && k.length <= 4 && k.every((w) => SELAM_KELIMELERI.has(w));
}

/** Hata dersini normalleştirir: tırnak ve parantez içi ayrıntı atılır. Hata olmayan metne dokunmaz. */
export function dersiNormallestir(metin: string): string {
  if (!/^hata\b/.test(metin)) return metin;
  return metin.replace(/\([^)]*\)/g, "").replace(/'[^']*'/g, "").replace(/"[^"]*"/g, "").replace(/\s+/g, " ").replace(/\s+([.;:,])/g, "$1").replace(/:([.;])/g, "$1").trim();
}

/** Uzun terminal çıktısını baş + son satırlara indirir; kırpıldığını metinde söyler. */
export function terminalKirp(metin: string, bas = TERMINAL_BAS, son = TERMINAL_SON): string {
  const satirlar = metin.split(/\r?\n/);
  if (satirlar.length <= bas + son + 1) return metin;
  const atlanan = satirlar.length - bas - son;
  return [...satirlar.slice(0, bas), `(… ${atlanan} satır …)`, ...satirlar.slice(-son)].join("\n");
}

/**
 * Algının kalıcı hafızaya yazılacak hâli; yazılmayacaksa `null`. `tur` ve `icerik` köprünün
 * `_aniIcerigi`nden gelir (sorgu da aynı içerikle kurulur — süzgeç onu değiştirmez).
 */
export function aniKaydi(a: Algi, tur: AniTuru, icerik: string, politika: "yeni" | "eski" = "yeni"): AniKaydi | null {
  if (a.tur === "olay") return null;
  if (politika === "yeni") {
    if (a.tur === "duydum" && sohbetGurultusuMu(a.metin)) return null;
    if (a.tur === "duydum" && (komutCoz(a.metin) || takipEylemi(a.metin) || sohbetEylemi(a.metin))) {
      return { icerik, onem: KOMUT_ONEMI };
    }
    if (a.tur === "sonuc") { const d = dersiNormallestir(icerik); return { icerik: d, onem: kuralOnemi(tur, d) }; }
  }
  if (a.tur === "terminal") {
    const kirpik = terminalKirp(icerik);
    return { icerik: kirpik, onem: kuralOnemi(tur, kirpik, a.kod) };
  }
  if (a.tur === "duydum" && a.kaynak === "mikrofon") return { icerik, onem: MIKROFON_ONEMI };
  return { icerik, onem: kuralOnemi(tur, icerik) };
}

/** Eski hafızada tekrarla şişmiş terminal anısının indiği tavan (gerçek hata: 7, `kuralOnemi`). */
export const TERMINAL_TAVANI = 7;

export interface TemizlikSonucu {
  aniler: unknown[];
  /** Atılan olay anısı (dünya olayı + inisiyatif dürtüsü). */
  atilan: number;
  /** Kırpılan terminal anısı. */
  kirpilan: number;
  /** Önemi tavana indirilen terminal anısı. */
  indirilen: number;
}

/**
 * Süzgeçten ÖNCE yazılmış hafızayı aynı kurallara getirir (spec 16 F1 göçü): olay anıları atılır,
 * terminal anıları kırpılır ve önemi tavana iner. Söz ve sonuç anılarına DOKUNULMAZ — eski bir
 * sözün klavyeden mi mikrofondan mı geldiği bilinmiyor; yanlışlıkla silmek geri alınamaz.
 * Tanınmayan kayıt olduğu gibi kalır (doğrulama `Hafiza.yukle`nin işi). Tekrar koşmak bir şey
 * değiştirmez (idempotent): ikinci açılışta sayılar sıfırdır.
 */
export function eskiHafizayiTemizle(aniler: readonly unknown[]): TemizlikSonucu {
  let atilan = 0, kirpilan = 0, indirilen = 0;
  const sonuc: unknown[] = [];
  for (const a of aniler) {
    const o = a as { tur?: unknown; metin?: unknown; onem?: unknown };
    if (o?.tur === "olay") { atilan++; continue; }
    if (o?.tur === "terminal" && typeof o.metin === "string") {
      const metin = terminalKirp(o.metin);
      const onem = typeof o.onem === "number" && o.onem > TERMINAL_TAVANI ? TERMINAL_TAVANI : o.onem;
      if (metin !== o.metin) kirpilan++;
      if (onem !== o.onem) indirilen++;
      sonuc.push(metin === o.metin && onem === o.onem ? a : { ...o, metin, onem });
      continue;
    }
    sonuc.push(a);
  }
  return { aniler: sonuc, atilan, kirpilan, indirilen };
}
