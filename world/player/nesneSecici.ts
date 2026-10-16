// world/player/nesneSecici.ts — Fareyle NESNE SEÇİMİ (spec 28): bir ışın (kaynak, yön) → ışının ilk vurduğu `Nesne`. SAF (Babylon yok).
//
// Seçilen şey Orion'un GÖRDÜĞÜYLE aynı veridir: `Yer.nesneler` (ofis, bank, ova). Mesh'e bakılmaz, kutuya bakılır: ofisin içindeki eşya `oda-esyalar.glb`'de
// tek parça, mesh adlarından nesne kimliği çıkmaz; kutu ise Orion'un `git`/`bak` hedefi, çarpışma ve algıyla aynı kaynaktır. Işın–kutu hesabı
// `isinTarama.ts`in `isinAabb`'ı (kopya yok).
//
// Kurallar: en yakın isabet kazanır; eşitlikte (iç içe kutular: masa ve üstündeki monitör) HACMİ KÜÇÜK olan kazanır; kaynağı kutunun içinde kalan nesne
// atlanır (kamera büyük bir nesnenin içindeyse her şeyi seçmesin); küçük nesne kaçmasın diye kutu her yönde `PAY` kadar şişirilir.
"use strict";
import { isinAabb, type Nokta3 } from "./isinTarama.ts";
import type { Nesne } from "../level/nesneKaydi.ts";

/** Seçim menzili (m): ova açık alan, uzaktaki nesne de seçilebilsin. */
export const SECIM_MENZILI = 60;
/** Kutuya her yönde eklenen pay (m): ince/küçük nesne (lamba direği) fareyle kaçmasın. */
export const SECIM_PAYI = 0.04;
/** Eşit sayılan mesafe farkı (m). */
const ESIT = 1e-6;

export interface Secim { nesne: Nesne; mesafe: number }

const hacim = (n: Nesne): number => n.kutu.g * n.kutu.yuk * n.kutu.d;

/** `yon` BİRİM uzunlukta olmalı. Hiçbir nesne vurulmadıysa null. */
export function nesneSec(kaynak: Nokta3, yon: Nokta3, nesneler: readonly Nesne[], menzil = SECIM_MENZILI): Secim | null {
  let en: Secim | null = null;
  for (const n of nesneler) {
    const k = n.kutu;
    const t = isinAabb(kaynak, yon, { x: k.x, y: k.y, z: k.z, g: k.g + 2 * SECIM_PAYI, yuk: k.yuk + 2 * SECIM_PAYI, d: k.d + 2 * SECIM_PAYI });
    if (t === null || t <= 0 || t > menzil) continue;   // t = 0: kaynak kutunun içinde
    if (!en || t < en.mesafe - ESIT || (Math.abs(t - en.mesafe) <= ESIT && hacim(n) < hacim(en.nesne))) en = { nesne: n, mesafe: t };
  }
  return en;
}
