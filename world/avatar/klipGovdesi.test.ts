// world/avatar/klipGovdesi.test.ts — JSON KLİP GERÇEK GÖVDEDE (spec 35 Dilim 5a), başsız (NullEngine), GERÇEK glb ve GERÇEK klip dosyalarıyla.
//
// Ölçülen şey kemiğin/düğümün YERİ (gövde-kökü çerçevesinde), ekrandaki deri DEĞİL: glb tek mesh ama 52 kemikli ve kemikler düğümlere bağlı;
// düğüm yerinde mi, kemik oraya gider. Görsel sonuç (deri ağırlıkları, kare) canlıda GÖRÜLMEDİ.
// Yön kuralı (protocol/animasyon.ts: sağ kol donme_z + ile yana-yukarı) bu dosyanın bekçisidir: işaret ya da çerçeve bozulursa el başın altında kalır.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
const { Scene } = await import("@babylonjs/core/scene.js");
const { FreeCamera } = await import("@babylonjs/core/Cameras/freeCamera.js");
const { Vector3, Matrix } = await import("@babylonjs/core/Maths/math.vector.js");
const { Saat } = await import("../engine/tik.ts");
const { avatarKur, prosedurelIskelet, klipKutuphanesiKur, klipleriYukle } = await import("./index.ts");
const { govdeKonumu } = await import("./uzuvSurucusu.ts");
const { klipOrnekle } = await import("./klipOrnekleyici.ts");
type TN = import("@babylonjs/core/Meshes/transformNode").TransformNode;
type SahneT = InstanceType<typeof Scene>;

const ZAMAN = { timeout: 30_000 };
const GLB = `data:model/gltf-binary;base64,${readFileSync(new URL("../../assets/orion-lowpoly.glb", import.meta.url)).toString("base64")}`;
const ASSETS = new URL("../../assets/", import.meta.url);

async function kutuphane() {
  const k = klipKutuphanesiKur();
  const r = await klipleriYukle((yol) => readFile(new URL(yol, ASSETS), "utf8"));
  assert.deepEqual(r.hatalar, []);
  k.doldur(r.klipler, r.hatalar);
  return k;
}

/** Bir (ya da iki) VRM beden; konsol susturulur (yükleyicinin blend shape uyarıları). */
async function sahneKur(ikinci = false) {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  new FreeCamera("kamera", new Vector3(0, 1.4, 4), sahne).setTarget(new Vector3(0, 1, 0));
  const saat = new Saat();
  const klipler = await kutuphane();
  const u = console.warn, l = console.log;
  console.warn = () => {}; console.log = () => {};
  try {
    const orion = await avatarKur({ sahne, saat, spawn: { x: 0, y: 0, z: 0 }, vrmYolu: GLB, vrmZorla: true, klipler });
    const flash = ikinci ? await avatarKur({ sahne, saat, spawn: { x: 2, y: 0, z: 0 }, vrmYolu: GLB, vrmZorla: true, ad: "flash", klipler }) : null;
    return { motor, sahne, saat, orion, flash };
  } finally { console.warn = u; console.log = l; }
}

/** Bu yüklemenin düğümü (`<önek>_klip_kok` altında; iki bedende aynı ad iki kez var). */
function dugum(sahne: SahneT, onek: string, ad: string): TN {
  const kok = sahne.getTransformNodeByName(`${onek}_klip_kok`)!;
  const d = kok.getChildTransformNodes(false).find((n) => n.name === ad);
  assert.ok(d, `${onek}: '${ad}' düğümü yok`);
  return d;
}

/** Bir kare: mantık tiki (50 ms) + çizim + render (klip render hedeflerinden önce uygulanır). */
function kare(s: Awaited<ReturnType<typeof sahneKur>>, n = 1) {
  for (let i = 0; i < n; i++) {
    s.saat.ilerle(50);
    s.orion.cizimGuncelle(0.05);
    s.flash?.cizimGuncelle(0.05);
    s.sahne.render();
  }
}

const elBas = (sahne: SahneT, onek: string) => {
  const kok = sahne.getTransformNodeByName(`${onek}_klip_kok`)!;
  return { el: govdeKonumu(kok, dugum(sahne, onek, "rightHand")), bas: govdeKonumu(kok, dugum(sahne, onek, "head")), omuz: govdeKonumu(kok, dugum(sahne, onek, "rightUpperArm")) };
};

