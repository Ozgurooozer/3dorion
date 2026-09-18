// world/avatar/ledYuz.test.ts — üçüncü sürücü gerçekten sürücü mü?
//
// Bu testlerin ASIL İDDİASI mimari: `AvatarIskeleti` Faz 1'de Babylon'dan
// kurtuldu ve "bu arayüzü uygulayan şeyin sahne olmak zorunda değil" dendi.
// Aşağıdaki testler Babylon YÜKLEMEDEN koşuyor ve gerçek donanım sürücüsünü
// sınıyor — iddianın kanıtı bu.
//
// Ağ yok: `gonder` kancası ile gönderimler yakalanıyor.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ledYuzKur, type YuzHali } from "./ledYuz.ts";

function duzenek(asgariAraMs = 0) {
  const gonderilen: YuzHali[] = [];
  const y = ledYuzKur({ asgariAraMs, gonder: (h) => { gonderilen.push(h); } });
  return { y, gonderilen };
}

test("yetenek bayrakları KISMİ gövdeyi doğru bildirir", () => {
  const { y } = duzenek();
  assert.equal(y.bilgi.tur, "ledyuz");
  assert.equal(y.bilgi.agizDestegi, true);
  // Kritik: boyun YOK. Üst katman bu bayrağa bakıp kafa döndürmeye kalkmamalı.
  assert.equal(y.bilgi.basDestegi, false);
  assert.equal(y.bilgi.hamBoy, 0, "yuzun boyu yok");
});

test("gövde uçları ÇÖKMEZ — sessiz no-op (arayüzün kendi kuralı)", () => {
  const { y, gonderilen } = duzenek();
  // Bunların hiçbirinin donanımda karşılığı yok; atmamalı, yollamamalı.
  y.konumUygula(1, 2, 3);
  y.govdeUygula(0.5);
  y.basUygula(0.2, 0.1);
  y.pozUygula("duruyor", 0.3, 1.25);
  y.bostaUygula(0.4, -0.2);
  y.gozKirp(1);
  assert.deepEqual(gonderilen, [], "govde komutlari donanima sizdi");
  assert.deepEqual(y.cizimKonumu(), { x: 0, y: 0, z: 0 });
});

test("jest yüz hâline çevrilir", () => {
  const { y, gonderilen } = duzenek();
  y.jestUygula("gülümsüyor", 0.5);
  y.jestUygula("kaş_çatıyor", 0.5);
  y.jestUygula("omuz_silkiyor", 0.5);
  assert.deepEqual(gonderilen, ["happy", "angry", "suspicious"]);
});

test("karşılığı OLMAYAN jest nötr kalır — uydurma ifade yok", () => {
  const { y, gonderilen } = duzenek();
  y.jestUygula("gülümsüyor", 0.5);
  // `el_salliyor` bir gövde jesti; 64×32 yüzde karşılığı yok.
  y.jestUygula("el_salliyor", 0.5);
  assert.deepEqual(gonderilen, ["happy", "neutral"],
    "karsiligi olmayan jest icin ifade uydurulmamali");
});

test("AYNI hâl tekrar YOLLANMAZ — hat boşuna doldurulmaz", () => {
  const { y, gonderilen } = duzenek();
  for (let i = 0; i < 20; i++) y.jestUygula("gülümsüyor", i / 20);
  assert.deepEqual(gonderilen, ["happy"], `${gonderilen.length} kez yollandi`);
});

test("ağız açıklığı tek başına hâl değiştirmez — jest ezilmez", () => {
  const { y, gonderilen } = duzenek();
  y.jestUygula("gülümsüyor", 0.5);
  // Konuşurken yüz hâlâ gülümsüyor olmalı; ağız akışı hâli sıfırlamamalı.
  for (let i = 0; i < 10; i++) y.agizUygula(i / 10);
  assert.deepEqual(gonderilen, ["happy"], "agiz akisi jesti ezdi");
});

test("kısma çalışır — asgari ara dolmadan ikinci gönderim gitmez", () => {
  const { y, gonderilen } = duzenek(10_000);
  y.jestUygula("gülümsüyor", 0.5);
  y.jestUygula("kaş_çatıyor", 0.5);   // hemen ardından: kısılmalı
  assert.deepEqual(gonderilen, ["happy"], "kisma calismadi");
});

test("görünmezlik yüzü uyutur", () => {
  const { y, gonderilen } = duzenek();
  y.gorunur(false);
  assert.deepEqual(gonderilen, ["sleepy"]);
});

test("ağ çökerse ODA DURMAZ — gönderim ateşle-unut", async () => {
  const eski = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
  try {
    // Kanca YOK: gerçek `fetch` yolu koşuyor ve patlıyor.
    const y = ledYuzKur({ asgariAraMs: 0 });
    assert.doesNotThrow(() => y.jestUygula("gülümsüyor", 0.5));
    await new Promise((r) => setTimeout(r, 10));   // reddedilen söz yutulsun
  } finally { globalThis.fetch = eski; }
});
