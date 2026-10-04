// world/player/gorunurluk.ts — Bir bakış noktasından hangi nesneler görünür? (spec 15 S1) Babylon YOK.
//
// `mind/algiHizmeti.ts` yalnız `CAPALAR`ı görüyordu ve yalnız beyin sorunca. Bu çekirdek
// aynı soruyu TÜM nesne kaydı için, LLM'siz ve ucuz cevaplar; `mind/mekanBellegi` (S2)
// sonucu bir bellekte tutar. Algının DOĞRULUĞU `isinTarama.ts`in ışınından gelir: burada
// ikinci bir okluzyon mantığı yok, yalnız onun üstünde nesne düzeyinde bir karar var.
//
// KURAL (spec 15 S1b): nesnenin 9 örnek noktasından (merkez + 8 köşe) en az biri, göz →
// nokta doğrusunda, nesnenin KENDİ kutusuna girmeden önce başka bir katı yüzeye çarpmıyorsa
// GÖRÜNÜR. Merkez örtülü ama başka nokta açıksa `kismen`. Nesnenin kendi kutusu engel
// sayılmaz. İlk sürüm yalnız merkezi denerdi: oda ortasından masa, önündeki sandalyenin
// arkasında kalan merkez noktası yüzünden "görünmez" çıktı (docs/olcum-goz-ve-mekan-bellegi.md).
//
// KONİ XZ düzleminde (kat farkı yok), `mind/algiHizmeti.ts` ile aynı açı: künyeden.
"use strict";
import { BEDEN } from "../../protocol/bedenTanimi.ts";
import type { Kutu } from "../level/olculer.ts";
import { KATI_YUZEYLER, type KatiYuzey } from "../level/olculer.ts";
import type { Nesne } from "../level/nesneKaydi.ts";
import { birimYon, isinAabb, type Nokta3 } from "./isinTarama.ts";

/** Sayısal gürültü payı (metre): kendi kutusuna "değme" ile örtülmeyi karıştırmasın. */
const EPS = 1e-6;

export interface Gorunum {
  id: string;
  /** Orion'un ayağından nesne merkezine XZ mesafesi (metre). */
  mesafe: number;
  /** Nesne merkezi bakış konisinin içinde mi. */
  konide: boolean;
  /** Nesnenin 9 örnek noktasından en az biri açık mı (koniden bağımsız). */
  gorunur: boolean;
  /** Merkez örtülü ama başka bir nokta açık: nesne KISMEN görünüyor. */
  kismen: boolean;
}

/** Köşeleri merkeze çekme oranı: yüzeye teğet noktalar belirsizlik üretmesin (spec 15 S1b). */
const KOSE_ORANI = 0.9;

/** Nesnenin örnek noktaları: merkez ilk, sonra 8 köşe. Merkez ilk olduğu için erken çıkış mümkün. */
export function ornekNoktalari(k: Kutu): Nokta3[] {
  const o: Nokta3[] = [{ x: k.x, y: k.y, z: k.z }];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    o.push({ x: k.x + sx * (k.g / 2) * KOSE_ORANI, y: k.y + sy * (k.yuk / 2) * KOSE_ORANI, z: k.z + sz * (k.d / 2) * KOSE_ORANI });
  }
  return o;
}

/** Hedef noktaya engelsiz mi bakılıyor? `kendi` kutusu engel sayılmaz. */
export function acikMi(goz: Nokta3, nokta: Nokta3, kendi: Kutu | null, yuzeyler: readonly KatiYuzey[] = KATI_YUZEYLER): boolean {
  const yon = birimYon(goz, nokta);
  if (!yon) return true; // göz tam noktada
  // Hedefe VARIŞ mesafesi: kendi kutusuna ilk giriş (kutu içindeyse 0), yoksa noktaya düz mesafe.
  const noktaMesafe = Math.hypot(nokta.x - goz.x, nokta.y - goz.y, nokta.z - goz.z);
  const giris = kendi ? isinAabb(goz, yon, kendi) : null;
  const varis = giris !== null ? Math.min(giris, noktaMesafe) : noktaMesafe;
  for (const y of yuzeyler) {
    // Kendi kutusu ayrıca elenmez: `varis` ≤ kendi kutusuna ilk giriş olduğundan, o kutu
    // `t < varis - EPS` koşuluna hiçbir zaman giremez (spec 15 karnesi: M2 denk mutant).
    const t = isinAabb(goz, yon, y.kutu);
    if (t !== null && t < varis - EPS) return false;
  }
  return true;
}

/** Hedef bakış konisinin içinde mi (XZ). Bakış sıfır vektörse yalnız aynı noktadaki hedef konidedir. */
export function konideMi(konum: Nokta3, bakis: Nokta3, hedef: Nokta3, koniYarim: number = BEDEN.duyu.koniYarim): boolean {
  const dx = hedef.x - konum.x, dz = hedef.z - konum.z;
  const u = Math.hypot(dx, dz);
  if (u < 1e-6) return true;
  const bu = Math.hypot(bakis.x, bakis.z);
  if (bu < 1e-9) return false;
  const kos = (dx * bakis.x + dz * bakis.z) / (u * bu);
  return Math.acos(Math.max(-1, Math.min(1, kos))) <= koniYarim;
}

/**
 * Bir bakış noktasından tüm nesnelerin durumu. Yan etkisiz, ayırma yok denecek kadar az:
 * 20Hz'de çağrılabilsin diye (spec 15 P2: 60 nesnede p95 ≤ 1 ms).
 *
 * @param konum Orion'un ayak konumu.
 * @param bakis Bakış yönü (XZ'de yeterli; birim olması gerekmez).
 */
export function gorunenNesneler(
  konum: Nokta3,
  bakis: Nokta3,
  gozYuksekligi: number,
  nesneler: readonly Nesne[],
  yuzeyler: readonly KatiYuzey[] = KATI_YUZEYLER,
): Gorunum[] {
  const goz: Nokta3 = { x: konum.x, y: konum.y + gozYuksekligi, z: konum.z };
  const cikti: Gorunum[] = [];
  for (const n of nesneler) {
    const noktalar = ornekNoktalari(n.kutu);
    const merkez = noktalar[0]!;
    const merkezAcik = acikMi(goz, merkez, n.kutu, yuzeyler);
    // Merkez açıksa geri kalan 8 ışına gerek yok (erken çıkış): açık odada maliyet merkez-kuralıyla aynı.
    let gorunur = merkezAcik;
    for (let i = 1; !gorunur && i < noktalar.length; i++) gorunur = acikMi(goz, noktalar[i]!, n.kutu, yuzeyler);
    cikti.push({
      id: n.id,
      mesafe: Math.hypot(konum.x - merkez.x, konum.z - merkez.z),
      konide: konideMi(konum, bakis, merkez),
      gorunur,
      kismen: gorunur && !merkezAcik,
    });
  }
  return cikti;
}