test("VRM: klipsiz sağ el omzun ALTINDA (taban: kollar aşağıda)", ZAMAN, async () => {
  const s = await sahneKur();
  try { kare(s, 2); const o = elBas(s.sahne, "orion"); assert.ok(o.el.y < o.omuz.y, `el ${o.el.y.toFixed(2)} omuz ${o.omuz.y.toFixed(2)}`); }
  finally { s.motor.dispose(); }
});

test("VRM: el_salla ortasında sağ el BAŞIN ÜSTÜNDE ve gövdenin sağında (+X)", ZAMAN, async () => {
  const s = await sahneKur();
  try {
    s.orion.niyet({ tur: "jest", jest: "el_salliyor", klip: "el_salla" }, "j1");
    kare(s, 20);                                         // ~1.0 sn: kol yukarıda, ön kol sallanıyor
    const o = elBas(s.sahne, "orion");
    assert.deepEqual([o.el.y > o.bas.y, o.el.x > 0], [true, true], `el (${o.el.x.toFixed(2)}, ${o.el.y.toFixed(2)}) baş y ${o.bas.y.toFixed(2)}`);
  } finally { s.motor.dispose(); }
});

test("VRM: el_salla ön kolu SALLAR: iki uç anda el farklı yanda (ön kol izi uygulanıyor)", ZAMAN, async () => {
  const s = await sahneKur();
  try {
    s.orion.niyet({ tur: "jest", jest: "el_salliyor", klip: "el_salla" }, "j1");
    kare(s, 14); const a = elBas(s.sahne, "orion").el.x;  // ~0.70 sn: +30°
    kare(s, 5); const b = elBas(s.sahne, "orion").el.x;   // ~0.95 sn: −25°
    assert.ok(Math.abs(a - b) > 0.05, `el x ${a.toFixed(3)} → ${b.toFixed(3)}`);
  } finally { s.motor.dispose(); }
});

test("VRM: klip BİTİNCE el yine omzun altında (ofset birikmez, geri alınır)", ZAMAN, async () => {
  const s = await sahneKur();
  try {
    s.orion.niyet({ tur: "jest", jest: "el_salliyor", klip: "el_salla" }, "j1");
    kare(s, 60);                                         // 3 sn > 2.4 sn
    const o = elBas(s.sahne, "orion");
    assert.ok(o.el.y < o.omuz.y, `el ${o.el.y.toFixed(2)} omuz ${o.omuz.y.toFixed(2)}`);
  } finally { s.motor.dispose(); }
});

test("VRM: 'dur' klibi keser — el bir sonraki karede aşağıda", ZAMAN, async () => {
  const s = await sahneKur();
  try {
    s.orion.niyet({ tur: "jest", jest: "el_salliyor", klip: "el_salla" }, "j1");
    kare(s, 20);
    s.orion.niyet({ tur: "dur" }, "d1");
    kare(s, 1);
    const o = elBas(s.sahne, "orion");
    assert.ok(o.el.y < o.omuz.y, `el ${o.el.y.toFixed(2)} omuz ${o.omuz.y.toFixed(2)}`);
  } finally { s.motor.dispose(); }
});

test("VRM iki beden: Flash'ın klibi Orion'un koluna UYGULANMAZ (kemik bu yüklemede aranır)", ZAMAN, async () => {
  const s = await sahneKur(true);
  try {
    s.flash!.niyet({ tur: "jest", jest: "el_salliyor", klip: "el_salla" }, "f1");
    kare(s, 20);
    const o = elBas(s.sahne, "orion"), f = elBas(s.sahne, "flash");
    assert.deepEqual([f.el.y > f.bas.y, o.el.y < o.omuz.y], [true, true]);
  } finally { s.motor.dispose(); }
});

/** Başın gövde-uzayındaki "ileri" yönü (+Z) klipten sonra nereye döndü: önce/sonra baş matrisinin farkı. */
function basYonu(sahne: SahneT, oncesi: InstanceType<typeof Matrix>): InstanceType<typeof Vector3> {
  const bas = dugum(sahne, "orion", "head");
  bas.computeWorldMatrix(true);
  const fark = Matrix.Invert(oncesi).multiply(bas.getWorldMatrix());
  return Vector3.TransformNormal(new Vector3(0, 0, 1), fark).normalize();
}

