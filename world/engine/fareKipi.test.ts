// world/engine/fareKipi.test.ts — kip kararı, BABYLON OLMADAN.
//
// Ayırmanın asıl kazancı bu dosya: "hangi durumda fare neyi sürer" sorusu
// artık NullEngine, sahne, kamera ve matris kurmadan yanıtlanabiliyor.
// Aynı davranış `kamera.test.ts`'te de sınanıyor ama orası tüm rig'i kuruyor;
// burası saniyenin binde biri kadar sürüyor ve kararın kendisine odaklanıyor.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fareKipiKur } from "./fareKipi.ts";

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

function düzenek(baslangic: { odakta?: boolean; kilitli?: boolean } = {}) {
  const pencere = olayHedefi();
  const tuval = olayHedefi();
  const g = globalThis as unknown as Record<string, unknown>;
  const eskiEkle = g.addEventListener, eskiSil = g.removeEventListener;
  g.addEventListener = pencere.addEventListener.bind(pencere);
  g.removeEventListener = pencere.removeEventListener.bind(pencere);

  const durum = {
    odakta: baslangic.odakta ?? false,
    kilitli: baslangic.kilitli ?? false,
    kilitIstendi: 0,
    donus: [0, 0] as [number, number],
  };

  const kip = fareKipiKur({
    tuval: tuval as unknown as HTMLCanvasElement,
    odaktaMi: () => durum.odakta,
    kilitliMi: () => durum.kilitli,
    kilitIste: () => { durum.kilitIstendi++; durum.kilitli = true; },
    dondur: (dx, dy) => { durum.donus[0] += dx; durum.donus[1] += dy; },
  });

  return {
    kip, durum, tuval,
    oynat: (dx = 10, dy = 0) => pencere.yay("mousemove", { movementX: dx, movementY: dy }),
    ctrl: (basili: boolean) =>
      pencere.yay(basili ? "keydown" : "keyup", { key: "Control", repeat: false }),
    ctrlTekrar: () => pencere.yay("keydown", { key: "Control", repeat: true }),
    /** Herhangi bir tuş olayı — Ctrl dışındakilerin sızmadığını sınamak için. */
    tus: (tur: "keydown" | "keyup", key: string) => pencere.yay(tur, { key, repeat: false }),
    blur: () => pencere.yay("blur", {}),
    kapat: () => { kip.sok(); g.addEventListener = eskiEkle; g.removeEventListener = eskiSil; },
  };
}

test("GEZİNİRKEN: kilit varsa fare kamerayı sürer, tuş gerekmez", () => {
  const d = düzenek({ odakta: false, kilitli: true });
  try {
    d.oynat(15, -5);
    assert.deepEqual(d.durum.donus, [15, -5]);
    assert.equal(d.kip.kamerada, true);
  } finally { d.kapat(); }
});

test("GEZİNİRKEN kilit YOKSA fare sürmez — önce tuvale tıklanmalı", () => {
  const d = düzenek({ odakta: false, kilitli: false });
  try {
    d.oynat(50);
    assert.deepEqual(d.durum.donus, [0, 0]);
    assert.equal(d.kip.kamerada, false);
  } finally { d.kapat(); }
});

test("GEZİNİRKEN tuvale tıklamak kilit ister", () => {
  const d = düzenek({ odakta: false });
  try {
    d.tuval.yay("click", {});
    assert.equal(d.durum.kilitIstendi, 1);
    d.oynat(20);
    assert.deepEqual(d.durum.donus, [20, 0], "kilit alininca fare surmeli");
  } finally { d.kapat(); }
});

test("ODAKTA tıklamak kilit İSTEMEZ — tıklamanın işi nesne seçmek", () => {
  const d = düzenek({ odakta: true });
  try {
    d.tuval.yay("click", {});
    assert.equal(d.durum.kilitIstendi, 0);
  } finally { d.kapat(); }
});

test("ODAKTA Ctrl'siz fare kamerayı OYNATMAZ — yazarken görüntü sabit", () => {
  const d = düzenek({ odakta: true, kilitli: true });
  try {
    d.oynat(100);
    assert.deepEqual(d.durum.donus, [0, 0], "kilit olsa bile odakta Ctrl sart");
    assert.equal(d.kip.kamerada, false);
  } finally { d.kapat(); }
});

test("ODAKTA Ctrl+fare kamerayı sürer ve KİLİT İSTEMEZ — Ctrl+C terminale gitsin", () => {
  const d = düzenek({ odakta: true, kilitli: false });
  try {
    d.ctrl(true);
    d.oynat(30, 7);
    assert.deepEqual(d.durum.donus, [30, 7]);
    assert.equal(d.durum.kilitIstendi, 0,
      "kilit alinsa imlec kaybolur ve Ctrl+C kabugun elinden gider");
  } finally { d.kapat(); }
});

test("Ctrl bırakılınca odakta sürüş durur", () => {
  const d = düzenek({ odakta: true });
  try {
    d.ctrl(true); d.oynat(10);
    d.ctrl(false); d.oynat(90);
    assert.deepEqual(d.durum.donus, [10, 0]);
  } finally { d.kapat(); }
});

test("TEKRAR EDEN keydown yeni bir şey yapmaz — tuş basılı tutulunca spam gelir", () => {
  const d = düzenek({ odakta: true });
  try {
    d.ctrl(true); d.ctrlTekrar(); d.ctrlTekrar();
    assert.equal(d.kip.ctrlBasili, true);
    d.ctrl(false);
    assert.equal(d.kip.ctrlBasili, false);
  } finally { d.kapat(); }
});

test("ALT-TAB Ctrl'yi basılı bırakmaz — keyup hiç gelmez", () => {
  const d = düzenek({ odakta: true });
  try {
    d.ctrl(true);
    assert.equal(d.kip.ctrlBasili, true);
    d.blur();
    assert.equal(d.kip.ctrlBasili, false);
    d.oynat(100);
    assert.deepEqual(d.durum.donus, [0, 0], "blur sonrasi fare surmemeli");
  } finally { d.kapat(); }
});

test("BAŞKA tuşlar Ctrl sanılmaz — Shift'e basmak kamerayı açmamalı", () => {
  const d = düzenek({ odakta: true });
  try {
    for (const key of ["Shift", "Alt", "Meta", "c", "Escape"]) {
      d.tus("keydown", key);
      assert.equal(d.kip.ctrlBasili, false, `${key} Ctrl sanildi`);
      d.oynat(50);
      assert.deepEqual(d.durum.donus, [0, 0], `${key} basiliyken fare surmemeli`);
    }
  } finally { d.kapat(); }
});

test("BAŞKA tuşun keyup'ı basılı Ctrl'yi DÜŞÜRMEZ", () => {
  // Ctrl+Shift gibi bileşimlerde Shift bırakılınca kamera kipi kapanmamalı.
  const d = düzenek({ odakta: true });
  try {
    d.ctrl(true);
    d.tus("keyup", "Shift");
    assert.equal(d.kip.ctrlBasili, true, "baska tusun keyup'i Ctrl'yi dusurmemeli");
    d.oynat(10);
    assert.deepEqual(d.durum.donus, [10, 0]);
  } finally { d.kapat(); }
});

test("sok() dinleyicileri çözer — çözüldükten sonra fare etkisiz", () => {
  const d = düzenek({ odakta: false, kilitli: true });
  try {
    d.kip.sok();
    d.oynat(100);
    assert.deepEqual(d.durum.donus, [0, 0], "cozuldukten sonra olay islenmemeli");
  } finally { d.kapat(); }
});
