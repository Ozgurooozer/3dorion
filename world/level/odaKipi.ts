// world/level/odaKipi.ts — Hangi oda görünüşü kurulacak (spec 11). Babylon'suz: testte 0.1 sn.
//
// "yeni": Blender odası (assets/oda-esyalar.glb) + kodda işlev yüzeyleri. Varsayılan.
// "klasik": eski kutu oda (oda.ts'nin ilk hâli). `?oda=klasik` ile açılır; glb
//   yüklenemezse yeni kip de kendiliğinden buna düşer (oda hiçbir zaman boş açılmaz).
"use strict";

export type OdaKipi = "yeni" | "klasik";

/** Blender betiğinin ürettiği, `assets/` altındaki model dosyası. */
export const ODA_MODELI = "oda-esyalar.glb";

/** URL sorgusundan kip: yalnız `oda=klasik` eski odayı seçer; başka her şey yeni oda. */
export function odaKipi(sorgu: string): OdaKipi {
  return new URLSearchParams(sorgu).get("oda") === "klasik" ? "klasik" : "yeni";
}
