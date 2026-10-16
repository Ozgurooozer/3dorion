// world/player/oturma.ts — Oyuncunun oturma/kalkma NOKTALARI: bir çapadan (`bank`, `sandalye`) hesaplanır. SAF (Babylon yok, durum yok).
//
// Neden ayrı: `oyuncu.ts` Babylon sahnesi ister ve birim testi yok; konum aritmetiği burada testlenir, oyuncu yalnız uygular.
// Poz yok (bedende oturma klibi yok): oturan beden, kalçası oturma yüzeyine denk gelecek kadar aşağı iner (ayak konumu = yüzey − `KALCA_YUKSEKLIGI`);
// bacaklar zemine/bankın altına gömülür, göz yüksekliği de doğal oturma gözüne iner. Gerçek oturma klibi gelince bu sabit kalkar.
"use strict";
import type { Capa } from "../level/capalar.ts";

/** Ayaktan kalçaya yükseklik (m): oturunca ayak konumu bu kadar aşağı iner. */
export const KALCA_YUKSEKLIGI = 0.9;

export interface OturmaNoktasi { x: number; y: number; z: number; yaw: number }

/** Çapaya oturulunca ayak konumu ve bakış yönü. Yön: `oturmaYonu`, yoksa çapanın `yon`u (sandalye masaya bakar). */
export function oturmaNoktasi(c: Capa): OturmaNoktasi {
  const d = c.oturmaYonu ?? c.yon;
  return { x: c.konum.x, y: c.konum.y - KALCA_YUKSEKLIGI, z: c.konum.z, yaw: Math.atan2(d.x, d.z) };
}

/** Kalkınca oyuncunun konulacağı yer (XZ): çapanın durağı. Yükseklik çağıranda yerden okunur. */
export function kalkmaNoktasi(c: Capa): { x: number; z: number } {
  return { x: c.durak.x, z: c.durak.z };
}
