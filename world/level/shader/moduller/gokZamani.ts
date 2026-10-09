// world/level/shader/moduller/gokZamani.ts — Gök zamanı: gök kubbesi saatle şafak/akşam/gece rengine döner, gece
// yıldızlar (yön ızgarasında karma, titreşen) ve ay diski çıkar. Gündüz gök, level paletindeki kendi renginde kalır
// (karışım gece ve alacakaranlıkla artar). Geometri yeniden pişirilmez: hepsi dünya eklentisinin gök dalı.
"use strict";
import type { ShaderModulu } from "../modul.ts";

export const GOK_ZAMANI_VARSAYILAN = {
  /** Gecede/alacakaranlıkta gök renginin zaman paletine dönme gücü. */
  guc: 1,
  /** Yıldız yoğunluğu (0 = yok). */
  yildiz: 1,
  /** Ay diskinin açısal yarıçapı (derece). */
  ayBoyu: 1.6,
  ay: "#e8eeff",
};
export type GokZamaniAyari = typeof GOK_ZAMANI_VARSAYILAN;

export const gokZamaniModulu: ShaderModulu<GokZamaniAyari> = {
  tur: "gokZamani",
  aciklama: "Gece göğü: saatle şafak/akşam/gece renkleri, yıldızlar ve ay (geometri yeniden pişirilmez).",
  varsayilan: GOK_ZAMANI_VARSAYILAN,
  aralik: { guc: { min: 0, max: 1, adim: 0.01 }, yildiz: { min: 0, max: 3, adim: 0.05 }, ayBoyu: { min: 0.2, max: 6, adim: 0.1 } },
  ekranMi: false,
  kur(b, a) {
    let ayar = a;
    const g = b.uniform.gok;
    return {
      ayarla(x) { ayar = x; },
      kare(d) {
        g.karisim = ayar.guc * Math.max(d.gece, d.alacakaranlik * 0.85);
        if (d.palet["gokZenit"]) g.zenit = d.palet["gokZenit"];
        if (d.palet["gokUfuk"]) g.ufuk = d.palet["gokUfuk"];
        g.yildiz = ayar.yildiz * d.gece;
        g.ayYonu = d.ayYonu;
        g.ayBoyu = Math.cos((ayar.ayBoyu * Math.PI) / 180);
        g.ayRengi = b.renk(ayar.ay);
      },
      yokEt() { g.karisim = 0; g.yildiz = 0; },
    };
  },
};
