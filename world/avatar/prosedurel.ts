// world/avatar/prosedurel.ts — Kodla üretilen yedek avatar.
//
// molp `Terminal/scene/ProceduralAvatar.ts` referans alındı, KOPYALANMADI:
// oradaki `registerBeforeRender` içinde t sayacı tutan ve kendi poz
// animasyonunu koşturan yapı burada YOK. Bu iskelet karar vermez — `beden.ts`
// ne uygulayacağını söyler, burası uygular. Animasyon zamanı dışarıdan gelir,
// yoksa 20 Hz mantık / serbest FPS çizim ayrımı bozulurdu.
//
// Neden var: `orion.vrm` bozuksa, indirilmemişse ya da GPU'da yüklenemezse
// dünya avatarsız kalmaz. Dış dosya gerektirmez, her zaman çalışır.
//
// Ağız: gerçek bir çene mesh'i var, `agizUygula` onu açar. VRM yolunun
// aksine burada blend shape'e bağımlılık yok.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Jest, Poz } from "../../protocol/niyet.ts";
import type { AvatarIskeleti, IskeletBilgisi } from "./iskelet.ts";

/** Hedef boy — VRM yolu da bu boya normalize edilir, ikisi aynı ölçekte durur. */
export const BOY = 1.75;

const TAU = Math.PI * 2;

function mat(sahne: Scene, ad: string, r: number, g: number, b: number, parlak = 0): StandardMaterial {
  const m = new StandardMaterial(ad, sahne);
  m.diffuseColor = new Color3(r, g, b);
  m.emissiveColor = new Color3(r * parlak, g * parlak, b * parlak);
  m.specularColor = new Color3(0.05, 0.05, 0.07);
  return m;
}

/**
 * Blok-tarzı Orion. Ölçüler `BOY` üstünden oranlıdır: boy değişirse tüm
 * parçalar birlikte ölçeklenir, elle sayı düzeltmek gerekmez.
 */
