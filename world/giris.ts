// world/giris.ts — Renderer giriş noktası ve BİRLEŞTİRME NOKTASI.
//
// Burada iş mantığı yoktur; parçalar birbirine bağlanır:
//   motor + sahne + saat (20Hz) + oda + kamera rig'i + oyuncu + HUD.
//
// İKİ DÖNGÜ AYRIMI (kritik, K1/K2):
//   saat.dinle(...)      → MANTIK. 20Hz sabit. Oyuncu hareketi, çarpışma,
//                          etkileşim taraması, kamera HEDEF pozu.
//   runRenderLoop(...)   → ÇİZİM. Serbest FPS. Yalnızca saati ilerletir,
//                          kamerayı hedefe yumuşatır ve sahneyi çizer.
// Mantık asla render döngüsünde çalışmaz; yoksa Orion'un davranışı donanıma
// göre değişir ve tekrarlanabilirlik ölür.
//
// KATI SINIR (K4): bu dosya `bridge/`, `mind/`, `voice/` veya molp'tan HİÇBİR
// şey import etmez. Yalnızca `protocol/` ve `@babylonjs/*`.
"use strict";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Culling/ray"; // Scene.pickWithRay yan etkisi
import { Saat, TIK_HZ } from "./engine/tik.ts";
import { KameraRig } from "./engine/kamera.ts";
import { odaKur } from "./level/oda.ts";
import { capaAdlari, tumCapalar } from "./level/capalar.ts";
import { capaKonumu } from "./level/capaGeometri.ts";
import { Oyuncu } from "./player/oyuncu.ts";
import { EtkilesimOlaylari } from "./player/etkilesim.ts";

const tuval = document.getElementById("tuval") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const altyazi = document.getElementById("altyazi") as HTMLDivElement;

// ── Motor + sahne ──────────────────────────────────────────────────────────
const motor = new Engine(tuval, true, { preserveDrawingBuffer: false, stencil: true }, true);
const sahne = new Scene(motor);
sahne.clearColor = new Color4(0.027, 0.027, 0.051, 1);
// Çarpışmayı kendimiz yapıyoruz (AABB, olculer.ts) — Babylon'un collider
// altyapısı kurulmaz: her karede gereksiz ellipsoid testi yok.
sahne.collisionsEnabled = false;
// Statik dekor çoğunlukta; aktif mesh listesi her karede yeniden kurulmasın.
sahne.skipPointerMovePicking = true;
sahne.autoClear = true;

// ── Dünya ──────────────────────────────────────────────────────────────────
const oda = odaKur(sahne);
const rig = new KameraRig(sahne, tuval);
const oyuncu = new Oyuncu(sahne, oda, rig, { dogumYeri: new Vector3(2.6, 0, 2.6) });

const saat = new Saat();

// ── MANTIK: 20Hz ───────────────────────────────────────────────────────────
let mantikTik = 0;
saat.dinle((t, dt) => {
  mantikTik++;
  oyuncu.guncelle(t, dt);
  rig.guncelle(dt);
});

// ── ÇİZİM: serbest FPS ─────────────────────────────────────────────────────
motor.runRenderLoop(() => {
  const ms = motor.getDeltaTime();
  saat.ilerle(ms);
  rig.cizimGuncelle(Math.min(ms, 100) / 1000);
  sahne.render();
});

addEventListener("resize", () => motor.resize());

// ── Etkileşim → altyazı/HUD ────────────────────────────────────────────────
// T3 (monitör) ve T4 (köprü) aynı yayıcıya abone olacak. Burada yalnızca
// kullanıcıya geri bildirim var; protokol mesajı ÜRETİLMEZ.
let ipucuMetin = "";
EtkilesimOlaylari.dinle("ipucu", (i) => { ipucuMetin = i?.metin ?? ""; });

function altyaziGoster(metin: string, ms = 2200): void {
  altyazi.textContent = metin;
  altyazi.dataset.gorunur = "1";
  clearTimeout(altyaziZaman);
  altyaziZaman = setTimeout(() => { altyazi.dataset.gorunur = "0"; }, ms);
}
let altyaziZaman: ReturnType<typeof setTimeout>;

EtkilesimOlaylari.dinle("basladi", (o) => {
  altyaziGoster(`${o.capa} · ${o.eylem} — çıkmak için Esc`);
  console.log(`[etkilesim] basladi capa=${o.capa} eylem=${o.eylem} t=${o.t.toFixed(2)}`);
});
EtkilesimOlaylari.dinle("bitti", (o) => {
  altyaziGoster("etkileşim kapandı");
  console.log(`[etkilesim] bitti capa=${o.capa}`);
});

// ── HUD: K1 ve K2 ölçümleri ekranda. "Sanırım hızlı" yerine sayı. ─────────
setInterval(() => {
  const hz = saat.olculenHz;
  const d = oyuncu.oyuncuDurumu();
  hud.textContent =
    `FPS ${motor.getFps().toFixed(0)}  |  tik ${hz.toFixed(2)} Hz (hedef ${TIK_HZ})  ` +
    `|  tik# ${mantikTik}  |  atlanan ${saat.atlanan}\n` +
    `kamera ${rig.mod === "omuz" ? "3.şahıs (F: 1.şahıs)" : "1.şahıs (F: 3.şahıs)"}  ` +
    `|  konum ${d.konum.x.toFixed(1)},${d.konum.z.toFixed(1)}  ` +
    `|  mesh ${oda.meshler.length}  |  çapa ${tumCapalar().length}\n` +
    (ipucuMetin ? ipucuMetin : "WASD yürü · Shift koş · F kamera · E etkileşim · Esc çık");
}, 250);

// ── Demo kancası (T7): sinematik çekim konsoldan tetiklenebilsin ───────────
// `window.dunya.sinematik("tahta")` → kamera tahtayı çerçeveler.
// Bu bir DEBUG yüzeyi; protokol değil, köprü değil.
(window as unknown as { dunya: unknown }).dunya = {
  sinematik(capa: string, sure = 4): boolean {
    const k = capaKonumu(capa);
    if (!k) { console.warn(`[dunya] bilinmeyen çapa: ${capa}. Geçerli: ${capaAdlari().join(", ")}`); return false; }
    rig.sinematikBak(k, 2.6, 0.7, sure);
    return true;
  },
  oyuncuDurumu: () => oyuncu.oyuncuDurumu(),
  capalar: capaAdlari,
};

// ── Duman testi kanıtı ─────────────────────────────────────────────────────
setTimeout(() => {
  const d = oyuncu.oyuncuDurumu();
  console.log(
    `[DUMAN] fps=${motor.getFps().toFixed(1)} hz=${saat.olculenHz.toFixed(2)} ` +
    `tik=${saat.tikSayisi} atlanan=${saat.atlanan} ` +
    `kamera=${rig.mod} mesh=${oda.meshler.length} capa=${tumCapalar().length} ` +
    `oyuncu=${d.konum.x.toFixed(2)},${d.konum.y.toFixed(2)},${d.konum.z.toFixed(2)} ` +
    `etkilesim=${d.etkilesim ?? "-"} kopru=${typeof window.kopru}`
  );
}, 4000);
