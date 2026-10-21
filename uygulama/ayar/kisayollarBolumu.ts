// uygulama/ayar/kisayollarBolumu.ts — AYAR PANELİ · KISAYOLLAR bölümü: ayrıntılı ekranlara tek tık (spec 34). DOM katmanı.
// Her kısayol başka bir modülün KENDİ açılış yolunu çağırır (Yapı çubuğu `ac(sekme)`, M seçici `ac`); burada yeni bir ekran ya da kopya yok.
"use strict";
import type { AyarBolumu } from "../../world/arayuz/ayarPaneli.ts";
import { dugme, el } from "./dom.ts";

export interface Kisayol {
  ad: string;
  ipucu: string;
  /** Açıldıysa true; açılamadıysa nedeni (altyazıda söylenir). */
  calistir: () => true | string;
}

export function kisayollarBolumu(kisayollar: readonly Kisayol[]): AyarBolumu {
  return {
    id: "kisayollar", ad: "Kısayollar", simge: "↗", sira: 90, ajanlar: ["orion"],
    ipucu: "Zihin ve Hafıza sekmeleri, model seçici",
    kur(govde, arac) {
      const satir = el("div", "ap-satir");
      satir.style.flexWrap = "wrap";
      satir.append(...kisayollar.map((k) => dugme(k.ad, k.ipucu, () => { const r = k.calistir(); if (r !== true) arac.bildir(`${k.ad}: ${r}`, 2500); })));
      govde.append(satir);
      return {};
    },
  };
}
