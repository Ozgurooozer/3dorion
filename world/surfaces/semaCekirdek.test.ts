// world/surfaces/semaCekirdek.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DUGUMLER, OKLAR, PARILTI_MS, semaDurumuKur, yerlesim,
} from "./semaCekirdek.ts";

test("her okun iki ucu da kayıtlı bir düğüm — kopuk ok yok", () => {
  const adlar = new Set(DUGUMLER.map((d) => d.ad));
  for (const [a, b] of OKLAR) {
    assert.ok(adlar.has(a), `bilinmeyen kaynak: ${a}`);
    assert.ok(adlar.has(b), `bilinmeyen hedef: ${b}`);
  }
});

test("düğüm adları benzersiz ve ızgara konumları çakışmıyor", () => {
  const adlar = new Set(DUGUMLER.map((d) => d.ad));
  assert.equal(adlar.size, DUGUMLER.length, "ad tekrarı var");
  const hucreler = new Set(DUGUMLER.map((d) => `${d.sutun}:${d.satir}`));
  assert.equal(hucreler.size, DUGUMLER.length, "iki dugum ayni hucrede");
});

test("akış SOLDAN SAĞA — ok hedefi kaynağından geride olamaz", () => {
  const s = new Map(DUGUMLER.map((d) => [d.ad, d.sutun]));
  for (const [a, b] of OKLAR) {
    assert.ok(s.get(b)! >= s.get(a)!, `ok geriye akiyor: ${a} -> ${b}`);
  }
});

test("yerleşim kutuları alanın İÇİNDE kalır", () => {
  const G = 900, Y = 500, K = 24;
  for (const [ad, k] of yerlesim(G, Y, K)) {
    assert.ok(k.x >= K - 1 && k.y >= K - 1, `${ad} sol/ust kenari asti`);
    assert.ok(k.x + k.g <= G - K + 1, `${ad} sag kenari asti`);
    assert.ok(k.y + k.yuk <= Y - K + 1, `${ad} alt kenari asti`);
    assert.ok(k.g > 0 && k.yuk > 0, `${ad} olcusu gecersiz`);
  }
});

test("yerleşim kutuları BİRBİRİYLE çakışmaz", () => {
  const k = [...yerlesim(900, 500, 24)];
  for (let i = 0; i < k.length; i++) {
    for (let j = i + 1; j < k.length; j++) {
      const [adA, a] = k[i]!, [adB, b] = k[j]!;
      const kesisiyor = a.x < b.x + b.g && b.x < a.x + a.g
                     && a.y < b.y + b.yuk && b.y < a.y + a.yuk;
      assert.ok(!kesisiyor, `${adA} ile ${adB} cakisiyor`);
    }
  }
});

test("dar yüzeyde de çökmez — kutular yine geçerli", () => {
  for (const [G, Y] of [[320, 180], [1600, 400]] as const) {
    for (const [ad, k] of yerlesim(G, Y, 8)) {
      assert.ok(k.g > 0 && k.yuk > 0, `${ad} ${G}x${Y} icin gecersiz`);
    }
  }
});

test("vuruş sayacı artırır, parıltı zamanla söner", () => {
  const d = semaDurumuKur();
  assert.equal(d.parilti("beyin", Date.now()), 0, "hic calismadan parilti olmamali");

  d.vur("beyin", "3.5 sn");
  const t = Date.now();
  assert.equal(d.oku("beyin").sayac, 1);
  assert.equal(d.oku("beyin").not, "3.5 sn");
  assert.ok(d.parilti("beyin", t) > 0.9, "yeni vurus parlak olmali");
  assert.ok(d.parilti("beyin", t + PARILTI_MS / 2) < 0.6, "yariyolda sonmeli");
  assert.equal(d.parilti("beyin", t + PARILTI_MS + 10), 0, "sure dolunca sonmeli");
});

test("notYaz sayacı ARTIRMAZ — durum bilgisi olay değildir", () => {
  const d = semaDurumuKur();
  d.notYaz("beyin", "kesik 240 sn");
  assert.equal(d.oku("beyin").sayac, 0);
  assert.equal(d.oku("beyin").not, "kesik 240 sn");
});

test("arıza işaretlenir, yeni vuruş onu KALDIRIR", () => {
  const d = semaDurumuKur();
  d.ariza("beyin", true, "kota doldu");
  assert.equal(d.oku("beyin").arizali, true);
  assert.equal(d.oku("beyin").not, "kota doldu");

  d.vur("beyin", "8.6 sn");
  assert.equal(d.oku("beyin").arizali, false, "calisan dugum arizali kalmamali");
});

test("bilinmeyen düğüm okumak çökmez — boş durum döner", () => {
  const d = semaDurumuKur();
  const b = d.oku("yok_boyle_bir_sey");
  assert.equal(b.sayac, 0);
  assert.equal(b.arizali, false);
});
