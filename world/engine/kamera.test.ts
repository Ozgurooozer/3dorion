// world/engine/kamera.test.ts — odak kipinin kamerayı GERÇEKTEN çevirdiği.
//
// Bildirilen arıza: "1. şahıstayken terminale düzgün açıyla geçemiyorum,
// 3. şahısta iyi." Sebep: `cizimGuncelle` yön dalında `_odak` ele alınmıyordu;
// kamera ekranın önüne gidiyor ama OYUNCUNUN baktığı yöne bakmaya devam
// ediyordu. 3. şahısta oyuncu zaten monitöre dönük yürüdüğü için gizleniyordu.
//
// NullEngine ile gerçek KameraRig koşulur — DOM yalnızca olay bağlama için
// gerekli, o yüzden minimum bir sahte kurulur.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";

// ── Asgari DOM: KameraRig yalnızca olay bağlamak için dokunuyor. ──────────
interface SahteHedef { addEventListener(): void; removeEventListener(): void }
const bosHedef: SahteHedef = { addEventListener() {}, removeEventListener() {} };
const g = globalThis as unknown as Record<string, unknown>;
g.document ??= { pointerLockElement: null, addEventListener() {}, removeEventListener() {}, exitPointerLock() {} };
g.addEventListener ??= () => {};
g.removeEventListener ??= () => {};

const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
const { Scene } = await import("@babylonjs/core/scene.js");
const { Vector3 } = await import("@babylonjs/core/Maths/math.vector.js");
const { KameraRig } = await import("./kamera.ts");

function rigKur() {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const rig = new KameraRig(sahne, bosHedef as unknown as HTMLCanvasElement);
  rig.hedefAyarla({ konum: new Vector3(0, 0, 0), gozYuksekligi: 1.6 });
  return { rig, sahne, motor };
}

/** Odak yerleşene kadar birkaç tik + kare çevir. */
function dondur(rig: InstanceType<typeof KameraRig>, kare = 120): void {
  for (let i = 0; i < kare; i++) { rig.guncelle(1 / 20); rig.cizimGuncelle(1 / 60); }
}

