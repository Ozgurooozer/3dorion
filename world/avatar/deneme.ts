// world/avatar/deneme.ts — T2 izole deneme sahnesi ve niyet dizisi koşucusu.
//
// Amaç: "niyet gerçekten hareket ettiriyor mu" sorusunu CANLI yanıtlamak.
// Birim testi geçmek "bitti" demeye yetmez (spec: Kanıt kuralı) — bu sahne
// Electron'da koşar, her `NiyetSonucu`'nu konsola basar ve ekran görüntüsü
// alınabilir bir kare üretir.
//
// Çalıştırma:
//   npx vite
//   npx electron world/avatar/deneme-main.cjs
//   npx electron world/avatar/deneme-main.cjs --vrm=/yok.vrm   (düşüş kanıtı)
//
// `world/giris.ts`e DOKUNULMAZ: birleştirmeyi koordinatör yapar. Bu sahne
// yalnızca avatar + oda + sabit kamera içerir.
"use strict";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import "@babylonjs/core/Materials/standardMaterial";
import { Saat, TIK_HZ } from "../engine/tik.ts";
import { odaKur } from "../level/oda.ts";
import { capaBul } from "../level/capalar.ts";
import { avatarKur, type Avatar } from "./index.ts";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";

const tuval = document.getElementById("tuval") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const gunlukEl = document.getElementById("gunluk") as HTMLDivElement;

const sorgu = new URLSearchParams(location.search);
/** Bilerek bozuk yol vermek için: ?vrm=/yok.vrm */
const vrmYolu = sorgu.get("vrm") ?? undefined;

const motor = new Engine(tuval, true, { preserveDrawingBuffer: true, stencil: true }, true);
const sahne = new Scene(motor);
sahne.clearColor = new Color4(0.027, 0.027, 0.051, 1);
sahne.collisionsEnabled = false;

const oda = odaKur(sahne);

// Sabit sinematik kamera: odanın sağ ön köşesinden, masa/tahta hattını görür.
// `?kamera=yakin` sandalyeyi soldan-önden çerçeveler: oturma pozu sandalyenin
// arkalığı ardında kalmasın diye ayrı bir kanıt açısı.
const YAKIN = sorgu.get("kamera") === "yakin";
const kamera = new FreeCamera("kam",
  YAKIN ? new Vector3(1.7, 1.55, -3.85) : new Vector3(3.9, 2.15, 1.5), sahne);
kamera.setTarget(YAKIN ? new Vector3(0.0, 0.95, -2.35) : new Vector3(-1.0, 0.95, -2.1));
kamera.minZ = 0.05;

const saat = new Saat();

// ── Niyet dizisi koşucusu ──────────────────────────────────────────────────
// Her niyet bir öncekinin SONUCUNU bekler. Böylece çıktı sırası deterministik
// olur ve "bitti" gerçekten bitti demektir.

const DIZI: { ad: string; n: Niyet }[] = [
  { ad: "git tahta",         n: { tur: "git",  hedef: { tip: "capa", ad: "tahta" } } },
  { ad: "bak pencere",       n: { tur: "bak",  hedef: { tip: "capa", ad: "pencere" } } },
  { ad: "jest el_salliyor",  n: { tur: "jest", jest: "el_salliyor" } },
  { ad: "otur",              n: { tur: "otur" } },
  { ad: "kalk",              n: { tur: "kalk" } },
];

const gunluk: string[] = [];
function yaz(satir: string): void {
  gunluk.push(satir);
  console.log(satir);
  gunlukEl.textContent = gunluk.slice(-14).join("\n");
}

let avatar: Avatar | null = null;
let sira = 0;
let bekleyenId = "";
let diziBitti = false;

function sonrakiNiyet(): void {
  const a = avatar;
  if (!a) return;
  if (sira >= DIZI.length) {
    diziBitti = true;
    yaz("[DIZI] tamamlandı");
    return;
  }
  const adim = DIZI[sira]!;
  bekleyenId = `t2_${sira}`;
  const d = a.durum();
  yaz(`[NIYET] ${bekleyenId} ${adim.ad} (konum ${d.konum.x.toFixed(2)},${d.konum.z.toFixed(2)} poz ${d.poz})`);
  a.niyet(adim.n, bekleyenId);
  sira++;
}

