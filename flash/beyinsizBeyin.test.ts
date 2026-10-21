// flash/beyinsizBeyin.test.ts — BEYİNSİZ BEYİN: model çağrısı sıfır, cevap kuraldan (spec 33 dilim 2).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ozetle } from "../protocol/algi.ts";
import { araclariUret } from "../bridge/araclar.ts";
import type { BeyinGirdisi } from "../bridge/beyin.ts";
import { BeyinsizBeyin, ozettenHata, ozettenSoz } from "./beyinsizBeyin.ts";
import { FLASH } from "./npcTanimi.ts";
import { flashDuzenegi } from "./flashTest.ts";

const soz = (metin: string) => ozetle({ tur: "duydum", metin, kesin: true, kaynak: "klavye" });
const hata = (not?: string) => ozetle({ tur: "sonuc", sonuc: { niyet_id: "komut_1", durum: "hata", ...(not ? { not } : {}) } });
const girdi = (ozetler: string[], araclar = araclariUret()): BeyinGirdisi => ({ ozetler, dunya: "", gecmis: [], araclar });

test("özetten söz: protokolün biçimleyicisiyle üretilmiş satır geri okunur (iç tırnak korunur)", () => {
  assert.equal(ozettenSoz(soz('"otur" de')), '"otur" de');
});

test("özetten söz: söz olmayan satır null", () => {
  assert.equal(ozettenSoz(hata("x")), null);
});

test("özetten hata: notlu hata satırı notunu verir", () => {
  assert.equal(ozettenHata(hata("bilinmeyen çapa")), "bilinmeyen çapa");
});

test("özetten hata: rutin sonuç null", () => {
  assert.equal(ozettenHata(ozetle({ tur: "sonuc", sonuc: { niyet_id: "komut_1", durum: "bitti" } })), null);
});

test("anlaşılmayan söz: cevap tek bir dunya_soyle çağrısıdır", async () => {
  const c = await new BeyinsizBeyin(FLASH).dusun(girdi([soz("oturabilir misin")]));
  assert.deepEqual(c.cagrilar.map((x) => x.ad), ["dunya_soyle"]);
});

test("anlaşılmayan söz: söylenen metin 'bilmiyorum + seçenek'", async () => {
  const c = await new BeyinsizBeyin(FLASH).dusun(girdi([soz("oturabilir misin")]));
  assert.deepEqual(c.cagrilar[0]?.girdi, { metin: "Bunu bilmiyorum. Şunu mu demek istedin: «otur»?" });
});

test("yalnız niyet hatası olan tur: 'yapamadım' söylenir", async () => {
  const c = await new BeyinsizBeyin(FLASH).dusun(girdi([hata("bedenim henüz yüklenmedi")]));
  assert.deepEqual(c.cagrilar[0]?.girdi, { metin: "Yapamadım: bedenim henüz yüklenmedi" });
});

test("rutin tur (söz ve hata yok): sessiz kalır", async () => {
  const c = await new BeyinsizBeyin(FLASH).dusun(girdi([ozetle({ tur: "olay", ad: "ozyn_yaklasti" })]));
  assert.deepEqual([c.metin, c.cagrilar.length], ["", 0]);
});

test("konuşma aracı sunulmamışsa cevap düz metin olur (köprü onu konuşur)", async () => {
  const c = await new BeyinsizBeyin(FLASH).dusun(girdi([soz("merhaba")], []));
  assert.match(c.metin, /^Bunu bilmiyorum\./);
});

test("sayaç: her düşünme isteği sayılır", async () => {
  const b = new BeyinsizBeyin(FLASH);
  await b.dusun(girdi([soz("merhaba")]));
  await b.dusun(girdi([hata("x")]));
  assert.equal(b.sayac().dusun, 2);
});

test("MODEL ÇAĞRISI SIFIR: anlaşılmayan söz Flash köprüsünden uçtan uca geçerken hiç ağ çağrısı yapılmaz", async () => {
  const eski = globalThis.fetch;
  let ag = 0;
  globalThis.fetch = (() => { ag++; return Promise.reject(new Error("Flash ağa çıkmamalı")); }) as typeof fetch;
  const d = flashDuzenegi();
  try {
    d.soyle("bana bir şiir okur musun");
    await d.bekle();
    d.soyle("oturabilir misin");
    await d.bekle();
  } finally { globalThis.fetch = eski; d.kapat(); }
  assert.equal(ag, 0);
});

test("uçtan uca: anlaşılmayan iki söz iki kez beyinsiz beyne gider ve iki kez cevaplanır", async () => {
  const d = flashDuzenegi();
  try {
    d.soyle("bana bir şiir okur musun");
    await d.bekle();
    d.soyle("oturabilir misin");
    await d.bekle();
  } finally { d.kapat(); }
  assert.deepEqual([d.f.beyin.sayac().bilmiyorum, d.sozler.length], [2, 2]);
});
