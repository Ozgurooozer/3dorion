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
  /** Orion'un algı alanı (m) bu yerde; yoksa künyeden (`BEDEN.duyu.algiMenzil`). Level verisinden: `algi.menzil`. */
  readonly algiMenzil?: number;
}

/**
 * Orion'un sistem mesajındaki DEĞİŞMEZ yer bilgisi (her tura tekrarlanmaz; spec 06 K3). Oda metni spec 06'dan beri
 * aynı ("In the room: …") — istem ölçümleri ve tools/ogretmen.ts ona dayanır; değiştirilmez. Başka yer: dışarıda
 * olduğunu ve oradaki adlandırılmış yerleri söyler. Çerçeve İngilizce, adlar Türkçe (spec 06 §6.8).
 */
export function yerSabitBilgisi(yer: Yer): string {
  const adlar = yer.capalar.map((c) => c.etiket).join(", ");
  return yer.ad === "oda" ? `In the room: ${adlar}.` : `Outside, in the ${yer.ad} (you left the room through its door): ${adlar}.`;
}

/** Durum defterinin konumu, hiçbir çapanın yanında değilken: odada "odanın ortası", dışarıda yerin adı. */
export function yerOrtasiSozu(yer: Yer): string {
  return yer.ad === "oda" ? "odanın ortası" : `dışarıda (${yer.ad})`;
}
