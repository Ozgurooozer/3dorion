// bridge/talimat.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { talimatUret, TEMEL_TALIMAT } from "./talimat.ts";

const bos = { konusma: false, terminal: false, anilar: false, olay: false };

test("çekirdek her zaman var", () => {
  for (const b of [bos, { ...bos, konusma: true }, { ...bos, terminal: true }]) {
    const t = talimatUret(b);
    assert.match(t, /bedenin var/i, "cekirdek bedeni anmali");
    assert.match(t, /dunya_soyle/);
    assert.match(t, /İKİ CÜMLE/i, "kisalik kurali cekirdekte olmali");
  }
});

test("terminal kuralları YALNIZCA terminal algısı varken gelir", () => {
  assert.ok(!talimatUret(bos).includes("dunya_komut"), "terminal yokken komut kuralı gönderilmemeli");
  const t = talimatUret({ ...bos, terminal: true });
  assert.match(t, /dunya_komut/, "komut onerme araci terminal baglaminda anilmali");
  assert.match(t, /Komutları OZYN yazıyor/);
});

test("konuşma kuralları yalnızca Ozyn konuşunca gelir", () => {
  assert.ok(!talimatUret(bos).includes("Susmak kabul değil"));
  assert.match(talimatUret({ ...bos, konusma: true }), /Susmak kabul değil/);
});

test("hafıza kuralı yalnızca anı getirildiyse gelir", () => {
  assert.ok(!/Hat[ıi]rlad[ıi]klar[ıi]n/.test(talimatUret(bos)), 'ani yokken hafiza kurali gonderilmemeli');
  assert.match(talimatUret({ ...bos, anilar: true }), /Hat[ıi]rlad[ıi]klar[ıi]n/, "hafiza kurali gelmeli");
});

test("olay kuralı konuşma varken TEKRARLANMAZ — çakışma yok", () => {
  const ikisi = talimatUret({ ...bos, konusma: true, olay: true });
  assert.ok(!ikisi.includes("Odada bir şey değişti"),
    "konuşma varken olay kuralı gereksiz, dikkati böler");
});

test("DURUMA GÖRE KISALIR: her şey açıkken bile taban+ilgili kadar", () => {
  const hepsi = talimatUret({ konusma: true, terminal: true, anilar: true, olay: true });
  const taban = TEMEL_TALIMAT;
  assert.ok(hepsi.length > taban.length, "bağlam varken uzamalı");
  // Asıl kazanç: bağlamsız tur çok daha kısa.
  assert.ok(taban.length < hepsi.length * 0.6,
    `taban ${taban.length}, hepsi ${hepsi.length} — bağlamsız tur belirgin kısa olmalı`);
});

test("talimat tek satır — çok satırlı metin bağlamda şişer", () => {
  const t = talimatUret({ konusma: true, terminal: true, anilar: true, olay: false });
  assert.ok(!t.includes("\n"));
});

test("tahta kuralı her zaman var — `yaz` aracı her turda sunuluyor", () => {
  assert.match(talimatUret(bos), /tahtanın önüne/);
});

test("ALGI aracı öğretilir — araç sunmak yetmez, kullanılacağı söylenmeli", () => {
  // `dunya_sor` uzun süre araç listesinde vardı ama talimatta hiç anılmıyordu:
  // model onu kullanmayı düşünmek zorunda değildi. Kimlik onu tanıtır.
  assert.match(talimatUret(bos), /dunya_sor/, "cekirdek algi aracini tanitmali");
});

test("algı kuralının AYRINTISI yalnızca gerektiğinde gelir", () => {
  // Çekirdekte tek tanıtım cümlesi var; "önce bak" kuralı konuşma/olay
  // bağlamına ait. Hepsini her tura koymak talimatı şişiriyordu.
  assert.ok(!/hatırladığın değil/.test(talimatUret(bos)),
    "baglamsiz turda ayrintili algi kurali gonderilmemeli");
  assert.match(talimatUret({ ...bos, konusma: true }), /hatırladığın değil/);
  assert.match(talimatUret({ ...bos, olay: true }), /dunya_sor ile bak/);
});
