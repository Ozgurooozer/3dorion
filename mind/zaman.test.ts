// mind/zaman.test.ts — zaman cümleleri BOZUK CÜMLE üretmemeli.
//
// Bu metinler doğrudan beynin bağlamına giriyor. İlk sürüm
// `${sureSozu(...)} bu odadasin` diyordu ve bir dakika altında
// "az önce bu odadasin" çıkıyordu — bozuk dil modelin de diline bulaşır.
//
// Mantık ÖNCE `giris.ts` içindeydi ve bu test onun KOPYASINI tutuyordu; iki
// kopya er geç ayrışır. `sureSozu` bir kez taşınmıştı; kalan ÜÇÜ (odadaSure,
// sessizlikSozu, gununVakti) burada kopya olarak kalmış ve dil değişiminde
// sessizce ayrışmıştı — test eski Türkçeyi doğruluyor, üretim İngilizce
// veriyordu. Üçü de taşındı; bu dosya artık GERÇEK fonksiyonları sınıyor.
//
// Çıktı İNGİLİZCE: bağlamın çerçevesi makineye konuşur (spec 06 §6.8).
// Orion'un SESİ Türkçedir ve o buradan geçmez.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";

import { sureSozu, oncesiSozu, odadaSure, sessizlikSozu, gununVakti } from "./zaman.ts";

const DK = 60_000, SAAT = 60 * DK, GUN = 24 * SAAT;

test("süre sözü ölçeğe göre birim değiştirir", () => {
  assert.equal(sureSozu(30_000), "just now");
  assert.equal(sureSozu(5 * DK), "for 5 minutes");
  assert.equal(sureSozu(3 * SAAT), "for 3 hours");
  assert.equal(sureSozu(2 * GUN), "for 2 days");
});

test("BİR DAKİKA ALTINDA bozuk cümle çıkmaz", () => {
  // Hata buydu: "az önce bu odadasin" — İngilizcede karşılığı
  // "You have been in this room just now."
  assert.equal(odadaSure(10_000), "You have just arrived in this room.");
  assert.ok(!odadaSure(10_000).includes("just now."), "sürekliliğe 'just now' gömüldü");
  assert.equal(sessizlikSozu(10_000), "Ozyn spoke just now.");
});

test("cümleler her ölçekte NOKTA ile biter ve tek cümle kalır", () => {
  for (const ms of [0, 30_000, 5 * DK, 90 * DK, 5 * SAAT, 3 * GUN]) {
    for (const c of [odadaSure(ms), sessizlikSozu(ms)]) {
      assert.match(c, /\.$/, `noktasiz: "${c}"`);
      assert.equal(c.split(".").filter(Boolean).length, 1, `birden cok cumle: "${c}"`);
    }
  }
});

test("günün vakti 24 saatin HEPSİNİ kapsar — boşluk yok", () => {
  for (let s = 0; s < 24; s++) {
    assert.ok(gununVakti(s).length > 0, `${s} icin vakit yok`);
  }
  assert.equal(gununVakti(3), "the middle of the night");
  assert.equal(gununVakti(9), "morning");
  assert.equal(gununVakti(14), "afternoon");
  assert.equal(gununVakti(19), "evening");
  assert.equal(gununVakti(23), "night");
});

test("HAM SAYI sızmaz — Orion '1847000 ms' demez", () => {
  for (const ms of [0, 999, 61_000, 7_200_000]) {
    for (const c of [odadaSure(ms), sessizlikSozu(ms)]) {
      assert.ok(!/\d{4,}/.test(c), `ham sayi sizdi: "${c}"`);
    }
  }
});

test("oncesiSozu GEÇMİŞ AN kalıbı — 'süredir' değil 'önce'", () => {
  // "for 3 hours Ozyn rejected the command" bozuk; anı geçmiş bir andır.
  assert.equal(oncesiSozu(30_000), "just now");
  assert.equal(oncesiSozu(12 * DK), "12 minutes ago");
  assert.equal(oncesiSozu(3 * SAAT), "3 hours ago");
  assert.equal(oncesiSozu(2 * GUN), "2 days ago");
});

test("iki kalıp KARIŞMAZ", () => {
  for (const ms of [30_000, 12 * DK, 3 * SAAT, 2 * GUN]) {
    const s = sureSozu(ms), o = oncesiSozu(ms);
    if (ms >= DK) {
      assert.match(s, /^for \d+ (minutes|hours|days)$/, `sureSozu bozuk: ${s}`);
      assert.match(o, /ago$/, `oncesiSozu bozuk: ${o}`);
      assert.ok(!o.startsWith("for "), `oncesiSozu süreklilik kalıbına kaydı: ${o}`);
    }
  }
});
