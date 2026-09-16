// world/olayUretici.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OlayUretici } from "./olayUretici.ts";
import type { OrionDurumu, OyuncuDurumu } from "../protocol/algi.ts";

const V0 = { x: 0, y: 0, z: 0 };
const orion = (uzerine: Partial<OrionDurumu> = {}): OrionDurumu => ({
  konum: V0, bakis: { x: 0, y: 0, z: 1 }, poz: "duruyor",
  mesgul: false, elinde: null, oturuyor_mu: false, ...uzerine,
});
const oyuncu = (mesafe: number, uzerine: Partial<OyuncuDurumu> = {}): OyuncuDurumu => ({
  konum: V0, bakis: { x: 0, y: 0, z: 1 }, bakiyor: false,
  mesafe, etkilesim: null, ...uzerine,
});

test("ilk örnek sessizdir — başlangıç durumu bir DEĞİŞİM değildir", () => {
  const u = new OlayUretici();
  assert.deepEqual(u.ornekle(0, orion(), oyuncu(0.5)), []);
});

test("yaklaşma eşiği geçilince olay üretir", () => {
  const u = new OlayUretici({ yakinEsik: 1.8, uzakEsik: 2.6 });
  u.ornekle(0, orion(), oyuncu(5));
  const o = u.ornekle(1000, orion(), oyuncu(1.0));
  assert.equal(o.length, 1);
  assert.equal(o[0]?.ad, "ozyn_yaklasti");
});

test("HİSTEREZİS: eşikte salınan oyuncu olay yağmuru üretmez", () => {
  const u = new OlayUretici({ yakinEsik: 1.8, uzakEsik: 2.6, sogumaMs: 0 });
  u.ornekle(0, orion(), oyuncu(5));
  let sayi = 0;
  // 1.8 ile 2.6 arasında 200 kez gidip gel: tek geçiş olmalı, sonra sessizlik.
  sayi += u.ornekle(100, orion(), oyuncu(1.7)).length;   // girdi
  for (let i = 0; i < 200; i++) {
    sayi += u.ornekle(200 + i, orion(), oyuncu(i % 2 ? 1.9 : 2.4)).length;
  }
  assert.equal(sayi, 1, "histerezis bandı içinde tek olay bile üretilmemeli");
});

test("uzak eşiği aşınca uzaklaşma üretir", () => {
  const u = new OlayUretici({ yakinEsik: 1.8, uzakEsik: 2.6, sogumaMs: 0 });
  u.ornekle(0, orion(), oyuncu(5));
  u.ornekle(100, orion(), oyuncu(1.0));
  const o = u.ornekle(200, orion(), oyuncu(3.0));
  assert.equal(o[0]?.ad, "ozyn_uzaklasti");
});

test("uzaktan bakmak olay değil, yakından bakmak olaydır", () => {
  const u = new OlayUretici({ yakinEsik: 1.8, uzakEsik: 2.6, sogumaMs: 0 });
  u.ornekle(0, orion(), oyuncu(5));
  const uzaktan = u.ornekle(100, orion(), oyuncu(5, { bakiyor: true }));
  assert.equal(uzaktan.length, 0, "odanın öbür ucundan bakmak olay sayılmamalı");

  const u2 = new OlayUretici({ yakinEsik: 1.8, uzakEsik: 2.6, sogumaMs: 0 });
  u2.ornekle(0, orion(), oyuncu(1.0));
  const yakindan = u2.ornekle(100, orion(), oyuncu(1.0, { bakiyor: true }));
  assert.equal(yakindan[0]?.ad, "ozyn_sana_bakti");
});

test("yüzeye geçme ve çıkma ayrı olaylardır, yüzey adını taşır", () => {
  const u = new OlayUretici({ sogumaMs: 0 });
  u.ornekle(0, orion(), oyuncu(1.0));
  const girdi = u.ornekle(100, orion(), oyuncu(1.0, { etkilesim: "monitor" }));
  assert.equal(girdi[0]?.ad, "ozyn_yuzeye_gecti");
  assert.equal(girdi[0]?.ayrinti?.yuzey, "monitor");

  const cikti = u.ornekle(200, orion(), oyuncu(1.0, { etkilesim: null }));
  assert.equal(cikti[0]?.ad, "ozyn_yuzeyden_cikti");
  assert.equal(cikti[0]?.ayrinti?.yuzey, "monitor");
});

test("soğuma aynı olayın hızlı tekrarını yutar", () => {
  const u = new OlayUretici({ yakinEsik: 1.8, uzakEsik: 2.6, sogumaMs: 5000 });
  u.ornekle(0, orion(), oyuncu(5));
  assert.equal(u.ornekle(100, orion(), oyuncu(1.0)).length, 1);
  u.ornekle(200, orion(), oyuncu(5));            // uzaklaştı (farklı ad, geçer)
  // 5 sn dolmadan yeniden yaklaş: soğumada, yutulmalı.
  assert.equal(u.ornekle(300, orion(), oyuncu(1.0)).length, 0);
  // 5 sn sonra yeniden üretilebilir.
  u.ornekle(6000, orion(), oyuncu(5));
  assert.equal(u.ornekle(6100, orion(), oyuncu(1.0)).length, 1);
});

test("Orion'un kendi oturması olay olarak yayınlanmaz", () => {
  const u = new OlayUretici({ sogumaMs: 0 });
  u.ornekle(0, orion(), oyuncu(1.0));
  const o = u.ornekle(100, orion({ oturuyor_mu: true }), oyuncu(1.0));
  assert.equal(o.length, 0, "kendi eylemi niyet sonucundan bilinir, olaydan değil");
});

test("bozuk eşik yapılandırması sessizce kabul edilmez", () => {
  assert.throws(() => new OlayUretici({ yakinEsik: 2.6, uzakEsik: 1.8 }), /histerezis/);
});
