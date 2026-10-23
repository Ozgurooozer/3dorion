// uygulama/sekans/kameraOynatici.test.ts — kamera oynatıcı: ▶ sırasında oynatma karesi, durunca önizleme, bırakınca oyuncuya dönüş (spec 38 §7).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { KameraPozu } from "./kameraDegerlendir.ts";
import { kameraOynaticiKur } from "./kameraOynatici.ts";
import type { OynatmaDurumu, SekansOynatici } from "./oynatici.ts";
import { sekansDogrula, type Sekans } from "../../protocol/sekans.ts";
import { kameraEkle, kesmeEkle } from "./editor/kameraIslemleri.ts";

const sekans = (): Sekans => {
  const r = sekansDogrula({ surum: 1, ad: "t", fps: 30, sure_kare: 120, baglamalar: [], izler: [] });
  if (!r.ok) throw new Error(r.hata);
  let s = r.deger;
  const a = kameraEkle(s, { konum: [0, 1, 3], hedef: [0, 1, 0], fov: 50 }); if (!a.ok) throw new Error(a.hata); s = a.deger.sekans;
  const b = kameraEkle(s, { konum: [5, 1, 0], hedef: [0, 1, 0], fov: 30 }); if (!b.ok) throw new Error(b.hata); s = b.deger.sekans;
  const c = kesmeEkle(s, 10, "kamera_1"); if (!c.ok) throw new Error(c.hata); s = c.deger;
  const d = kesmeEkle(s, 60, "kamera_2"); if (!d.ok) throw new Error(d.hata); return d.deger;
};

function kur() {
  const gelenler: (KameraPozu | null)[] = [];
  let kare: number | null = null;
  let calisiyor: OynatmaDurumu["calisiyor"] = null;
  const oynatici = { durum: () => ({ calisiyor, son: null }), kare: () => kare } as unknown as SekansOynatici;
  let dongu: (() => void) | null = null;
  const k = kameraOynaticiKur({ oynatici, surucu: { uygula: (p) => { gelenler.push(p); } }, kareGozcusu: (f) => { dongu = f; return () => { dongu = null; }; } });
  return {
    k, gelenler, kare: () => dongu?.(),
    oyna: (s: Sekans, f: number | null) => { calisiyor = { sekans: "t", plan: { kareler: [], sure: 4, dongu: false }, aralik: { bas: 0, bit: 120 }, t0: 0, ajanlar: [], kamera: { kameralar: s.kameralar!, kesmeler: s.kesmeler! } }; kare = f; },
    dur: () => { calisiyor = null; kare = null; },
  };
}

test("▶ sırasında oynatma karesinin kamerası uygulanır (kesme anında değişir)", () => {
  const t = kur(), s = sekans();
  t.oyna(s, 20); t.kare();
  assert.equal(t.gelenler.at(-1)?.kamera, "kamera_1");
  t.oyna(s, 70); t.kare();
  assert.equal(t.gelenler.at(-1)?.kamera, "kamera_2");
});

test("ilk kesmeden önceki karede kamera oyuna bırakılır (null), ardışık null tekrar gönderilmez", () => {
  const t = kur(), s = sekans();
  t.oyna(s, 20); t.kare();
  t.oyna(s, 5); t.kare(); t.kare(); t.kare();
  assert.deepEqual(t.gelenler.map((p) => p?.kamera ?? null), ["kamera_1", null]);
});

test("▶ biterken kamera BİR KEZ oyuna bırakılır; boştayken hiçbir şey gönderilmez", () => {
  const t = kur(), s = sekans();
  t.oyna(s, 20); t.kare();
  t.dur(); t.kare(); t.kare();
  assert.deepEqual(t.gelenler.map((p) => p?.kamera ?? null), ["kamera_1", null]);
  const n = t.gelenler.length;
  t.kare(); t.kare();
  assert.equal(t.gelenler.length, n);
});

test("önizleme: oynamıyorken playhead'in kamerası; kapanınca bırakılır; ▶ önizlemeden önce gelir", () => {
  const t = kur(), s = sekans();
  let kare = 70;
  t.k.onizleme(() => ({ sekans: s, kare }));
  t.kare();
  assert.equal(t.gelenler.at(-1)?.kamera, "kamera_2");
  kare = 20; t.kare();
  assert.equal(t.gelenler.at(-1)?.kamera, "kamera_1");
  t.oyna(s, 70); t.kare();
  assert.equal(t.gelenler.at(-1)?.kamera, "kamera_2", "oynarken oynatma karesi");
  t.dur();
  t.k.onizleme(null);
  assert.equal(t.gelenler.at(-1), null, "önizleme kapanınca bırakıldı");
  assert.equal(t.k.onizlemeAcikMi(), false);
});

test("yokEt: kare dinleyicisi kalkar ve kamera bırakılır", () => {
  const t = kur(), s = sekans();
  t.oyna(s, 20); t.kare();
  t.k.yokEt();
  assert.equal(t.gelenler.at(-1), null);
  const n = t.gelenler.length;
  t.kare();
  assert.equal(t.gelenler.length, n);
});

test("kamerasız sekans oynarken kamera hiç uygulanmaz", () => {
  const t = kur();
  const bos = { kameralar: undefined, kesmeler: undefined } as unknown as Sekans;
  t.oyna(bos, 20); t.kare(); t.kare();
  assert.equal(t.gelenler.length, 0);
});
