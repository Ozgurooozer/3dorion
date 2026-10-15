// host/webMonitor.test.ts — 3. monitör ana süreç parçası (sahte pencere): adres güvenliği (W6), koordinat çevirme (W3), kare kısıtlama, yeniden deneme.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { WebMonitor, adresGecerliMi, pikselCevir, GENISLIK, YUKSEKLIK, VARSAYILAN_ADRES } from "./webMonitor.js";

type SahteOlay = { olay: string; d?: string; g?: number; y?: number };

/** Pencere gibi davranan sahte: webContents olaylarını elle tetiklemek için tutucular. */
function sahtePencere() {
  const dinleyiciler: Record<string, ((...a: unknown[]) => void)[]> = {};
  const girdiler: Record<string, unknown>[] = [];
  const yuklenenler: string[] = [];
  let yikildi = false;
  const wc = {
    on(ad: string, f: (...a: unknown[]) => void) { (dinleyiciler[ad] ??= []).push(f); },
    sendInputEvent(o: Record<string, unknown>) { girdiler.push(o); },
    setFrameRate() {},
    setWindowOpenHandler() {},
  };
  const pencere = {
    webContents: wc,
    loadURL(u: string) { yuklenenler.push(u); return Promise.resolve(); },
    isDestroyed: () => yikildi,
    destroy() { yikildi = true; },
  };
  const tetikle = (ad: string, ...a: unknown[]) => { for (const f of dinleyiciler[ad] ?? []) f(...a); };
  return { pencere, girdiler, yuklenenler, tetikle, yikildi: () => yikildi };
}

function kur(ek: { simdi?: () => number } = {}) {
  const olaylar: SahteOlay[] = [];
  const p = sahtePencere();
  const zamanlayicilar: { f: () => void; ms: number }[] = [];
  const m = new WebMonitor((o) => { olaylar.push(o as SahteOlay); }, {
    pencereKur: () => p.pencere,
    zamanlayici: (f: () => void, ms: number) => { zamanlayicilar.push({ f, ms }); return 1; },
    ...ek,
  });
  return { m, p, olaylar, zamanlayicilar };
}

test("W6 adres güvenliği: yalnız yerel http; dış adres, https ve saçma girdi reddedilir", () => {
  for (const iyi of ["http://localhost:4747", "http://127.0.0.1:4747/harita", "http://localhost"]) assert.equal(adresGecerliMi(iyi), true, iyi);
  for (const kotu of ["https://localhost:4747", "http://example.com", "http://192.168.1.5:4747", "file:///c:/x", "javascript:alert(1)", "", "localhost", null, 42])
    assert.equal(adresGecerliMi(kotu), false, String(kotu));
});

test("ac(): dış adres REDDEDİLİR ve hiçbir pencere açılmaz; yerel adres yüklenir", () => {
  const { m, p } = kur();
  assert.equal(m.ac("http://example.com"), false);
  assert.equal(m.acik, false);
  assert.equal(m.ac(), true);
  assert.deepEqual(p.yuklenenler, [VARSAYILAN_ADRES]);
  assert.equal(m.acik, true);
});

test("sayfa içinden yerel dışına gezinme iptal edilir", () => {
  const { m, p } = kur();
  m.ac();
  let iptal = 0;
  p.tetikle("will-navigate", { preventDefault: () => { iptal++; } }, "http://example.com/");
  p.tetikle("will-navigate", { preventDefault: () => { iptal += 10; } }, "http://localhost:4747/baska");
  assert.equal(iptal, 1);
});

test("W3 koordinat: 0..1 → sayfa pikseli, köşeler ve merkez; sınır dışı kenara sıkışır; NaN 0", () => {
  assert.deepEqual(pikselCevir(0, 0), { x: 0, y: 0 });
  assert.deepEqual(pikselCevir(1, 1), { x: GENISLIK - 1, y: YUKSEKLIK - 1 });
  assert.deepEqual(pikselCevir(0.5, 0.5), { x: Math.round((GENISLIK - 1) / 2), y: Math.round((YUKSEKLIK - 1) / 2) });
  assert.deepEqual(pikselCevir(-3, 9), { x: 0, y: YUKSEKLIK - 1 });
  assert.deepEqual(pikselCevir(Number.NaN, Number.NaN), { x: 0, y: 0 });
});