export function prosedurelIskelet(sahne: Scene): AvatarIskeleti {
  const kok = new TransformNode("orion_kok", sahne);

  const govdeMat = mat(sahne, "orion_govde", 0.10, 0.11, 0.16, 0.18);
  const koyuMat = mat(sahne, "orion_koyu", 0.16, 0.18, 0.26, 0.16);
  const isikMat = mat(sahne, "orion_isik", 0.0, 0.55, 0.80, 1.0);
  const gozMat = mat(sahne, "orion_goz", 0.0, 0.92, 1.0, 1.0);
  const yuzMat = mat(sahne, "orion_yuz", 0.20, 0.22, 0.30, 0.2);
  const malzemeler = [govdeMat, koyuMat, isikMat, gozMat, yuzMat];

  const meshler: Mesh[] = [];
  const kutu = (ad: string, g: number, y: number, d: number, m: StandardMaterial): Mesh => {
    const x = CreateBox(ad, { width: g, height: y, depth: d }, sahne);
    x.material = m;
    meshler.push(x);
    return x;
  };

  // ── Hiyerarşi: kök → kalça → gövde → boyun → baş ───────────────────────
  // Oturma ve eğilme kalçadan, bakış boyundan döner. Ayrı pivotlar olmasaydı
  // "baş ayrı, gövde ayrı" isteği kökten döndürmeye çöker (donuk kafa dönüşü).
  const kalca = new TransformNode("orion_kalca", sahne);
  kalca.parent = kok;
  kalca.position.y = BOY * 0.52;

  const govde = kutu("orion_govde_mesh", BOY * 0.32, BOY * 0.36, BOY * 0.18, govdeMat);
  govde.parent = kalca;
  govde.position.y = BOY * 0.18;

  const cekirdek = kutu("orion_cekirdek", BOY * 0.11, BOY * 0.09, BOY * 0.02, isikMat);
  cekirdek.parent = govde;
  cekirdek.position.set(0, BOY * 0.03, BOY * 0.095);

  const boyun = new TransformNode("orion_boyun", sahne);
  boyun.parent = kalca;
  boyun.position.y = BOY * 0.38;

  const bas = kutu("orion_bas", BOY * 0.26, BOY * 0.25, BOY * 0.24, govdeMat);
  bas.parent = boyun;
  bas.position.y = BOY * 0.13;

  const yuz = kutu("orion_yuz_mesh", BOY * 0.19, BOY * 0.12, BOY * 0.01, yuzMat);
  yuz.parent = bas;
  yuz.position.set(0, BOY * 0.015, BOY * 0.125);

  const gozL = kutu("orion_gozL", BOY * 0.04, BOY * 0.04, BOY * 0.012, gozMat);
  gozL.parent = bas;
  gozL.position.set(-BOY * 0.056, BOY * 0.04, BOY * 0.128);
  const gozR = kutu("orion_gozR", BOY * 0.04, BOY * 0.04, BOY * 0.012, gozMat);
  gozR.parent = bas;
  gozR.position.set(BOY * 0.056, BOY * 0.04, BOY * 0.128);

  // Çene: `agizUygula` bunu aşağı indirir ve uzatır. Gerçek bir ağız parçası
  // olması, ses senkronunun blend shape'e bağımlı olmamasını sağlar.
  const cene = kutu("orion_cene", BOY * 0.09, BOY * 0.02, BOY * 0.012, koyuMat);
  cene.parent = bas;
  const CENE_Y = -BOY * 0.055;
  cene.position.set(0, CENE_Y, BOY * 0.128);

  const omuzL = new TransformNode("orion_omuzL", sahne);
  omuzL.parent = kalca;
  omuzL.position.set(BOY * 0.19, BOY * 0.32, 0);
  const kolL = kutu("orion_kolL", BOY * 0.08, BOY * 0.34, BOY * 0.09, govdeMat);
  kolL.parent = omuzL;
  kolL.position.y = -BOY * 0.17;

  const omuzR = new TransformNode("orion_omuzR", sahne);
  omuzR.parent = kalca;
  omuzR.position.set(-BOY * 0.19, BOY * 0.32, 0);
  const kolR = kutu("orion_kolR", BOY * 0.08, BOY * 0.34, BOY * 0.09, govdeMat);
  kolR.parent = omuzR;
  kolR.position.y = -BOY * 0.17;

  // Bacaklar KALÇAYA bağlı, köke değil: oturunca kalça inince bacaklar da
  // iner. Köke bağlı kalsalardı oturma pozunda gövde sandalyeye otururken
  // bacaklar havada asılı kalırdı (ilk canlı denemede görüldü).
  const bacakL = new TransformNode("orion_bacakL", sahne);
  bacakL.parent = kalca;
  bacakL.position.set(BOY * 0.085, 0, 0);
  const uylukL = kutu("orion_uylukL", BOY * 0.10, BOY * 0.50, BOY * 0.11, koyuMat);
  uylukL.parent = bacakL;
  uylukL.position.y = -BOY * 0.25;

  const bacakR = new TransformNode("orion_bacakR", sahne);
  bacakR.parent = kalca;
  bacakR.position.set(-BOY * 0.085, 0, 0);
  const uylukR = kutu("orion_uylukR", BOY * 0.10, BOY * 0.50, BOY * 0.11, koyuMat);
  uylukR.parent = bacakR;
  uylukR.position.y = -BOY * 0.25;

  // Elindeki nesne göstergesi (al/birak) — küçük bir küre.
  const tutulan = CreateSphere("orion_tutulan", { diameter: BOY * 0.1, segments: 8 }, sahne);
  tutulan.material = isikMat;
  tutulan.parent = omuzR;
  tutulan.position.set(0, -BOY * 0.36, BOY * 0.09);
  tutulan.setEnabled(false);
  meshler.push(tutulan);

  // ── Durum uygulama ──────────────────────────────────────────────────────

  const bilgi: IskeletBilgisi = {
    tur: "prosedurel", kaynak: "prosedurel (kod üretimi)",
    agizDestegi: true, kirpmaDestegi: true, basDestegi: true, hamBoy: BOY,
  };

  let sonPoz: Poz = "duruyor";

  function govdeUygula(yaw: number): void { kok.rotation.y = yaw; }

  function basUygula(yaw: number, pitch: number): void {
    boyun.rotation.y = yaw;
    // Babylon'da +X dönüşü burnu AŞAĞI eğer; pitch pozitif = yukarı.
    boyun.rotation.x = -pitch;
  }

  function pozUygula(poz: Poz, faz: number, hiz: number): void {
    sonPoz = poz;
    const salinim = Math.sin(faz * TAU);
    const genlik = Math.min(1, hiz / 1.6);

    // Varsayılana dön; her poz kendi sapmasını yazar.
    kalca.rotation.x = 0;
    kalca.position.y = BOY * 0.52;
    bacakL.rotation.x = 0; bacakR.rotation.x = 0;
    bacakL.rotation.z = 0; bacakR.rotation.z = 0;
    omuzL.rotation.x = 0; omuzR.rotation.x = 0;
    omuzL.rotation.z = 0.06; omuzR.rotation.z = -0.06;

    switch (poz) {
      case "yürüyor":
      case "koşuyor": {
        const k = poz === "koşuyor" ? 1.35 : 1;
        bacakL.rotation.x = salinim * 0.62 * genlik * k;
        bacakR.rotation.x = -salinim * 0.62 * genlik * k;
        omuzL.rotation.x = -salinim * 0.55 * genlik * k;
        omuzR.rotation.x = salinim * 0.55 * genlik * k;
        // Adım başına hafif yukarı-aşağı: yürüyüş kaymaz, basar.
        kalca.position.y = BOY * 0.52 + Math.abs(Math.cos(faz * TAU)) * 0.025 * genlik;
        kalca.rotation.x = 0.06 * k;
        break;
      }
      case "oturuyor":
        // Uyluklar öne, gövde hafif geriye, KALÇA oturma yüzeyine iner.
        //
        // Kalçanın inmesi SUNUM kararıdır, dünya durumu değil: `yurutucu`
        // kökü yalnızca OTURMA_YUKSELMESI kadar kaldırır (protokoldeki
        // `konum` ayak/kök hizasıdır). Gövdenin sandalyeye gerçekten oturmuş
        // görünmesi bu pivotun işidir. İlk canlı denemede avatar sandalyenin
        // ÜSTÜNDE havada duruyordu; bu satır onu düzeltti.
        kalca.position.y = BOY * 0.17;
        bacakL.rotation.x = -Math.PI / 2;
        bacakR.rotation.x = -Math.PI / 2;
        omuzL.rotation.x = -0.35; omuzR.rotation.x = -0.35;
        kalca.rotation.x = -0.06;
        break;
      case "eğiliyor":
        kalca.rotation.x = 0.45;
        break;
      case "yatıyor":
        kalca.rotation.x = 1.4;
        break;
      case "bakıyor":
        kalca.rotation.x = 0.04;
        break;
      case "duruyor":
        break;
    }
  }

  function jestUygula(jest: Jest | null, ilerleme: number): void {
    if (!jest) return;
    // Yarım sinüs zarfı: 0'da başlar, ortada doruk, 1'de biter.
    const z = Math.sin(Math.min(1, Math.max(0, ilerleme)) * Math.PI);
    switch (jest) {
      case "el_salliyor":
        omuzR.rotation.z = -0.06 - z * 2.2;
        omuzR.rotation.x = Math.sin(ilerleme * TAU * 3) * 0.5 * z;
        break;
      case "işaret_ediyor":
        omuzR.rotation.x = -z * 1.5;
        omuzR.rotation.z = -0.06 - z * 0.2;
        break;
      case "el_açıyor":
        omuzL.rotation.z = 0.06 + z * 0.9;
        omuzR.rotation.z = -0.06 - z * 0.9;
        omuzL.rotation.x = -z * 0.5; omuzR.rotation.x = -z * 0.5;
        break;
      case "omuz_silkiyor":
        omuzL.position.y = BOY * 0.32 + z * 0.07;
        omuzR.position.y = BOY * 0.32 + z * 0.07;
        omuzL.rotation.z = 0.06 + z * 0.7; omuzR.rotation.z = -0.06 - z * 0.7;
        break;
      case "başını_sallıyor":
        boyun.rotation.x += Math.sin(ilerleme * TAU * 2) * 0.28 * z;
        break;
      case "kaş_çatıyor":
        gozL.scaling.y = 1 - z * 0.45; gozR.scaling.y = 1 - z * 0.45;
        break;
      case "gülümsüyor":
        cene.scaling.x = 1 + z * 0.5;
        gozL.scaling.y = 1 - z * 0.3; gozR.scaling.y = 1 - z * 0.3;
        break;
      case "bekliyor":
        omuzL.rotation.x = -z * 0.35; omuzR.rotation.x = -z * 0.35;
        omuzL.rotation.z = 0.06 + z * 0.55; omuzR.rotation.z = -0.06 - z * 0.55;
        break;
    }
    if (jest !== "omuz_silkiyor") {
      omuzL.position.y = BOY * 0.32;
      omuzR.position.y = BOY * 0.32;
    }
  }

  function agizUygula(aciklik: number): void {
    const a = Math.min(1, Math.max(0, aciklik));
    cene.scaling.y = 1 + a * 5;
    cene.position.y = CENE_Y - a * BOY * 0.022;
  }

  function bostaUygula(nefes: number, agirlik: number): void {
    // Nefes: göğüs ölçeği + omuzların çok hafif yükselmesi.
    govde.scaling.z = 1 + nefes * 0.022;
    govde.scaling.x = 1 + nefes * 0.012;
    if (sonPoz === "duruyor" || sonPoz === "bakıyor") {
      // Ağırlık aktarma: kalça yana kayar, gövde ters yöne hafif eğilir.
      kalca.position.x = agirlik * 0.022;
      kalca.rotation.z = -agirlik * 0.022;
    } else {
      kalca.position.x = 0;
      kalca.rotation.z = 0;
    }
  }

  function gozKirp(kapali: number): void {
    const s = Math.max(0.05, 1 - kapali);
    gozL.scaling.y = s;
    gozR.scaling.y = s;
  }

  // Kökü kapatmak tüm hiyerarşiyi kapatır — `tutulan` küresinin kendi
  // açık/kapalı durumu korunur (1. şahıs geçişinde kaybolmasın diye önemli).
  function gorunur(g: boolean): void { kok.setEnabled(g); }

  function yokEt(): void {
    for (const m of meshler) m.dispose();
    for (const m of malzemeler) m.dispose();
    kok.dispose();
  }

  /** Elindeki nesne göstergesi — `beden.ts` durum değişince açar/kapar. */
  const iskelet: AvatarIskeleti & { elindekiGoster(v: boolean): void } = {
    kok, bilgi,
    govdeUygula, basUygula, pozUygula, jestUygula,
    agizUygula, bostaUygula, gozKirp, gorunur, yokEt,
    elindekiGoster(v: boolean) { tutulan.setEnabled(v); },
  };
  return iskelet;
}
