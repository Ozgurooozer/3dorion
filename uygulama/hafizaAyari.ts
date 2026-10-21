// uygulama/hafizaAyari.ts — BAĞLAMI ŞİŞİRMEME AYARLARININ KALICILIĞI (Ozyn, 2026-10-21: "otomatik compact sınırı koy ve ayarlanabilir olsun").
//
// Dört ayar var (otomatik sıkıştırma eşiği ve aralığı, md notları toplam/tek-not bütçesi); değerleri devre panosunun telleridir (`uygulama/devrePanosu.ts`
// PANO_TELLERI.hafiza) ve duvardan/Zihin sekmesinden (HAFIZA düğümü) değişir. Teller bellekte yaşar; burası onları tarayıcı deposuna (localStorage) yazar ve
// açılışta geri okur ki her açılışta varsayılana dönmesin. Aralıklar tek kaynaktan (`mind/sikistir.ts`, `mind/mdBaglami.ts`: pano düğmesiyle AYNI sabit).
//
// Kayıt bozuksa/aralık dışıysa o ayar ATLANIR ve söylenir (sessiz yutma yok); varsayılan kalır. Yazma hatası (kota) ayarı bozmaz, uyarı basılır.
"use strict";
import type { Tel } from "../protocol/pano.ts";
import { OTO_ARALIK_DK_ARALIGI, OTO_ESIK_ARALIGI } from "../mind/sikistir.ts";
import { MD_DOSYA_ARALIGI, MD_TOPLAM_ARALIGI } from "../mind/mdBaglami.ts";
import type { Depo } from "./yerlestirmeKaydi.ts";

export const HAFIZA_AYAR_ANAHTARI = "orion.hafizaAyari.v1";

export interface HafizaAyarTelleri {
  otoEsik: Tel<number>;
  otoAralikDk: Tel<number>;
  mdToplam: Tel<number>;
  mdDosya: Tel<number>;
}
type Anahtar = keyof HafizaAyarTelleri;
const ANAHTARLAR: readonly Anahtar[] = ["otoEsik", "otoAralikDk", "mdToplam", "mdDosya"];
const ARALIK: Readonly<Record<Anahtar, { readonly en: number; readonly cok: number }>> = {
  otoEsik: OTO_ESIK_ARALIGI, otoAralikDk: OTO_ARALIK_DK_ARALIGI, mdToplam: MD_TOPLAM_ARALIGI, mdDosya: MD_DOSYA_ARALIGI,
};

export interface YuklemeRaporu {
  /** Kayıttan telle uygulanan ayarlar. */
  uygulanan: Anahtar[];
  /** Atlanan ayarlar ve nedeni (bozuk kayıt, aralık dışı, sayı değil). */
  atlanan: { ayar: Anahtar | "kayit"; neden: string }[];
}

/** Kayıttaki ayarları telle yazar. Depo yoksa ya da kayıt yoksa hiçbir şey olmaz (rapor boş). Fırlatmaz. */
export function hafizaAyariniYukle(depo: Depo | null, teller: HafizaAyarTelleri): YuklemeRaporu {
  const rapor: YuklemeRaporu = { uygulanan: [], atlanan: [] };
  let ham: string | null;
  try { ham = depo?.getItem(HAFIZA_AYAR_ANAHTARI) ?? null; } catch (err) { rapor.atlanan.push({ ayar: "kayit", neden: `depo okunamadı: ${err instanceof Error ? err.message : String(err)}` }); return rapor; }
  if (ham === null) return rapor;
  let v: unknown;
  try { v = JSON.parse(ham); } catch { rapor.atlanan.push({ ayar: "kayit", neden: "kayıt JSON değil" }); return rapor; }
  if (typeof v !== "object" || v === null || Array.isArray(v)) { rapor.atlanan.push({ ayar: "kayit", neden: "kayıt nesne değil" }); return rapor; }
  const kayit = v as Record<string, unknown>;
  for (const a of ANAHTARLAR) {
    if (!(a in kayit)) continue;
    const d = kayit[a];
    const { en, cok } = ARALIK[a];
    if (typeof d !== "number" || !Number.isInteger(d)) { rapor.atlanan.push({ ayar: a, neden: "tam sayı değil" }); continue; }
    if (d < en || d > cok) { rapor.atlanan.push({ ayar: a, neden: `aralık dışı (${en}–${cok})` }); continue; }
    teller[a].yaz(d);
    rapor.uygulanan.push(a);
  }
  return rapor;
}

/**
 * Tellerin `yaz`ı sarılır: her değişiklikte dört ayarın GÜNCEL değeri depoya yazılır. Yükleme bundan ÖNCE yapılmalı (yoksa açılıştaki ilk yazma kaydı
 * varsayılanla ezerdi). Yazma hatası fırlamaz (ayar bellekte yine değişir), `uyari` ile söylenir.
 */
export function hafizaAyariniKaliciYap(depo: Depo | null, teller: HafizaAyarTelleri, uyari: (m: string) => void = (m) => console.warn(m)): void {
  if (!depo) return;
  for (const a of ANAHTARLAR) {
    const tel = teller[a];
    const asil = tel.yaz.bind(tel);
    tel.yaz = (deger: number) => {
      asil(deger);
      try {
        depo.setItem(HAFIZA_AYAR_ANAHTARI, JSON.stringify(Object.fromEntries(ANAHTARLAR.map((k) => [k, teller[k]()]))));
      } catch (err) { uyari(`[AYAR] hafıza ayarı kaydedilemedi: ${err instanceof Error ? err.message : String(err)}`); }
    };
  }
}
