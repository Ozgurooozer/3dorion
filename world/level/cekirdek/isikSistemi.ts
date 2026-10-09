// world/level/cekirdek/isikSistemi.ts — Level'in TEK ışık düzeni: güneş + kademeli gölge, gök dolgusu,
// görüntü işleme (ton eşleme, pozlama, kontrast), sis ve arka plan.
//
// Babylon'da dış mekân için yerleşik desen (araştırma, 2026-10-08): tek GÜNEŞ (yönlü ışık + kademeli gölge
// haritası), ondan belirgin DÜŞÜK bir dolgu (gök/ortam) ve görüntü işleme. Dolgu güneşe yaklaşırsa gölgeli
// taraf dolar ve gölgeler kaybolur — ova'nın ilk sürümü tam olarak buydu ("ışıklandırma yok").
//
// Modüller ışığa dokunmaz; gölge atan/alan mesh'lerini `golgeyeKat` ile kaydeder. Ayarlar canlı değişebilir
// (`uygula`): gölge çözünürlüğü ya da kademe sayısı değişirse üreteç yeniden kurulur, kayıtlı mesh'ler korunur.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { Scene as SahneSinifi } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import type { IsikAyari, OrtamAyari, Vec3 } from "./levelTanimi.ts";
import type { Renk } from "./renk.ts";

export interface IsikSistemi {
  readonly gunes: DirectionalLight;
  readonly dolgu: HemisphericLight;
  /** Güneşe doğru birim yön. */
  gunesYonu(): Vec3;
  golgeyeKat(mesh: AbstractMesh, ne: { atar?: boolean; alir?: boolean }): void;
  golgedenCikar(mesh: AbstractMesh): void;
  uygula(isik: IsikAyari, ortam: OrtamAyari, renk: (ad: string) => Renk): void;
  yokEt(): void;
}

const c3 = (r: Renk) => new Color3(r[0], r[1], r[2]);

/** Güneşe doğru yönü birim vektöre çevirir (tanımda elle yazılan yön normalize olmayabilir). */
export function birimYon(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function isikSistemiKur(sahne: Scene): IsikSistemi {
  const dolgu = new HemisphericLight("isik_dolgu", new Vector3(0, 1, 0), sahne);
  const gunes = new DirectionalLight("isik_gunes", new Vector3(0, -1, 0), sahne);
  let yon: Vec3 = [0, 1, 0];
  let golge: CascadedShadowGenerator | null = null;
  let golgeAyari = "";
  const atanlar = new Set<AbstractMesh>();
  const alanlar = new Set<AbstractMesh>();

  const golgeKur = (a: IsikAyari["gunes"]["golge"]) => {
    golge?.dispose();
    golge = null;
    if (!a.acik) return;
    const g = new CascadedShadowGenerator(a.boyut, gunes);
    g.numCascades = a.kademe;
    g.shadowMaxZ = a.uzaklik;
    g.lambda = 0.85;                 // yakın kademeye daha çok çözünürlük (yürüyen kamera)
    g.stabilizeCascades = true;      // kamera dönerken gölge kenarı titremesin
    g.usePercentageCloserFiltering = true;
    g.filteringQuality = a.yumusaklik > 0.66 ? CascadedShadowGenerator.QUALITY_HIGH
      : a.yumusaklik > 0.33 ? CascadedShadowGenerator.QUALITY_MEDIUM : CascadedShadowGenerator.QUALITY_LOW;
    g.bias = 0.004;
    g.normalBias = 0.02;
    // Sağlam gölge (spec 19): kademeler görünen derinliğe sıkışır, uzak düzlem kırpılmaz, geçişler karışır.
    g.autoCalcDepthBounds = a.otomatikSinir ?? true;
    g.depthClamp = true;
    g.cascadeBlendPercentage = a.karisim ?? 0.1;
    if ((a.kip ?? 0) === 1) {
      g.usePercentageCloserFiltering = false;
      g.useContactHardeningShadow = true;
      g.contactHardeningLightSizeUVRatio = 0.02 + a.yumusaklik * 0.1;
      g.penumbraDarkness = 0;
    }
    for (const m of atanlar) g.addShadowCaster(m, false);
    golge = g;
  };

  return {
    gunes, dolgu,
    gunesYonu: () => yon,
    golgeyeKat(mesh, ne) {
      if (ne.atar) { atanlar.add(mesh); golge?.addShadowCaster(mesh, false); }
      if (ne.alir) { alanlar.add(mesh); mesh.receiveShadows = true; }
    },
    golgedenCikar(mesh) {
      atanlar.delete(mesh); alanlar.delete(mesh);
      golge?.removeShadowCaster(mesh, false);
    },
    uygula(isik, ortam, renk) {
      yon = birimYon(isik.gunes.yon);
      gunes.direction = new Vector3(-yon[0], -yon[1], -yon[2]);
      gunes.diffuse = c3(renk(isik.gunes.renk));
      gunes.specular = Color3.Black();
      gunes.intensity = isik.gunes.siddet;
      dolgu.diffuse = c3(renk(isik.dolgu.ust));
      dolgu.groundColor = c3(renk(isik.dolgu.alt));
      dolgu.specular = Color3.Black();
      dolgu.intensity = isik.dolgu.siddet;

      // Gölge: yalnız üreteci etkileyen ayarlar değişince yeniden kur; koyuluk canlı.
      const g = isik.gunes.golge;
      const anahtar = JSON.stringify([g.acik, g.boyut, g.kademe, g.uzaklik, g.yumusaklik, g.otomatikSinir, g.kip]);
      if (anahtar !== golgeAyari) { golgeAyari = anahtar; golgeKur(g); }
      if (golge) { golge.darkness = g.koyuluk; golge.cascadeBlendPercentage = g.karisim ?? 0.1; }

      sahne.clearColor = new Color4(...renk(ortam.arkaPlan), 1);
      sahne.fogMode = ortam.sis.acik ? SahneSinifi.FOGMODE_EXP2 : SahneSinifi.FOGMODE_NONE;
      sahne.fogColor = c3(renk(ortam.sis.renk));
      sahne.fogDensity = ortam.sis.yogunluk;

      // Ton eşleme AÇIK/TÜRÜ stilden gelir (stil.son.tonlama, isikSonrasi.ts); burada level tabanı: pozlama, kontrast.
      const ip = sahne.imageProcessingConfiguration;
      ip.exposure = ortam.tonlama.pozlama;
      ip.contrast = ortam.tonlama.kontrast;

      // Piksel kipi: iç çözünürlüğü düşür, tuvali en-yakın komşuyla büyüt (bulanık değil keskin piksel).
      const motor = sahne.getEngine(), piksel = ortam.piksel ?? 1;
      if (motor.getHardwareScalingLevel() !== piksel) motor.setHardwareScalingLevel(piksel);
      const tuval = motor.getRenderingCanvas();
      if (tuval) tuval.style.imageRendering = piksel > 1 ? "pixelated" : "";
    },
    yokEt() {
      golge?.dispose();
      gunes.dispose();
      dolgu.dispose();
      atanlar.clear(); alanlar.clear();
    },
  };
}