function sonucGeldi(s: NiyetSonucu): void {
  const a = avatar!;
  const d = a.durum();
  const veri = s.veri ? ` veri=${JSON.stringify(s.veri)}` : "";
  const not = s.not ? ` not="${s.not}"` : "";
  yaz(
    `[SONUC] ${s.niyet_id} ${s.durum}${not}${veri} | ` +
    `konum ${d.konum.x.toFixed(2)},${d.konum.y.toFixed(2)},${d.konum.z.toFixed(2)} ` +
    `poz=${d.poz} oturuyor=${d.oturuyor_mu} mesgul=${d.mesgul}`);
  if (s.niyet_id !== bekleyenId) return;
  if (s.durum === "basladi") return;
  // bitti / hata / iptal → sıradaki adım.
  setTimeout(sonrakiNiyet, 1500); // adımlar arası duraklama: her pozun ekran görüntüsünde yakalanabilmesi için
}

// ── Kurulum ────────────────────────────────────────────────────────────────

avatarKur({
  sahne, saat,
  spawn: { x: 2.2, y: 0, z: 1.6 },
  yaw: Math.PI,
  vrmYolu,
  oyuncuKonumu: () => ({ x: 3.6, y: 1.6, z: 2.9 }),
}).then((a) => {
  avatar = a;
  const b = a.iskeletBilgisi();
  yaz(`[ISKELET] tur=${b.tur} agiz=${b.agizDestegi} kirpma=${b.kirpmaDestegi} bas=${b.basDestegi} hamBoy=${b.hamBoy.toFixed(3)}`);
  yaz(`[ISKELET] kaynak=${b.kaynak}`);
  a.sonucDinle(sonucGeldi);
  setTimeout(sonrakiNiyet, 600);
});

// ── MANTIK 20 Hz / ÇİZİM serbest FPS ───────────────────────────────────────
let mantikTik = 0;
saat.dinle(() => { mantikTik++; });

motor.runRenderLoop(() => {
  const ms = motor.getDeltaTime();
  saat.ilerle(ms);
  avatar?.cizimGuncelle(Math.min(ms, 100) / 1000);
  sahne.render();
});

addEventListener("resize", () => motor.resize());

setInterval(() => {
  const d = avatar?.durum();
  const tahta = capaBul("tahta")!;
  hud.textContent =
    `FPS ${motor.getFps().toFixed(0)}  |  tik ${saat.olculenHz.toFixed(2)} Hz (hedef ${TIK_HZ})  |  tik# ${mantikTik}  |  atlanan ${saat.atlanan}\n` +
    (d
      ? `konum ${d.konum.x.toFixed(2)},${d.konum.y.toFixed(2)},${d.konum.z.toFixed(2)}  poz ${d.poz}  ` +
        `mesgul ${d.mesgul}  oturuyor ${d.oturuyor_mu}  elinde ${d.elinde ?? "-"}\n` +
        `bakis ${d.bakis.x.toFixed(2)},${d.bakis.y.toFixed(2)},${d.bakis.z.toFixed(2)}  ` +
        `tahta durak ${tahta.durak.x.toFixed(2)},${tahta.durak.z.toFixed(2)}  mesh ${oda.meshler.length}`
      : "avatar yükleniyor…");
}, 200);

// ── Duman kanıtı ───────────────────────────────────────────────────────────
setTimeout(() => {
  const d = avatar?.durum();
  const b = avatar?.iskeletBilgisi();
  console.log(
    `[DUMAN] fps=${motor.getFps().toFixed(1)} hz=${saat.olculenHz.toFixed(2)} ` +
    `tik=${saat.tikSayisi} atlanan=${saat.atlanan} iskelet=${b?.tur ?? "-"} ` +
    `dizi=${diziBitti ? "bitti" : `${sira}/${DIZI.length}`} ` +
    `avatar=${d ? `${d.konum.x.toFixed(2)},${d.konum.y.toFixed(2)},${d.konum.z.toFixed(2)}` : "-"} ` +
    `poz=${d?.poz ?? "-"} oturuyor=${d?.oturuyor_mu ?? "-"} mesgul=${d?.mesgul ?? "-"} ` +
    `bakis=${d ? `${d.bakis.x.toFixed(2)},${d.bakis.y.toFixed(2)},${d.bakis.z.toFixed(2)}` : "-"}`);
}, Number(sorgu.get("duman") ?? 16000));
