// world/giris.ts — Renderer giriş noktası: motor, sahne, saat.
//
// T1 buradan genişletir: level/, player/, kamera rig'i. Şu anki hâli
// "kabuk ayakta ve saat dönüyor" kanıtı üretir, dünya değil.
"use strict";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3, Color4 } from "@babylonjs/core/Maths/math";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Materials/standardMaterial";
import { Saat, TIK_HZ } from "./engine/tik.ts";

const tuval = document.getElementById("tuval") as HTMLCanvasElement;
const hud   = document.getElementById("hud") as HTMLDivElement;

const motor = new Engine(tuval, true, { preserveDrawingBuffer: false, stencil: true }, true);
const sahne = new Scene(motor);
sahne.clearColor = new Color4(0.027, 0.027, 0.051, 1);

const kamera = new FreeCamera("kam", new Vector3(0, 1.7, 4), sahne);
kamera.setTarget(new Vector3(0, 1.2, 0));

new HemisphericLight("isik", new Vector3(0, 1, 0), sahne);
CreateGround("zemin", { width: 24, height: 20 }, sahne);

const saat = new Saat();
let mantikTik = 0;
saat.dinle(() => { mantikTik++; });

motor.runRenderLoop(() => {
  saat.ilerle(motor.getDeltaTime());
  sahne.render();
});

addEventListener("resize", () => motor.resize());

// HUD: K1 ve K2 ölçümleri ekranda. "Sanırım hızlı" yerine sayı.
setInterval(() => {
  const hz = saat.olculenHz;
  hud.textContent =
    `FPS ${motor.getFps().toFixed(0)}  |  tik ${hz.toFixed(2)} Hz (hedef ${TIK_HZ})  ` +
    `|  tik# ${mantikTik}  |  atlanan ${saat.atlanan}`;
}, 500);

// Duman testi kanıtı: ORION_SMOKE ile açıldığında ölçümü konsola basar.
setTimeout(() => {
  console.log(
    `[DUMAN] fps=${motor.getFps().toFixed(1)} hz=${saat.olculenHz.toFixed(2)} ` +
    `tik=${saat.tikSayisi} atlanan=${saat.atlanan} kopru=${typeof window.kopru}`
  );
}, 4000);
