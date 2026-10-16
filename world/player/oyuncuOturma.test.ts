// world/player/oyuncuOturma.test.ts — GERÇEK Oyuncu + gerçek KameraRig (NullEngine): bankın ipucu, F ile oturma, hareket kilidi, F/Esc ile kalkma, C kamera, E etkisiz.
//
// `oturma.test.ts` yalnız noktaları hesaplar; burası oyuncunun o noktaları UYGULADIĞINI ve tuşların bağlandığını sınar. DOM yalnız olay bağlamak için
// gerekli (kamera.test.ts deseni): `addEventListener` sahtesi oyuncunun klavye işleyicisini yakalar, test tuşa bunun üstünden basar.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";

type Isleyici = (e: { code: string; target: null; preventDefault(): void }) => void;
const isleyiciler = new Map<string, Isleyici>();
const bosHedef = { addEventListener() {}, removeEventListener() {} };
const g = globalThis as unknown as Record<string, unknown>;
g.document ??= { pointerLockElement: null, addEventListener() {}, removeEventListener() {}, exitPointerLock() {} };
g.addEventListener = (tur: string, f: Isleyici) => { isleyiciler.set(tur, f); };
g.removeEventListener = () => {};

const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
const { Scene } = await import("@babylonjs/core/scene.js");
const { Vector3 } = await import("@babylonjs/core/Maths/math.vector.js");
const { KameraRig } = await import("../engine/kamera.ts");
const { Oyuncu } = await import("./oyuncu.ts");
const { EtkilesimYayici } = await import("./etkilesim.ts");
const { birlesikYerKur } = await import("../yer/birlesikYer.ts");
const { BANK } = await import("../level/bank.ts");
const { KALCA_YUKSEKLIGI } = await import("./oturma.ts");
const { imlecKipiKur } = await import("./imlecKipi.ts");
import type { Yer } from "../yer/yer.ts";
import type { OdaKurulumu } from "../level/oda.ts";

/** Sahte ova: geniş sınır, engelsiz, düz zemin −0,05 (teras). */
const OVA: Yer = {
  ad: "ova", sinir: { minX: -60, maxX: 60, minZ: -60, maxZ: 60 },
  engeller: [], katiYuzeyler: [], capalar: [], nesneler: [], yukseklik: () => -0.05,
};

function dunya() {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const rig = new KameraRig(sahne, bosHedef as unknown as HTMLCanvasElement);
  const yer = birlesikYerKur(OVA);
  const yayici = new EtkilesimYayici();
  const oda = { seffaflar: [] } as unknown as OdaKurulumu;
  const kilit = { birak: 0, iste: 0 };
  const imlec = imlecKipiKur({ kilidiBirak: () => { kilit.birak++; }, kilidiIste: () => { kilit.iste++; }, engelli: () => false });
  const oyuncu = new Oyuncu(sahne, oda, rig, { yer: () => yer, yayici, dogumYeri: new Vector3(0, 0, 0), imlec });
  let t = 0;
  const tik = (n = 1) => { for (let i = 0; i < n; i++) { t += 0.05; oyuncu.guncelle(t, 0.05); } };
  const tus = (kod: string) => { isleyiciler.get("keydown")!({ code: kod, target: null, preventDefault() {} }); };
  const birak = (kod: string) => { isleyiciler.get("keyup")?.({ code: kod, target: null, preventDefault() {} }); };
  /** Bankın önüne geç ve ona bakan eğimi bul (eğim yönü rig'in işaretine bağlı olmasın: tara). Bulunamazsa false. */
  const bankaBak = (): boolean => {
    oyuncu.isinla(BANK.x, BANK.z + 1.3, Math.PI);
    for (let p = 0.6; p >= -1.4; p -= 0.05) {
      rig.bakisAyarla(Math.PI, p);
      tik();
      if (yayici.sonIpucu?.capa === "bank") return true;
    }
    return false;
  };
  return { motor, rig, oyuncu, yayici, yer, tik, tus, birak, bankaBak, imlec, kilit };
}

const AZ = 1e-6;

test("bankın önünden ona bakınca ipucu '[F] bank — otur' çıkar", () => {
  const { motor, yayici, bankaBak } = dunya();
  try {
    assert.ok(bankaBak(), "bakış hiçbir eğimde bankı tanımadı");
    assert.equal(yayici.sonIpucu?.metin, "[F] bank — otur");
  } finally { motor.dispose(); }
});

