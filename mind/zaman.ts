// mind/zaman.ts — süreyi insan diline çeviren iki cümle kalıbı.
//
// Orion "1847000 ms" demez. Kabalık bilinçli: dakika hassasiyeti bir varlık
// için yeter ve sayı kalabalığı bağlamı şişirir.
//
// İKİ AYRI KALIP, karıştırılmaz:
//   sureSozu   → SÜREKLİLİK: "3 saattir bu odadasın"
//   oncesiSozu → GEÇMİŞ AN:  "3 saat önce Ozyn komutu reddetti"
// "3 saattir Ozyn komutu reddetti" bozuk Türkçedir ve bozuk Türkçe modelin
// de diline bulaşır (world/zamanSozu.test.ts'in ilk gerekçesi buydu).
//
// `world/giris.ts` içindeydi; testi mantığın KOPYASINI tutmak zorunda
// kalıyordu çünkü giris.ts sahneye bağlı. Buraya taşındı: tek kaynak.
//
// SAF: bağımlılık yok.
"use strict";

const DK = 60_000;

/** "az önce" · "12 dakikadır" · "3 saattir" · "2 gündür" */
export function sureSozu(ms: number): string {
  const dk = Math.floor(ms / DK);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dakikadır`;
  const saat = Math.floor(dk / 60);
  return saat < 24 ? `${saat} saattir` : `${Math.floor(saat / 24)} gündür`;
}

/**
 * "az önce" · "12 dakika önce" · "3 saat önce" · "2 gün önce"
 *
 * Anıların ÖNÜNE yazılır (spec 06 K3). Zamansız bir anı, model için
 * şimdiki bilgiden ayırt edilemez: canlı kayıtta Orion'un önüne günler
 * öncesinin "Ozyn komutu reddetti" anısı zamansız olarak geliyordu.
 */
export function oncesiSozu(ms: number): string {
  const dk = Math.floor(ms / DK);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dakika önce`;
  const saat = Math.floor(dk / 60);
  return saat < 24 ? `${saat} saat önce` : `${Math.floor(saat / 24)} gün önce`;
}
