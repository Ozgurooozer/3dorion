// bridge/yapisalSozlesme.test.ts — Yapısal sözleşme araç tablosundan TÜRER ve bozuk cevabı sessizce yutmaz (spec 26 F1).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { aracRehberi, yapisalAraclar, yapisalSema, yapisaldanCikti, TABLO_ADLARI } from "./yapisalSozlesme.ts";
import { araclariUret, turIcinAraclar } from "./araclar.ts";

test("şemadaki araç adları araç tablosunun TAMAMI (konuşma hariç): yeni araç modele sessizce görünmez kalmaz", () => {
  assert.deepEqual([...yapisalAraclar()].sort(), [...TABLO_ADLARI].sort());
  assert.equal(yapisalAraclar().includes("dunya_soyle"), false);
  assert.ok(yapisalAraclar().includes("dunya_otur") && yapisalAraclar().includes("dunya_kalk") && yapisalAraclar().includes("dunya_dur"));
});

test("şema: soz + eylemler zorunlu, eylem öğesi arac+girdi", () => {
  const s = yapisalSema() as { required: string[]; properties: { eylemler: { items: { required: string[] } } } };
  assert.deepEqual(s.required, ["soz", "eylemler"]);
  assert.deepEqual(s.properties.eylemler.items.required, ["arac", "girdi"]);
});

test("rehber her araç için tek satır ve tam şemadan KISA (bağlam payı)", () => {
  const r = aracRehberi();
  for (const ad of yapisalAraclar()) assert.match(r, new RegExp(`- ${ad}\\b`), ad);
  assert.ok(r.length < JSON.stringify(araclariUret()).length * 0.6, `rehber ${r.length}, tam şema ${JSON.stringify(araclariUret()).length}`);
});

test("rehber: enum değerleri (poz, sor) satırda ve Ozyn'in hedefi {tip:'oyuncu'} söyleniyor", () => {
  const r = aracRehberi();
  assert.match(r, /dunya_sor\{ne=onumde\|yakin\|oyuncu\|dunya\|gor\}/);
  assert.match(r, /hedef = \{tip:'oyuncu'\} for Ozyn/);
});

test("cevap: eylemler sırayla çağrılara, soz son çağrı olarak dunya_soyle'ye döner", () => {
  const c = yapisaldanCikti({ soz: "Tamam.", eylemler: [{ arac: "dunya_otur", girdi: {} }, { arac: "dunya_bak", girdi: { hedef: { tip: "capa", ad: "pencere" } } }] });
  assert.deepEqual(c.cagrilar.map((x) => x.ad), ["dunya_otur", "dunya_bak", "dunya_soyle"]);
});

test("cevap: boş söz konuşma çağrısı üretmez; bilinmeyen araç düşer AMA nedeni bilgiye yazılır", () => {
  const c = yapisaldanCikti({ soz: "  ", eylemler: [{ arac: "dunya_ucak", girdi: {} }] });
  assert.deepEqual([c.cagrilar.length, c.bilgi?.["yapisalHata"]], [0, "bilinmeyen araç: dunya_ucak"]);
});

test("cevap: nesne olmayan girdi boş çıktı + hata notu (sessiz düşme yok)", () => {
  const c = yapisaldanCikti("merhaba");
  assert.deepEqual([c.cagrilar.length, c.bilgi?.["yapisalHata"]], [0, "cevap nesne değil"]);
});

test("tur kuralı: gordum-yalnız turda `sor` rehberde, şemada ve kabul listesinde YOK (köprünün süzdüğü liste yapısal yolda da işler)", () => {
  const tur = turIcinAraclar(araclariUret(), new Set(["gordum"]));
  assert.equal(tur.some((a) => a.ad === "dunya_sor"), false);
  assert.doesNotMatch(aracRehberi(tur), /dunya_sor/);
  assert.equal(yapisalAraclar(tur).includes("dunya_sor"), false);
  const c = yapisaldanCikti({ soz: "", eylemler: [{ arac: "dunya_sor", girdi: { ne: "gor" } }] }, {}, tur);
  assert.deepEqual([c.cagrilar.length, c.bilgi?.["yapisalHata"]], [0, "bilinmeyen araç: dunya_sor"]);
});

test("tur kuralı: Ozyn aynı turda konuştuysa ya da gordum yoksa `sor` yerinde", () => {
  for (const turler of [["gordum", "duydum"], ["duydum"], ["olay"], []]) {
    assert.ok(turIcinAraclar(araclariUret(), new Set(turler)).some((a) => a.ad === "dunya_sor"), turler.join("+") || "boş");
  }
});
