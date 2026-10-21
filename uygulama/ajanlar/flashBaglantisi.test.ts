// uygulama/ajanlar/flashBaglantisi.test.ts — Flash dünyada, BAŞSIZ (spec 33 dilim 3): gerçek glb, NullEngine, gerçek Flash köprüsü,
// söz tek girdi adaptöründen. Pencere/Electron açılmaz; "çalışıyor" iddiası değil, kablonun uçtan uca bağlı olduğunun kanıtı.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carpisiyorMu } from "../../world/level/olculer.ts";
import { ODA_YERI } from "../../world/yer/odaYeri.ts";
import { AjanDefteri } from "./ajanKaydi.ts";
import { girdiAdaptoruKur } from "./girdiAdaptoru.ts";
import { Koltuklar } from "./koltuklar.ts";

const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
const { Scene } = await import("@babylonjs/core/scene.js");
const { Saat } = await import("../../world/engine/tik.ts");
const { avatarKur } = await import("../../world/avatar/index.ts");
const { flashBaglantisiKur, FLASH_DOGUM } = await import("./flashBaglantisi.ts");

const GLB = `data:model/gltf-binary;base64,${readFileSync(new URL("../../assets/orion-lowpoly.glb", import.meta.url)).toString("base64")}`;
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function dunya() {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const saat = new Saat();
  const ajanlar = new AjanDefteri();
  const koltuklar = new Koltuklar();
  const altyazilar: string[] = [];
  const log = console.log, uyari = console.warn;
  console.log = () => {}; console.warn = () => {};
  try {
    // Orion'un bedeni (köprüsüz): giris.ts'teki gibi koltuk defterine kayıtlı.
    const orion = await avatarKur({ sahne, saat, spawn: { x: 0.9, y: 0, z: -1.2 }, vrmYolu: GLB, vrmZorla: true, koltukDolu: (c) => koltuklar.dolu(c, "Orion") });
    koltuklar.kaydet("Orion", () => orion.koltugu());
    const fb = await flashBaglantisiKur({
      sahne, saat, vrmYolu: GLB, yer: () => ODA_YERI, oyuncuKonumu: () => ({ x: 1.6, y: 0, z: 1.9 }),
      koltuklar, ajanlar, altyazi: (m) => { altyazilar.push(m); }, gunluk: { ekle: () => {} },
    });
    const girdi = girdiAdaptoruKur({ ajanlar: () => ajanlar.hepsi(), hedef: () => "flash" });
    const ilerle = (n: number) => { for (let i = 0; i < n; i++) saat.ilerle(50); };
    return { motor, orion, fb, girdi, ilerle, altyazilar, kapat: () => { fb.flash.kopru.durdur(); motor.dispose(); console.log = log; console.warn = uyari; } };
  } catch (e) { console.log = log; console.warn = uyari; throw e; }
}

test("Flash'ın doğum noktası ofiste serbest (duvara/eşyaya gömülü doğmaz)", () => {
  assert.equal(carpisiyorMu(FLASH_DOGUM.x, FLASH_DOGUM.z, 0.4, ODA_YERI), false);
});

test("Flash ajan olarak kaydolur: sohbet hedefi 'flash' sözü ona ulaştırır", async () => {
  const d = await dunya();
  try { assert.deepEqual(d.girdi.ilet("otur", "klavye").map((a) => a.id), ["flash"]); }
  finally { d.kapat(); }
});

test("'otur' Flash'ın bedenini oturtur (komut sözlüğü → eylem sırası → beden), model yok", async () => {
  const d = await dunya();
  try {
    d.girdi.ilet("otur", "klavye");
    for (let i = 0; i < 40; i++) { d.ilerle(20); await bekle(1); }
    assert.equal(d.fb.avatar.durum().oturuyor_mu, true);
  } finally { d.kapat(); }
});

test("Orion sandalyedeyken Flash'a 'otur': Flash oturmaz ve nedenini altyazıda söyler", async () => {
  const d = await dunya();
  try {
    d.orion.niyet({ tur: "otur" }, "o1");
    d.ilerle(400);
    d.girdi.ilet("otur", "klavye");
    for (let i = 0; i < 10; i++) { d.ilerle(2); await bekle(1); }
    await bekle(350);   // Flash'ın hata toplama penceresi (300 ms)
    assert.match(d.altyazilar.join(" | "), /Flash: Yapamadım: .*dolu: Orion orada/i);
  } finally { d.kapat(); }
});

test("anlaşılmayan söz: Flash altyazıda 'bilmiyorum' der", async () => {
  const d = await dunya();
  try {
    d.girdi.ilet("bugün hava nasıl", "klavye");
    await bekle(5);
    assert.match(d.altyazilar[0] ?? "", /^Flash: Bunu bilmiyorum\./);
  } finally { d.kapat(); }
});

test("aktör kaydı: birleşik dünya Flash'ın mesh'lerini ve konumunu görür", async () => {
  const d = await dunya();
  try {
    const a = d.fb.aktor();
    assert.deepEqual([a !== null && a.meshler.length > 0, a?.x, a?.z], [true, FLASH_DOGUM.x, FLASH_DOGUM.z]);
  } finally { d.kapat(); }
});
