// uygulama/graf/editor/degiskenler.ts — "BENİM GRAFİĞİM · DEĞİŞKENLER" (spec 35 dilim 2b). SAF.
//
// YENİ BİR DEĞİŞKEN SİSTEMİ YOK: değişken, grafikteki `degisken.oku/yaz/artir` düğümlerinin (durumDugumleri.ts) `ad` + `tip` ayarıdır; liste o düğümlerden
// TOPLANIR (Blueprint'in "My Blueprint · Variables" görünümü gibi, ama kaynak JSON'un kendisi). "＋ Değişken" yalnız bu düğümlerden birini ekler.
// Aynı ad iki türle kullanılmışsa ÇAKIŞMA işaretlenir: çalışma anında okuma hata verirdi ("başka bir düğüm başka türle yazmış"), editör önceden söyler.
// Artır yalnız sayıdır (düğüm tip ayarı almaz).
"use strict";
import { grafAdiGecerli, type Graf, type GrafDegeri } from "../../../protocol/graf.ts";
import type { Sonuc } from "../../../protocol/dogrula.ts";
import { DEGISKEN_DUGUMU, DEGISKEN_TIPLERI, type DegiskenTipi } from "../durumDugumleri.ts";

export interface DegiskenSatiri {
  ad: string;
  /** Kullanılan türler (çoğu zaman tek; birden çoksa çakışma). */
  tipler: DegiskenTipi[];
  /** Bu adı kullanan düğümler. */
  dugumler: string[];
  cakisma: boolean;
}

const DEGISKEN_TURLERI: ReadonlySet<string> = new Set(Object.values(DEGISKEN_DUGUMU));

/** Grafikteki değişkenler (ada göre sıralı). Adı olmayan (henüz yazılmamış) değişken düğümü listeye girmez; denetim onu gösterir. */
export function degiskenleriTopla(g: Graf): DegiskenSatiri[] {
  const m = new Map<string, DegiskenSatiri>();
  for (const d of g.dugumler) {
    if (!DEGISKEN_TURLERI.has(d.tip)) continue;
    const ad = d.ayar?.["ad"];
    if (typeof ad !== "string" || !ad) continue;
    const ham = d.tip === DEGISKEN_DUGUMU.artir ? "sayi" : (d.ayar?.["tip"] ?? "sayi");
    const tip = (DEGISKEN_TIPLERI as readonly GrafDegeri[]).includes(ham) ? (ham as DegiskenTipi) : null;
    const s = m.get(ad) ?? { ad, tipler: [], dugumler: [], cakisma: false };
    if (tip && !s.tipler.includes(tip)) s.tipler.push(tip);
    s.dugumler.push(d.id);
    s.cakisma = s.tipler.length > 1;
    m.set(ad, s);
  }
  return [...m.values()].sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}

/** "＋ Değişken" kısayolunun düğümü: tür + ilk ayar. Ad kuralı grafik adınınki (yazma düğümü de aynı kuralla reddederdi). */
export function degiskenDugumu(islem: "oku" | "yaz" | "artir", ad: string, tip: DegiskenTipi): Sonuc<{ tip: string; ayar: Record<string, GrafDegeri> }> {
  if (!grafAdiGecerli(ad)) return { ok: false, hata: `değişken adı geçersiz: ${JSON.stringify(ad)} (harf, rakam, _ ve -; boşluk yok)` };
  if (islem === "artir" && tip !== "sayi") return { ok: false, hata: "Artır yalnız sayı değişkeninde olur" };
  const ayar: Record<string, GrafDegeri> = islem === "artir" ? { ad } : { ad, tip };
  return { ok: true, deger: { tip: DEGISKEN_DUGUMU[islem], ayar } };
}
