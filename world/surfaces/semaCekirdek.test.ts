// world/surfaces/semaCekirdek.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DUGUMLER, OKLAR, PARILTI_MS, semaDurumuKur, yerlesim,
  semaAlani, semaYerlesimi, dugumBul,
} from "./semaCekirdek.ts";
import type { Kutu } from "./semaCekirdek.ts";

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

// ── EŞDEĞERLİK: yeni geometri ESKİ çizim matematiğiyle BİREBİR aynı ───────
//
// S1 refactor'ünün kapısı. Oranlar `sema.ts`'in `ciz()` içinden çekirdeğe
// taşındı; taşıma sırasında bir piksel bile kaymadığını kanıtlamak gerek.
// Eski matematik burada REFERANS olarak yeniden yazılıyor — iki bağımsız
// uygulama aynı sonucu veriyorsa taşıma temizdir.

/** `sema.ts`'in taşınmadan ÖNCEKİ hesabı, birebir. */
function eskiMatematik(genislik: number, yukseklik: number) {
  const kenar = Math.round(yukseklik * 0.04);
  const basYuk = Math.round(yukseklik * 0.11);
  const altYuk = Math.round(yukseklik * 0.10);
  const alanY0 = basYuk;
  const alanYuk = yukseklik - basYuk - altYuk;
  const ham = yerlesim(genislik, alanYuk, kenar);
  const kutular = new Map<string, Kutu>();
  for (const [ad, k] of ham) kutular.set(ad, { ...k, y: k.y + alanY0 });
  return { kenar, basYuk, altYuk, kutular };
}

test("semaAlani ESKİ oranları birebir üretir", () => {
  for (const [g, y] of [[910, 512], [1820, 1024], [600, 400]] as const) {
    const eski = eskiMatematik(g, y);
    const a = semaAlani(g, y);
    assert.equal(a.kenar, eski.kenar, `${g}x${y} kenar kaydı`);
    assert.equal(a.basYuk, eski.basYuk, `${g}x${y} başlık kaydı`);
    assert.equal(a.altYuk, eski.altYuk, `${g}x${y} alt şerit kaydı`);
  }
});

test("semaYerlesimi ESKİ kutuların AYNISINI üretir — bir piksel bile kaymaz", () => {
  for (const [g, y] of [[910, 512], [1820, 1024], [600, 400]] as const) {
    const eski = eskiMatematik(g, y).kutular;
    const yeni = semaYerlesimi(semaAlani(g, y));
    assert.equal(yeni.size, eski.size, `${g}x${y} kutu sayısı değişti`);
    for (const [ad, e] of eski) {
      const n = yeni.get(ad);
      assert.ok(n, `${ad} kayboldu`);
      assert.deepEqual(n, e, `${g}x${y} ${ad} kaydı`);
    }
  }
});

// ── VURUŞ TESTİ ───────────────────────────────────────────────────────────

test("her düğümün MERKEZİ kendi adına döner — gidiş-dönüş", () => {
  const alan = semaAlani(910, 512);
  for (const [ad, k] of semaYerlesimi(alan)) {
    const bulunan = dugumBul(alan, k.x + k.g / 2, k.y + k.yuk / 2);
    assert.equal(bulunan, ad, `${ad} merkezi ${bulunan} olarak okundu`);
  }
});

test("her düğümün DÖRT KÖŞESİ de kendi adına döner", () => {
  const alan = semaAlani(910, 512);
  for (const [ad, k] of semaYerlesimi(alan)) {
    const koseler: readonly (readonly [number, number])[] =
      [[1, 1], [k.g - 1, 1], [1, k.yuk - 1], [k.g - 1, k.yuk - 1]];
    for (const [dx, dy] of koseler) {
      assert.equal(dugumBul(alan, k.x + dx, k.y + dy), ad, `${ad} köşesi kaçtı`);
    }
  }
});

test("BAŞLIK ve ALT ŞERİT null döner — yanlışlıkla düğüm seçilmez", () => {
  const alan = semaAlani(910, 512);
  assert.equal(dugumBul(alan, 455, alan.basYuk / 2), null, "başlıkta düğüm bulundu");
  assert.equal(dugumBul(alan, 455, alan.yukseklik - alan.altYuk / 2), null, "alt şeritte düğüm bulundu");
});

test("OK KANALINA tıklamak null döner — en yakına yuvarlama YOK", () => {
  // Devre panosunda "yanlışlıkla en yakın kutuyu seç" tehlikelidir:
  // operatör neye bastığını bilmeli.
  const alan = semaAlani(910, 512);
  const k = semaYerlesimi(alan).get("algi")!;
  // Kutunun hemen sağındaki boşluk (oklar oradan geçer).
  assert.equal(dugumBul(alan, k.x + k.g + 5, k.y + k.yuk / 2), null);
});

test("alan DIŞINA tıklamak çökmez", () => {
  const alan = semaAlani(910, 512);
  const noktalar: readonly (readonly [number, number])[] =
    [[-50, -50], [99999, 99999], [0, 0], [910, 512]];
  for (const [px, py] of noktalar) {
    assert.doesNotThrow(() => dugumBul(alan, px, py));
  }
});

