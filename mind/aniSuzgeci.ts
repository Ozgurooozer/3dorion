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
import type { AniTuru } from "./hafiza.ts";
import { sohbetGurultusuMu, dersiNormallestir, terminalKirp, KOMUT_ONEMI } from "./aniYardimcilari.ts";
import { uygula, kayitDan } from "./hafizaKurallari.ts";
import { komutCoz } from "./komutSozlugu.ts";
import { takipEylemi } from "./takipSozu.ts";
import { sohbetEylemi } from "./sohbetKipi.ts";

/** Taşındı: yardımcılar ve sabitler `aniYardimcilari.ts`te (döngüsel import olmasın); buradan geriye dönük aynı adla dışa verilir. */
export { TERMINAL_BAS, TERMINAL_SON, MIKROFON_ONEMI, KOMUT_ONEMI, sohbetGurultusuMu, dersiNormallestir, terminalKirp } from "./aniYardimcilari.ts";

export interface AniKaydi { icerik: string; onem: number }

/**
 * Algının kalıcı hafızaya yazılacak hâli; yazılmayacaksa `null`. `tur` ve `icerik` köprünün
 * `_aniIcerigi`nden gelir (sorgu da aynı içerikle kurulur — süzgeç onu değiştirmez).
 *
 * KARAR KURAL TABLOSUNDA (`hafizaKurallari.ts`, Markov biçimi: ELE → İÇERİK → ÖNEM, grup içinde ilk eşleşen kural). Bu işlev
 * yalnız ince bir kapıdır; eski kod gövdesi `aniSuzgeci.test.ts`te REFERANS olarak durur (tablo ile denklik testi).
 */
export function aniKaydi(a: Algi, tur: AniTuru, icerik: string, politika: "yeni" | "eski" = "yeni"): AniKaydi | null {
  const s = uygula(kayitDan(a, tur, icerik, politika));
  return s.yaz ? { icerik: s.icerik, onem: s.onem } : null;
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

export interface SozTemizligiSonucu {
  aniler: unknown[];
  /** Atılan: selam/sohbet sözü ve ortam parametre hatası (bugünkü `aniKaydi` bunları yazmazdı). */
  atilan: number;
  /** Önemi `KOMUT_ONEMI`ye inen doğuştan komut sözü. */
  indirilen: number;
  /** Ayrıntısı atılıp tek derse inen hata anısı. */
  normallesen: number;
}

/**
 * Söz ve sonuç anıları için eski hafıza göçü: süzgeçten (2026-10-12/14) ÖNCE yazılmış kayıtları bugünkü yazma
 * kurallarına getirir. `eskiHafizayiTemizle` bunlara bilerek dokunmuyordu ("yanlışlıkla silmek geri alınamaz");
 * bu yüzden desen DAR: yalnız `aniKaydi`nin kendi kararlarını yeniden uygular, yeni hüküm koymaz.
 *   - konusma: selam/sohbet sözü atılır; doğuştan komut sözü önemi KOMUT_ONEMI'ne iner.
 *   - sonuc:   "hata: ortam …" atılır (kural 7); diğer hata dersleri normalleşir (kural 6).
 * Yazım hatalı kısa sözlere, normal sözlere, tanınmayan kayıtlara DOKUNULMAZ. İdempotent. Silmeden önce yedek çağıranın işi.
 */
export function eskiSozleriTemizle(aniler: readonly unknown[]): SozTemizligiSonucu {
  let atilan = 0, indirilen = 0, normallesen = 0;
  const sonuc: unknown[] = [];
  for (const a of aniler) {
    const o = a as { tur?: unknown; metin?: unknown; onem?: unknown };
    if (typeof o?.metin !== "string") { sonuc.push(a); continue; }
    if (o.tur === "konusma") {
      if (sohbetGurultusuMu(o.metin)) { atilan++; continue; }
      const komut = komutCoz(o.metin) || takipEylemi(o.metin) || sohbetEylemi(o.metin);
      if (komut && typeof o.onem === "number" && o.onem > KOMUT_ONEMI) { indirilen++; sonuc.push({ ...o, onem: KOMUT_ONEMI }); continue; }
    } else if (o.tur === "sonuc") {
      if (/^hata: ortam /.test(o.metin)) { atilan++; continue; }
      const d = dersiNormallestir(o.metin);
      if (d !== o.metin) { normallesen++; sonuc.push({ ...o, metin: d }); continue; }
    }
    sonuc.push(a);
  }
  return { aniler: sonuc, atilan, indirilen, normallesen };
}
