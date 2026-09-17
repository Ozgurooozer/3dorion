// mind/zaman.test.ts — zaman cümleleri BOZUK TÜRKÇE üretmemeli.
//
// Bu metinler doğrudan beynin bağlamına giriyor. İlk sürüm
// `${sureSozu(...)} bu odadasin` diyordu ve bir dakika altında
// "az önce bu odadasin" çıkıyordu — bozuk Türkçe modelin de diline bulaşır.
//
// Mantık ÖNCE `giris.ts` içindeydi ve bu test onun KOPYASINI tutuyordu; iki
// kopya er geç ayrışır. `mind/zaman.ts`e taşındı, burası artık onu sınıyor.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";

import { sureSozu, oncesiSozu } from "./zaman.ts";

const DK = 60_000, SAAT = 60 * DK, GUN = 24 * SAAT;

function odadaSure(ms: number): string {
  return Math.floor(ms / DK) < 1 ? "Bu odaya yeni geldin." : `${sureSozu(ms)} bu odadasin.`;
}
function sessizlikSozu(ms: number): string {
  return Math.floor(ms / DK) < 1 ? "Ozyn az önce konustu." : `Ozyn'le ${sureSozu(ms)} konusmadiniz.`;
}
function gununVakti(saat: number): string {
  if (saat < 5) return "gecenin bir yarısı";
  if (saat < 12) return "sabah";
  if (saat < 17) return "öğleden sonra";
  if (saat < 21) return "akşam";
  return "gece";
}

test("süre sözü ölçeğe göre birim değiştirir", () => {
  assert.equal(sureSozu(30_000), "az önce");
  assert.equal(sureSozu(5 * DK), "5 dakikadır");
  assert.equal(sureSozu(3 * SAAT), "3 saattir");
  assert.equal(sureSozu(2 * GUN), "2 gündür");
});

test("BİR DAKİKA ALTINDA bozuk cümle çıkmaz", () => {
  // Hata buydu: "az önce bu odadasin".
  assert.equal(odadaSure(10_000), "Bu odaya yeni geldin.");
  assert.ok(!odadaSure(10_000).includes("az önce bu odadasin"));
  assert.equal(sessizlikSozu(10_000), "Ozyn az önce konustu.");
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
  assert.equal(gununVakti(3), "gecenin bir yarısı");
  assert.equal(gununVakti(9), "sabah");
  assert.equal(gununVakti(14), "öğleden sonra");
  assert.equal(gununVakti(19), "akşam");
  assert.equal(gununVakti(23), "gece");
});

test("HAM SAYI sızmaz — Orion '1847000 ms' demez", () => {
  for (const ms of [0, 999, 61_000, 7_200_000]) {
    for (const c of [odadaSure(ms), sessizlikSozu(ms)]) {
      assert.ok(!/\d{4,}/.test(c), `ham sayi sizdi: "${c}"`);
    }
  }
});

test("oncesiSozu GEÇMİŞ AN kalıbı — 'süredir' değil 'önce'", () => {
  // "3 saattir Ozyn komutu reddetti" bozuk; anı geçmiş bir andır.
  assert.equal(oncesiSozu(30_000), "az önce");
  assert.equal(oncesiSozu(12 * DK), "12 dakika önce");
  assert.equal(oncesiSozu(3 * SAAT), "3 saat önce");
  assert.equal(oncesiSozu(2 * GUN), "2 gün önce");
});

test("iki kalıp KARIŞMAZ", () => {
  for (const ms of [30_000, 12 * DK, 3 * SAAT, 2 * GUN]) {
    const s = sureSozu(ms), o = oncesiSozu(ms);
    if (ms >= DK) {
      assert.match(s, /(dakikadır|saattir|gündür)$/, `sureSozu bozuk: ${s}`);
      assert.match(o, /önce$/, `oncesiSozu bozuk: ${o}`);
    }
  }
});