test("DAR panelde de vuruş testi tutarlı", () => {
  const alan = semaAlani(320, 180);
  for (const [ad, k] of semaYerlesimi(alan)) {
    assert.equal(dugumBul(alan, k.x + k.g / 2, k.y + k.yuk / 2), ad);
  }
});

// ── UV ÇEVİRİMİ: ters dönerse SESSİZ yanlış seçer ─────────────────────────
//
// Babylon UV verir (v ALTTAN), piksel uzayı üstten. `1 - v` unutulursa panel
// çökmez: REFLEKS yerine HAFIZA seçer. Şemanın dikey yerleşimi -1/0/+1 ile
// neredeyse simetrik olduğu için "gidiş-dönüş" testi TEK BAŞINA bu hatayı
// yakalamaz — aşağıdaki asimetri testleri onun için var.

import { uvdenPiksel, dugumBulUv, dugumTanim } from "./semaCekirdek.ts";

/** Piksel → UV, `uvdenPiksel`in TERSİ. Test bilerek bağımsız yazıldı. */
function pikselUv(alan: ReturnType<typeof semaAlani>, px: number, py: number) {
  return { u: px / alan.genislik, v: 1 - py / alan.yukseklik };
}

test("UV gidiş-dönüş: her düğümün merkezi kendi adına döner", () => {
  const alan = semaAlani(910, 512);
  for (const [ad, k] of semaYerlesimi(alan)) {
    const { u, v } = pikselUv(alan, k.x + k.g / 2, k.y + k.yuk / 2);
    assert.equal(dugumBulUv(alan, u, v), ad, `${ad} UV gidiş-dönüşü kaydı`);
  }
});

test("ASİMETRİ: v ters çevrilirse REFLEKS yerine HAFIZA seçilir — tuzak budur", () => {
  const alan = semaAlani(910, 512);
  const k = semaYerlesimi(alan).get("refleks")!;
  const { u, v } = pikselUv(alan, k.x + k.g / 2, k.y + k.yuk / 2);

  assert.equal(dugumBulUv(alan, u, v), "refleks");
  // Aynı noktanın AYNADAKİ hâli başka bir düğüm olmalı. Bu iddia tutmazsa
  // yerleşim dikey simetrik demektir ve bu test artık ters çevrimi yakalamaz.
  const ayna = dugumBulUv(alan, u, 1 - v);
  assert.notEqual(ayna, "refleks", "ayna aynı düğüme düştü — test körleşmiş");
  assert.equal(ayna, "hafiza", "ayna beklenen komşuya düşmedi");
});

test("ASİMETRİ: BAKIŞ'ın aynası BOŞLUĞA düşer — ters çevrim seçimi kaybeder", () => {
  // BAKIŞ sütun 4 / satır -1'de; sütun 4 / satır +1 boş. Ters çevrimde
  // tıklama hiçbir şey seçmez: "tıkladım ama açılmadı" diye okunur, panel
  // bozuk sanılır. REFLEKS testi yanlış seçimi, bu test kayıp seçimi tutar.
  const alan = semaAlani(910, 512);
  const k = semaYerlesimi(alan).get("bakis")!;
  const { u, v } = pikselUv(alan, k.x + k.g / 2, k.y + k.yuk / 2);
  assert.equal(dugumBulUv(alan, u, v), "bakis");
  assert.equal(dugumBulUv(alan, u, 1 - v), null, "sütun 4 satır +1 boş olmalı");
});

test("uvdenPiksel v=1 ÜSTE, v=0 ALTA düşer", () => {
  const alan = semaAlani(910, 512);
  assert.equal(uvdenPiksel(alan, 0, 1).py, 0, "v=1 üst kenar olmalı");
  assert.equal(uvdenPiksel(alan, 0, 0).py, 512, "v=0 alt kenar olmalı");
  assert.equal(uvdenPiksel(alan, 1, 0).px, 910);
});

test("BAŞLIK şeridinin UV'si null döner — üst şerit düğüm değil", () => {
  const alan = semaAlani(910, 512);
  const { u, v } = pikselUv(alan, 455, alan.basYuk / 2);
  assert.equal(dugumBulUv(alan, u, v), null);
});

test("bozuk UV çökmez — NaN/Infinity/aralık dışı null döner", () => {
  const alan = semaAlani(910, 512);
  for (const [u, v] of [[NaN, 0.5], [0.5, NaN], [Infinity, 0.5], [-3, 0.5], [0.5, 9]] as const) {
    assert.doesNotThrow(() => dugumBulUv(alan, u, v));
    assert.equal(dugumBulUv(alan, u, v), null, `${u},${v} için null bekleniyordu`);
  }
});

test("dugumTanim her düğüm için açıklama döner, bilinmeyende null", () => {
  for (const d of DUGUMLER) {
    const t = dugumTanim(d.ad);
    assert.ok(t, `${d.ad} tanımı yok`);
    assert.ok(t.aciklama.length > 20, `${d.ad} açıklaması boş/çok kısa`);
    assert.ok(!t.aciklama.includes("\n"), `${d.ad} açıklaması çok satırlı — panel tek satır çizer`);
  }
  assert.equal(dugumTanim("yok_boyle"), null);
});
