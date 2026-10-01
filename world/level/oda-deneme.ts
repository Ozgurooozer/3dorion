// world/level/oda-deneme.ts — Odayı BEYİNSİZ, sabit kamera açılarından gösteren deneme sayfası.
//
// Neden ayrı sayfa: odanın görünüşünü ölçmek için tam uygulamayı (Electron + beyin)
// açmak, ölçüm haftasında karar kaydına sahte algı/uyanış satırları yazar ve açık
// olan gerçek Orion'la çakışır. Burada yalnız `odaKur` var: aynı malzeme, aynı ışık,
// aynı ölçüler — ama ne avatar ne beyin.
//
// Kullanım (npm run dev, vite 5273):
//   /world/level/oda-deneme.html?aci=referans   (referans görselin açısı)
//   ?aci=giris | masa | tahta
// Sahne hazır olup FPS ölçülünce sayfa başlığı "hazir …" olur — ekran görüntüsü
// alan betik bunu bekler.
"use strict";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import { odaKur } from "./oda.ts";

/** Sabit kamera açıları: önce/sonra görüntüleri aynı yerden alınsın diye. */
interface Aci { konum: [number, number, number]; hedef: [number, number, number] }
export const ACILAR = {
  // Referans görsel: ön-sol köşeden masaya ve arkasındaki cama.
  referans: { konum: [-3.4, 1.7, 1.9], hedef: [0.6, 1.15, -3.6] },
  // Kapıdan içeri bakış.
  giris: { konum: [2.4, 1.7, 3.6], hedef: [-0.6, 1.2, -3.0] },
  // Sandalyenin arkasından masaya.
  masa: { konum: [0.0, 1.55, -0.6], hedef: [0.0, 1.1, -4.0] },
  // Odanın ortasından sol duvara (tahta).
  tahta: { konum: [2.2, 1.65, 0.2], hedef: [-5.0, 1.5, -0.4] },
} satisfies Record<string, Aci>;

const tuval = document.getElementById("tuval") as HTMLCanvasElement;
const olcumKutusu = document.getElementById("olcum") as HTMLDivElement;
const motor = new Engine(tuval, true, { preserveDrawingBuffer: true, stencil: true }, true);
const sahne = new Scene(motor);
// giris.ts ile aynı arka plan rengi.
sahne.clearColor = new Color4(0.027, 0.027, 0.051, 1);

const oda = odaKur(sahne);

const ad = new URLSearchParams(location.search).get("aci") ?? "referans";
const aci: Aci = (ACILAR as Record<string, Aci | undefined>)[ad] ?? ACILAR.referans;
const kamera = new FreeCamera("deneme_kamera", new Vector3(...aci.konum), sahne);
kamera.setTarget(new Vector3(...aci.hedef));
kamera.fov = 1.0;
kamera.minZ = 0.05;

const olcer = new SceneInstrumentation(sahne);
olcer.captureFrameTime = true;

motor.runRenderLoop(() => sahne.render());
window.addEventListener("resize", () => motor.resize());

// Oda (yeni kipte glb) ve sahne hazır olunca 3 sn kare say: FPS ve çizim çağrısı ortalaması.
// `kip` yazılır: glb yüklenemeyip klasiğe düşüldüyse görüntü yanlış odayı göstermesin.
void oda.hazir.then((kurulanKip) => sahne.executeWhenReady(() => {
  const bas = performance.now();
  let kare = 0;
  let cizim = 0;
  sahne.onAfterRenderObservable.add(() => {
    kare++;
    cizim += olcer.drawCallsCounter.current;
  });
  setTimeout(() => {
    const sn = (performance.now() - bas) / 1000;
    const fps = kare / sn;
    const ozet = `kip=${kurulanKip} aci=${ad} fps=${fps.toFixed(1)} cizim=${(cizim / Math.max(kare, 1)).toFixed(0)} mesh=${oda.meshler.length} aktif=${sahne.getActiveMeshes().length}`;
    olcumKutusu.textContent = ozet;
    console.log(`[ODA-DENEME] ${ozet}`);
    document.title = `hazir ${ozet}`;
  }, 3000);
}));
