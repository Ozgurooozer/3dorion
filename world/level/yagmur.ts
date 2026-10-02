// world/level/yagmur.ts — Cam duvarın ardında yağan yağmur (spec 11, Faz 3; yalnız yeni kip).
//
// Referans görselin yağmurlu camı. Ucuz tutuldu: iki düzlem (uzak ve yakın katman), her biri
// kodla çizilmiş tek DynamicTexture; her karede yalnız dokunun dikey ofseti değişir (yeniden
// çizim yok). Farklı hız ve yoğunluktaki iki katman derinlik hissi verir. Çizim çağrısı +2.
//
// Düzlemler camın ARKASINDA, manzaranın ÖNÜNDE: cam üstte ~0.3 m dışarı yatar (CAM_DUVARI.egim),
// manzara 0.75 m geride; katmanlar 0.40 ve 0.60 m geride. Işın ve kamera onları yok sayar.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CAM_DUVARI, ODA } from "./olculer.ts";
import { yagmurCizgileri } from "./yagmurCizgileri.ts";

interface Katman {
  ad: string;
  /** Arka duvarın iç yüzünden geriye uzaklık (m). */
  geri: number;
  tohum: number;
  adet: number;
  /** Çizgi kalınlığı (doku pikseli). */
  kalinlik: number;
  /** Doku tekrarı (yatay, dikey) — düzlem büyük, doku küçük. */
  tekrar: [number, number];
  /** Doku yüksekliği / saniye. */
  hiz: number;
  renk: Color3;
}

const KATMANLAR: readonly Katman[] = [
  { ad: "uzak", geri: 0.6, tohum: 11, adet: 220, kalinlik: 1, tekrar: [4, 2], hiz: 0.55, renk: new Color3(0.38, 0.34, 0.58) },
  { ad: "yakin", geri: 0.4, tohum: 12, adet: 38, kalinlik: 2, tekrar: [2.5, 1.2], hiz: 1.05, renk: new Color3(0.6, 0.52, 0.75) },
];

const DOKU_G = 256, DOKU_Y = 512;

/** Yağmur katmanlarını kurar ve canlandırır; düzlemleri döndürür (ışın dışı tutulsunlar). */
export function yagmurKur(sahne: Scene): Mesh[] {
  const genis = CAM_DUVARI.xMax - CAM_DUVARI.xMin;
  const yuksek = CAM_DUVARI.ust - CAM_DUVARI.alt;
  const meshler: Mesh[] = [];
  for (const k of KATMANLAR) {
    const doku = new DynamicTexture(`d_yagmur_${k.ad}`, { width: DOKU_G, height: DOKU_Y }, sahne, false);
    doku.hasAlpha = true;
    doku.wrapU = Texture.WRAP_ADDRESSMODE;
    doku.wrapV = Texture.WRAP_ADDRESSMODE;
    doku.uScale = k.tekrar[0];
    doku.vScale = k.tekrar[1];
    const ctx = doku.getContext();
    ctx.clearRect(0, 0, DOKU_G, DOKU_Y);
    ctx.lineWidth = k.kalinlik;
    for (const c of yagmurCizgileri(k.tohum, k.adet)) {
      // Alttan taşan çizgi üstten devam eder (doku dikeyde tekrarlanıyor): iki kez çiz.
      for (const kay of [0, -1]) {
        const x = c.x * DOKU_G, y0 = (c.y + kay) * DOKU_Y, y1 = y0 + c.boy * DOKU_Y;
        const g = ctx.createLinearGradient(x, y0, x, y1);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(1, `rgba(255,255,255,${c.opaklik.toFixed(3)})`);
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
        ctx.stroke();
      }
    }
    doku.update(true);

    const m = new StandardMaterial(`m_yagmur_${k.ad}`, sahne);
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.emissiveColor = k.renk;
    m.emissiveTexture = doku;
    m.opacityTexture = doku;
    m.disableLighting = true;
    m.fogEnabled = false;
    m.backFaceCulling = false;

    const p = CreatePlane(`yagmur_${k.ad}`, { width: genis, height: yuksek + 0.4 }, sahne);
    p.position.set((CAM_DUVARI.xMin + CAM_DUVARI.xMax) / 2, (CAM_DUVARI.alt + CAM_DUVARI.ust) / 2, -ODA.derinlik / 2 - k.geri);
    p.rotation.y = Math.PI; // düzlem normali -Z; odaya (+Z) çevir
    p.material = m;
    p.isPickable = false;
    meshler.push(p);

    // Aşağı akış: v ofseti artınca desen aşağı kayar (düzlemde v alttan üste artar).
    sahne.onBeforeRenderObservable.add(() => {
      const dt = sahne.getEngine().getDeltaTime() / 1000;
      doku.vOffset = (doku.vOffset + k.hiz * Math.min(dt, 0.1)) % 1;
    });
  }
  return meshler;
}
