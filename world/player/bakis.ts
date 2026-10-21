// world/player/bakis.ts — "Ozyn bir şeye bakıyor" koni sabiti (tek kaynak, saf).
//
// Oyuncu durumu (oyuncu.ts: Orion'a bakıyor mu) ve ajanın gözü (uygulama/ajanlar/ajanAlgisi.ts: Flash'a bakıyor mu) AYNI konik toleransı
// kullanır; iki kopya ayrışırsa Orion'a "bakıyor" Flash'a "bakmıyor" sayılırdı. Babylon bağımlılığı yok: sabit saf testten de alınır.
"use strict";

/** Bakış yönü ile hedef yönü arasındaki en geniş açı (rad, ≈28°) ve kosinüsü. */
export const BAKIS_ACISI = 0.49;
export const BAKIS_KOSINUS = Math.cos(BAKIS_ACISI);
