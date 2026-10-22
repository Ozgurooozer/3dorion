// uygulama/ajanlar/ajanGovdesi.ts — AJANIN GÖVDESİNİN GRAFİĞE AÇILAN YÜZÜ ve sözün okunma süresi (spec 35 dilim 2c).
//
// Bu kavramlar AJANA aittir, program motoruna (`uygulama/graf/`) değil: ajan kaydı (`ajanKaydi.ts`) ve Flash'ın bağlantısı graf motorunu bilmemeli,
// graf motoru ajanları bilebilir (tek yön: graf → ajanlar). Eskiden `graf/grafYetenegi.ts`teydi; ters yönlü bağımlılık oradan sökülüp buraya taşındı.
"use strict";
import type { Vec3 } from "../../protocol/temel.ts";

/** Sözün okunma süresi (ms): ses yokken (Flash; Piper kurulu değil) sonraki düğüm/söz ezilmesin diye beklenir. Kaba kestirim, ölçülmedi. */
export function okumaSuresiMs(metin: string): number {
  return Math.min(8000, Math.max(1500, metin.length * 60));
}

/** Ajan gövdesinin anlık durumu (grafiğin Dünya değişkenleri: Ajan durumu, Ozyn'e mesafe, En yakın nesne). */
export interface AjanGovdesi {
  readonly konum: Vec3;
  /** Süreli bir iş yapıyor (yürüyor, oturmaya gidiyor). */
  readonly mesgul: boolean;
  readonly oturuyor: boolean;
}

/** Bir gövdenin protokol durumundan (`OrionDurumu`) açılan kısmı: tek dönüşüm, Orion ve Flash aynı yerden geçer. */
export function govdeDurumundan(d: { konum: Vec3; mesgul: boolean; oturuyor_mu: boolean }): AjanGovdesi {
  return { konum: { ...d.konum }, mesgul: d.mesgul, oturuyor: d.oturuyor_mu };
}
