// uygulama/zeminKalemi.test.ts — zemin kalemi: basılı tutarak şekillendirme, Shift ters, Esc/sağ tık, tıklama sahipliği, geri al tuşları (NullEngine; gerçek editör kalemi ve yüzeyi).
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
const { zeminKalemiKur } = await import("./zeminKalemi.ts");
const { ornekTanim } = await import("../world/level/cekirdek/ornekTanim.ts");
const { zeminYuksekligi } = await import("../world/level/moduller/zemin.ts");
const { zeminAyari, zeminOku } = await import("./zemin.ts");
import type { Level } from "../world/level/cekirdek/levelKur.ts";
import type { LevelTanimi } from "../world/level/cekirdek/levelTanimi.ts";
import type { Vurus } from "./zeminBaglantisi.ts";

interface SahteOlay { clientX: number; clientY: number; button: number; shiftKey: boolean; ctrlKey: boolean; deltaY: number; pointerId: number; durduruldu: boolean; stopImmediatePropagation(): void; preventDefault(): void }
const olay = (ek: Partial<SahteOlay> = {}): SahteOlay => {
  const o: SahteOlay = { clientX: 256, clientY: 128, button: 0, shiftKey: false, ctrlKey: false, deltaY: 0, pointerId: 1, durduruldu: false, stopImmediatePropagation() { o.durduruldu = true; }, preventDefault() {}, ...ek };
  return o;
};

const zeminliTanim = (): LevelTanimi => ({
  ...ornekTanim(), nesneler: [],
  katmanlar: [{ tur: "zemin", ad: "zemin", acik: true, ayar: { duzenleme: [], duzenlemeHucre: 2 } }],
});

function kur(tanim: LevelTanimi | null = zeminliTanim(), levelVar = true) {
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
  let t = tanim ? structuredClone(tanim) : null;
  const level = {
    tanim: () => structuredClone(t!),
    ayarla: (y: LevelTanimi) => { t = structuredClone(y); },
    // Gerçek level gibi: yükseklik zemin katmanının ŞU ANKİ ayarından (şekillendikçe değişir).
    yukseklik: (x: number, z: number) => { const a = zeminAyari(t!); return a ? zeminYuksekligi(a)(x, z) : 0; },
  } as unknown as Level;
  const bitenler: Vurus[] = [];
  const sayac = { baslarken: 0, geriAl: 0, ileriAl: 0 };
  const altyazi: string[] = [];
  const kalem = zeminKalemiKur({
    sahne, kamera, tuval, level: () => (levelVar ? level : null),
    baslarken: () => { sayac.baslarken++; },
    vurusBitti: (v) => { bitenler.push(v); },
    geriAl: () => { sayac.geriAl++; }, ileriAl: () => { sayac.ileriAl++; },
    altyazi: (m) => { altyazi.push(m); },
  });
  const ates = (tur: string, o: object) => { for (const f of [...(dinleyici[tur] ?? [])]) f(o); };
  const pencereAtes = (tur: string, o: object) => { for (const f of [...(pencere[tur] ?? [])]) f(o); };
  const tus = (code: string, ek: { ctrlKey?: boolean; shiftKey?: boolean } = {}) => {
    const o = { key: code, code, ctrlKey: false, shiftKey: false, metaKey: false, target: null, durduruldu: false, stopImmediatePropagation() { o.durduruldu = true; }, preventDefault() {}, ...ek };
    pencereAtes("keydown", o);
    return o;
  };
  const sekil = () => zeminOku(level.tanim())!.duzenleme;
  const bitir = () => { kalem.yokEt(); motor.dispose(); };
  return { kalem, ates, pencereAtes, tus, sekil, bitenler, sayac, altyazi, level, sahne, bitir };
}

