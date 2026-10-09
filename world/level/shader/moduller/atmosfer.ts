// world/level/shader/moduller/atmosfer.ts — Fiziksel atmosfer (Babylon `@babylonjs/addons/atmosphere`, deneysel): Rayleigh/Mie
// saçılımlı gök, güneşin gün batımında kızarması, çoklu saçılım. Ova'nın gündüz/akşam göğünü fiziksel verir; ay, yıldız ve
// stilize dünyalar (siberpunk, büyü) `gokZamani`nda kalır.
//
// Sınır (eklenti belgesi): uzaklık sisi (aerial perspective) sonsuz uzak düzlem + doğrusal olmayan derinlik ister, bizim
// kameramız sonlu uzak düzlemli ve derinlik doğrusal — sis burada AÇILMAZ, sis ışık sisteminin ufuk rengine bağlı kalır.
// Gök yalnız gökyüzü: kubbe mesh'i gizlenir, eklenti kareyi gök grubunda çizer.
"use strict";
import { Atmosphere } from "@babylonjs/addons/atmosphere/atmosphere";
import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import type { ShaderModulu } from "../modul.ts";

export const ATMOSFER_VARSAYILAN = {
  /** Gök parlaklığı. */
  pozlama: 1,
  /** Çoklu saçılım (gölgedeki gök aydınlığı). */
  cokluSacilim: 1,
  /** Rayleigh saçılımı çarpanı (mavilik). */
  rayleigh: 1,
  /** Mie saçılımı çarpanı (güneş çevresi hâlesi, sis). */
  mie: 1,
  /** Gece için asgari çoklu saçılım (tam karanlık olmasın). */
  geceTaban: 0.02,
};
export type AtmosferAyari = typeof ATMOSFER_VARSAYILAN;

export const atmosferModulu: ShaderModulu<AtmosferAyari> = {
  tur: "atmosfer",
  aciklama: "Fiziksel gök (Babylon atmosphere addon): gün batımı kızıllığı, çoklu saçılım. Kubbe yerine geçer.",
  varsayilan: ATMOSFER_VARSAYILAN,
  aralik: {
    pozlama: { min: 0.1, max: 4, adim: 0.05 }, cokluSacilim: { min: 0, max: 3, adim: 0.05 },
    rayleigh: { min: 0, max: 4, adim: 0.05 }, mie: { min: 0, max: 4, adim: 0.05 }, geceTaban: { min: 0, max: 0.3, adim: 0.005 },
  },
  ekranMi: false,
  kur(b, a) {
    const sahne = b.sahne;
    const isik = sahne.getLightByName("isik_gunes") as DirectionalLight | null;
    if (!isik || !Atmosphere.IsSupported(sahne.getEngine())) return { ayarla() {}, kare() {}, yokEt() {} };
    const atmosfer = new Atmosphere("atmosfer", sahne, [isik]);
    atmosfer.isLinearSpaceComposition = true;
    atmosfer.isLinearSpaceLight = true;
    const kubbe = sahne.getMeshByName("gok");
    const kubbeVardi = kubbe?.isVisible ?? false;
    if (kubbe) kubbe.isVisible = false;
    const taban = { r: atmosfer.physicalProperties.peakRayleighScattering.clone(), m: atmosfer.physicalProperties.mieScatteringScale };
    const uygula = (x: AtmosferAyari) => {
      atmosfer.exposure = x.pozlama;
      atmosfer.multiScatteringIntensity = x.cokluSacilim;
      atmosfer.minimumMultiScatteringIntensity = x.geceTaban;
      atmosfer.physicalProperties.peakRayleighScattering.copyFrom(taban.r.scale(x.rayleigh));
      atmosfer.physicalProperties.mieScatteringScale = taban.m * x.mie;
    };
    uygula(a);
    return {
      ayarla: uygula,
      kare() { /* güneş yönü ışıktan okunur (isikSistemi.zamanUygula) */ },
      yokEt() { atmosfer.dispose(); if (kubbe) kubbe.isVisible = kubbeVardi; },
    };
  },
};
