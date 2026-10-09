// world/level/moduller/parcacik.ts — Havada uçuşanlar: gündüz POLEN/toz zerreleri, gece ATEŞBÖCEKLERİ.
//
// İki Babylon parçacık sistemi, ikisi de gün/gece durumuna bağlı: polen gün ışığıyla, ateşböceği geceyle yayılır (yayma hızı
// her karede dünya durumundan; aksi sistem sönerek biter). Ateşböceği ışıması renk gradyanıyla yanıp söner, ekleme
// karışımlı (additive) çizilir; polen sönük ve yumuşak. Doku koddan: yumuşak yuvarlak (varlık dosyası yok).
// Alan sabit bir kutu (merkez, yarıçap) — kamera uzaklaşırsa orada kalır; çim alanının üstünde yüzer.
"use strict";
import "@babylonjs/core/Particles/particleSystemComponent";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { Renk } from "../cekirdek/renk.ts";
import type { LevelModulu } from "../cekirdek/modul.ts";

export const PARCACIK_VARSAYILAN = {
  /** Alanın merkezi (m) ve yarıçapı. */
  x: 0,
  z: 0,
  alan: 38,
  /** Yükseklik aralığı (zeminden, m). */
  yukseklikMin: 0.3,
  yukseklikMax: 3.4,
  /** Aynı anda yaşayan polen / ateşböceği sayısı (tam gün ışığında / tam gecede). */
  polen: 260,
  atesBocegi: 500,
  /** Boyutlar (m). */
  polenBoyu: 0.05,
  atesBoyu: 0.2,
  /** Yaşam süresi (sn): ömür boyunca uçuşlar; ateşböceğinde yanıp sönme bu süreye yayılır. */
  polenOmru: 9,
  atesOmru: 7,
  /** Süzülme hızı (m/sn). */
  polenHiz: 0.35,
  atesHiz: 0.5,
  polenRenk: "#fff4c2",
  atesRenk: "#c8ff5a",
};
export type ParcacikAyari = typeof PARCACIK_VARSAYILAN;

/** Yayma hızı (parçacık/sn): hedef sayı ÷ ömür × ışık payı. Saf. */
export const yaymaHizi = (sayi: number, omur: number, pay: number) => (sayi / Math.max(0.1, omur)) * Math.max(0, Math.min(1, pay));

/** Yumuşak yuvarlak doku (merkez parlak, kenar sönük) — koddan çizilir. */
function yumusakDoku(sahne: Scene): DynamicTexture {
  const d = new DynamicTexture("parcacikDoku", 64, sahne, false);
  const c = d.getContext() as CanvasRenderingContext2D;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  d.update();
  d.hasAlpha = true;
  return d;
}

interface Sistem { ps: ParticleSystem; renk(r: Renk): void }

