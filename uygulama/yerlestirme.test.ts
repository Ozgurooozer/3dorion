// uygulama/yerlestirme.test.ts — asset yerleştirme durumu: ekle/dönüştür/kaldır, level'ın üstüne idempotent uygulama, "çağır" konumu, bozuk kayıt.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { bosDurum, ekle, donustur, kaldir, tanimaUygula, durumuYaz, durumuOku, eklenenMi, EKLENEN_ONEKI, type YerlestirmeDurumu } from "./yerlestirme.ts";
import type { NesneYeri } from "../world/level/cekirdek/levelTanimi.ts";

const lvl = (id: string, x = 0): NesneYeri => ({ id, varlik: "A", konum: [x, 0, 0], donus: 0, olcek: 1 });

test("ekle: kimlik 'yer-' önekli ve benzersiz; girdi durum DEĞİŞMEZ", () => {
  const d0 = bosDurum();
  const a = ekle(d0, "A", [1, 0, 2]);
  const b = ekle(a.durum, "B", [3, 0, 4]);
  assert.deepEqual([a.id, b.id], [`${EKLENEN_ONEKI}1`, `${EKLENEN_ONEKI}2`]);
  assert.equal(d0.eklenen.length, 0);
  assert.equal(b.durum.eklenen.length, 2);
});

test("ekle: silinen kimlik yeniden kullanılmaz değil — araya boşluk olsa da çakışma yok", () => {
  let d = ekle(ekle(ekle(bosDurum(), "A", [0, 0, 0]).durum, "A", [0, 0, 0]).durum, "A", [0, 0, 0]).durum;
  d = kaldir(d, "yer-2");
  const y = ekle(d, "A", [0, 0, 0]);
  assert.equal(new Set(y.durum.eklenen.map((e) => e.id)).size, y.durum.eklenen.length);
});

test("dönüştür: eklenen kendi kaydında, level nesnesi geçersiz kılmada güncellenir", () => {
  const e = ekle(bosDurum(), "A", [0, 0, 0]);
  const t1 = donustur(e.durum, e.id, { konum: [5, 0, 5] });
  assert.deepEqual(t1.eklenen[0]!.konum, [5, 0, 5]);
  assert.deepEqual(t1.degisen, {});
  const t2 = donustur(bosDurum(), "n7", { konum: [9, 0, 9] });
  assert.deepEqual(t2.degisen["n7"], { konum: [9, 0, 9] });
});

test("dönüştür: verilmeyen alan olduğu gibi kalır; ardışık değişiklikler alan alan birleşir", () => {
  const a = donustur(bosDurum(), "n7", { konum: [1, 0, 1], olcek: 2 });
  const b = donustur(a, "n7", { donus: [0, 90, 0] });
  assert.deepEqual(b.degisen["n7"], { konum: [1, 0, 1], olcek: 2, donus: [0, 90, 0] });
  const e = ekle(bosDurum(), "A", [0, 0, 0], 30, 3);
  assert.deepEqual(donustur(e.durum, e.id, { konum: [4, 0, 4] }).eklenen[0], { id: e.id, varlik: "A", konum: [4, 0, 4], donus: 30, olcek: 3 });
});

test("dönüştür: var olmayan eklenen kimliği HATA", () => {
  assert.throws(() => donustur(bosDurum(), "yer-9", { konum: [0, 0, 0] }), /eklenenler arasında yok/);
});

test("kaldır: eklenen kalkar; level nesnesi kaldırılamaz (HATA)", () => {
  const e = ekle(bosDurum(), "A", [0, 0, 0]);
  assert.equal(kaldir(e.durum, e.id).eklenen.length, 0);
  assert.throws(() => kaldir(e.durum, "n1"), /kaldırılamaz/);
});

test("uygula: level nesneleri korunur, değişen konum geçersiz kılınır, eklenenler sona gelir", () => {
  let d: YerlestirmeDurumu = donustur(bosDurum(), "n1", { konum: [7, 0, 7] });
  d = ekle(d, "B", [1, 0, 1]).durum;
  const s = tanimaUygula([lvl("n1"), lvl("n2", 2)], d);
  assert.deepEqual(s.map((n) => n.id), ["n1", "n2", "yer-1"]);
  assert.deepEqual(s[0]!.konum, [7, 0, 7]);
  assert.deepEqual(s[1]!.konum, [2, 0, 0]);
});

test("uygula: level nesnesinin dönüşü ve ölçeği de geçersiz kılınır; konumu yazılmamışsa level'ınki kalır", () => {
  const d = donustur(bosDurum(), "n1", { donus: [0, 45, 0], olcek: [2, 2, 2] });
  const n = tanimaUygula([lvl("n1", 3)], d)[0]!;
  assert.deepEqual([n.konum, n.donus, n.olcek], [[3, 0, 0], [0, 45, 0], [2, 2, 2]]);
});