test("sol tık basılı: zemin yükselir; bırakınca vuruş BİR kez bildirilir (önceki şekil, bölge, ad)", () => {
  const k = kur();
  try {
    k.kalem.sec("yukselt");
    k.ates("pointermove", olay());
    const asagi = olay();
    k.ates("pointerdown", asagi);
    assert.equal(asagi.durduruldu, true);
    assert.ok(k.sekil().length > 0, "damga vuruldu");
    assert.ok(Math.max(...k.sekil().filter((_, i) => i % 2 === 1)) > 0, "yükselme pozitif");
    assert.equal(k.kalem.vuruyor(), true);
    assert.equal(k.bitenler.length, 0);
    k.pencereAtes("pointerup", olay());
    assert.equal(k.bitenler.length, 1);
    assert.deepEqual(k.bitenler[0]!.once.duzenleme, []);
    assert.equal(k.bitenler[0]!.ad, "yükselt");
    assert.ok(k.bitenler[0]!.bolge);
    assert.equal(k.kalem.vuruyor(), false);
  } finally { k.bitir(); }
});

test("Alçalt aracı çukur açar; Shift basılı başlayan vuruş işlemi TERSLER (yükselt ⇄ alçalt)", () => {
  const alcalt = kur();
  try {
    alcalt.kalem.sec("alcalt");
    alcalt.ates("pointermove", olay());
    alcalt.ates("pointerdown", olay());
    assert.ok(Math.min(...alcalt.sekil().filter((_, i) => i % 2 === 1)) < 0);
  } finally { alcalt.bitir(); }
  const ters = kur();
  try {
    ters.kalem.sec("yukselt");
    ters.ates("pointermove", olay());
    ters.ates("pointerdown", olay({ shiftKey: true }));
    assert.ok(Math.min(...ters.sekil().filter((_, i) => i % 2 === 1)) < 0, "Shift ile yükselt alçaltır");
    ters.pencereAtes("pointerup", olay());
    assert.equal(ters.bitenler[0]!.ad, "alçalt");
  } finally { ters.bitir(); }
});

test("basılı tutarken fare durunca da ~90 ms'de bir damga vurulur (kare gözcüsü)", async () => {
  const k = kur();
  try {
    k.kalem.sec("yukselt");
    k.ates("pointermove", olay());
    k.ates("pointerdown", olay());
    const ilk = Math.max(...k.sekil().filter((_, i) => i % 2 === 1));
    await new Promise((r) => setTimeout(r, 130));
    k.sahne.render();
    const sonra = Math.max(...k.sekil().filter((_, i) => i % 2 === 1));
    assert.ok(sonra > ilk, `ikinci damga yükseltmeli: ${ilk} → ${sonra}`);
  } finally { k.bitir(); }
});

test("Esc süren vuruşu İPTAL eder: zemin başladığı hâle döner, vuruş bildirilmez; kalem açık kalır", () => {
  const k = kur();
  try {
    k.kalem.sec("yukselt");
    k.ates("pointermove", olay());
    k.ates("pointerdown", olay());
    assert.ok(k.sekil().length > 0);
    const esc = k.tus("Escape");
    assert.equal(esc.durduruldu, true);
    assert.deepEqual(k.sekil(), []);
    assert.equal(k.bitenler.length, 0);
    assert.equal(k.kalem.arac(), "yukselt");
  } finally { k.bitir(); }
});

test("Esc vuruş yokken kalemi bırakır (tuş yutulur); kalem yokken Esc'e dokunulmaz", () => {
  const k = kur();
  try {
    assert.equal(k.tus("Escape").durduruldu, false);
    k.kalem.sec("duzle");
    assert.equal(k.tus("Escape").durduruldu, true);
    assert.equal(k.kalem.arac(), null);
  } finally { k.bitir(); }
});

test("sağ tık kalemi bırakır ve menüyü AÇTIRMAZ; kalem yokken sağ tık serbest", () => {
  const k = kur();
  try {
    k.kalem.sec("yukselt");
    const sag = olay({ button: 2 });
    k.ates("contextmenu", sag);
    assert.equal(sag.durduruldu, true);
    assert.equal(k.kalem.arac(), null);
    const ikinci = olay({ button: 2 });
    k.ates("contextmenu", ikinci);
    assert.equal(ikinci.durduruldu, false);
  } finally { k.bitir(); }
});

test("kalem açıkken click nesne seçimine GİTMEZ; kapalıyken gider", () => {
  const k = kur();
  try {
    const bos = olay();
    k.ates("click", bos);
    assert.equal(bos.durduruldu, false);
    k.kalem.sec("yukselt");
    const tik = olay();
    k.ates("click", tik);
    assert.equal(tik.durduruldu, true);
  } finally { k.bitir(); }
});

