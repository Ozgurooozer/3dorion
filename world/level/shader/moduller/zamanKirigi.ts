// world/level/shader/moduller/zamanKirigi.ts — Zaman kırığı (vault: hata türü "bölgesel gün/gece salınımı"): dünyada
// küre biçimli bir bölge BAŞKA BİR SAATTE yaşar — içi o saatin palet rampasıyla boyanır (öğlen ortasında gece
// cebi), sınırı dijital mavi titreşir, bölge nefes alır (yarıçap salınımı). Dünya uzayında, malzemelerde çalışır:
// kamera nereden bakarsa baksın bölge yerinde kalır.
"use strict";
import type { ShaderModulu } from "../modul.ts";
import { paletZamanda } from "../dunyaDurumu.ts";
import { GLITCH } from "../paletler.ts";

export const ZAMAN_KIRIGI_VARSAYILAN = {
  merkezX: 18,
  merkezZ: -24,
  yaricap: 20,
  /** Kenar yumuşaklığı (yarıçapa oran). */
  kenar: 0.18,
  guc: 0.92,
  /** Bölgenin içindeki saat farkı (12 = öğlen ↔ gece yarısı). */
  saatFarki: 12,
  /** Yarıçap nefesi (oran). */
  nabiz: 0.08,
  isilti: GLITCH.dijitalMavi,
};
export type ZamanKirigiAyari = typeof ZAMAN_KIRIGI_VARSAYILAN;

export const zamanKirigiModulu: ShaderModulu<ZamanKirigiAyari> = {
  tur: "zamanKirigi",
  aciklama: "Bölgesel zaman kırığı: küre bölge başka saatin paletinde yaşar, sınırı titreşir (vault: hata türü).",
  varsayilan: ZAMAN_KIRIGI_VARSAYILAN,
  aralik: {
    merkezX: { min: -150, max: 150, adim: 1 }, merkezZ: { min: -150, max: 150, adim: 1 }, yaricap: { min: 2, max: 120, adim: 1 },
    kenar: { min: 0.01, max: 0.8, adim: 0.01 }, guc: { min: 0, max: 1, adim: 0.01 }, saatFarki: { min: -12, max: 12, adim: 0.25 },
    nabiz: { min: 0, max: 0.5, adim: 0.01 },
  },
  ekranMi: false,
  kur(b, a) {
    let ayar = a;
    const k = b.uniform.kirik;
    return {
      ayarla(x) { ayar = x; },
      kare(d) {
        const p = paletZamanda(d.kareler, d.saat + ayar.saatFarki);
        k.acik = true;
        k.merkez = [ayar.merkezX, 0, ayar.merkezZ];
        k.yaricap = ayar.yaricap * (1 + ayar.nabiz * Math.sin(d.sure * 1.3));
        k.kenar = ayar.kenar;
        k.guc = ayar.guc;
        k.rampa = [p["r0"] ?? [0, 0, 0], p["r1"] ?? [0.2, 0.2, 0.3], p["r2"] ?? [0.4, 0.4, 0.5], p["r3"] ?? [0.7, 0.7, 0.8], p["r4"] ?? [1, 1, 1]];
        k.isilti = b.renk(ayar.isilti);
      },
      yokEt() { k.acik = false; },
    };
  },
};
