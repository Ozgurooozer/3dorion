// uygulama/senaryoSahnesi.ts — Görüntü senaryolarının ORTAK sahne kurulumu (klipdene, sekansdene, kimododene): Orion yüzü kameraya dönük durur.
//
// Neden böyle (klipdene'nin koşularından): Orion boştayken masaya (-Z) döner, bu yüzden `isinla` yaw'ı tutmaz (ilk üç koşuda görüldü). Ozyn kameranın
// ARKASINA geçer (kamera +Z'de, ona bakar) ve Orion'a "oyuncuya bak" denir: boyun sınırı aşılınca gövde kendi döner, yüzü kameraya gelir. Gövde döndükten
// sonra bakış serbest bırakılır: "oyuncuya bak" sürerken baş sürekli ona kilitlenir, baş izini (onay/ret) ezer (4. koşuda şüphelendik).
"use strict";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { SenaryoBaglami } from "./senaryoBaglami.ts";

const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Kamera yönleri (Orion'dan kameraya, gövde yüzü +Z iken): `onden` yüz, `yandan` Orion'un sağı (+X; bacak sallanması görünsün). */
export const KAMERA_YONU = { onden: new Vector3(0, 0, 1), yandan: new Vector3(1, 0, 0) } as const;

/** Orion'u kameraya döndürür, kamerayı ona kilitler, bakışı bırakır. Orion yoksa null. `onek`: niyet kimliklerinin öneki. */
export async function orionuKarsiyaAl(d: SenaryoBaglami, onek: string, yon: Vector3 = KAMERA_YONU.onden, mesafe = 2.6): Promise<{ x: number; z: number } | null> {
  const orion = d.orion;
  if (!orion) return null;
  const k = orion.durum().konum;
  d.oyuncu.isinla(k.x, k.z + 4.2, Math.PI);
  d.niyetiYurut({ tur: "bak", hedef: { tip: "oyuncu" } }, `${onek}_bak`);
  await bekle(2500);
  kameraKilitle(d, k, yon, mesafe);
  await bekle(1500);
  d.niyetiYurut({ tur: "bak", hedef: null }, `${onek}_bak_birak`);
  await bekle(400);
  return { x: k.x, z: k.z };
}

/** Kamerayı Orion'un gövde ortasına (1,05 m) verilen yönden kilitler (yön değiştirmek Orion'u döndürmez). */
export function kameraKilitle(d: SenaryoBaglami, k: { x: number; z: number }, yon: Vector3, mesafe = 2.6): void {
  d.rig.odakKilitle(new Vector3(k.x, 1.05, k.z), mesafe, 0.1, yon);
}
