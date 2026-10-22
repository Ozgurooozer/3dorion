// uygulama/duzenleyici/sayiAlani.ts — EDİTÖRLERİN SAYI KUTUSU KURALI (spec 35 dilim 2b'den çıkarıldı; spec 36). SAF.
//
// Yazılan metin `Number` ile sayıya çevrilir, ASLA eval ile değil (LiteGraph'ın sayı alanı ifadeyi eval ediyordu, spec 35 §5): "1+1" HATADIR, nedeni
// "ifade hesaplanmaz" diye söylenir. Türkçe ondalık virgül kabul edilir ("2,5" → 2.5). Aralık dışı değer YAZILMAZ (nedeni döner; alan eski değerine döner).
// İki kullanıcı: graf editörünün ayar alanları (`uygulama/graf/editor/alanlar.ts`) ve sekans editörünün Ayrıntılar paneli (`uygulama/sekans/editor/`).
// Kural tek yerde: ikinci bir sayı deseni yazılırsa "1+1" bir yerde kabul edilebilirdi.
"use strict";
import type { Sonuc } from "../../protocol/dogrula.ts";

const SAYI_DESENI = /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;

export interface SayiKurali {
  en?: number;
  cok?: number;
  /** Yalnız tamsayı (kare numarası gibi): "12,5" reddedilir. */
  tamsayi?: boolean;
}

/** Boş metin → `undefined` (alanı sil / varsayılana dön; çağıran ne demek olduğuna karar verir). */
export function sayiMetniCoz(ad: string, ham: string, k: SayiKurali = {}): Sonuc<number | undefined> {
  const t = ham.trim().replace(",", ".");
  if (t === "") return { ok: true, deger: undefined };
  if (!SAYI_DESENI.test(t)) return { ok: false, hata: `${ad}: sayı olmalı (gelen: ${JSON.stringify(ham)}; ifade hesaplanmaz)` };
  const n = Number(t);
  if (!Number.isFinite(n)) return { ok: false, hata: `${ad}: sonlu sayı olmalı` };
  if (k.tamsayi && !Number.isInteger(n)) return { ok: false, hata: `${ad}: tamsayı olmalı (gelen: ${n})` };
  if ((k.en !== undefined && n < k.en) || (k.cok !== undefined && n > k.cok)) return { ok: false, hata: `${ad}: ${n} aralık dışı (${k.en ?? "-∞"}–${k.cok ?? "∞"})` };
  return { ok: true, deger: n };
}
