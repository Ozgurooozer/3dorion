// world/level/ova-deneme.ts — Ova level'ini BEYİNSİZ gösteren deneme sayfası (spec 17).
//
// Orion yok, oda yok: yalnız `ovaKur`. Sanat kararı görüntüyle verilir — sabit açılar önce/sonra aynı
// yerden çekilsin (`tools/oda-goruntu.mjs`, ODA_ADRES ile). Elle gezinmek için: tıkla, WASD + fare, Shift koş.
//
//   /world/level/ova-deneme.html?aci=ufuk | alcak | tepe | gunes
//   ?piksel=3   düşük iç çözünürlük + en-yakın büyütme (ileride piksel-sanat shader'ının ucuz önizlemesi)
// Hazır olunca (3 sn ölçüm) başlık "hazir …" olur.
"use strict";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import { ovaKur } from "./ova/ova.ts";
import { OVA, yukseklik } from "./ova/ovaVerisi.ts";

interface Aci { konum: [number, number, number]; hedef: [number, number, number] }
/** Sabit açılar. y değeri zeminden yükseklik (göz) — zemin dalgalı. */
export const OVA_ACILARI = {
  // Referans 1: ufka doğru, güneşe sırtı dönük yarım açı — gök yarı sahne.
  ufuk: { konum: [0, OVA.goz, 0], hedef: [60, 6, -40] },
  // Çimin içinden, alçak: L3'te çimin yoğunluğu buradan okunur.
  alcak: { konum: [4, 0.45, 6], hedef: [40, 1.5, -30] },
  // Yukarıdan eğik: zeminin lekeleri ve dalgası.
  tepe: { konum: [-30, 28, 40], hedef: [20, 0, -20] },
  // Güneşe karşı: disk, bulutların gölgeli altları.
  gunes: { konum: [0, OVA.goz, 0], hedef: [OVA.gunesYonu[0] * 100, OVA.gunesYonu[1] * 60, OVA.gunesYonu[2] * 100] },
} satisfies Record<string, Aci>;

const q = new URLSearchParams(location.search);
const tuval = document.getElementById("tuval") as HTMLCanvasElement;
const olcumKutusu = document.getElementById("olcum") as HTMLDivElement;
const motor = new Engine(tuval, true, { preserveDrawingBuffer: true, stencil: true }, true);
const piksel = Math.max(1, Math.min(8, Number(q.get("piksel") ?? 1) || 1));
if (piksel > 1) { motor.setHardwareScalingLevel(piksel); tuval.classList.add("piksel"); }
const sahne = new Scene(motor);
const ova = ovaKur(sahne);

const ad = q.get("aci") ?? "ufuk";
const aci: Aci = (OVA_ACILARI as Record<string, Aci | undefined>)[ad] ?? OVA_ACILARI.ufuk;
const [ax, ay, az] = aci.konum;
const kamera = new UniversalCamera("ova_kamera", new Vector3(ax, yukseklik(ax, az) + ay, az), sahne);
kamera.setTarget(new Vector3(...aci.hedef));
kamera.fov = 0.95;
kamera.minZ = 0.05;
kamera.maxZ = OVA.kameraUzak;
// WASD + fare (tıklayınca). Yükseklik her karede zemine oturtulur: yürürken tepeye gömülmez/havada kalmaz.
kamera.keysUp = [87]; kamera.keysDown = [83]; kamera.keysLeft = [65]; kamera.keysRight = [68];
kamera.speed = 0.25;
kamera.angularSensibility = 2500;
kamera.attachControl(tuval, true);
const gozYuksekligi = ay;
let kos = false;
addEventListener("keydown", (e) => { if (e.key === "Shift") kos = true; });
addEventListener("keyup", (e) => { if (e.key === "Shift") kos = false; });
tuval.addEventListener("click", () => { void tuval.requestPointerLock?.(); });

const olcer = new SceneInstrumentation(sahne);
olcer.captureFrameTime = true;

sahne.onBeforeRenderObservable.add(() => {
  const dt = motor.getDeltaTime() / 1000;
  ova.guncelle(dt);
  kamera.speed = kos ? 0.6 : 0.25;
  // Tepe açısı (ay > 10) serbest uçar; yer açıları zemine oturur.
  if (gozYuksekligi < 10) kamera.position.y = yukseklik(kamera.position.x, kamera.position.z) + gozYuksekligi;
});
motor.runRenderLoop(() => sahne.render());
addEventListener("resize", () => motor.resize());

sahne.executeWhenReady(() => {
  const bas = performance.now();
  let kare = 0, cizim = 0;
  sahne.onAfterRenderObservable.add(() => { kare++; cizim += olcer.drawCallsCounter.current; });
  setTimeout(() => {
    const sn = (performance.now() - bas) / 1000;
    const ucgen = sahne.getActiveMeshes().data.reduce((t, m) => t + (m?.getTotalIndices?.() ?? 0) / 3, 0);
    const ozet = `aci=${ad} piksel=${piksel} fps=${(kare / sn).toFixed(1)} cizim=${(cizim / Math.max(kare, 1)).toFixed(0)} ucgen=${Math.round(ucgen)} mesh=${ova.meshler.length} aktif=${sahne.getActiveMeshes().length}`;
    olcumKutusu.textContent = ozet;
    console.log(`[OVA-DENEME] ${ozet}`);
    document.title = `hazir ${ozet}`;
  }, 3000);
});
