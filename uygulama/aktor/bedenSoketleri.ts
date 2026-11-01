// uygulama/aktor/bedenSoketleri.ts — beden soketi çözümü (spec 45 B5): "orion/el_sag" → avatarın eklem düğümünün dünya matrisi.
// Soket adı oyuncu-dostu (level JSON'unda yazılan: `soket: "el_sag"`); avatar sözleşmesi ise `Uzuv` adı bilir. Eşleme TEK yerde; Babylon'suz saf.
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Uzuv } from "../../protocol/animasyon.ts";

/** Soket adı → uzuv. Yeni soket = bir satır (kılıç ele, lamba kafaya…). Level doğrulaması da bu tabloyu kullanabilir (`BEDEN_SOKETLERI`). */
export const BEDEN_SOKETLERI = {
  el_sag: "sag_el", el_sol: "sol_el",
  on_kol_sag: "sag_on_kol", on_kol_sol: "sol_on_kol",
  kol_sag: "sag_kol", kol_sol: "sol_kol",
  ayak_sag: "sag_ayak", ayak_sol: "sol_ayak",
  bas: "bas", boyun: "boyun", gogus: "gogus", govde: "govde", kalca: "kalca",
  sirt: "gogus",
} as const satisfies Record<string, Uzuv>;
export type BedenSoketAdi = keyof typeof BEDEN_SOKETLERI;

/** Bir bedenin soket kaynağı: avatar yüzünün yalnız bu işe yarayan parçası (kemik düğümü sızmaz). */
export interface BedenKaynagi { uzuvDunyaMatrisi(u: Uzuv): readonly number[] | null }

export const bedenSoketiVarMi = (ad: string): ad is BedenSoketAdi => Object.hasOwn(BEDEN_SOKETLERI, ad);

/**
 * `bedenler`: beden adı ("orion", "flash1") → kaynak; beden yoksa/yüklenmediyse `null` döner. Çözülemeyen her durum null: kodlu uyarıyı
 * (AKT-BAG-012) çağıran çalışma zamanı yazar, burada sessiz ama TEK anlamlı (null = "şimdi çözülemedi").
 */
export function bedenSoketiCozucu(bedenler: (ad: string) => BedenKaynagi | null): (beden: string, soket: string) => Matrix | null {
  return (beden, soket) => {
    if (!bedenSoketiVarMi(soket)) return null;
    const m = bedenler(beden)?.uzuvDunyaMatrisi(BEDEN_SOKETLERI[soket]);
    return m && m.length === 16 ? Matrix.FromArray(m as number[]) : null;
  };
}
