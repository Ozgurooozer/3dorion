// uygulama/sekans/editor/kameraYardimcilari.ts — KAMERA DÜZENLEMENİN GEOMETRİSİ (spec 38 §7): yörünge, yakınlık, yükseklik, Orion'un karşısına. SAF.
//
// Kamerayı sahnede serbestçe gezdirmek editör açıkken mümkün değil (tuşlar editörün); bu yüzden kamera DÜĞMELERLE ve sayılarla ayarlanır ve önizleme
// canlıdır (Kamera sekmesi açıkken sahne seçili kameranın gözüyle görünür). Yörünge HEDEF NOKTA etrafında döner: konum = hedef + küresel (yatay açı, yükselti, mesafe).
// Eksenler Babylon dünyası: Y yukarı; yatay açı 0 = hedefin +Z'sinde, artı yön = +X'e (saat yönü, yukarıdan bakınca).
"use strict";
import type { Nokta3 } from "../../../protocol/sekans.ts";

const DERECE = Math.PI / 180;
export const YORUNGE_ADIMI = { aci: 10, yukseklik: 10, mesafe: 0.25 } as const;
export const EN_YAKIN = 0.3, EN_UZAK = 40;

export interface KameraGeometrisi { konum: Nokta3; hedef: Nokta3 }

/** Konumun hedefe göre küresel hâli: yatay açı (derece), yükselti (derece), mesafe (m). */
export function kuresel(k: KameraGeometrisi): { yatay: number; yukselti: number; mesafe: number } {
  const dx = k.konum[0] - k.hedef[0], dy = k.konum[1] - k.hedef[1], dz = k.konum[2] - k.hedef[2];
  const mesafe = Math.hypot(dx, dy, dz);
  return { yatay: Math.atan2(dx, dz) / DERECE, yukselti: Math.atan2(dy, Math.hypot(dx, dz)) / DERECE, mesafe };
}

/** Küresel hâlden konum (hedef sabit). */
export function konumdan(hedef: Nokta3, yatay: number, yukselti: number, mesafe: number): Nokta3 {
  const y = yatay * DERECE, e = yukselti * DERECE, h = Math.cos(e) * mesafe;
  return [hedef[0] + Math.sin(y) * h, hedef[1] + Math.sin(e) * mesafe, hedef[2] + Math.cos(y) * h];
}

/** Hedefin etrafında yörünge: yatay açı, yükselti (±85° ile sınırlı: kutba dayanınca yön bozulmasın) ve mesafe (0,3–40 m) değişir. */
export function yorungele(k: KameraGeometrisi, dYatay: number, dYukselti: number, dMesafe: number): Nokta3 {
  const s = kuresel(k);
  const yukselti = Math.max(-85, Math.min(85, s.yukselti + dYukselti));
  const mesafe = Math.max(EN_YAKIN, Math.min(EN_UZAK, s.mesafe + dMesafe));
  return konumdan(k.hedef, s.yatay + dYatay, yukselti, mesafe);
}

/** Orion'un karşısına: Orion'un baktığı yönde `mesafe` m önünde, göz hizasında; hedef göğsü. `yaw`: Orion'un gövde yaw'ı (radyan, 0 = +Z). */
export function orionKarsisi(orion: { x: number; y: number; z: number }, yaw: number, mesafe = 2.4): KameraGeometrisi {
  const hedef: Nokta3 = [orion.x, orion.y + 1.15, orion.z];
  return { hedef, konum: [orion.x + Math.sin(yaw) * mesafe, orion.y + 1.45, orion.z + Math.cos(yaw) * mesafe] };
}

/** Orion'un yanından (sağ tarafı): profil. */
export function orionYanindan(orion: { x: number; y: number; z: number }, yaw: number, mesafe = 3): KameraGeometrisi {
  const hedef: Nokta3 = [orion.x, orion.y + 1.1, orion.z];
  return { hedef, konum: [orion.x + Math.cos(yaw) * mesafe, orion.y + 1.3, orion.z - Math.sin(yaw) * mesafe] };
}

/** Radyan → derece görüş alanı ve ters (Babylon radyan, sekans derece). */
export const fovRadyan = (derece: number): number => derece * DERECE;
export const fovDerece = (radyan: number): number => radyan / DERECE;
