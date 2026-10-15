// mind/aniYardimcilari.ts — Hafıza yazma kurallarının SAF yardımcıları ve sayı sabitleri (yaprak dosya: hiçbir kural dosyasını import etmez).
//
// `aniSuzgeci.ts` (eski göç) ve `hafizaKurallari.ts` (kural tablosu, Markov biçimi) ikisi de bunları kullanır; ayrı dosyada olmaları
// döngüsel importu önler. Karar mantığı (hangi kayıt yazılır, önemi kaç) TABLODA (`hafizaKurallari.ts`), burada yalnız araçlar.
"use strict";
import { sadelestir } from "./hafizaYonlendirici.ts";

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
