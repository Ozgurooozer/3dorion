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
  /** Güneş ışığının atmosferden geçerken kızarması (0 = palet rengi aynen, 1 = tam fiziksel renk). */
  gunesRengi: 0.85,
};
export type AtmosferAyari = typeof ATMOSFER_VARSAYILAN;

export const atmosferModulu: ShaderModulu<AtmosferAyari> = {
  tur: "atmosfer",
  aciklama: "Fiziksel gök (Babylon atmosphere addon): gün batımı kızıllığı, çoklu saçılım. Kubbe yerine geçer.",
  varsayilan: ATMOSFER_VARSAYILAN,
  aralik: {
    pozlama: { min: 0.1, max: 4, adim: 0.05 }, cokluSacilim: { min: 0, max: 3, adim: 0.05 },
    rayleigh: { min: 0, max: 4, adim: 0.05 }, mie: { min: 0, max: 4, adim: 0.05 }, geceTaban: { min: 0, max: 0.3, adim: 0.005 }, gunesRengi: { min: 0, max: 1, adim: 0.01 },
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
    let ayar = a;
    const iletilen = { r: 1, g: 1, b: 1 };
    return {
      ayarla(x) { ayar = x; uygula(x); },
      kare(d) {
        // Güneş ışığı rengi: atmosferin iletim tablosundan (ufka yaklaştıkça kızıl). Parlaklık değil yalnız ton —
        // şiddeti ışık sistemi (zamanUygula) belirler. Tablo hazır değilse ya da güneş ufkun altındaysa palet rengi kalır.
        if (!atmosfer.transmittanceLut || d.gunesYonu[1] <= 0.01 || ayar.gunesRengi <= 0) return;
        const r = atmosfer.physicalProperties.planetRadius + 0.002;   // km: yerden ~2 m
        atmosfer.getTransmittedColorToRef({ x: d.gunesYonu[0], y: d.gunesYonu[1], z: d.gunesYonu[2] }, r, { x: 0, y: 1, z: 0 }, iletilen);
        const en = Math.max(iletilen.r, iletilen.g, iletilen.b, 1e-6), k = ayar.gunesRengi;
        isik.diffuse.r *= 1 + (iletilen.r / en - 1) * k;
        isik.diffuse.g *= 1 + (iletilen.g / en - 1) * k;
        isik.diffuse.b *= 1 + (iletilen.b / en - 1) * k;
      },
      yokEt() { atmosfer.dispose(); if (kubbe) kubbe.isVisible = kubbeVardi; },
    };
  },
};
