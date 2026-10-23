// uygulama/sekans/kamera.test.ts — kamera değerlendirme (kareye göre poz, harman) ve düzenleme işlemleri (spec 38 §7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sekansDogrula, type Sekans } from "../../protocol/sekans.ts";
import { etkinKesme, kameraPozu } from "./kameraDegerlendir.ts";
import { kameraAyarla, kameraEkle, kameraSil, kesmeAyarla, kesmeEkle, kesmeSil } from "./editor/kameraIslemleri.ts";

const bos = (): Sekans => { const r = sekansDogrula({ surum: 1, ad: "t", fps: 30, sure_kare: 120, baglamalar: [], izler: [] }); if (!r.ok) throw new Error(r.hata); return r.deger; };
const ok = <T>(r: { ok: boolean; deger?: T; hata?: string }): T => { assert.ok(r.ok, r.hata ?? ""); return r.deger as T; };
const iki = (): Sekans => {
  let s = bos();
  const a = ok(kameraEkle(s, { konum: [0, 1.6, 3], hedef: [0, 1.4, 0], fov: 50 })); s = a.sekans;
  const b = ok(kameraEkle(s, { konum: [4, 2, 0], hedef: [0, 1.2, 0], fov: 30 })); s = b.sekans;
  s = ok(kesmeEkle(s, 10, a.id)); s = ok(kesmeEkle(s, 60, b.id, "yumusak", 20));
  return s;
};

test("kameraPozu: ilk kesmeden ÖNCE poz yok (oyunun kendi kamerası), kesmeyle başlar", () => {
  const s = iki();
  assert.equal(kameraPozu(s, 9), null);
  assert.deepEqual(kameraPozu(s, 10)!.konum, [0, 1.6, 3]);
  assert.equal(kameraPozu(s, 59)!.kamera, "kamera_1");
});

test("kameraPozu: yumuşak geçiş başta önceki, sonda yeni kamera, ortada karışım; sonrasında yeni kamera", () => {
  const s = iki();
  assert.deepEqual(kameraPozu(s, 60)!.konum, [0, 1.6, 3]);
  const orta = kameraPozu(s, 70)!;                    // t = 0.5 → smoothstep 0.5
  assert.ok(Math.abs(orta.konum[0] - 2) < 1e-9 && Math.abs(orta.fov - 40) < 1e-9, JSON.stringify(orta));
  assert.deepEqual(kameraPozu(s, 80)!.konum, [4, 2, 0]);
  assert.equal(kameraPozu(s, 119)!.fov, 30);
  assert.equal(kameraPozu(s, 70)!.kamera, "kamera_2", "harmanda etkin kamera hedef kamera");
});

test("kameraPozu: harman tek yönde ilerler (monoton) ve uçlarda hız 0 (smoothstep)", () => {
  const s = iki();
  const xs = Array.from({ length: 21 }, (_, i) => kameraPozu(s, 60 + i)!.konum[0]);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i]! >= xs[i - 1]! - 1e-12);
  assert.ok(xs[1]! - xs[0]! < xs[10]! - xs[9]!, "başta yavaş");
});

test("kameraPozu: önceki kesme yoksa 'yumuşak' ilk kesme ani", () => {
  let s = bos();
  const a = ok(kameraEkle(s, { konum: [0, 1, 3], hedef: [0, 1, 0], fov: 50 })); s = a.sekans;
  s = ok(kesmeEkle(s, 5, a.id, "yumusak", 30));
  assert.deepEqual(kameraPozu(s, 5)!.konum, [0, 1, 3]);
});

test("etkinKesme: kareye göre son kesme ve sırası", () => {
  const s = iki();
  assert.equal(etkinKesme(s, 5), null);
  assert.equal(etkinKesme(s, 10)!.i, 0);
  assert.equal(etkinKesme(s, 100)!.i, 1);
});

test("kameraEkle: sıradaki ad ve kimlik, tavanda neden; kameraAyarla alanı değiştirir, geçersizi reddeder", () => {
  let s = bos();
  const a = ok(kameraEkle(s, { konum: [0, 1, 3], hedef: [0, 1, 0], fov: 50 })); s = a.sekans;
  assert.equal(s.kameralar![0]!.ad, "Kamera 1");
  s = ok(kameraAyarla(s, a.id, { ad: "Giriş", fov: 35 }));
  assert.deepEqual([s.kameralar![0]!.ad, s.kameralar![0]!.fov], ["Giriş", 35]);
  const r = kameraAyarla(s, a.id, { fov: 500 });
  assert.equal(r.ok, false);
  assert.equal(kameraAyarla(s, "yok", { fov: 40 }).ok, false);
  for (let i = 0; i < 7; i++) s = ok(kameraEkle(s, { konum: [i, 1, 3], hedef: [i, 1, 0], fov: 50 })).sekans;
  assert.match((kameraEkle(s, { konum: [0, 1, 3], hedef: [0, 1, 0], fov: 50 }) as { hata: string }).hata, /en çok 8/);
});

test("kameraSil: kamerayı ve ona bağlı kesmeleri kaldırır, kaç kesme gittiğini söyler; son kamerada alanlar kalkar", () => {
  const s = iki();
  const r = ok(kameraSil(s, "kamera_2"));
  assert.equal(r.kesme, 1);
  assert.equal(r.sekans.kameralar!.length, 1);
  assert.equal(r.sekans.kesmeler!.length, 1);
  const son = ok(kameraSil(r.sekans, "kamera_1")).sekans;
  assert.ok(!("kameralar" in son) && !("kesmeler" in son));
});

test("kesmeEkle: aynı karede kesme varsa kamerası değişir (sayı artmaz); sıralı kalır", () => {
  let s = iki();
  s = ok(kesmeEkle(s, 10, "kamera_2"));
  assert.equal(s.kesmeler!.length, 2);
  assert.equal(s.kesmeler![0]!.kamera, "kamera_2");
  s = ok(kesmeEkle(s, 30, "kamera_1"));
  assert.deepEqual(s.kesmeler!.map((k) => k.kare), [10, 30, 60]);
});

test("kesmeAyarla/kesmeSil: kare taşıma çakışmayı reddeder, silince kesme gider", () => {
  let s = iki();
  assert.equal(kesmeAyarla(s, 10, { kare: 60 }).ok, false);
  const r = ok(kesmeAyarla(s, 10, { kare: 20 }));
  assert.equal(r.kare, 20);
  s = r.sekans;
  s = ok(kesmeSil(s, 20));
  assert.deepEqual(s.kesmeler!.map((k) => k.kare), [60]);
  assert.equal(kesmeSil(s, 999).ok, false);
});