function sistemKur(sahne: Scene, ad: string, doku: DynamicTexture, a: ParcacikAyari, ates: boolean): Sistem {
  const kapasite = Math.ceil((ates ? a.atesBocegi : a.polen) * 1.4) + 8;
  const ps = new ParticleSystem(ad, kapasite, sahne);
  ps.particleTexture = doku;
  ps.emitter = new Vector3(a.x, 0, a.z);
  ps.minEmitBox = new Vector3(-a.alan, a.yukseklikMin, -a.alan);
  ps.maxEmitBox = new Vector3(a.alan, a.yukseklikMax, a.alan);
  const hiz = ates ? a.atesHiz : a.polenHiz, omur = ates ? a.atesOmru : a.polenOmru;
  ps.minLifeTime = omur * 0.6; ps.maxLifeTime = omur;
  ps.minSize = (ates ? a.atesBoyu : a.polenBoyu) * 0.6; ps.maxSize = ates ? a.atesBoyu : a.polenBoyu;
  ps.direction1 = new Vector3(-hiz, -hiz * 0.15, -hiz); ps.direction2 = new Vector3(hiz, hiz * (ates ? 0.35 : 0.7), hiz);
  ps.minEmitPower = 0.6; ps.maxEmitPower = 1;
  ps.gravity = Vector3.Zero();
  ps.updateSpeed = 0.016;
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.minAngularSpeed = 0; ps.maxAngularSpeed = 0;
  ps.renderingGroupId = 0;
  ps.isLocal = false;
  // Ömür boyunca belirip sönme: polende tek tepe; ateşböceğinde iki parıltı (yanıp sönme).
  const yak = (r: Renk) => {
    ps.removeColorGradient(0); ps.removeColorGradient(0.2); ps.removeColorGradient(0.4); ps.removeColorGradient(0.6); ps.removeColorGradient(0.8); ps.removeColorGradient(1);
    // Ateşböceğinde renk 1'in üstünde (ekleme karışımı parlar: HDR gibi); polen sönük kalır.
    const p = ates ? 2.2 : 1, k = (al: number) => new Color4(r[0] * p, r[1] * p, r[2] * p, al);
    if (ates) { ps.addColorGradient(0, k(0)); ps.addColorGradient(0.2, k(1)); ps.addColorGradient(0.4, k(0.1)); ps.addColorGradient(0.6, k(1)); ps.addColorGradient(0.8, k(0.15)); ps.addColorGradient(1, k(0)); }
    else { ps.addColorGradient(0, k(0)); ps.addColorGradient(0.25, k(0.55)); ps.addColorGradient(0.75, k(0.55)); ps.addColorGradient(1, k(0)); }
  };
  return { ps, renk: yak };
}

export const parcacikModulu: LevelModulu<ParcacikAyari> = {
  tur: "parcacik",
  aciklama: "Havada uçuşanlar: gündüz polen, gece ateşböcekleri (gün/gece durumuna bağlı).",
  varsayilan: PARCACIK_VARSAYILAN,
  zemineBagli: false,
  aralik: {
    x: { min: -300, max: 300, adim: 1 }, z: { min: -300, max: 300, adim: 1 }, alan: { min: 2, max: 150, adim: 1 },
    yukseklikMin: { min: 0, max: 20, adim: 0.05 }, yukseklikMax: { min: 0.1, max: 40, adim: 0.05 },
    polen: { min: 0, max: 3000, adim: 10 }, atesBocegi: { min: 0, max: 2000, adim: 10 },
    polenBoyu: { min: 0.005, max: 0.5, adim: 0.005 }, atesBoyu: { min: 0.005, max: 0.8, adim: 0.005 },
    polenOmru: { min: 1, max: 40, adim: 0.5 }, atesOmru: { min: 1, max: 40, adim: 0.5 },
    polenHiz: { min: 0, max: 3, adim: 0.05 }, atesHiz: { min: 0, max: 3, adim: 0.05 },
  },
  kur(b, a) {
    const doku = yumusakDoku(b.sahne);
    const polen = sistemKur(b.sahne, "polen", doku, a, false), ates = sistemKur(b.sahne, "atesBocegi", doku, a, true);
    polen.renk(b.renk(a.polenRenk)); ates.renk(b.renk(a.atesRenk));
    // Açılışta alan boş başlamasın: ilk karedeki ışığa göre ön ısıtma.
    const d0 = b.dunya();
    polen.ps.emitRate = yaymaHizi(a.polen, a.polenOmru, d0.gunIsigi); ates.ps.emitRate = yaymaHizi(a.atesBocegi, a.atesOmru, d0.gece);
    for (const s of [polen, ates]) { s.ps.preWarmCycles = 120; s.ps.preWarmStepOffset = 5; s.ps.start(); }
    return {
      meshler: [],
      guncelle() {
        const d = b.dunya();
        polen.ps.emitRate = yaymaHizi(a.polen, a.polenOmru, d.gunIsigi * d.gunIsigi);   // alacakaranlıkta çabuk azalır
        ates.ps.emitRate = yaymaHizi(a.atesBocegi, a.atesOmru, d.gece * d.gece);
      },
      yokEt() { polen.ps.dispose(); ates.ps.dispose(); doku.dispose(); },
    };
  },
};
