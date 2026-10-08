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

/** Terminal anısında korunan satırlar. */
export const TERMINAL_BAS = 4;
export const TERMINAL_SON = 8;
/** Mikrofondan gelen sözün önemi (klavye: 8, `kuralOnemi`). */
export const MIKROFON_ONEMI = 6;

export interface AniKaydi { icerik: string; onem: number }

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
export function aniKaydi(a: Algi, tur: AniTuru, icerik: string): AniKaydi | null {
  if (a.tur === "olay") return null;
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
