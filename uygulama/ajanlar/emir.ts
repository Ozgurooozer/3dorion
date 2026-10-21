// uygulama/ajanlar/emir.ts — ORION → BAŞKA AJAN EMRİ (spec 33; Ozyn, 2026-10-21: "orion da orion lite'a emir verebilsin, takip et, otur gibi"). SAF: DOM, köprü yok.
//
// Orion'un `emret` niyeti buraya gelir: komut hedef ajanın girdisine, Ozyn'in yazmış olduğu gibi (klavye) TESLİM edilir. Teslim = "yapıldı" DEĞİL: ajan kendi kapısından
// geçirir (Flash: komut sözlüğü), anlamazsa kendi cevabını verir; sonucu Orion'a dönmez (NPC'nin işi asenkron, Orion bilmek isterse `sor` der). Kurallar:
//   • Orion kendine emredemez (döngü ve anlamsız kendine-konuşma yok);
//   • olmayan ajan NEDENLE reddedilir ve kimlerin olduğunu söyler (Orion'un modeli kendini düzeltebilsin);
//   • ajanın girdisi bir hata fırlatırsa emir reddedilir ve nedeni söylenir (Orion'un turunu çökertmez);
//   • ajan hitapla başlayan sözü ayıklıyorsa ("Flash otur") emir de aynı kapıdan geçer.
// Sonuç metni İngilizce: Orion'un modeline gider (çerçeve İngilizce, spec 06 §6.8).
"use strict";
import type { AjanDefteri } from "./ajanKaydi.ts";
import { ORION_AJANI } from "./ajanKaydi.ts";
import { hitapAyikla } from "./girdiAdaptoru.ts";

export interface EmirSonucu { ok: boolean; not: string }

/** Orion'un emir verebileceği DİĞER ajanların kimlikleri (`dunya_emret` aracı yalnız bu liste boş değilken sunulur). */
export function emirHedefleri(defter: AjanDefteri): string[] {
  return defter.hepsi().filter((a) => a.id !== ORION_AJANI.id).map((a) => a.id);
}

export function emirTeslim(defter: AjanDefteri, kime: string, soz: string): EmirSonucu {
  if (kime === ORION_AJANI.id) return { ok: false, not: "you cannot command yourself" };
  const ajan = defter.al(kime);
  if (!ajan) {
    const var_ = emirHedefleri(defter);
    return { ok: false, not: `no character named "${kime}"${var_.length ? ` (available: ${var_.join(", ")})` : " (none available)"}` };
  }
  try { ajan.algi({ tur: "duydum", metin: ajan.hitapAyiklar ? hitapAyikla(soz, ajan.ad) : soz, kesin: true, kaynak: "klavye" }); }
  catch (err) { return { ok: false, not: `${ajan.ad} could not take the command: ${err instanceof Error ? err.message : String(err)}` }; }
  return { ok: true, not: `Delivered to ${ajan.ad}.` };
}
