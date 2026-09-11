// world/player/isinTarama.ts — Bakış ışını: SAF matematik, Babylon YOK.
//
// Neden ayrı ve saf: ilk sürüm `scene.pickWithRay`e etiket süzgeci veriyordu
// (`predicate: m => m.metadata?.capa`). Süzgeç isabetten ÖNCE çalıştığı için
// duvar ve masa gövdesi ışını hiç durdurmuyordu — oyuncu duvarın arkasından
// monitöre `E` basabiliyordu. Bu bir doğruluk hatasıydı, kozmetik değil.
//
// Doğru sıra ve bu dosyanın sözleşmesi:
//   1. Işın odanın TÜM katı yüzeylerine çarpar (duvar, tavan, zemin, raf dahil).
//   2. EN YAKIN isabet seçilir.
//   3. Süzme ondan SONRA: isabetin `capa` etiketi varsa etkileşim önerilir,
//      yoksa (duvar/zemin) etkileşim YOKTUR.
//
// Babylon'suz olması test edilebilirlik için: `isinTarama.test.ts` motor
// yüklemeden koşar. Babylon tarafı (`oyuncu.ts`) yalnızca kaynak/yön verir.
"use strict";
import type { CapaAdi } from "../../protocol/temel.ts";
import type { Kutu } from "../level/olculer.ts";
import { KATI_YUZEYLER, type KatiYuzey } from "../level/olculer.ts";

/** Yön bileşeni bu değerden küçükse eksene paralel kabul edilir. */
const EPS = 1e-9;

export interface Nokta3 { x: number; y: number; z: number }

export interface Isabet {
  /** Vurulan yüzeyin çapası; null = etkileşimsiz katı yüzey (duvar, zemin). */
  capa: CapaAdi | null;
  /** Kaynaktan isabete metre cinsinden uzaklık. */
  mesafe: number;
}

/**
 * Işın ↔ AABB kesişimi (slab yöntemi).
 *
 * @param kaynak Işının başlangıcı.
 * @param yon    BİRİM uzunlukta yön — aksi hâlde dönen `t` metre olmaz.
 * @param kutu   Eksen hizalı kutu.
 * @returns Kaynaktan kesişime uzaklık (metre), kesişim yoksa `null`.
 *          Kaynak kutunun içindeyse 0 döner.
 */
export function isinAabb(kaynak: Nokta3, yon: Nokta3, kutu: Kutu): number | null {
  let tGiris = 0;
  let tCikis = Infinity;

  // Üç eksen aynı mantık; dizi yerine elle açıldı — 20Hz'de her karede
  // onlarca yüzey için çağrılıyor, ara dizi ayırmak istemiyoruz.
  const eksenler: readonly [number, number, number, number][] = [
    [kaynak.x, yon.x, kutu.x, kutu.g / 2],
    [kaynak.y, yon.y, kutu.y, kutu.yuk / 2],
    [kaynak.z, yon.z, kutu.z, kutu.d / 2],
  ];

  for (const [o, d, merkez, yari] of eksenler) {
    const alt = merkez - yari;
    const ust = merkez + yari;
    if (Math.abs(d) < EPS) {
      // Işın bu eksende hareketsiz: kaynak dilimin dışındaysa asla kesişmez.
      if (o < alt || o > ust) return null;
      continue;
    }
    let ta = (alt - o) / d;
    let tb = (ust - o) / d;
    if (ta > tb) { const g = ta; ta = tb; tb = g; }
    if (ta > tGiris) tGiris = ta;
    if (tb < tCikis) tCikis = tb;
    if (tGiris > tCikis) return null;
  }

  // Kutu tamamen ışının arkasındaysa isabet sayılmaz.
  if (tCikis < 0) return null;
  return tGiris;
}

/**
 * Menzil içindeki EN YAKIN katı yüzeyi bulur. Etiket süzgeci UYGULAMAZ —
 * duvar da isabettir, `capa: null` ile döner. Süzme çağıranın işi.
 *
 * @param yon BİRİM uzunlukta olmalı.
 */
export function isinTara(
  kaynak: Nokta3,
  yon: Nokta3,
  menzil: number,
  yuzeyler: readonly KatiYuzey[] = KATI_YUZEYLER,
): Isabet | null {
  let enYakin: Isabet | null = null;
  for (const y of yuzeyler) {
    const t = isinAabb(kaynak, yon, y.kutu);
    if (t === null || t > menzil) continue;
    if (!enYakin || t < enYakin.mesafe) enYakin = { capa: y.capa, mesafe: t };
  }
  return enYakin;
}

/**
 * Oyuncunun baktığı etkileşimli çapa — okluzyon dahil.
 *
 * En yakın katı yüzey duvar/zemin ise `null` döner: arkasındaki monitör
 * GÖRÜNMEZ, dolayısıyla etkileşilemez. Menzil dışındaki isabet de `null`.
 *
 * @param yon BİRİM uzunlukta olmalı.
 */
export function bakilanCapa(
  kaynak: Nokta3,
  yon: Nokta3,
  menzil: number,
  yuzeyler: readonly KatiYuzey[] = KATI_YUZEYLER,
): CapaAdi | null {
  return isinTara(kaynak, yon, menzil, yuzeyler)?.capa ?? null;
}

/** İki nokta arasındaki birim yön vektörü. Çakışık noktalar için `null`. */
export function birimYon(a: Nokta3, b: Nokta3): Nokta3 | null {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const boy = Math.hypot(dx, dy, dz);
  if (boy < EPS) return null;
  return { x: dx / boy, y: dy / boy, z: dz / boy };
}
