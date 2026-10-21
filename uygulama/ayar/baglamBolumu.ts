// uygulama/ayar/baglamBolumu.ts — AYAR PANELİ · BAĞLAM bölümü: otomatik sıkıştırma eşiği/aralığı ve md notları bütçesi (spec 34). DOM katmanı.
//
// YENİ TEL YOK: dört ayar devre panosunun HAFIZA düğümündeki düğmelerdir (`PANO_TELLERI.hafiza`, mind/tanim `hafiza.oto_*`, `hafiza.md_*`); yazma
// `pano.yaz`tan geçer, kalıcılığı `uygulama/hafizaAyari.ts` (tarayıcı deposu). Duvar ve Zihin sekmesiyle aynı tel: biri değişince öbürü görür.
"use strict";
import type { AyarBolumu } from "../../world/arayuz/ayarPaneli.ts";
import type { Pano } from "../../protocol/pano.ts";
import { panoListesiKur } from "./panoListesi.ts";
import { el } from "./dom.ts";

export const BAGLAM_DUGMELERI = ["hafiza.oto_esik", "hafiza.oto_aralik", "hafiza.md_toplam", "hafiza.md_dosya"] as const;

export interface BaglamBolumuAyari {
  pano: () => Pano | null;
  /** Başlık özeti için iki değer (telin kendisi; kopya değil). */
  esik: () => number;
  mdToplam: () => number;
}

export function baglamBolumu(a: BaglamBolumuAyari): AyarBolumu {
  return {
    id: "baglam", ad: "Bağlam", simge: "📦", sira: 50, ajanlar: ["orion"],
    ipucu: "Bağlamı şişirmeme: otomatik sıkıştırma ve md notları bütçesi (devre panosu · HAFIZA ile aynı teller)",
    ozet: () => `sıkıştır >${a.esik()} · md ${a.mdToplam()}`,
    kur(govde, arac) {
      govde.append(el("div", "ap-not", "Orion hafızadan yalnız SORULANI getirir; her turda giden notlar ve biriken ham anılar bu sınırlarla tutulur. Kalıcıdır (bu tarayıcı)."));
      const liste = panoListesiKur(govde, a.pano, BAGLAM_DUGMELERI, arac.bildir);
      return { goster: liste.tazele, tazele: liste.tazele };
    },
  };
}
