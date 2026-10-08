// world/level/cekirdek/malzeme.ts — Level'in TEK malzeme fabrikası.
//
// Bütün level mesh'leri malzemesini buradan alır. İleride toon/piksel shader'a (NodeMaterial ya da
// post-process) geçiş bu dosyanın içini değiştirmek olsun; modüllere dokunulmasın. Bugün: StandardMaterial,
// renk köşe renginden (palet), parlama yok (lowpoly mat yüzey). Sahnenin görüntü işleme ayarı (ton eşleme,
// pozlama) Standard malzemeye de uygulanır — ışık sistemi onu kurar.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Renk } from "./renk.ts";

export type MalzemeTuru =
  /** Güneş ve dolguyla aydınlanır, gölge alabilir (zemin, kaya, çim). */
  | "isikli"
  /** Işıksız: son renk = renk × köşe rengi (gök, bulut, güneş — gölgesi geometride "pişmiş"). */
  | "pismis";

export interface MalzemeAyari {
  /** Sisten etkilensin mi. Varsayılan: ışıklıda evet, pişmişte hayır (gök ufku zaten sis rengi). */
  sis?: boolean;
  /** Köşe rengi yerine/üstüne tek renk (ör. güneş diski). */
  renk?: Renk;
  /** İki yüzlü çiz (ince çim yaprakları). */
  ciftYuz?: boolean;
}

export function malzemeKur(sahne: Scene, ad: string, tur: MalzemeTuru, ayar: MalzemeAyari = {}): StandardMaterial {
  const m = new StandardMaterial(`malzeme_${ad}`, sahne);
  const renk = ayar.renk ? new Color3(...ayar.renk) : Color3.White();
  m.specularColor = Color3.Black();
  m.backFaceCulling = !ayar.ciftYuz;
  m.fogEnabled = ayar.sis ?? tur === "isikli";
  if (tur === "pismis") {
    // Işık katkısı sıfır; renk emissive'den. İlk sürümde emissive yoktu → bulut ve güneş SİYAH çıktı.
    m.disableLighting = true;
    m.emissiveColor = renk;
    m.diffuseColor = Color3.Black();
  } else {
    m.diffuseColor = renk;
  }
  return m;
}
