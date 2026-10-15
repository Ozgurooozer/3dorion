// mind/doktorKomutlari.ts — Doğuştan DOKTOR komutları: "doktor", "kendini kontrol et", "tam muayene" (token'sız).
//
// `komutSozlugu.ts`in ailesi (aynı ilke: sözün TAMAMI bir kalıba uymalı; yanlış eşleşme sessizlikten pahalıdır). Niyet: `doktor`
// (protocol/niyet.ts). Orion'un LLM aracıyla (`dunya_doktor`) AYNI niyeti üretir; fark yalnız maliyet: burada 0 token, ~0 ms.
// "Oturmak kadar kolay": Ozyn "doktor" der, Orion kendini muayene eder, sağlıklıysa kısa söyler, hastaysa neyin bozuk olduğunu söyler.
//
// Girdi `sozuNormalle` çıktısıdır (katlanmış, noktalamasız, dolgusuz: "Doktoru çağır!" → "doktoru cagir"). Saf.
// BİLEREK EŞLEŞMEYENLER (LLM'e gider): serbest sorular ("doktor ne işe yarar"), olumsuz ("kontrol etme"), birden çok istek.
"use strict";
import type { Niyet } from "../protocol/niyet.ts";
import type { KomutEslesmesi } from "./komutSozlugu.ts";

const doktor = (kapsam?: "hizli" | "tam"): KomutEslesmesi => ({
  program: "komut:doktor",
  adimlar: [{ tur: "doktor", ...(kapsam ? { kapsam } : {}) } as Niyet],
});

/** Hızlı (varsayılan) kalıplar. */
const HIZLI = /^(doktor( cagir| cagirsana)?|doktoru cagir(sana)?|doktora git|kendini (kontrol|muayene|test) et(sene)?|muayene ol(sana)?|hata kontrolu( yap)?|kontrol et|hizli (muayene|kontrol)( yap| ol)?)$/;
/** Tam kapsam: her efekti açıp kapatır (≈35 sn). */
const TAM = /^(tam (muayene|kontrol|test)( yap| ol)?|doktor tam|kendini tam (kontrol|muayene) et|tam kapsamli (muayene|kontrol)( yap)?)$/;

export function doktorCoz(s: string): KomutEslesmesi | null {
  if (TAM.test(s)) return doktor("tam");
  if (HIZLI.test(s)) return doktor();
  return null;
}