/** İki açı arasındaki en kısa fark (radyan). */
function fark(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

test("odak kamerayı hedefe ÇEVİRİR — oyuncu ters yöne bakıyorken bile", () => {
  const { rig, motor } = rigKur();
  try {
    // Oyuncu ekrana TERS bakıyor: arızanın ortaya çıktığı durum.
    rig.bakisAyarla(0, -0.5);   // ekrana TERS bakiyor (ekran -Z tarafinda)
    const ekran = new Vector3(0, 1.2, -2);
    rig.odakKilitle(ekran, 0.95, 0.05);
    dondur(rig);

    // Kamera ekrana bakıyor mu? Bakış yönü ile kamera→ekran yönü örtüşmeli.
    const k = rig.kamera.position;
    const beklenenYaw = Math.atan2(ekran.x - k.x, ekran.z - k.z);
    assert.ok(fark(rig.kamera.rotation.y, beklenenYaw) < 0.05,
      `kamera ekrana bakmali: yaw=${rig.kamera.rotation.y.toFixed(3)} beklenen=${beklenenYaw.toFixed(3)}`);
  } finally { motor.dispose(); }
});

test("1. ŞAHIS ile 3. şahıs odakta AYNI açıyı verir — mod fark etmemeli", () => {
  const ekran = new Vector3(0, 1.2, -2);
  const olc = (birinciSahis: boolean) => {
    const { rig, motor } = rigKur();
    try {
      if (birinciSahis) { rig.modDegistir(); dondur(rig, 40); }
      rig.bakisAyarla(0, -0.5);   // ekrana TERS bakiyor (ekran -Z tarafinda)
      rig.odakKilitle(ekran, 0.95, 0.05);
      dondur(rig);
      return { yaw: rig.kamera.rotation.y, pitch: rig.kamera.rotation.x };
    } finally { motor.dispose(); }
  };
  const ucuncu = olc(false);
  const birinci = olc(true);
  assert.ok(fark(ucuncu.yaw, birinci.yaw) < 0.02,
    `mod acıyı degistirmemeli: 3.sahis=${ucuncu.yaw.toFixed(3)} 1.sahis=${birinci.yaw.toFixed(3)}`);
  assert.ok(Math.abs(ucuncu.pitch - birinci.pitch) < 0.02, "pitch de ayni olmali");
});

test("odak bırakılınca açı SIÇRAMAZ — oyuncu bakışı kameraya yetişmiş olmalı", () => {
  const { rig, motor } = rigKur();
  try {
    rig.bakisAyarla(0, -0.5);   // ekrana TERS bakiyor (ekran -Z tarafinda)
    rig.odakKilitle(new Vector3(0, 1.2, -2), 0.95, 0.05);
    dondur(rig);
    const once = rig.kamera.rotation.y;

    rig.odakBirak();
    rig.guncelle(1 / 20); rig.cizimGuncelle(1 / 60);
    assert.ok(fark(rig.kamera.rotation.y, once) < 0.05,
      `odak birakilinca sicradi: ${once.toFixed(3)} -> ${rig.kamera.rotation.y.toFixed(3)}`);
  } finally { motor.dispose(); }
});

test("odakta fare kamerayı KAÇIRMAZ — terminalde yazarken görüntü sabit", () => {
  const { rig, motor } = rigKur();
  try {
    const ekran = new Vector3(0, 1.2, -2);
    rig.odakKilitle(ekran, 0.95, 0.05);
    dondur(rig);
    const once = rig.kamera.rotation.y;
    // Odakta oyuncu bakışı değişse bile kamera ekranda kalmalı (fare olayı
    // zaten `fareHareket` içinde erken dönüyor; burada sonucu sınıyoruz).
    rig.bakisAyarla(0.7, 0.3);
    dondur(rig, 20);
    assert.ok(fark(rig.kamera.rotation.y, once) < 0.05, "odakta bakis degismemeli");
  } finally { motor.dispose(); }
});

// ── FARE KİPİ: ODAĞA GÖRE İKİ DURUM ───────────────────────────────────────
// İstek (Ozyn): "terminale bakınca Ctrl ile hareket ettireceğiz ekranı;
// terminalden çıkınca mouse ile normal kamera hareketlerini yapacağız;
// terminale veya ofisteki bir panele gelince mouse kullanılabilir, objeleri
// seçebilir."
//
// Yani:
//   gezinirken → fare kamerayı sürer (kilitli imleç, klasik)
//   odakta     → imleç SERBEST (tıklayıp seçmek için), kamera Ctrl'ye bağlı
//
// Bir önceki sürüm bunu TERS kurmuştu; bu testler ters kurulumu yakalar.

/** Dinleyici tutan asgari olay hedefi. */
function olayHedefi() {
  const kayit = new Map<string, Set<(e: unknown) => void>>();
  return {
    addEventListener(t: string, f: (e: unknown) => void) {
      (kayit.get(t) ?? kayit.set(t, new Set()).get(t)!).add(f);
    },
    removeEventListener(t: string, f: (e: unknown) => void) { kayit.get(t)?.delete(f); },
    yay(t: string, e: unknown) { for (const f of kayit.get(t) ?? []) f(e); },
  };
}

/** Gerçek olay akışıyla bir rig kurar; DOM sahtesi testten sonra geri verilir. */
function düzenek() {
  const pencere = olayHedefi();
  const tuval = olayHedefi();
  let kilitIstendi = 0;
  const eskiEkle = g.addEventListener, eskiSil = g.removeEventListener, eskiDoc = g.document;
  // Sahte belge GERÇEKTEN dinleyici tutmalı: `pointerlockchange` window'a
  // değil document'a bağlanıyor. İlk sürümde bu olay boşa gidiyordu ve test
  // "fare kamerayı sürmüyor" diye kalıyordu — kod değil, düzenek eksikti.
  const belgeOlay = olayHedefi();
  const belge = {
    pointerLockElement: null as unknown,
    addEventListener: belgeOlay.addEventListener.bind(belgeOlay),
    removeEventListener: belgeOlay.removeEventListener.bind(belgeOlay),
    exitPointerLock() { belge.pointerLockElement = null; belgeOlay.yay("pointerlockchange", {}); },
  };
  g.addEventListener = pencere.addEventListener.bind(pencere);
  g.removeEventListener = pencere.removeEventListener.bind(pencere);
  g.document = belge;

  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const tuvalNesnesi = Object.assign(tuval, {
    requestPointerLock() {
      kilitIstendi++;
      belge.pointerLockElement = tuvalNesnesi;
      belgeOlay.yay("pointerlockchange", {});      // tarayıcının yaptığını taklit et
    },
  });
  const rig = new KameraRig(sahne, tuvalNesnesi as unknown as HTMLCanvasElement);
  rig.hedefAyarla({ konum: new Vector3(0, 0, 0), gozYuksekligi: 1.6 });

  return {
    rig, pencere, tuval,
    kilit: () => kilitIstendi,
    fareOynat: (dx: number) => pencere.yay("mousemove", { movementX: dx, movementY: 0 }),
    ctrl: (basili: boolean) =>
      pencere.yay(basili ? "keydown" : "keyup", { key: "Control", repeat: false }),
    kapat: () => {
      motor.dispose();
      g.addEventListener = eskiEkle; g.removeEventListener = eskiSil; g.document = eskiDoc;
    },
  };
}

test("GEZİNİRKEN tuvale tıklamak kamerayı fareye verir — bakmak tuş istemez", () => {
  const d = düzenek();
  try {
    d.tuval.yay("click", {});
    assert.equal(d.kilit(), 1, "gezinirken tiklamak kilit almali");

    const eskiYaw = d.rig.yaw;
    d.fareOynat(100);
    assert.notEqual(d.rig.yaw, eskiYaw, "gezinirken fare kamerayi surmeli");
  } finally { d.kapat(); }
});

test("ODAKTA tıklamak kilit ALMAZ — orada tıklamanın işi nesne seçmek", () => {
  const d = düzenek();
  try {
    d.rig.odakKilitle(new Vector3(0, 1.2, -2), 0.95, 0.05);
    const once = d.kilit();
    d.tuval.yay("click", {});
    assert.equal(d.kilit(), once, "odakta tiklamak kilit ALMAMALI (imlec serbest kalmali)");
  } finally { d.kapat(); }
});

test("ODAKTA Ctrl+fare kamerayı sürer — ama KİLİT ALMAZ (Ctrl+C terminale gitsin)", () => {
  const d = düzenek();
  try {
    d.rig.odakKilitle(new Vector3(0, 1.2, -2), 0.95, 0.05);
    for (let i = 0; i < 60; i++) { d.rig.guncelle(1 / 20); d.rig.cizimGuncelle(1 / 60); }
    const kilitOnce = d.kilit();
    const yawOnce = d.rig.yaw;

    d.ctrl(true);
    d.fareOynat(120);
    assert.notEqual(d.rig.yaw, yawOnce, "odakta Ctrl+fare kamerayi surmeli");
    assert.equal(d.kilit(), kilitOnce,
      "kilit ALINMAMALI: alinsa imlec kaybolur ve Ctrl+C kabugun elinden gider");
  } finally { d.kapat(); }
});

test("ODAKTA Ctrl BASILI DEĞİLKEN fare kamerayı oynatmaz — yazarken görüntü sabit", () => {
  const d = düzenek();
  try {
    d.rig.odakKilitle(new Vector3(0, 1.2, -2), 0.95, 0.05);
    for (let i = 0; i < 60; i++) { d.rig.guncelle(1 / 20); d.rig.cizimGuncelle(1 / 60); }
    const yawOnce = d.rig.yaw;
    d.fareOynat(200);
    assert.equal(d.rig.yaw, yawOnce, "Ctrl'siz fare odakta kamerayi oynatmamali");
  } finally { d.kapat(); }
});

test("Ctrl BIRAKILINCA odakta kamera yine sabitlenir", () => {
  const d = düzenek();
  try {
    d.rig.odakKilitle(new Vector3(0, 1.2, -2), 0.95, 0.05);
    d.ctrl(true); d.fareOynat(50);
    const yaw = d.rig.yaw;
    d.ctrl(false); d.fareOynat(200);
    assert.equal(d.rig.yaw, yaw, "Ctrl birakilinca fare artik surmemeli");
  } finally { d.kapat(); }
});

test("ODAKTAN ÇIKINCA kamera hemen fareye döner — fazladan tıklama gerekmez", () => {
  const d = düzenek();
  try {
    d.rig.odakKilitle(new Vector3(0, 1.2, -2), 0.95, 0.05);
    const once = d.kilit();
    d.rig.odakBirak();
    assert.equal(d.kilit(), once + 1, "odak birakilinca kilit ISTENMELI");
  } finally { d.kapat(); }
});

test("ALT-TAB Ctrl'yi basılı bırakmaz — pencere odağı gidince temizlenir", () => {
  const d = düzenek();
  try {
    d.rig.odakKilitle(new Vector3(0, 1.2, -2), 0.95, 0.05);
    d.ctrl(true);
    assert.equal(d.rig.fareKamerada, true);
    d.pencere.yay("blur", {});
    assert.equal(d.rig.fareKamerada, false, "blur sonrasi Ctrl basili kalmamali");
  } finally { d.kapat(); }
});

test("odakBirak İKİ KEZ çağrılsa da bozulmaz — Esc'e iki kez basmak güvenli", () => {
  const d = düzenek();
  try {
    d.rig.odakKilitle(new Vector3(0, 1.2, -2), 0.95, 0.05);
    d.rig.odakBirak();
    assert.equal(d.rig.odakta, false);
    d.rig.odakBirak();                       // ikinci kez: sessizce geçmeli
    assert.equal(d.rig.odakta, false);
  } finally { d.kapat(); }
});
