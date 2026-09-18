// mind/zaman.ts — süreyi bağlam diline çeviren iki cümle kalıbı.
//
// Orion "1847000 ms" demez. Kabalık bilinçli: dakika hassasiyeti bir varlık
// için yeter ve sayı kalabalığı bağlamı şişirir.
//
// İKİ AYRI KALIP, karıştırılmaz:
//   sureSozu   → SÜREKLİLİK: "for 3 hours" → "you have been in this room for 3 hours"
//   oncesiSozu → GEÇMİŞ AN:  "3 hours ago"  → "[3 hours ago] Ozyn rejected the command"
// İkisini karıştırmak bozuk cümle üretir ve bozuk dil modelin de diline
// bulaşır (world/zamanSozu.test.ts'in ilk gerekçesi buydu).
//
// ÇIKTI İNGİLİZCE (2026-09-18, ölçüldü — spec 06 §6.8): bu satırlar bağlamın
// ÇERÇEVESİ, Orion'un sesi değil. Türkçe çerçevede yerel model 1. turda
// 10 denemenin 10'unda yanlış araç seçiyordu; İngilizce çerçevede 9/10 doğru.
//
// `world/giris.ts` içindeydi; testi mantığın KOPYASINI tutmak zorunda
// kalıyordu çünkü giris.ts sahneye bağlı. Buraya taşındı: tek kaynak.
//
// SAF: bağımlılık yok.
"use strict";

const DK = 60_000;

/** "just now" · "for 12 minutes" · "for 3 hours" · "for 2 days" */
export function sureSozu(ms: number): string {
  const dk = Math.floor(ms / DK);
  if (dk < 1) return "just now";
  if (dk < 60) return `for ${dk} minutes`;
  const saat = Math.floor(dk / 60);
  return saat < 24 ? `for ${saat} hours` : `for ${Math.floor(saat / 24)} days`;
}

/**
 * "just now" · "12 minutes ago" · "3 hours ago" · "2 days ago"
 *
 * Anıların ÖNÜNE yazılır (spec 06 K3). Zamansız bir anı, model için
 * şimdiki bilgiden ayırt edilemez: canlı kayıtta Orion'un önüne günler
 * öncesinin "Ozyn komutu reddetti" anısı zamansız olarak geliyordu.
 */
export function oncesiSozu(ms: number): string {
  const dk = Math.floor(ms / DK);
  if (dk < 1) return "just now";
  if (dk < 60) return `${dk} minutes ago`;
  const saat = Math.floor(dk / 60);
  return saat < 24 ? `${saat} hours ago` : `${Math.floor(saat / 24)} days ago`;
}

// Aşağıdaki üçü `world/giris.ts` içindeydi ve `mind/zaman.test.ts` onların
// KOPYASINI tutuyordu — çünkü giris.ts sahneye bağlı, testten çağrılamıyor.
// `sureSozu` için bu bir kez çözülmüştü; kalan üçü geride kalmış ve dil
// değişiminde sessizce ayrışmıştı (test eski Türkçeyi doğruluyor, üretim
// İngilizce veriyordu). Buraya taşındılar: tek kaynak, test gerçeği sınıyor.

/**
 * "Ne kadardır buradayım" cümlesi.
 *
 * Süreyi cümleye GÖMMEK gerekiyor, yan yana koymak değil: ilk sürüm
 * `${sureSozu(...)} bu odadasin` diyordu ve bir dakikanın altında
 * "az önce bu odadasin" gibi bozuk bir cümle çıkıyordu. Beynin okuyacağı
 * metin bu; bozuk dil modelin de diline bulaşır.
 */
export function odadaSure(ms: number): string {
  if (Math.floor(ms / DK) < 1) return "You have just arrived in this room.";
  return `You have been in this room ${sureSozu(ms)}.`;
}

/** Sessizliğin ne kadar sürdüğü — varlığın farkında olması gereken şey. */
export function sessizlikSozu(ms: number): string {
  if (Math.floor(ms / DK) < 1) return "Ozyn spoke just now.";
  return `You and Ozyn have not spoken ${sureSozu(ms)}.`;
}

/**
 * Günün hangi vakti — "14:32" yerine yaşanan bir zaman.
 *
 * Saati SAYI olarak alır, `Date` değil: saf kalsın ve test saat 03:00'ü
 * beklemek zorunda kalmasın.
 */
export function gununVakti(saat: number): string {
  if (saat < 5) return "the middle of the night";
  if (saat < 12) return "morning";
  if (saat < 17) return "afternoon";
  if (saat < 21) return "evening";
  return "night";
}