test("fare olayları sayfaya doğru türle gider; pencere yokken ve bilinmeyen türde false", () => {
  const { m, p } = kur();
  assert.equal(m.fare({ tip: "bas", x: 0.5, y: 0.5 }), false, "pencere yokken sessiz yutma olmamalı");
  m.ac();
  assert.equal(m.fare({ tip: "bas", x: 0, y: 0, dugme: "right" }), true);
  assert.equal(m.fare({ tip: "birak", x: 0, y: 0 }), true);
  assert.equal(m.fare({ tip: "hareket", x: 1, y: 1 }), true);
  assert.equal(m.fare({ tip: "tekerlek", x: 0.5, y: 0.5, dy: 120, dx: 99999 }), true);
  assert.equal(m.fare({ tip: "klavye", x: 0, y: 0 }), false);
  assert.deepEqual(p.girdiler.map((g) => g.type), ["mouseDown", "mouseUp", "mouseMove", "mouseWheel"]);
  assert.equal(p.girdiler[0]!.button, "right");
  assert.equal(p.girdiler[1]!.button, "left", "geçersiz/eksik düğme sola düşer");
  assert.equal(p.girdiler[3]!.deltaX, 600, "tekerlek değeri sınırlanır");
});

test("kareler ~9/sn ile sınırlanır (sayfa hızlı boyanırsa IPC boğulmaz)", () => {
  let t = 1000;
  const { m, p, olaylar } = kur({ simdi: () => t });
  m.ac();
  const resim = { getSize: () => ({ width: 100, height: 60 }), toJPEG: () => new Uint8Array([1, 2, 3]) };
  for (const dt of [0, 20, 50, 120, 130, 240]) { t = 1000 + dt; p.tetikle("paint", {}, {}, resim); }
  const kareler = olaylar.filter((o) => o.olay === "kare");
  assert.equal(kareler.length, 3, "0, 120, 240 ms'deki kareler geçmeli");
  assert.deepEqual([kareler[0]!.g, kareler[0]!.y], [100, 60]);
});

test("sayfa yüklenemezse 'kapali' bildirilir ve 5 sn sonra yeniden denenir; yüklenince 'acik'", () => {
  const { m, p, olaylar, zamanlayicilar } = kur();
  m.ac();
  p.tetikle("did-fail-load", {}, -102, "ERR_CONNECTION_REFUSED", "http://localhost:4747/", true);
  assert.ok(olaylar.some((o) => o.olay === "durum" && o.d === "kapali"));
  assert.equal(zamanlayicilar.length, 1);
  assert.equal(zamanlayicilar[0]!.ms, 5000);
  zamanlayicilar[0]!.f();
  assert.equal(p.yuklenenler.length, 2, "yeniden denenmeli");
  p.tetikle("did-finish-load");
  assert.ok(olaylar.some((o) => o.olay === "durum" && o.d === "acik"));
});

test("alt çerçeve hatası ve iptal (-3) 'kapali' sayılmaz", () => {
  const { m, p, olaylar } = kur();
  m.ac();
  p.tetikle("did-fail-load", {}, -102, "x", "u", false);
  p.tetikle("did-fail-load", {}, -3, "x", "u", true);
  assert.equal(olaylar.filter((o) => o.d === "kapali").length, 0);
});

test("W6 sızıntı: kapat() pencereyi yıkar ve sonrasında fare reddedilir", () => {
  const { m, p } = kur();
  m.ac();
  m.kapat();
  assert.equal(p.yikildi(), true);
  assert.equal(m.acik, false);
  assert.equal(m.fare({ tip: "bas", x: 0, y: 0 }), false);
});
