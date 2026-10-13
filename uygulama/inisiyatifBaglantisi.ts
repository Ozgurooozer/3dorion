// uygulama/inisiyatifBaglantisi.ts — Kapıyı (mind/inisiyatif.ts) köprüye bağlayan TEK yer.
//
// Kapı karar verir, köprü açık işlerin listesini tutar; ikisinin arasındaki sıra burada: açık işi oku → karar →
// hatırlatılan işi köprüde işaretle → olayı algı olarak ver. Bu sıra eskiden kompozisyon kökündeydi (world/giris.ts)
// ve test edilmiyordu.
"use strict";
import type { Algi } from "../protocol/algi.ts";
import { inisiyatifOlayi, type Inisiyatif, type InisiyatifDurumu, type InisiyatifKarari } from "../mind/inisiyatif.ts";

/** Köprünün bu bağlantının kullandığı yüzü (`bridge/kopru.ts` `Kopru`). */
export interface InisiyatifKoprusu {
  acikIs(): { ozet: string; yasMs: number; anahtar: string } | null;
  acikIsAnildi(anahtar: string): void;
  algi(a: Algi): void;
}

/**
 * Bir tik. `eski` (`?inisiyatif=eski`): açık iş okunmaz; `girdiYasiMs`'i vermemek çağıranın işidir. Uyanılırsa kararı
 * döndürür (günlük ve konsol için), yoksa null.
 */
export function inisiyatifTik(
  inisiyatif: Inisiyatif, kopru: InisiyatifKoprusu, d: Omit<InisiyatifDurumu, "acikIs">, eski = false,
): InisiyatifKarari | null {
  const k = inisiyatif.karar(eski ? d : { ...d, acikIs: kopru.acikIs() });
  if (!k) return null;
  if (k.neden === "acik_is" && k.acikIs) kopru.acikIsAnildi(k.acikIs.anahtar);
  kopru.algi(inisiyatifOlayi(k, d.sessizlikMs));
  return k;
}
