// uygulama/duzenlemeKipi.test.ts — "Çağır" hayaleti: tıklayınca koyar, Esc/sağ tık/tekerlek, tıklama sahipliği (NullEngine; gerçek editör hayaleti ve yüzeyi).
// Gizmo (taşı/döndür/ölçekle) burada YOK: Babylon'un yardımcı katmanı gerçek ekranda denenir ([YAZILDI-KOŞULMADI]).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";

// `addEventListener` (pencere) Node'da yok: modül yüklenmeden önce küçük bir pencere kurulur.
type Dinleyici = (e: object) => void;
const pencere: Record<string, Dinleyici[]> = {};
Object.assign(globalThis, {
  addEventListener: (t: string, f: unknown) => { (pencere[t] ??= []).push(f as Dinleyici); },
  removeEventListener: (t: string, f: unknown) => { pencere[t] = (pencere[t] ?? []).filter((x) => x !== f); },
});

const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
const { Scene } = await import("@babylonjs/core/scene.js");
const { FreeCamera } = await import("@babylonjs/core/Cameras/freeCamera.js");
const { Vector3 } = await import("@babylonjs/core/Maths/math.vector.js");
const { TransformNode } = await import("@babylonjs/core/Meshes/transformNode.js");
const { duzenlemeKipiKur } = await import("./duzenlemeKipi.ts");
import type { Level } from "../world/level/cekirdek/levelKur.ts";
import type { Vec3 } from "../world/level/cekirdek/levelTanimi.ts";

interface SahteOlay { clientX: number; clientY: number; shiftKey: boolean; deltaY: number; deltaX: number; durduruldu: boolean; stopImmediatePropagation(): void; preventDefault(): void }
const olay = (ek: Partial<SahteOlay> = {}): SahteOlay => {
  const o: SahteOlay = { clientX: 256, clientY: 128, shiftKey: false, deltaY: 0, deltaX: 0, durduruldu: false, stopImmediatePropagation() { o.durduruldu = true; }, preventDefault() {}, ...ek };
  return o;
};

function kur() {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const kamera = new FreeCamera("k", new Vector3(0, 6, -6), sahne);
  kamera.setTarget(new Vector3(0, 0, 0));   // ekranın ortası zemini (0,0,0) civarında keser
  sahne.activeCamera = kamera;
  const dinleyici: Record<string, Dinleyici[]> = {};
  const tuval = {
    addEventListener: (t: string, f: unknown) => { (dinleyici[t] ??= []).push(f as Dinleyici); },
    removeEventListener: (t: string, f: unknown) => { dinleyici[t] = (dinleyici[t] ?? []).filter((x) => x !== f); },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  } as unknown as HTMLCanvasElement;
  const level = {
    yukseklik: () => 0,
    nesneler: { ornekOlustur: async (ad: string) => new TransformNode(`ornek_${ad}`, sahne), idsi: () => null },
  } as unknown as Level;
  const koyulan: { varlik: string; konum: Vec3; donus: Vec3 }[] = [];
  const altyazi: string[] = [];
  const kip = duzenlemeKipiKur({
    sahne, kamera, tuval, level: () => level, secili: () => null,
    koy: (varlik, konum, donus) => { koyulan.push({ varlik, konum, donus }); },
    donustur: () => {}, altyazi: (m) => { altyazi.push(m); },
  });
  const ates = (tur: string, o: object) => { for (const f of [...(dinleyici[tur] ?? [])]) f(o); };
  const tusAtes = (code: string) => { const o = { key: code, stopImmediatePropagation() { (o as { durduruldu?: boolean }).durduruldu = true; }, preventDefault() {} } as { key: string; durduruldu?: boolean }; for (const f of [...(pencere["keydown"] ?? [])]) f(o); return o; };
  return { motor, sahne, kip, ates, tusAtes, koyulan, altyazi };
}

test("Çağır → imleç hareket → SOL TIK: asset imlecin altındaki zemine konur; tıklama nesne seçimine GİTMEZ", async () => {
  const k = kur();
  try {
    await k.kip.cagir("PROP_Lamp", "Lamba");
    k.ates("pointermove", olay());
    const tik = olay();
    k.ates("click", tik);
    assert.equal(k.koyulan.length, 1);
    assert.equal(k.koyulan[0]!.varlik, "PROP_Lamp");
    assert.ok(Math.abs(k.koyulan[0]!.konum[1]) < 0.05, `zemine oturmalı, y=${k.koyulan[0]!.konum[1]}`);
    assert.equal(tik.durduruldu, true);
  } finally { k.kip.yokEt(); k.motor.dispose(); }
});

