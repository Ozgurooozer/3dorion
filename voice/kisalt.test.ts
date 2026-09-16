// voice/kisalt.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ikiCumleyeKisalt } from "./kisalt.ts";

test("iki cümleden kısa metne dokunmaz", () => {
  assert.equal(ikiCumleyeKisalt("Selam Ozyn."), "Selam Ozyn.");
  assert.equal(ikiCumleyeKisalt("Selam. Buradayım."), "Selam. Buradayım.");
});

test("üçüncü cümleyi atar", () => {
  const g = "Birinci cümle. İkinci cümle. Üçüncü cümle atılmalı.";
  assert.equal(ikiCumleyeKisalt(g), "Birinci cümle. İkinci cümle.");
});

test("GERÇEK ölçüm çıktısı: oda monoloğu iki cümleye iner", () => {
  // Bu metin canlı koşudan alındı (2026-09-12, 229 karakter, gevezelik kusuru).
  const g = "Terminalde `boyle_bir_komut_yok` komutu çalışmadı. Özn, bu komut tanınmıyor. " +
            "Pencerenin önündeki masada duruyorum. Senin terminal ekranında `boyle_bir_komut_yok` yazıyor. " +
            "Bu komut belirsiz görünüyor. Pencerenin önünden bakıyorum.";
  const k = ikiCumleyeKisalt(g);
  assert.equal(k, "Terminalde `boyle_bir_komut_yok` komutu çalışmadı. Özn, bu komut tanınmıyor.");
  assert.ok(k.length <= 180);
});

test("soru ve ünlem de cümle sonudur", () => {
  assert.equal(ikiCumleyeKisalt("Ne oldu? Bilmiyorum. Bakayım."), "Ne oldu? Bilmiyorum.");
  assert.equal(ikiCumleyeKisalt("Oldu! Tamam! Bitti."), "Oldu! Tamam!");
});

test("noktalama yoksa karakter tavanı kelime ortasından kesmez", () => {
  const g = "a".repeat(50) + " " + "b".repeat(50) + " " + "c".repeat(200);
  const k = ikiCumleyeKisalt(g, { azamiKarakter: 120 });
  assert.ok(k.length <= 121, `uzunluk ${k.length}`);
  assert.ok(!k.includes("ccc"), "tavan aşan kelime alınmamalı");
  assert.ok(k.endsWith("…"), "kesildiği görünür olmalı");
});

test("çok uzun İKİ cümle de karakter tavanına uyar", () => {
  const g = "Bu cümle " + "çok ".repeat(80) + "uzun. İkinci cümle.";
  const k = ikiCumleyeKisalt(g, { azamiKarakter: 100 });
  assert.ok(k.length <= 101);
});

test("boş ve boşluklu girdi boş döner", () => {
  assert.equal(ikiCumleyeKisalt(""), "");
  assert.equal(ikiCumleyeKisalt("   \n  "), "");
});

test("satır sonları tek boşluğa indirilir — TTS'e temiz metin gider", () => {
  assert.equal(ikiCumleyeKisalt("Selam\n\nOzyn."), "Selam Ozyn.");
});

test("ayar ile cümle sayısı değiştirilebilir", () => {
  assert.equal(ikiCumleyeKisalt("Bir. İki. Üç.", { azamiCumle: 1 }), "Bir.");
});
