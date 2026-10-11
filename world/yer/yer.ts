// world/yer/yer.ts — "Yer": Orion'un ve oyuncunun içinde bulunduğu alanın SAF verisi (spec 24 C1). Babylon YOK.
//
// NEDEN. Oda bir level değil: ölçüleri `level/olculer.ts` sabitleri, çapaları `level/capalar.ts` defteri.
// Yol bulma, çarpışma, bakış ışını, algı ve Orion'un yürüyüşü bu sabitleri DOĞRUDAN okuyordu — ofisin kapısından
// ovaya çıkılınca (spec 24) hepsi yanlış yerde hesap yapardı. Artık her biri bir `Yer` görür; oda yeri bugünkü
// sabitlerden TÜRER (`odaYeri.ts`, ikinci liste yok), ova yeri level tanımından (C2).
//
// Yer, AKTÖR BAŞINA verilir (`() => Yer`): Ozyn içerideyken Orion kendi kararıyla dışarı çıkabilir (C6) — "tek
// aktif yer" global'i bunu taşıyamazdı.
"use strict";
import type { Kutu, KatiYuzey } from "../level/olculer.ts";
import type { Capa } from "../level/capalar.ts";
import type { Nesne } from "../level/nesneKaydi.ts";

/** Yürünebilir dikdörtgen (XZ, duvar iç yüzü). */
export interface Sinir {
  readonly minX: number; readonly maxX: number;
  readonly minZ: number; readonly maxZ: number;
}

/** Yürüme alanı: sınır + XZ engelleri. Yol bulma ve çarpışma YALNIZ bunu görür. */
export interface YurumeAlani {
  readonly sinir: Sinir;
  readonly engeller: readonly Kutu[];
}

export interface Yer extends YurumeAlani {
  /** Kararlı ad ("oda", "ova"); algıya ve günlüğe bu geçer. */
  readonly ad: string;
  /** Bakış ışınını durduran yüzeyler (etkileşim ve görünürlük). */
  readonly katiYuzeyler: readonly KatiYuzey[];
  /** Adla anılan noktalar: git / otur / odaklan hedefleri. */
  readonly capalar: readonly Capa[];
  /** Orion'un bildiği nesneler (spec 15 biçimi). */
  readonly nesneler: readonly Nesne[];
  /** Zemin yüksekliği (m). Oda düz: hep 0. */
  yukseklik(x: number, z: number): number;
}
