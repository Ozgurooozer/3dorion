// world/level/ova/ovaMalzeme.ts — Ova'nın TEK malzeme fabrikası (spec 17).
//
// Bütün ova mesh'leri malzemesini buradan alır. Neden tek fabrika: ileride toon/piksel shader'a geçiş
// (referans 3) bu dosyanın içini değiştirmek olsun, level'in her parçasını tek tek değil. Bugün:
// StandardMaterial, renk köşe renginden (paletten, ovaGeometri.ts), parlama yok (lowpoly mat yüzey).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Renk } from "./ovaVerisi.ts";

export type MalzemeTuru =
  /** Güneşle aydınlanır (zemin, kaya): yüzey yönü gölgesini ışıktan alır. */
  | "isikli"
  /** Işıksız: rengi tamamen köşe rengidir (gök, bulut — gölgesi geometride "pişmiş"). */
  | "pismis";

export interface MalzemeAyari {
  /** Sisten etkilensin mi. Gök ve bulut etkilenmez (ufuk rengi zaten sis rengi). */
  sis?: boolean;
  /** Köşe rengi yerine tek renk (ör. güneş diski). */
  renk?: Renk;
}

export function ovaMalzemesi(sahne: Scene, ad: string, tur: MalzemeTuru, ayar: MalzemeAyari = {}): StandardMaterial {
  const m = new StandardMaterial(`ova_${ad}`, sahne);
  const renk = ayar.renk ? new Color3(...ayar.renk) : Color3.White();
  m.diffuseColor = renk;
  m.specularColor = Color3.Black();
  m.backFaceCulling = true;
  m.fogEnabled = ayar.sis ?? tur === "isikli";
  if (tur === "pismis") {
    // Işıksız: ışık katkısı sıfır, son renk = emissive × köşe rengi. Emissive beyaz (ya da verilen renk),
    // diffuse siyah — ilk sürümde emissive yoktu ve bulutlar/güneş SİYAH çıktı (ekran görüntüsü).
    m.disableLighting = true;
    m.emissiveColor = renk;
    m.diffuseColor = Color3.Black();
  }
  m.freeze();
  return m;
}
