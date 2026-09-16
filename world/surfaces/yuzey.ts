// world/surfaces/yuzey.ts — Odadaki her EKRAN/PANO için ortak altyapı.
//
// NEDEN VAR: odaya üç ekran daha ekleniyor (admin terminali, beyin şeması,
// beyin logları). Monitörü dört kez kopyalamak dört neredeyse-aynı dosya ve
// bakım kâbusu demekti.
//
// Bu dosya SPEKÜLATİF bir soyutlama DEĞİL: `monitor.ts` ve `tahta.ts` zaten
// çalışıyordu ve ikisi de aynı üç şeyi yapıyordu —
//   1. dünya ölçüsünden en/boy oranı doğru bir DynamicTexture kurmak,
//   2. kirli bayrağıyla boyamak (her karede boyamak GPU israfı),
//   3. malzemeyi ekran/pano gibi ayarlamak.
// Ortaklık İKİ ÇALIŞAN ÖRNEKTEN çıkarıldı, sonra üzerine eklendi.
//
// Değişen kısım tek bir geri çağrıdır: `ciz`. İçerik ne olursa olsun
// (terminal ızgarası, el yazısı, şema çizimi, log satırları) altyapı aynı.
//
// Bağımlılık sınırı (K4): yalnızca @babylonjs/*.
"use strict";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { Observer } from "@babylonjs/core/Misc/observable";

/** Yüzeyin piksel ölçüsü — çizim geri çağrısı bunu kullanır. */
export interface YuzeyOlcusu {
  genislik: number;
  yukseklik: number;
}

export type IsikKipi =
  /** Kendi ışığını yayar: monitör, LED pano. Odanın ışığından etkilenmez. */
  | "ekran"
  /** Işık alır ama okunur kalsın diye hafif parlar: beyaz tahta, kâğıt pano. */
  | "pano";

export interface YuzeyAyari {
  sahne: Scene;
  /** Üzerine çizilecek mesh (oda.ts üretir). */
  mesh: AbstractMesh;
  /** Dünya ölçüsü (metre) — doku en/boy oranı bundan türer, yoksa yazı ezilir. */
  genislikM: number;
  yukseklikM: number;
  /** Dokunun dikey çözünürlüğü (piksel). Yatay, en/boy oranından türer. */
  dikeyPiksel: number;
  isik: IsikKipi;
  /** Hata ayıklama adı — doku/malzeme adlarına girer. */
  ad: string;
  /**
   * İçeriği çizer. `an` = performance.now(), animasyon için.
   * SADECE burada çizim yapılır; altyapı ne çizildiğini bilmez.
   */
  ciz(bag: CanvasRenderingContext2D, olcu: YuzeyOlcusu, an: number): void;
}

export interface Yuzey {
  /** Bir sonraki karede yeniden çizilsin. */
  kirlet(): void;
  /** Piksel ölçüsü — içerik yerleşimi için. */
  olcu(): YuzeyOlcusu;
  /** Sürekli animasyon: her karede boya (nabız, imleç). Varsayılan kapalı. */
  surekliBoyama(acik: boolean): void;
  yokEt(): void;
}

export function yuzeyKur(ayar: YuzeyAyari): Yuzey {
  const { sahne, mesh } = ayar;

  const YUKSEKLIK = Math.max(64, Math.round(ayar.dikeyPiksel));
  // En/boy oranı dünya ölçüsüyle AYNI olmalı; yoksa yazı yatay/dikey ezilir.
  const GENISLIK = Math.max(64, Math.round(YUKSEKLIK * (ayar.genislikM / ayar.yukseklikM)));

  const doku = new DynamicTexture(`${ayar.ad}Doku`, { width: GENISLIK, height: YUKSEKLIK },
    sahne, true, Texture.TRILINEAR_SAMPLINGMODE);
  doku.anisotropicFilteringLevel = 8;
  doku.hasAlpha = false;
  const bag = doku.getContext() as unknown as CanvasRenderingContext2D;

  const mat = new StandardMaterial(`${ayar.ad}Mat`, sahne);
  mat.diffuseTexture = doku;
  mat.specularColor = Color3.Black();
  if (ayar.isik === "ekran") {
    // Işıksız ekran reçetesi: doku DIFFUSE yuvasına girer, aydınlatmayı beyaz
    // emissiveColor sürer. Doku `emissiveTexture` yuvasına konursa aydınlatma
    // terimi sabit beyaz kalır ve düzlem bembeyaz çıkar (monitörde ölçüldü).
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
  } else {
    mat.emissiveColor = new Color3(0.35, 0.35, 0.35);
  }
  mesh.material = mat;
  // Artık yer tutucu değil.
  if (mesh.metadata && typeof mesh.metadata === "object") {
    delete (mesh.metadata as Record<string, unknown>).yerTutucu;
  }

  const olcu: YuzeyOlcusu = { genislik: GENISLIK, yukseklik: YUKSEKLIK };
  let kirli = true;
  let surekli = false;
  let oldu = false;

  function boya(): void {
    if (oldu) return;
    if (!kirli && !surekli) return;
    ayar.ciz(bag, olcu, performance.now());
    doku.update();
    kirli = false;
  }

  const gozlemci: Observer<Scene> | null = sahne.onBeforeRenderObservable.add(boya);
  boya();

  return {
    kirlet() { kirli = true; },
    olcu: () => ({ ...olcu }),
    surekliBoyama(acik) { surekli = acik; if (acik) kirli = true; },
    yokEt() {
      if (oldu) return;
      oldu = true;
      if (gozlemci) sahne.onBeforeRenderObservable.remove(gozlemci);
      doku.dispose();
      mat.dispose();
    },
  };
}

// ── Ortak çizim yardımcıları ───────────────────────────────────────────────
// Dört ekran da aynı görsel dili konuşsun diye; her yüzey kendi rengini
// yeniden icat etmesin.

export const RENK = {
  ekranZemin: "#07080e",
  panoZemin: "#f2f4f1",
  metin: "#d7dcea",
  soluk: "#7c88a6",
  vurgu: "#58c1ff",
  iyi: "#6fd39b",
  uyari: "#ffc857",
  kotu: "#ff7a70",
  cerceve: "#2a3246",
} as const;

export const YAZI = {
  tek: "'Cascadia Mono', Consolas, 'Courier New', monospace",
  duz: "'Segoe UI', system-ui, sans-serif",
} as const;

/** Zemini tek renk doldurur — her çizimin ilk adımı. */
export function zeminDoldur(bag: CanvasRenderingContext2D, o: YuzeyOlcusu, renk: string): void {
  bag.fillStyle = renk;
  bag.fillRect(0, 0, o.genislik, o.yukseklik);
}

/** Köşeleri yuvarlatılmış kutu — panel/kart çizimlerinde kullanılır. */
export function yuvarlakKutu(
  bag: CanvasRenderingContext2D,
  x: number, y: number, g: number, yuk: number, yaricap: number,
): void {
  const r = Math.min(yaricap, g / 2, yuk / 2);
  bag.beginPath();
  bag.moveTo(x + r, y);
  bag.lineTo(x + g - r, y);
  bag.quadraticCurveTo(x + g, y, x + g, y + r);
  bag.lineTo(x + g, y + yuk - r);
  bag.quadraticCurveTo(x + g, y + yuk, x + g - r, y + yuk);
  bag.lineTo(x + r, y + yuk);
  bag.quadraticCurveTo(x, y + yuk, x, y + yuk - r);
  bag.lineTo(x, y + r);
  bag.quadraticCurveTo(x, y, x + r, y);
  bag.closePath();
}
