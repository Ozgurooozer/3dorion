// world/level/editor/cekirdek/kurtarma.ts — Çökme kurtarması (spec 23 A): kaydedilmemiş tanımın kopyası. Saf.
//
// Editör kirliyken (kaydedilmemiş değişiklik) birkaç saniye sessizlikte tanımın kopyası tarayıcıya yazılır;
// kaydedilince silinir. Sayfa açılınca kopya DOSYADAN FARKLIYSA kurtarma önerilir — kendiliğinden UYGULANMAZ
// (Ozyn seçer: Kurtar / Sil). Kopya, yüklendiği dosyanın imzasını da taşır: o arada dosya başka yerden
// kaydedildiyse ("dosya değişti") uyarılır — kurtarmak o kaydın üstüne yazmak demektir.
// Depolama enjekte (tarayıcıda localStorage; testte bellek).
"use strict";
import { levelTanimiDogrula, type LevelTanimi } from "../../cekirdek/levelTanimi.ts";

export interface KurtarmaKaydi {
  surum: 1;
  /** Yazıldığı an (ms). */
  zaman: number;
  tanim: LevelTanimi;
  /** Bu düzenleme oturumunun başladığı dosya içeriğinin imzası. */
  temel: string;
}

export interface KurtarmaDeposu {
  oku(ad: string): unknown;
  yaz(ad: string, k: KurtarmaKaydi): void;
  sil(ad: string): void;
}

/** İmza: tanımın kararlı metni (kısa olması gerekmez; karşılaştırma için). */
export const tanimImzasi = (t: LevelTanimi): string => JSON.stringify(t);

export interface KurtarmaOnerisi {
  kayit: KurtarmaKaydi;
  /** Kopya alındıktan sonra dosya başka yerden kaydedilmiş (kurtarmak onun üstüne yazar). */
  dosyaDegisti: boolean;
  /** Nesne sayısı farkı (kopya − dosya): şeritte "N nesne" bilgisi. */
  nesneFarki: number;
}

/** Saklanan değer geçerli bir kayıt mı (bozuk/eski biçim sessizce yok sayılır, öneri çıkmaz). */
export function kurtarmaKaydiMi(v: unknown): v is KurtarmaKaydi {
  if (typeof v !== "object" || v === null) return false;
  const k = v as Record<string, unknown>;
  return k["surum"] === 1 && typeof k["zaman"] === "number" && typeof k["temel"] === "string" && levelTanimiDogrula(k["tanim"]).ok;
}

/** Açılışta: kopya var ve şimdiki dosyadan farklıysa öneri; değilse null. */
export function kurtarmaOnerisi(saklanan: unknown, dosya: LevelTanimi): KurtarmaOnerisi | null {
  if (!kurtarmaKaydiMi(saklanan)) return null;
  const dosyaImza = tanimImzasi(dosya);
  if (tanimImzasi(saklanan.tanim) === dosyaImza) return null;
  return {
    kayit: saklanan,
    dosyaDegisti: saklanan.temel !== dosyaImza,
    nesneFarki: (saklanan.tanim.nesneler?.length ?? 0) - (dosya.nesneler?.length ?? 0),
  };
}

/** Yazılacak kayıt (kirli değilse yazılmaz: null → sil). */
export const kurtarmaKaydi = (tanim: LevelTanimi, kirli: boolean, temel: string, zaman: number): KurtarmaKaydi | null =>
  kirli ? { surum: 1, zaman, tanim, temel } : null;
