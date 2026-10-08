// world/level/ova-deneme.ts — Ova level'ini BEYİNSİZ gösteren ve DÜZENLETEN deneme sayfası (spec 17).
//
// Level = veri: world/level/ova/ova.level.json. Sayfa onu okur, `levelKur` ile kurar (modüller:
// world/level/moduller/), level panelini açar (canlı düzenle, Kaydet → dosya) — F8 Babylon Inspector, H paneli
// gizler. Elle gezinmek: tıkla, WASD + fare, Shift koş.
//
//   /world/level/ova-deneme.html?aci=ufuk | alcak | tepe | gunes
//   ?piksel=3   düşük iç çözünürlük + en-yakın büyütme (piksel-sanat shader'ının ucuz önizlemesi)
//   ?panel=0    paneli kapat (ekran görüntüsü için)
// Hazır olunca (3 sn ölçüm) başlık "hazir …" olur — tools/oda-goruntu.mjs bunu bekler.
"use strict";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import { levelKur } from "./cekirdek/levelKur.ts";
import { MODULLER } from "./moduller/index.ts";
import { levelPaneliKur } from "./editor/levelPaneli.ts";
import { inspektorAcKapa } from "./editor/inspektor.ts";

const LEVEL_DOSYASI = "/world/level/ova/ova.level.json";
const GOZ = 1.7;

interface Aci { konum: [number, number, number]; hedef: [number, number, number] }
/** Sabit açılar (y: zeminden yükseklik; 10 m üstü serbest uçuş). */
export const OVA_ACILARI = {
  ufuk: { konum: [0, GOZ, 0], hedef: [60, 6, -40] },
  alcak: { konum: [4, 0.45, 6], hedef: [40, 1.5, -30] },
  tepe: { konum: [-30, 28, 40], hedef: [20, 0, -20] },
  gunes: { konum: [0, GOZ, 0], hedef: [-55, 30, -72] },
} satisfies Record<string, Aci>;

const dosyadanOku = async (): Promise<unknown> => (await fetch(`${LEVEL_DOSYASI}?t=${Date.now()}`)).json();

const q = new URLSearchParams(location.search);
const tuval = document.getElementById("tuval") as HTMLCanvasElement;
const olcumKutusu = document.getElementById("olcum") as HTMLDivElement;
const motor = new Engine(tuval, true, { preserveDrawingBuffer: true, stencil: true }, true);
const piksel = Math.max(1, Math.min(8, Number(q.get("piksel") ?? 1) || 1));
if (piksel > 1) { motor.setHardwareScalingLevel(piksel); tuval.classList.add("piksel"); }
const sahne = new Scene(motor);

try {
  const level = levelKur(sahne, await dosyadanOku(), MODULLER);

  const ad = q.get("aci") ?? "ufuk";
  const aci: Aci = (OVA_ACILARI as Record<string, Aci | undefined>)[ad] ?? OVA_ACILARI.ufuk;
  const [ax, ay, az] = aci.konum;
  const kamera = new UniversalCamera("ova_kamera", new Vector3(ax, level.yukseklik(ax, az) + ay, az), sahne);
  kamera.setTarget(new Vector3(...aci.hedef));
  kamera.fov = 0.95;
  kamera.minZ = 0.05;
  kamera.maxZ = level.tanim().ortam.kamera.uzak;
  kamera.keysUp = [87]; kamera.keysDown = [83]; kamera.keysLeft = [65]; kamera.keysRight = [68];
  kamera.angularSensibility = 2500;
  kamera.attachControl(tuval, true);
  let kos = false;
  addEventListener("keydown", (e) => { if (e.key === "Shift") kos = true; });
  addEventListener("keyup", (e) => { if (e.key === "Shift") kos = false; });
  tuval.addEventListener("click", () => { void tuval.requestPointerLock?.(); });

  if (q.get("panel") !== "0") {
    levelPaneliKur({ level, moduller: MODULLER, ad: "ova", dosyadanOku, inspektor: () => inspektorAcKapa(sahne) });
  }

  const olcer = new SceneInstrumentation(sahne);
  olcer.captureFrameTime = true;
  sahne.onBeforeRenderObservable.add(() => {
    level.guncelle(motor.getDeltaTime() / 1000);
    kamera.speed = kos ? 0.6 : 0.25;
    kamera.maxZ = level.tanim().ortam.kamera.uzak;
    if (ay < 10) kamera.position.y = level.yukseklik(kamera.position.x, kamera.position.z) + ay;
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
      const s = level.sayim();
      const ozet = `aci=${ad} piksel=${piksel} fps=${(kare / sn).toFixed(1)} cizim=${(cizim / Math.max(kare, 1)).toFixed(0)} ucgen=${Math.round(ucgen)} katman=${s.katman} mesh=${s.mesh}`;
      olcumKutusu.textContent = ozet;
      console.log(`[OVA-DENEME] ${ozet}`);
      document.title = `hazir ${ozet}`;
    }, 3000);
  });
} catch (err) {
  // Bozuk tanım sessizce boş sahne göstermez: hata ekranda.
  const m = err instanceof Error ? err.message : String(err);
  olcumKutusu.textContent = `HATA: ${m}`;
  olcumKutusu.style.color = "#b00020";
  document.title = `hata ${m}`;
  console.error("[OVA-DENEME]", err);
}
