// world/avatar/bosta.ts — Boşta mikro-hareket: SAF, Babylon YOK.
//
// "Odada biri var" hissinin yarısı burada. Hiçbir şey yapmayan bir avatar
// hareketsiz durursa manken olur; nefes alıp ağırlığını aktarırsa canlı olur.
//
// KAPSAM SINIRI (önemli): burası KARAR VERMEZ. Ne yapacağına karar vermek
// T6'nın (mind/) işi. Bu dosya yalnızca "hangi anda gövde kaç milimetre
// oynuyor" sorusuna yanıt verir. Niyet üretmez, hedef seçmez, bakış yönü
// önermez.
//
// Saf ve DETERMİNİSTİK: aynı `t` her zaman aynı sonucu verir. `Math.random`
// yok — yoksa test edilemez ve iki çalıştırma karşılaştırılamaz.
"use strict";

/** Nefes döngüsü (saniye) — sakin bir yetişkin ≈ 14 soluk/dk. */
export const NEFES_PERIYODU = 4.2;
/** Ağırlık aktarma döngüsü. Nefesle aynı periyoda düşmesin: ritim mekanik olur. */
export const AGIRLIK_PERIYODU = 7.3;
/** Göz kırpma taban aralığı; üstüne determinist sapma eklenir. */
export const KIRPMA_TABANI = 3.2;
/** Bir göz kırpmanın süresi. */
export const KIRPMA_SURESI = 0.13;

export interface BostaHareket {
  /** Nefes: -1..1. Beden bunu göğüs ölçeği / omuz yüksekliğine uygular. */
  nefes: number;
  /** Ağırlık aktarma: -1..1. Kalça yana kayması ve hafif gövde eğimi. */
  agirlik: number;
  /** Göz kapanma oranı 0..1. 0 = açık, 1 = tam kapalı. */
  gozKapali: number;
  /** Başın çok yavaş, amaçsız salınımı: -1..1. */
  basSalinimi: number;
}

/** Determinist sapma üreteci — periyot indeksinden 0..1. */
function sapma(n: number, tohum: number): number {
  const s = Math.sin(n * 12.9898 + tohum * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Boşta mikro-hareket. `t` dünya zamanı (saniye), `tohum` avatar başına sabit.
 *
 * Göz kırpma zamanlaması: her `KIRPMA_TABANI` uzunluğundaki pencerede bir kez,
 * pencere içindeki yeri determinist sapmayla kaydırılmış olarak. Böylece
 * kırpma düzenli bir metronom gibi duymaz ama tekrar edilebilir kalır.
 */
export function bostaHesapla(t: number, tohum = 0): BostaHareket {
  const nefes = Math.sin((t / NEFES_PERIYODU) * Math.PI * 2);
  const agirlik = Math.sin((t / AGIRLIK_PERIYODU) * Math.PI * 2 + 1.1);
  const basSalinimi =
    Math.sin(t * 0.21 + 0.7) * 0.6 + Math.sin(t * 0.13 + 2.1) * 0.4;

  const pencere = Math.floor(t / KIRPMA_TABANI);
  // Kırpma penceresinin içinde nerede: pencerenin ilk %70'ine yayılır.
  const basla = pencere * KIRPMA_TABANI + sapma(pencere, tohum) * KIRPMA_TABANI * 0.7;
  let gozKapali = 0;
  const gecen = t - basla;
  if (gecen >= 0 && gecen < KIRPMA_SURESI) {
    // Üçgen zarf: kapanıp açılır.
    const u = gecen / KIRPMA_SURESI;
    gozKapali = 1 - Math.abs(2 * u - 1);
  }

  return { nefes, agirlik, gozKapali, basSalinimi };
}
