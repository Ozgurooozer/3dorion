// mind/mercekSuzgec.ts — SÜZGEÇ MERCEĞİ: algıyı Orion'un kendi beklentisiyle okur (spec 12 Faz 4–5,
// spec 13 Faz 6).
//
// İki bugünkü boşluk (spec 12 §2):
//   B1 — Orion önerdiği ve Ozyn'in onayladığı komutun SONUCUNU görmüyor: başarılı çıktı
//        `refleks.terminal.kod_rutin` ile süzülüyor (ortak test 3'te canlı görüldü: `ls`).
//   B8 — Kendi yürüyüşü "Ozyn yaklaştı" diye geliyor ve beyni uyandırıyor.
// Efferans kopyası (spec 12 §3.1): kendi eyleminin sonucu "beklenen" diye işaretlenir.
//   - BEKLENEN CEVAP: onaylanmış komutun sonucu bekleniyorken gelen terminal bloğu → geçir.
//   - YAN ÜRÜN: Orion yürürken gelen yaklaştı/uzaklaştı (fail = ben) → süz.
//
// Mercek SAF bir öneridir; köprü onu önce GÖLGEDE yazar (kayıtta `mercek` alanı), yetki
// anahtarı (`benlikSuzgecYetkisi`, varsayılan KAPALI) açıkken uygular. Yetki yalnız
// EZİLEBİLİR bir içerik kuralının kararını değiştirir; dikkat (maliyet tavanı) her
// zaman sonra gelir ve mercek onu genişletemez (spec 12 §4.6 sabit teller).
//
// Saf.
"use strict";
import type { Algi } from "../protocol/algi.ts";
import { eden, type BenlikGoruntusu } from "./benlik.ts";
import { terminalAyristir } from "./durumKodu.ts";

export type MercekKurali = "benlik.beklenen_cevap" | "benlik.yan_urun";
export interface MercekOnerisi { oneri: "gecir" | "suz"; kural: MercekKurali; gerekce: string }

/** Algıyı benlikle okur. Söyleyecek bir şeyi yoksa null (bugünkü karar geçerli). */
export function suzgecMercegi(a: Algi, b: BenlikGoruntusu): MercekOnerisi | null {
  if (a.tur === "terminal" && b.bekliyorum?.ne === "komut_sonucu") {
    const beklenen = /`(.*)`/.exec(b.bekliyorum.ozet)?.[1]?.trim();
    const komut = terminalAyristir(a.kuyruk).komut?.trim();
    // Komut satırı okunabiliyorsa EŞLEŞMELİ (spec 12 §7: Ozyn aynı anda başka komut yazabilir).
    if (komut && beklenen && komut !== beklenen) return null;
    return { oneri: "gecir", kural: "benlik.beklenen_cevap", gerekce: `önerdiğim ${b.bekliyorum.ozet} sonucu` };
  }
  if (a.tur === "olay" && (a.ad === "ozyn_yaklasti" || a.ad === "ozyn_uzaklasti") && eden(a, b) === "ben") {
    return { oneri: "suz", kural: "benlik.yan_urun", gerekce: "kendi yürüyüşümün yan ürünü" };
  }
  return null;
}