test("VRM: basla_onayla başı ÖNE eğer (ileri yön aşağı döner: donme_x + = öne)", ZAMAN, async () => {
  const s = await sahneKur();
  try {
    kare(s, 1);
    const bas = dugum(s.sahne, "orion", "head"); bas.computeWorldMatrix(true);
    const once = bas.getWorldMatrix().clone();
    s.orion.niyet({ tur: "jest", jest: "başını_sallıyor", klip: "basla_onayla" }, "j1");
    kare(s, 4);                                          // ~0.2 sn: +14°
    assert.ok(basYonu(s.sahne, once).y < -0.15, `ileri.y ${basYonu(s.sahne, once).y.toFixed(3)}`);
  } finally { s.motor.dispose(); }
});

test("VRM: basla_reddet başı SAĞ-SOL çevirir (ileri yön yatayda döner, aşağı gitmez)", ZAMAN, async () => {
  const s = await sahneKur();
  try {
    kare(s, 1);
    const bas = dugum(s.sahne, "orion", "head"); bas.computeWorldMatrix(true);
    const once = bas.getWorldMatrix().clone();
    s.orion.niyet({ tur: "jest", jest: "kaş_çatıyor", klip: "basla_reddet" }, "j1");
    kare(s, 4);                                          // ~0.2 sn: −18°
    const y = basYonu(s.sahne, once);
    assert.deepEqual([Math.abs(y.x) > 0.2, Math.abs(y.y) < 0.1], [true, true], `ileri (${y.x.toFixed(3)}, ${y.y.toFixed(3)})`);
  } finally { s.motor.dispose(); }
});

test("VRM: selam_ver gövdeyi öne eğer — baş öne ve aşağı gelir, ayak yerinde", ZAMAN, async () => {
  const s = await sahneKur();
  try {
    kare(s, 1);
    const once = elBas(s.sahne, "orion").bas.clone();
    const kok = s.sahne.getTransformNodeByName("orion_klip_kok")!;
    const ayak0 = govdeKonumu(kok, dugum(s.sahne, "orion", "rightFoot"));
    s.orion.niyet({ tur: "jest", jest: "gülümsüyor", klip: "selam_ver" }, "j1");
    kare(s, 18);                                         // ~0.9 sn: 22° eğik
    const sonra = elBas(s.sahne, "orion").bas;
    const ayak = govdeKonumu(kok, dugum(s.sahne, "orion", "rightFoot"));
    assert.deepEqual([sonra.z - once.z > 0.1, sonra.y < once.y, Vector3.Distance(ayak, ayak0) < 0.01], [true, true, true],
      `baş z ${once.z.toFixed(2)}→${sonra.z.toFixed(2)} y ${once.y.toFixed(2)}→${sonra.y.toFixed(2)}`);
  } finally { s.motor.dispose(); }
});

test("VRM: dusun sağ eli YUKARI ve ÖNE getirir (çeneye doğru)", ZAMAN, async () => {
  const s = await sahneKur();
  try {
    kare(s, 1);
    const once = elBas(s.sahne, "orion").el.clone();
    s.orion.niyet({ tur: "jest", jest: "bekliyor", klip: "dusun" }, "j1");
    kare(s, 30);                                         // 1.5 sn: tutuş
    const o = elBas(s.sahne, "orion");
    // Çene ≈ başın önü-altı: el omuz hizasına kalkar, öne gelir ve ortaya (x küçülür) yaklaşır.
    assert.deepEqual([o.el.y > o.omuz.y - 0.1, o.el.z - once.z > 0.08, o.el.x < once.x - 0.1], [true, true, true],
      `el (${once.x.toFixed(2)}, ${once.y.toFixed(2)}, ${once.z.toFixed(2)}) → (${o.el.x.toFixed(2)}, ${o.el.y.toFixed(2)}, ${o.el.z.toFixed(2)}) omuz y ${o.omuz.y.toFixed(2)} baş ${o.bas.x.toFixed(2)}, ${o.bas.y.toFixed(2)}, ${o.bas.z.toFixed(2)}`);
  } finally { s.motor.dispose(); }
});

