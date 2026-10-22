// uygulama/sekans/geciciKlipler.ts — SEKANSIN GEÇİCİ KLİP KATMANI (spec 36): bedenlerin klip bulucusu = kütüphane + oynayan sekansın derlenmiş klipleri. SAF.
//
// NEDEN (oynatıcı bedene nasıl bağlanır): projede TEK eylem yolu var — `jest` niyetinin `klip` alanı; beden klibi adla, ÇAĞRI ANINDA bulucusundan arar
// (`world/avatar/yurutucu.ts`). Sekans oynarken bağlama başına derlenmiş klip (`derleyici.ts`) bu katmana konur ve AYNI niyet yolundan istenir
// (`niyetDogrula` → ajanın kapısı → beden). Bedene ikinci bir kapı (doğrudan uzuv sürücüsü, ayrı "sekans kanalı") AÇILMADI.
//
// KURALLAR:
//   • Geçici adlar `sekans__` ile başlar (klip adı kuralına uyar: `[a-z0-9_]`). Kütüphanede bu önekle bir klip olsa bile geçici katman yalnız KENDİ
//     kaydına bakar; önekli ad kütüphaneden ASLA çözülmez (bir dosya oynayan sekansın yerine geçemesin).
//   • `adlar()` yalnız kütüphanenin adlarıdır: geçici klipler grafiğin "Animasyon oynat" seçeneklerinde ve "bilinmeyen klip (yüklü: …)" metninde GÖRÜNMEZ.
//   • Tavanlı (16 = 8 bağlama × 2): oynatıcı her bitişte kaldırır; unutulan kayıt birikmesin, birikirse nedenle reddedilir.
//   • Bedene verilen klip nesnesi bedende kalır (yürütücü başlarken alır): oynatma bitince kaydı kaldırmak süren oynamayı bozmaz.
"use strict";
import type { AnimasyonKlibi } from "../../protocol/animasyon.ts";
import type { KlipBulucu } from "../../world/avatar/index.ts";

export const GECICI_ONEK = "sekans__";
export const GECICI_AZAMI = 16;

export interface GeciciKlipKatmani extends KlipBulucu {
  /** Geçici klibi koyar (adı `GECICI_ONEK` ile başlamalı, tekil). Sonuç nedenli. */
  ekle(k: AnimasyonKlibi): { ok: true } | { ok: false; neden: string };
  kaldir(ad: string): void;
  /** Kayıtlı geçici klip sayısı (testler, sızıntı bekçisi). */
  sayi(): number;
}

export function geciciKlipKatmaniKur(taban: KlipBulucu): GeciciKlipKatmani {
  const gecici = new Map<string, AnimasyonKlibi>();
  return {
    bul: (ad) => (ad.startsWith(GECICI_ONEK) ? gecici.get(ad) ?? null : taban.bul(ad)),
    adlar: () => taban.adlar(),
    ekle(k) {
      if (!k.ad.startsWith(GECICI_ONEK)) return { ok: false, neden: `geçici klip adı '${GECICI_ONEK}' ile başlamalı (gelen '${k.ad}')` };
      if (gecici.has(k.ad)) return { ok: false, neden: `'${k.ad}' zaten kayıtlı` };
      if (gecici.size >= GECICI_AZAMI) return { ok: false, neden: `en çok ${GECICI_AZAMI} geçici klip (oynayan sekanslar kaldırmadı mı?)` };
      gecici.set(k.ad, k);
      return { ok: true };
    },
    kaldir: (ad) => { gecici.delete(ad); },
    sayi: () => gecici.size,
  };
}