test("sol tıktan başka düğme vuruş başlatmaz; kalem yokken pointerdown'a dokunulmaz", () => {
  const k = kur();
  try {
    const bos = olay();
    k.ates("pointerdown", bos);
    assert.equal(bos.durduruldu, false);
    k.kalem.sec("yukselt");
    k.ates("pointermove", olay());
    k.ates("pointerdown", olay({ button: 1 }));
    assert.equal(k.kalem.vuruyor(), false);
    assert.deepEqual(k.sekil(), []);
  } finally { k.bitir(); }
});

test("Ctrl+tekerlek fırça yarıçapını değiştirir (olay yutulur); Ctrl'suz tekerlek serbest", () => {
  const k = kur();
  try {
    k.kalem.sec("yukselt");
    const once = k.kalem.ayar().yaricap;
    const duz = olay({ deltaY: -100 });
    k.ates("wheel", duz);
    assert.equal(duz.durduruldu, false);
    assert.equal(k.kalem.ayar().yaricap, once);
    const ctrl = olay({ deltaY: -100, ctrlKey: true });
    k.ates("wheel", ctrl);
    assert.equal(ctrl.durduruldu, true);
    assert.ok(k.kalem.ayar().yaricap > once);
    k.ates("wheel", olay({ deltaY: 100, ctrlKey: true }));
    k.ates("wheel", olay({ deltaY: 100, ctrlKey: true }));
    assert.ok(k.kalem.ayar().yaricap < once);
  } finally { k.bitir(); }
});

test("Ctrl+Z geri al, Ctrl+Y ve Ctrl+Shift+Z ileri al; kalem yokken tuşlar serbest", () => {
  const k = kur();
  try {
    assert.equal(k.tus("KeyZ", { ctrlKey: true }).durduruldu, false);
    assert.equal(k.sayac.geriAl, 0);
    k.kalem.sec("yukselt");
    assert.equal(k.tus("KeyZ", { ctrlKey: true }).durduruldu, true);
    k.tus("KeyY", { ctrlKey: true });
    k.tus("KeyZ", { ctrlKey: true, shiftKey: true });
    assert.deepEqual([k.sayac.geriAl, k.sayac.ileriAl], [1, 2]);
  } finally { k.bitir(); }
});

test("kalem açılırken diğer düzenleme kipleri kapatılır (baslarken)", () => {
  const k = kur();
  try {
    k.kalem.sec("yukselt");
    assert.equal(k.sayac.baslarken, 1);
    k.kalem.sec(null);
    assert.equal(k.sayac.baslarken, 1);
  } finally { k.bitir(); }
});

test("ayarla: sınırlara oturur; dinleyici haber alır", () => {
  const k = kur();
  try {
    let haber = 0;
    k.kalem.dinle(() => { haber++; });
    k.kalem.ayarla({ yaricap: 9999, guc: -5 });
    assert.equal(k.kalem.ayar().yaricap, 40);
    assert.equal(k.kalem.ayar().guc, 0.02);
    assert.ok(haber >= 1);
    assert.throws(() => k.kalem.ayarla({ yaricap: Number.NaN }), /sayı olmalı/);
  } finally { k.bitir(); }
});

test("level hazır değilken ya da zemin katmanı yokken kalem seçilmez; neden söylenir", () => {
  const hazirDegil = kur(zeminliTanim(), false);
  try {
    hazirDegil.kalem.sec("yukselt");
    assert.equal(hazirDegil.kalem.arac(), null);
    assert.match(hazirDegil.altyazi.at(-1)!, /hazır değil/);
  } finally { hazirDegil.bitir(); }
  const zeminsiz = kur({ ...ornekTanim(), katmanlar: [], nesneler: [] });
  try {
    zeminsiz.kalem.sec("yukselt");
    assert.equal(zeminsiz.kalem.arac(), null);
    assert.match(zeminsiz.altyazi.at(-1)!, /zemin katmanı yok/);
  } finally { zeminsiz.bitir(); }
});
