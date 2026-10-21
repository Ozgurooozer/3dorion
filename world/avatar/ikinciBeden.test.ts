// world/avatar/ikinciBeden.test.ts — İKİNCİ BEDEN (spec 33 dilim 3): `avatarKur` aynı sahnede iki kez, GERÇEK glb ile, başsız (NullEngine).
// Spike'ta (2026-10-21) ölçülenler bekçiye döndü: iki kök aynı adı alıyordu ve iki beden aynı sandalyeye aynı noktada oturuyordu.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
const { Scene } = await import("@babylonjs/core/scene.js");
const { PBRMaterial } = await import("@babylonjs/core/Materials/PBR/pbrMaterial.js");
const { Color3 } = await import("@babylonjs/core/Maths/math.color.js");
const { Saat } = await import("../engine/tik.ts");
const { avatarKur } = await import("./index.ts");

const GLB = `data:model/gltf-binary;base64,${readFileSync(new URL("../../assets/orion-lowpoly.glb", import.meta.url)).toString("base64")}`;
const FLASH_RENGI = "#ffb347";

/** Orion (öneksiz, renksiz — bugünkü çağrı) + Flash (önekli, renkli). Yükleyicinin uyarıları (ağız/kırpma blend shape'i yok) susturulur. */
async function ikiBeden() {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const saat = new Saat();
  let flashKoltugu: () => string | null = () => null;
  let orionKoltugu: () => string | null = () => null;
  const uyari = console.warn, log = console.log;
  console.warn = () => {}; console.log = () => {};
  try {
    const orion = await avatarKur({ sahne, saat, spawn: { x: 0.9, y: 0, z: -1.2 }, vrmYolu: GLB, vrmZorla: true, koltukDolu: (c) => (flashKoltugu() === c ? "Flash" : null) });
    const flash = await avatarKur({ sahne, saat, spawn: { x: -1.2, y: 0, z: 0.6 }, vrmYolu: GLB, vrmZorla: true, ad: "flash", renk: FLASH_RENGI, koltukDolu: (c) => (orionKoltugu() === c ? "Orion" : null) });
    orionKoltugu = () => orion.koltugu();
    flashKoltugu = () => flash.koltugu();
    return { motor, sahne, saat, orion, flash };
  } finally { console.warn = uyari; console.log = log; }
}

const kokMalzemeleri = (sahne: InstanceType<typeof Scene>, ad: string) =>
  sahne.getTransformNodeByName(ad)!.getChildMeshes(false).map((m) => m.material).filter((m) => m instanceof PBRMaterial);

test("iki beden: Orion'un kökü adıyla bulunur (yerGecisi bu adla arar), Flash'ınki kendi önekiyle", async () => {
  const { motor, sahne } = await ikiBeden();
  try { assert.deepEqual([sahne.getTransformNodeByName("orion_vrm_kok") !== null, sahne.getTransformNodeByName("flash_vrm_kok") !== null], [true, true]); }
  finally { motor.dispose(); }
});

test("iki beden: 'orion_vrm_kok' adında YALNIZ bir düğüm var", async () => {
  const { motor, sahne } = await ikiBeden();
  try { assert.equal(sahne.transformNodes.filter((n) => n.name === "orion_vrm_kok").length, 1); }
  finally { motor.dispose(); }
});

test("Flash'ın rengi kendi malzemesinde", async () => {
  const { motor, sahne } = await ikiBeden();
  try {
    const beklenen = Color3.FromHexString(FLASH_RENGI).toLinearSpace();
    assert.ok(kokMalzemeleri(sahne, "flash_vrm_kok").every((m) => (m as InstanceType<typeof PBRMaterial>).albedoColor.equalsWithEpsilon(beklenen, 1e-4)));
  } finally { motor.dispose(); }
});

test("Flash'ın rengi Orion'a SIZMAZ (ortak malzeme yok)", async () => {
  const { motor, sahne } = await ikiBeden();
  try {
    const flashMalzemesi = new Set(kokMalzemeleri(sahne, "flash_vrm_kok"));
    assert.deepEqual(kokMalzemeleri(sahne, "orion_vrm_kok").filter((m) => flashMalzemesi.has(m)), []);
  } finally { motor.dispose(); }
});

test("aynı sandalye: Orion oturmaya giderken Flash'ın 'otur'u hata döner, sahibi Orion", async () => {
  const { motor, saat, orion, flash } = await ikiBeden();
  try {
    const sonuc: string[] = [];
    flash.sonucDinle((s) => { if (s.durum === "hata") sonuc.push(s.not ?? ""); });
    orion.niyet({ tur: "otur" }, "o1");
    saat.ilerle(50);
    flash.niyet({ tur: "otur" }, "f1");
    saat.ilerle(50);
    assert.match(sonuc.join(" | "), /dolu: Orion orada/);
  } finally { motor.dispose(); }
});

test("aynı sandalye: Orion kalkınca Flash oturabilir", async () => {
  const { motor, saat, orion, flash } = await ikiBeden();
  try {
    orion.niyet({ tur: "otur" }, "o1");
    for (let i = 0; i < 400; i++) saat.ilerle(50);
    orion.niyet({ tur: "kalk" }, "o2");
    for (let i = 0; i < 100; i++) saat.ilerle(50);
    flash.niyet({ tur: "otur" }, "f1");
    for (let i = 0; i < 500; i++) saat.ilerle(50);
    assert.equal(flash.durum().oturuyor_mu, true);
  } finally { motor.dispose(); }
});

test("Flash'ı yok etmek Orion'un bedenine dokunmaz", async () => {
  const { motor, sahne, orion, flash } = await ikiBeden();
  try {
    flash.yokEt();
    assert.deepEqual([sahne.getTransformNodeByName("flash_vrm_kok"), orion.iskeletBilgisi().tur], [null, "vrm"]);
  } finally { motor.dispose(); }
});