test("F ile oturulur: etkileşim 'otur' başlar, ayak konumu oturma noktasında (kalça yüzeyde), yüz ova'ya (+Z)", () => {
  const { motor, rig, oyuncu, yayici, tus, bankaBak } = dunya();
  try {
    assert.ok(bankaBak());
    tus("KeyF");
    assert.equal(yayici.aktif?.eylem, "otur");
    assert.ok(Math.abs(oyuncu.konum.x - BANK.x) < AZ && Math.abs(oyuncu.konum.z - BANK.z) < AZ, "bankın üstünde değil");
    assert.ok(Math.abs(oyuncu.konum.y - (BANK.zemin + BANK.oturma - KALCA_YUKSEKLIGI)) < AZ, `y=${oyuncu.konum.y}`);
    assert.ok(Math.abs(rig.yaw) < 1e-6, `yaw=${rig.yaw} (ova'ya +Z: 0 beklenir)`);
  } finally { motor.dispose(); }
});

test("oturan YÜRÜYEMEZ: W basılıyken bile konum değişmez", () => {
  const { motor, oyuncu, tus, birak, tik, bankaBak } = dunya();
  try {
    assert.ok(bankaBak());
    tus("KeyF");
    const once = { x: oyuncu.konum.x, y: oyuncu.konum.y, z: oyuncu.konum.z };
    tus("KeyW"); tik(20); birak("KeyW");
    assert.deepEqual({ x: oyuncu.konum.x, y: oyuncu.konum.y, z: oyuncu.konum.z }, once);
    assert.equal(oyuncu.hareketliMi, false);
  } finally { motor.dispose(); }
});

test("oturanda F tekrar basılınca KALKAR: etkileşim biter, oyuncu bankın önüne (durak) ve zemine konur", () => {
  const { motor, oyuncu, yayici, yer, tus, bankaBak } = dunya();
  try {
    assert.ok(bankaBak());
    tus("KeyF");
    tus("KeyF");
    assert.equal(yayici.aktif, null);
    const bank = yer.capalar.find((c) => c.ad === "bank")!;
    assert.ok(Math.abs(oyuncu.konum.x - bank.durak.x) < AZ && Math.abs(oyuncu.konum.z - bank.durak.z) < AZ, "durağa konmadı");
    assert.ok(Math.abs(oyuncu.konum.y - yer.yukseklik(bank.durak.x, bank.durak.z)) < AZ, "zemine konmadı");
  } finally { motor.dispose(); }
});

test("oturanda Esc de KALDIRIR (etkileşimi bitirir): aynı çıkış yolu", () => {
  const { motor, oyuncu, yayici, yer, tus, bankaBak } = dunya();
  try {
    assert.ok(bankaBak());
    tus("KeyF");
    tus("Escape");
    assert.equal(yayici.aktif, null);
    const bank = yer.capalar.find((c) => c.ad === "bank")!;
    assert.ok(Math.abs(oyuncu.konum.z - bank.durak.z) < AZ, "durağa konmadı");
  } finally { motor.dispose(); }
});

test("kalkınca yürümek yeniden mümkün", () => {
  const { motor, oyuncu, tus, birak, tik, bankaBak } = dunya();
  try {
    assert.ok(bankaBak());
    tus("KeyF"); tus("KeyF");
    const once = oyuncu.konum.z;
    tus("KeyW"); tik(10); birak("KeyW");
    assert.notEqual(oyuncu.konum.z, once);
  } finally { motor.dispose(); }
});

test("E artık etkileşim başlatmaz (eski tuş boşta)", () => {
  const { motor, yayici, tus, bankaBak } = dunya();
  try {
    assert.ok(bankaBak());
    tus("KeyE");
    assert.equal(yayici.aktif, null);
  } finally { motor.dispose(); }
});

test("C kamera modunu değiştirir; F çapa yokken kamerayı DEĞİŞTİRMEZ", () => {
  const { motor, rig, oyuncu, tus, tik } = dunya();
  try {
    oyuncu.isinla(0, 0, 0);
    rig.bakisAyarla(0, 0);
    tik();
    const mod = rig.mod;
    tus("KeyF");
    assert.equal(rig.mod, mod, "F kamerayı değiştirdi");
    tus("KeyC");
    assert.notEqual(rig.mod, mod, "C kamerayı değiştirmedi");
  } finally { motor.dispose(); }
});

