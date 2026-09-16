// world/surfaces/gunlukCekirdek.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { gunlukCekirdegiKur, saatBicimle } from "./gunlukCekirdek.ts";
import type { Olay, Seviye } from "./gunlukCekirdek.ts";

const T0 = new Date(2026, 0, 1, 9, 5, 3).getTime();
const olay = (metin: string, seviye: Seviye = "bilgi", kaynak = "beyin", kayma = 0): Olay =>
  ({ ts: T0 + kayma, seviye, kaynak, metin });

test("saat hh:mm:ss biçiminde, tek haneler sıfırla dolar", () => {
  assert.equal(saatBicimle(T0), "09:05:03");
});

test("en yeni olay EN ALTTA — terminal gibi okunur", () => {
  const g = gunlukCekirdegiKur();
  g.ekle(olay("birinci"));
  g.ekle(olay("ikinci"));
  const v = g.gorunum(60, 10);
  assert.equal(v.at(-1)?.metin, "ikinci");
  assert.equal(v.at(-2)?.metin, "birinci");
});

test("ekrana sığmayan ESKİ olaylar düşer, yenisi kalır", () => {
  const g = gunlukCekirdegiKur();
  for (let i = 0; i < 20; i++) g.ekle(olay(`satir${i}`));
  const v = g.gorunum(60, 5);
  assert.equal(v.length, 5);
  assert.equal(v.at(-1)?.metin, "satir19", "en yeni gorunmeli");
  assert.ok(!v.some((s) => s.metin === "satir0"), "en eski dusmeli");
});

test("uzun metin sarılır ve başlık YALNIZCA ilk satırda olur", () => {
  const g = gunlukCekirdegiKur();
  g.ekle(olay("bu cok uzun bir mesaj ve tek satira kesinlikle sigmayacak kadar uzundur"));
  const v = g.gorunum(40, 10);
  assert.ok(v.length > 1, "sarilmali");
  assert.ok(v[0]!.baslik.length > 0, "ilk satirda baslik olmali");
  assert.equal(v[1]!.baslik, "", "devam satirinda baslik tekrarlanmamali");
  // Her görsel satır sütun sınırını aşmamalı — yoksa ekrandan taşar.
  for (const s of v) {
    assert.ok(s.baslik.length + s.metin.length <= 40 + 1, `satir tasti: "${s.baslik}${s.metin}"`);
  }
});

test("yer yetmeyince olayın BAŞI kırpılır, SONU kalır", () => {
  const g = gunlukCekirdegiKur();
  g.ekle(olay("aaaa bbbb cccc dddd eeee ffff gggg hhhh"));
  const v = g.gorunum(20, 2);
  assert.equal(v.length, 2);
  // Son parça görünmeli: en yeni bilgi kaybolmamalı.
  assert.ok(v.at(-1)!.metin.includes("hhhh"), `son parca gorunmeli: ${JSON.stringify(v)}`);
});

test("kapasite aşılınca en eski DÜŞER ve sayılır — sessiz kayıp yok", () => {
  const g = gunlukCekirdegiKur(3);
  for (let i = 0; i < 6; i++) g.ekle(olay(`x${i}`));
  assert.equal(g.olaylar().length, 3);
  assert.equal(g.dusen, 3);
  assert.equal(g.olaylar()[0]?.metin, "x3");
});

test("seviye her görsel satıra taşınır — renk devam satırında da doğru", () => {
  const g = gunlukCekirdegiKur();
  g.ekle(olay("cok uzun bir hata mesaji ki iki satira bolunsun diye yazildi", "hata"));
  const v = g.gorunum(30, 10);
  assert.ok(v.length > 1);
  for (const s of v) assert.equal(s.seviye, "hata");
});

test("boş günlük ve saçma ölçüler çökmez", () => {
  const g = gunlukCekirdegiKur();
  assert.deepEqual(g.gorunum(60, 10), []);
  g.ekle(olay("bir"));
  assert.deepEqual(g.gorunum(2, 10), [], "cok dar sutun bos doner");
  assert.deepEqual(g.gorunum(60, 0), [], "sifir satir bos doner");
});

test("temizle her şeyi sıfırlar", () => {
  const g = gunlukCekirdegiKur(2);
  for (let i = 0; i < 5; i++) g.ekle(olay(`y${i}`));
  g.temizle();
  assert.equal(g.olaylar().length, 0);
  assert.equal(g.dusen, 0);
});