test("Çağır: art arda tıklama art arda koyar (kip sürer); hayalet kapanana dek", async () => {
  const k = kur();
  try {
    await k.kip.cagir("PROP_Lamp", "Lamba");
    k.ates("pointermove", olay());
    k.ates("click", olay());
    k.ates("click", olay());
    assert.equal(k.koyulan.length, 2);
    assert.equal(k.kip.etkin(), true);
  } finally { k.kip.yokEt(); k.motor.dispose(); }
});

test("Çağır: tekerlek hayaleti 15° (Shift: 90°) döndürür; koyulan nesne o açıyı taşır", async () => {
  const k = kur();
  try {
    await k.kip.cagir("PROP_Lamp", "Lamba");
    k.ates("pointermove", olay());
    k.ates("wheel", olay({ deltaY: 100 }));
    k.ates("wheel", olay({ deltaY: 100, shiftKey: true }));
    k.ates("click", olay());
    assert.deepEqual(k.koyulan[0]!.donus, [0, 105, 0]);
  } finally { k.kip.yokEt(); k.motor.dispose(); }
});

test("Çağır: Esc hayaleti bitirir (tuş yutulur), sonra tıklama KOYMAZ ve seçime gider", async () => {
  const k = kur();
  try {
    await k.kip.cagir("PROP_Lamp", "Lamba");
    k.ates("pointermove", olay());
    const esc = k.tusAtes("Escape");
    assert.equal(esc.durduruldu, true);
    assert.equal(k.kip.etkin(), false);
    const tik = olay();
    k.ates("click", tik);
    assert.equal(k.koyulan.length, 0);
    assert.equal(tik.durduruldu, false);
  } finally { k.kip.yokEt(); k.motor.dispose(); }
});

test("Çağır: sağ tık hayaleti bitirir ve menüyü AÇTIRMAZ; hayalet yokken sağ tık serbest (menü açılır)", async () => {
  const k = kur();
  try {
    await k.kip.cagir("PROP_Lamp", "Lamba");
    const sag = olay();
    k.ates("contextmenu", sag);
    assert.equal(sag.durduruldu, true);
    assert.equal(k.kip.etkin(), false);
    const ikinci = olay();
    k.ates("contextmenu", ikinci);
    assert.equal(ikinci.durduruldu, false);
  } finally { k.kip.yokEt(); k.motor.dispose(); }
});

test("hayalet yokken Esc ve tıklama dokunulmaz (mevcut davranış korunur)", () => {
  const k = kur();
  try {
    assert.equal(k.tusAtes("Escape").durduruldu, undefined);
    const tik = olay();
    k.ates("click", tik);
    assert.equal(tik.durduruldu, false);
    assert.equal(k.koyulan.length, 0);
  } finally { k.kip.yokEt(); k.motor.dispose(); }
});

test("bitir(): imleç kipi kapanırken hayalet kapanır", async () => {
  const k = kur();
  try {
    await k.kip.cagir("PROP_Lamp", "Lamba");
    k.kip.bitir();
    assert.equal(k.kip.etkin(), false);
  } finally { k.kip.yokEt(); k.motor.dispose(); }
});

test("level hazır değilken Çağır: hayalet açılmaz, nedeni söylenir", async () => {
  const k = kur();
  try {
    // kur() hazır level verir; hazır değil durumu için ayrı bir kip.
    const kip = duzenlemeKipiKur({ sahne: k.sahne, kamera: k.sahne.activeCamera!, tuval: { addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) } as unknown as HTMLCanvasElement,
      level: () => null, secili: () => null, koy: () => {}, donustur: () => {}, altyazi: (m) => { k.altyazi.push(m); } });
    await kip.cagir("PROP_Lamp", "Lamba");
    assert.equal(kip.etkin(), false);
    assert.match(k.altyazi.at(-1)!, /hazır değil/);
    kip.yokEt();
  } finally { k.kip.yokEt(); k.motor.dispose(); }
});

test("cagrilan + dinle: hayalet başlayınca varlık görünür ve dinleyici haber alır; Esc bırakınca null", async () => {
  const k = kur();
  try {
    let haber = 0;
    const birak = k.kip.dinle(() => { haber++; });
    assert.equal(k.kip.cagrilan(), null);
    await k.kip.cagir("PROP_Lamp", "Lamba");
    assert.equal(k.kip.cagrilan(), "PROP_Lamp");
    assert.ok(haber >= 1, "başlayınca haber");
    const once = haber;
    k.tusAtes("Escape");
    assert.equal(k.kip.cagrilan(), null);
    assert.ok(haber > once, "bitince haber");
    birak();
    const son = haber;
    await k.kip.cagir("PROP_Lamp", "Lamba");
    assert.equal(haber, son, "abonelik bırakılınca haber yok");
  } finally { k.kip.yokEt(); k.motor.dispose(); }
});
