// world/avatar/goz.ts — Orion'un gözü (spec 25 V0): Orion'un başından bir kare çeker ve o karenin GERÇEĞİNİ
// geometriden çıkarır (hangi nesne karede, ne kadar yer kaplıyor, örtülü mü).
//
// NEDEN İKİSİ BİR ARADA: görme modelinin doğruluğu ancak aynı karenin gerçeğiyle ölçülebilir. Gerçek, Orion'un bugün
// kullandığı görünürlük kodundan (`player/gorunurluk.ts`, örtülme) + izdüşüm alanından gelir — böylece "model ne
// gördü" ile "geometri ne diyor" aynı göz, aynı kare üzerinden karşılaştırılır.
//
// Kare: ayrı bir kamera, render hedefinden (son işlem efektleri YOK — level'ın stil efektleri oyuncunun kamerasında).
// Çekim sırasında Orion'un kendi bedeni gizlenir (göz başın içinde).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Viewport } from "@babylonjs/core/Maths/math.viewport";
import { CreateScreenshotUsingRenderTargetAsync } from "@babylonjs/core/Misc/screenshotTools";
import type { Yer } from "../yer/yer.ts";
import type { Kutu } from "../level/olculer.ts";
import { gorunenNesneler } from "../player/gorunurluk.ts";
import { GOZ_YUKSEKLIK } from "../level/olculer.ts";

/** Gözün bakışı yataydan bu kadar aşağı (rad): yürürken insan hafif yere bakar. */
export const GOZ_EGIMI = 0.08;
/** Gözün görüş açısı (dikey, rad). */
export const GOZ_FOV = 1.0;

export interface KareGercegi {
  id: string;
  ad: string;
  /** Örtülmemiş en az bir örnek noktası var mı (gorunurluk.ts). */
  gorunur: boolean;
  /** Kutunun kareye kırpılmış izdüşüm alanı / kare alanı (0–1). Kamera arkasındaysa 0. */
  alan: number;
}

export interface GozKaresi {
  /** PNG, base64 (önek yok). */
  png: string;
  gercek: KareGercegi[];
  goz: { x: number; y: number; z: number };
  yaw: number;
}

/** Kutunun kareye kırpılmış izdüşüm alanı oranı. Köşelerden biri kameranın arkasındaysa kaba ama güvenli: o köşe atlanır. */
function izdusumAlani(k: Kutu, gorunumIzdusum: Matrix, en: number, boy: number): number {
  const vp = new Viewport(0, 0, en, boy);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, onde = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const p = Vector3.Project(new Vector3(k.x + sx * k.g / 2, k.y + sy * k.yuk / 2, k.z + sz * k.d / 2), Matrix.IdentityReadOnly, gorunumIzdusum, vp);
    if (p.z <= 0 || p.z >= 1) continue;
    onde++;
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  if (!onde) return 0;
  const g = Math.max(0, Math.min(en, maxX) - Math.max(0, minX)), y = Math.max(0, Math.min(boy, maxY) - Math.max(0, minY));
  return (g * y) / (en * boy);
}

export interface OrionGozu {
  /** Ayak konumu + yaw'dan kare ve gerçeği. `gizle`: çekim sırasında Orion'un bedenini gizleyip geri açar. */
  kare(ayak: { x: number; y: number; z: number }, yaw: number, yer: Yer, en: number, boy: number, gizle?: (g: boolean) => void): Promise<GozKaresi>;
  yokEt(): void;
}

export function orionGozuKur(sahne: Scene): OrionGozu {
  const kamera = new UniversalCamera("orion_goz", Vector3.Zero(), sahne);
  kamera.fov = GOZ_FOV;
  kamera.minZ = 0.1;
  kamera.inputs.clear();
  return {
    async kare(ayak, yaw, yer, en, boy, gizle) {
      const goz = { x: ayak.x, y: ayak.y + GOZ_YUKSEKLIK, z: ayak.z };
      const ileri = new Vector3(Math.sin(yaw) * Math.cos(GOZ_EGIMI), -Math.sin(GOZ_EGIMI), Math.cos(yaw) * Math.cos(GOZ_EGIMI));
      kamera.position.set(goz.x, goz.y, goz.z);
      kamera.setTarget(kamera.position.add(ileri));
      kamera.maxZ = sahne.activeCamera?.maxZ ?? 500;
      kamera.computeWorldMatrix();
      // Babylon izdüşümü kameranın en/boy oranını motorun çizim boyutundan alır; kare boyutuna sabitle.
      const oran = en / boy;
      const izdusum = Matrix.PerspectiveFovLH(GOZ_FOV, oran, kamera.minZ, kamera.maxZ, sahne.getEngine().isNDCHalfZRange);
      const gi = kamera.getViewMatrix().multiply(izdusum);

      const bakis = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
      const gorunum = new Map(gorunenNesneler(ayak, bakis, GOZ_YUKSEKLIK, yer.nesneler, yer.katiYuzeyler).map((g) => [g.id, g]));
      const gercek: KareGercegi[] = yer.nesneler.map((n) => ({
        id: n.id, ad: n.ad, gorunur: gorunum.get(n.id)?.gorunur ?? false, alan: +izdusumAlani(n.kutu, gi, en, boy).toFixed(4),
      }));

      gizle?.(false);
      try {
        const veri = await CreateScreenshotUsingRenderTargetAsync(sahne.getEngine(), kamera, { width: en, height: boy }, "image/png");
        return { png: veri.replace(/^data:image\/png;base64,/, ""), gercek, goz, yaw };
      } finally {
        gizle?.(true);
      }
    },
    yokEt() { kamera.dispose(); },
  };
}