test("uygula: İDEMPOTENT — iki kez uygulamak ekleme çoğaltmaz", () => {
  const d = ekle(bosDurum(), "B", [1, 0, 1]).durum;
  const bir = tanimaUygula([lvl("n1")], d);
  const iki = tanimaUygula(bir, d);
  assert.deepEqual(iki, bir);
});

test("uygula: durum boşsa girdi listesiyle aynı içerik; girdi dizisi değişmez", () => {
  const girdi = [lvl("n1")];
  assert.deepEqual(tanimaUygula(girdi, bosDurum()), girdi);
  const d = ekle(bosDurum(), "B", [1, 0, 1]).durum;
  tanimaUygula(girdi, d);
  assert.equal(girdi.length, 1);
});

test("uygula: eklenen kaldırılınca bir sonraki uygulamada level'dan da düşer", () => {
  const e = ekle(bosDurum(), "B", [1, 0, 1]);
  const var1 = tanimaUygula([lvl("n1")], e.durum);
  const yok = tanimaUygula(var1, kaldir(e.durum, e.id));
  assert.deepEqual(yok.map((n) => n.id), ["n1"]);
});

test("eklenenMi: yalnız 'yer-' önekliler", () => {
  assert.deepEqual([eklenenMi("yer-3"), eklenenMi("n3"), eklenenMi("yer")], [true, false, false]);
});

test("kayıt: yaz → oku gidiş-dönüş aynı durum", () => {
  const d = donustur(donustur(ekle(bosDurum(), "A", [1, 2, 3], 90, 2).durum, "n4", { konum: [5, 0, 6] }), "n5", { donus: [0, 10, 0], olcek: 1.5 });
  assert.deepEqual(durumuOku(durumuYaz(d)), d);
});

test("kayıt: eski sürüm 1 (yalnız 'tasinan' konumu) okunur ve yeni biçime çevrilir", () => {
  const d = durumuOku(JSON.stringify({ surum: 1, eklenen: [], tasinan: { n1: [1, 2, 3] } }));
  assert.deepEqual(d.degisen, { n1: { konum: [1, 2, 3] } });
  assert.match(durumuYaz(d), /"surum":2/);
});

test("kayıt: boş/yok → boş durum; bozuk kayıtlar HATA (sessiz bozulma yok)", () => {
  assert.deepEqual(durumuOku(null), bosDurum());
  assert.throws(() => durumuOku("{"), SyntaxError);
  assert.throws(() => durumuOku(JSON.stringify({ surum: 3, eklenen: [] })), /sürümü/);
  assert.throws(() => durumuOku(JSON.stringify({ surum: 2, eklenen: [], degisen: { n1: { olcek: 0 } } })), /degisen\["n1"\] bozuk/);
  assert.throws(() => durumuOku(JSON.stringify({ surum: 1 })), /eklenen dizisi/);
  assert.throws(() => durumuOku(JSON.stringify({ surum: 1, eklenen: [{ id: "n1", varlik: "A", konum: [0, 0, 0], donus: 0, olcek: 1 }] })), /bozuk/);
  assert.throws(() => durumuOku(JSON.stringify({ surum: 1, eklenen: [{ id: "yer-1", varlik: "A", konum: [0, 0], donus: 0, olcek: 1 }] })), /bozuk/);
  assert.throws(() => durumuOku(JSON.stringify({ surum: 1, eklenen: [{ id: "yer-1", varlik: "A", konum: [0, 0, 0], donus: 0, olcek: 0 }] })), /bozuk/);
  const bir = { id: "yer-1", varlik: "A", konum: [0, 0, 0], donus: 0, olcek: 1 };
  assert.throws(() => durumuOku(JSON.stringify({ surum: 1, eklenen: [bir, bir] })), /yinelenen/);
  assert.throws(() => durumuOku(JSON.stringify({ surum: 1, eklenen: [], tasinan: { n1: [1, 2] } })), /bozuk/);
});

test("eksen başına dönüş/ölçek (level nesnesini kopyalarken) KAYBOLMAZ ve kopya bağımsızdır", () => {
  const donus: [number, number, number] = [0, 45, 10];
  const olcek: [number, number, number] = [1, 2, 1];
  const e = ekle(bosDurum(), "A", [0, 0, 0], donus, olcek);
  donus[1] = 99; olcek[1] = 99;   // kaynak sonradan değişse de kayıt etkilenmez
  assert.deepEqual(e.durum.eklenen[0]!.donus, [0, 45, 10]);
  assert.deepEqual(e.durum.eklenen[0]!.olcek, [1, 2, 1]);
  assert.deepEqual(durumuOku(durumuYaz(e.durum)), e.durum);
});

test("kayıt: ölçeğin bir ekseni ≤ 0 ise bozuk", () => {
  assert.throws(() => durumuOku(JSON.stringify({ surum: 1, eklenen: [{ id: "yer-1", varlik: "A", konum: [0, 0, 0], donus: 0, olcek: [1, 0, 1] }] })), /bozuk/);
});