// ── İMLEÇ KİPİ (Tab, spec 28) ──────────────────────────────────────────────

test("Tab imleç kipini açar (fare kilidi bırakılır), ikinci Tab kapatır (kilit yeniden istenir)", () => {
  const { motor, imlec, kilit, tus } = dunya();
  try {
    tus("Tab");
    assert.deepEqual([imlec.acik, kilit.birak, kilit.iste], [true, 1, 0]);
    tus("Tab");
    assert.deepEqual([imlec.acik, kilit.birak, kilit.iste], [false, 1, 1]);
  } finally { motor.dispose(); }
});

test("imleç kipinde W/A/S/D ile YÜRÜNEBİLİR (yalnız bakış kilitli)", () => {
  const { motor, oyuncu, tus, birak, tik } = dunya();
  try {
    oyuncu.isinla(0, 0, 0);
    tus("Tab");
    const once = oyuncu.konum.z;
    tus("KeyW"); tik(10); birak("KeyW");
    assert.notEqual(oyuncu.konum.z, once);
  } finally { motor.dispose(); }
});

test("Esc imleç kipini kapatır ve kilidi İSTEMEZ (tarayıcı Esc'ten hemen sonra reddeder)", () => {
  const { motor, imlec, kilit, tus } = dunya();
  try {
    tus("Tab");
    tus("Escape");
    assert.deepEqual([imlec.acik, kilit.iste], [false, 0]);
  } finally { motor.dispose(); }
});

test("imleç kipi açıkken F yine etkileşimdir (kip etkileşimi bozmaz)", () => {
  const { motor, yayici, tus, bankaBak } = dunya();
  try {
    assert.ok(bankaBak());
    tus("Tab");
    tus("KeyF");
    assert.equal(yayici.aktif?.eylem, "otur");
  } finally { motor.dispose(); }
});

// ── MENÜDEN ETKİLEŞİM ("ben yapayım", spec 28) ─────────────────────────────

test("menüden: bankın önündeyken etkilesimBaslat('bank','otur') OTURTUR (F ile aynı olay yolu)", () => {
  const { motor, oyuncu, yayici, yer } = dunya();
  try {
    const bank = yer.capalar.find((c) => c.ad === "bank")!;
    oyuncu.isinla(bank.durak.x, bank.durak.z, Math.PI);
    assert.equal(oyuncu.etkilesimBaslat("bank", "otur"), true);
    assert.equal(yayici.aktif?.eylem, "otur");
    assert.ok(Math.abs(oyuncu.konum.x - bank.konum.x) < AZ && Math.abs(oyuncu.konum.z - bank.konum.z) < AZ, "oturmadı");
  } finally { motor.dispose(); }
});

test("menüden: UZAKTAYKEN reddedilir (menzil) ve hiçbir etkileşim başlamaz", () => {
  const { motor, oyuncu, yayici } = dunya();
  try {
    oyuncu.isinla(0, 0, 0);
    assert.equal(oyuncu.etkilesimBaslat("bank", "otur"), false);
    assert.equal(yayici.aktif, null);
  } finally { motor.dispose(); }
});

test("menüden: çapanın taşımadığı eylem ve olmayan çapa reddedilir", () => {
  const { motor, oyuncu, yer } = dunya();
  try {
    const bank = yer.capalar.find((c) => c.ad === "bank")!;
    oyuncu.isinla(bank.durak.x, bank.durak.z, Math.PI);
    assert.equal(oyuncu.etkilesimBaslat("bank", "yaz"), false);
    assert.equal(oyuncu.etkilesimBaslat("yok_boyle_capa", "otur"), false);
  } finally { motor.dispose(); }
});

test("menüden: başka bir etkileşim AÇIKKEN (oturuyorken) reddedilir", () => {
  const { motor, oyuncu, yer } = dunya();
  try {
    const bank = yer.capalar.find((c) => c.ad === "bank")!;
    oyuncu.isinla(bank.durak.x, bank.durak.z, Math.PI);
    assert.equal(oyuncu.etkilesimBaslat("bank", "otur"), true);
    assert.equal(oyuncu.etkilesimBaslat("bank", "otur"), false);
  } finally { motor.dispose(); }
});
