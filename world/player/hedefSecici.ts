// world/player/hedefSecici.ts — Fareyle ZEMİN ve ORION seçimi (spec 28 genişletmesi): bir ışın (kaynak, yön) → zemin noktası ya da Orion'a isabet. SAF (Babylon yok).
//
// Nesne seçici (`nesneSecici.ts`) yalnız `Yer.nesneler` kutularını görür; Orion nesne değil (kendi bedeni, konumu her an değişir) ve zemin kutu değil. Sağ tık
// üç yere gidebilir: nesne, Orion, boş zemin; hangisinin menüsü açılacağı en yakın isabete göre kökte (`uygulama/nesneSecimi.ts`) karar verilir.
"use strict";
import { isinAabb, type Nokta3 } from "./isinTarama.ts";
import { SECIM_MENZILI } from "./nesneSecici.ts";

/** Orion'un tıklanabilir gövde kutusu (m): ayakta / oturur. Kutu, görünen bedenden hafif geniştir (kaçmasın). */
export const ORION_KUTUSU = { genislik: 0.75, derinlik: 0.75, ayakta: 1.85, oturur: 1.35 } as const;

/** Işının Orion'a isabet mesafesi (m); vurmadıysa ya da kaynak gövdenin içindeyse null. `yon` BİRİM olmalı. */
export function orionuVur(kaynak: Nokta3, yon: Nokta3, konum: Nokta3, oturuyor: boolean, menzil = SECIM_MENZILI): number | null {
  const yuk = oturuyor ? ORION_KUTUSU.oturur : ORION_KUTUSU.ayakta;
  const t = isinAabb(kaynak, yon, { x: konum.x, y: konum.y + yuk / 2, z: konum.z, g: ORION_KUTUSU.genislik, yuk, d: ORION_KUTUSU.derinlik });
  return t === null || t <= 0 || t > menzil ? null : t;
}

/**
 * Işının zemini kestiği nokta. Zemin düz değilse (ova: plato, yamaç) `yukseklik(x, z)` ile birkaç yinelemede oturur. Işın yukarı/yatay bakıyorsa, zemin
 * menzilin ötesindeyse ya da kaynaktan geriye düşüyorsa null. Dönen `y` zeminin o noktadaki yüksekliğidir.
 */
export function zeminNoktasi(kaynak: Nokta3, yon: Nokta3, yukseklik: (x: number, z: number) => number, menzil = SECIM_MENZILI): Nokta3 | null {
  if (yon.y >= -1e-6) return null;
  let h = yukseklik(kaynak.x, kaynak.z);
  let p: Nokta3 = kaynak;
  for (let i = 0; i < 4; i++) {
    const t = (h - kaynak.y) / yon.y;
    if (t <= 0 || t > menzil) return null;
    p = { x: kaynak.x + t * yon.x, y: h, z: kaynak.z + t * yon.z };
    h = yukseklik(p.x, p.z);
  }
  return { x: p.x, y: h, z: p.z };
}