// ── prosedürel blok gövde ──
test("prosedürel: el_salla 'sag_kol'u gövdenin SAĞINDAKİ omza (omuzL, +X) uygular; kol ucu omzun üstüne çıkar", async () => {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  try {
    const i = prosedurelIskelet(sahne, { onek: "p" });
    const klipler = await kutuphane();
    i.pozUygula("duruyor", 0, 0);
    i.klipUygula!(klipOrnekle(klipler.bul("el_salla")!, 1.0));
    const kok = sahne.getTransformNodeByName("p_klip_kok")!;
    const omuz = sahne.getTransformNodeByName("p_omuzL")!;
    omuz.computeWorldMatrix(true);
    const uc = Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(0, -0.34 * 1.75, 0), omuz.getWorldMatrix()), Matrix.Invert(kok.getWorldMatrix()));
    const omuzY = govdeKonumu(kok, omuz).y;
    assert.deepEqual([uc.y > omuzY, uc.x > 0], [true, true], `uç (${uc.x.toFixed(2)}, ${uc.y.toFixed(2)}) omuz y ${omuzY.toFixed(2)}`);
  } finally { motor.dispose(); }
});

test("prosedürel: uzuv kümesi ölçüldüğü gibi (ön kol/el/göğüs/boyun YOK)", () => {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  try {
    const i = prosedurelIskelet(sahne, { onek: "p" });
    assert.deepEqual([...i.klipUzuvlari!].sort(), ["bas", "govde", "kok", "sag_bacak", "sag_kol", "sol_bacak", "sol_kol"]);
  } finally { motor.dispose(); }
});

test("prosedürel: klip bitince (boş değerler) omuzun bütün dönmesi poz koduyla aynı — y ekseni BİRİKMEZ", async () => {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  try {
    const i = prosedurelIskelet(sahne, { onek: "p" });
    const k = (await kutuphane()).bul("el_salla")!;
    const omuz = sahne.getTransformNodeByName("p_omuzL")!;
    for (let t = 0; t < 2.4; t += 0.05) { i.pozUygula("duruyor", 0, 0); i.klipUygula!(klipOrnekle(k, t)); }
    i.pozUygula("duruyor", 0, 0); i.klipUygula!([]);
    assert.deepEqual([omuz.rotation.x, Number(omuz.rotation.y.toFixed(9)), omuz.rotation.z], [0, 0, 0.06]);
  } finally { motor.dispose(); }
});

test("VRM: hiçbir iz atlanmaz (52 kemikli rig bütün soyut uzuvları taşır); basladi sonucu bunu söyler", ZAMAN, async () => {
  const s = await sahneKur();
  try {
    const veri: unknown[] = [];
    s.orion.sonucDinle((r) => { if (r.durum === "basladi") veri.push(r.veri); });
    s.orion.niyet({ tur: "jest", jest: "bekliyor", klip: "dusun" }, "j1");
    kare(s, 1);
    assert.deepEqual(veri, [{ klip: "dusun", sure: 3, dongu: false, atlanan: [] }]);
  } finally { s.motor.dispose(); }
});

test("prosedürel gövde (VRM yüklenemedi): dusun'un ön kol izi ATLANIR ve basladi sonucunda adıyla durur", ZAMAN, async () => {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const saat = new Saat();
  const u = console.warn, l = console.log;
  const uyarilar: string[] = [];
  console.warn = (...a: unknown[]) => { uyarilar.push(a.join(" ")); }; console.log = () => {};
  try {
    const a = await avatarKur({ sahne, saat, vrmYolu: "data:model/gltf-binary;base64,AAAA", klipler: await kutuphane() });
    const veri: unknown[] = [];
    a.sonucDinle((r) => { if (r.durum === "basladi") veri.push(r.veri); });
    a.niyet({ tur: "jest", jest: "bekliyor", klip: "dusun" }, "j1");
    saat.ilerle(50);
    assert.deepEqual([a.iskeletBilgisi().tur, veri, uyarilar.some((x) => x.includes("'dusun' klibinin 1 izi uygulanamadı: sag_on_kol.donme_x"))],
      ["prosedurel", [{ klip: "dusun", sure: 3, dongu: false, atlanan: ["sag_on_kol.donme_x"] }], true]);
  } finally { console.warn = u; console.log = l; motor.dispose(); }
});
