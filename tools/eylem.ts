// tools/eylem.ts — "Söylediğini YAPTI mı?" puanı (eylem ölçüsü, spec 12 Faz 0).
//
// 2026-10-02 ortak canlı testte Ozyn "otur", "bana gel", "bilgisayarı aç"
// dedi; Orion üçünde de yalnız `dunya_soyle` çağırdı ("Oturuyorum Ozyn.") ve
// hiçbir şey yapmadı. Bu dosya bir cevabın İSTENEN beden aracını çağırıp
// çağırmadığını sayar — sözün içeriğine bakmaz.
//
// SAF: girdi çağrı listesi + beklenti, çıktı puan. Babylon'suz, ağsız.
"use strict";
import { capaCoz, type CapaAdi } from "../protocol/temel.ts";

export interface EylemBeklentisi {
  /** Çağrılması gereken araç, ör. `dunya_otur`. */
  arac: string;
  /** Hedef türü şart mı ("bana gel" → `oyuncu`). */
  hedefTip?: "oyuncu";
  /** Hedef çapa şart mı ("pencereye bak" → `pencere`). Etiket de kabul: "çalışma masası" → masa. */
  capa?: CapaAdi;
}

export interface Cagri { ad: string; girdi: unknown }

export interface EylemPuani {
  /** İstenen araç, istenen hedefle çağrıldı. */
  dogru: boolean;
  /** Yalnız konuştu ya da baktı, beden aracı yok: canlıdaki hatanın ta kendisi. */
  yalnizSoz: boolean;
}

/** Konuşmak ve bakmak bedeni hareket ettirmez. */
const SOZ_ARACLARI = new Set(["dunya_soyle", "dunya_sor"]);

function alan(girdi: unknown, ad: string): unknown {
  return girdi && typeof girdi === "object" ? (girdi as Record<string, unknown>)[ad] : undefined;
}

/** Çağrının hedef çapası: `capa` alanı (otur/odaklan) ya da `hedef.ad` (git/bak). */
function cagriCapasi(girdi: unknown): CapaAdi | null {
  const ad = alan(girdi, "capa") ?? alan(alan(girdi, "hedef"), "ad");
  return typeof ad === "string" ? capaCoz(ad) : null;
}

function uyar(c: Cagri, b: EylemBeklentisi): boolean {
  if (c.ad !== b.arac) return false;
  if (b.hedefTip && alan(alan(c.girdi, "hedef"), "tip") !== b.hedefTip) return false;
  if (b.capa && cagriCapasi(c.girdi) !== b.capa) return false;
  return true;
}

export function eylemPuanla(cagrilar: readonly Cagri[], b: EylemBeklentisi): EylemPuani {
  return {
    dogru: cagrilar.some((c) => uyar(c, b)),
    yalnizSoz: cagrilar.length > 0 && cagrilar.every((c) => SOZ_ARACLARI.has(c.ad)),
  };
}
