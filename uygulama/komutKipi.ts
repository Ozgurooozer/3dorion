// uygulama/komutKipi.ts — Orion'un terminal komutu ONAYSIZ çalışsın mı (spec 26 F2; Ozyn, 2026-10-11: "terminal onaysız
// çalışsın sorun değil"). Saf karar: kip + komutun risk seviyesi → çalışsın mı.
//
// Üç kip:
//   otomatik  VARSAYILAN. Okuyan ve değiştiren komutlar hemen çalışır; YIKICI sınıf (rm -r, format, git reset --hard,
//             kapatma, Remove-Item…; mind/komutRiski.ts) yine Ozyn'in tuşunu bekler. Ozyn "sorun değil" dedi; yıkıcı
//             sınıf geri dönüşsüz hasar olduğu için varsayılanda korunur — tek ayarla kalkar (`tam`).
//   tam       Hepsi onaysız (riskli dahil).
//   onayli    Eski davranış: hepsi onay bekler.
// Seçim: URL `?komutkipi=` (host: ORION_KOMUT_KIPI). Bilinmeyen değer HATA değil, varsayılana düşer ama çağıran görür.
"use strict";
import type { RiskSeviyesi } from "../mind/komutRiski.ts";

export const KOMUT_KIPLERI = ["otomatik", "tam", "onayli"] as const;
export type KomutKipi = (typeof KOMUT_KIPLERI)[number];
export const KOMUT_KIPI_VARSAYILAN: KomutKipi = "otomatik";

/** URL/env değerinden kip; geçersizse varsayılan (`gecerli: false`: çağıran uyarı yazabilir). */
export function komutKipiCoz(ham: string | null | undefined): { kip: KomutKipi; gecerli: boolean } {
  if (!ham) return { kip: KOMUT_KIPI_VARSAYILAN, gecerli: true };
  const k = (KOMUT_KIPLERI as readonly string[]).includes(ham) ? (ham as KomutKipi) : null;
  return k ? { kip: k, gecerli: true } : { kip: KOMUT_KIPI_VARSAYILAN, gecerli: false };
}

/** Bu kipte bu risk seviyesindeki komut onaysız çalışsın mı. */
export function onaysizCalissinMi(kip: KomutKipi, seviye: RiskSeviyesi): boolean {
  if (kip === "onayli") return false;
  if (kip === "tam") return true;
  return seviye !== "yikici";
}
