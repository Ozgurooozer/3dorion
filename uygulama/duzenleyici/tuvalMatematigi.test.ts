// uygulama/duzenleyici/tuvalMatematigi.test.ts — tuval matematiği: ekran↔dünya gidiş-dönüş, İMLEÇ MERKEZLİ yakınlaştırmanın sabit noktası, ölçek
// tavanı, sığdır, kutu seçimi, ızgara. Ölçülmüş tolerans: kayan nokta hatası 1e-9 piksel.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import {
  BASLANGIC_GORUNUMU, OLCEK_COK, OLCEK_EN, dunyadanEkrana, ekrandanDunyaya, izgarayaYasla, kaydir, koselerdenKutu, kutularKesisir, kutulariBirlestir,
  sigdir, tekerlekCarpani, yakinlastir, type Gorunum,
} from "./tuvalMatematigi.ts";

const TOL = 1e-9;
const yakin = (a: number, b: number) => Math.abs(a - b) < TOL;

test("ekran ↔ dünya gidiş-dönüş: aynı nokta geri gelir (birkaç görünümde)", () => {
  const gorunumler: Gorunum[] = [{ x: 0, y: 0, olcek: 1 }, { x: 37.5, y: -120, olcek: 0.4 }, { x: -800, y: 300, olcek: 1.9 }];
  for (const g of gorunumler) {
    for (const p of [{ x: 0, y: 0 }, { x: 513.25, y: -77 }, { x: -1000, y: 2400 }]) {
      const geri = ekrandanDunyaya(g, dunyadanEkrana(g, p));
      assert.ok(yakin(geri.x, p.x) && yakin(geri.y, p.y), `${JSON.stringify(g)} ${JSON.stringify(p)} → ${JSON.stringify(geri)}`);
    }
  }
});

test("yakınlaştırma İMLEÇ MERKEZLİ: imlecin altındaki dünya noktası yakınlaşmadan sonra da imlecin altında", () => {
  const g: Gorunum = { x: 100, y: 50, olcek: 0.8 };
  const imlec = { x: 640, y: 360 };
  const once = ekrandanDunyaya(g, imlec);
  const sonra = ekrandanDunyaya(yakinlastir(g, imlec, 1.7), imlec);
  assert.ok(yakin(once.x, sonra.x) && yakin(once.y, sonra.y), `${JSON.stringify(once)} ≠ ${JSON.stringify(sonra)}`);
});

test("yakınlaştırma ölçek tavanına dayanınca da sabit nokta korunur ve ölçek sınırda kalır", () => {
  const g: Gorunum = { x: 10, y: 10, olcek: 1.5 };
  const imlec = { x: 300, y: 200 };
  const z = yakinlastir(g, imlec, 100);
  assert.equal(z.olcek, OLCEK_COK);
  const once = ekrandanDunyaya(g, imlec), sonra = ekrandanDunyaya(z, imlec);
  assert.ok(yakin(once.x, sonra.x) && yakin(once.y, sonra.y));
});

test("uzaklaştırma tabanın altına inmez", () => {
  assert.equal(yakinlastir({ x: 0, y: 0, olcek: 0.3 }, { x: 0, y: 0 }, 0.01).olcek, OLCEK_EN);
});

test("geçersiz çarpan (0, eksi, NaN) görünümü değiştirmez", () => {
  const g: Gorunum = { x: 1, y: 2, olcek: 1 };
  for (const c of [0, -2, Number.NaN]) assert.deepEqual(yakinlastir(g, { x: 5, y: 5 }, c), g);
});

test("tekerlek: aşağı (deltaY > 0) uzaklaştırır, yukarı yakınlaştırır; aşırı adım sınırlı", () => {
  assert.ok(tekerlekCarpani(100) < 1);
  assert.ok(tekerlekCarpani(-100) > 1);
  assert.equal(tekerlekCarpani(10_000), tekerlekCarpani(300));
});

test("kaydır: yalnız başlangıç noktası değişir, ölçek aynı", () => {
  assert.deepEqual(kaydir({ x: 5, y: 5, olcek: 0.5 }, 10, -3), { x: 15, y: 2, olcek: 0.5 });
});

test("sığdır: bütün kutular kenar boşluğuyla ekranın içinde ve ortada", () => {
  const kutular = [{ x: 0, y: 0, g: 200, h: 100 }, { x: 900, y: 400, g: 200, h: 100 }];
  const ekran = { g: 800, h: 600 };
  const g = sigdir(kutular, ekran, 40);
  const b = kutulariBirlestir(kutular)!;
  const sol = dunyadanEkrana(g, { x: b.x, y: b.y }), sag = dunyadanEkrana(g, { x: b.x + b.g, y: b.y + b.h });
  assert.ok(sol.x >= 40 - TOL && sol.y >= 40 - TOL && sag.x <= 760 + TOL && sag.y <= 560 + TOL, `${JSON.stringify(sol)} ${JSON.stringify(sag)}`);
  assert.ok(yakin(sol.x - 0, ekran.g - sag.x), "yatayda ortalı");
});

test("sığdır: küçük grafik BÜYÜTÜLMEZ (ölçek en çok 1)", () => {
  assert.equal(sigdir([{ x: 0, y: 0, g: 50, h: 30 }], { g: 1600, h: 900 }).olcek, 1);
});

test("sığdır: hiç düğüm yoksa başlangıç görünümü", () => {
  assert.deepEqual(sigdir([], { g: 800, h: 600 }), BASLANGIC_GORUNUMU);
});

test("kutu seçimi: kesişen kutu seçilir, dokunmayan seçilmez; köşeler hangi yönden sürüklenirse sürüklensin aynı kutu", () => {
  const secim = koselerdenKutu({ x: 300, y: 300 }, { x: 100, y: 100 });
  assert.deepEqual(secim, { x: 100, y: 100, g: 200, h: 200 });
  assert.equal(kutularKesisir(secim, { x: 250, y: 250, g: 200, h: 80 }), true);
  assert.equal(kutularKesisir(secim, { x: 301, y: 0, g: 50, h: 50 }), false);
});

test("ızgaraya yaslama 20 birimlik adıma yuvarlar", () => {
  assert.deepEqual([izgarayaYasla(9), izgarayaYasla(11), izgarayaYasla(-31)], [0, 20, -40]);
});
