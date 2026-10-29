// uygulama/aktorYetenegi.test.ts — aktör yeteneği (spec 43 A3): canlı ışığa GEÇİCİ yazma, geri alma, tanıma dokunmama, değişken ezmesi, şema kapıları.
//
// Ekransız Babylon (NullEngine); nesne düğümü model yüklemesinden bağımsız kurulur, gerçek model/ışık görüntüsü canlı doğrulamada (aktordene).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { levelKur } from "../world/level/cekirdek/levelKur.ts";
import { ornekTanim } from "../world/level/cekirdek/ornekTanim.ts";
import type { LevelTanimi } from "../world/level/cekirdek/levelTanimi.ts";
import { aktorYetenegiKur } from "./aktorYetenegi.ts";

function kur() {
  const t: LevelTanimi = ornekTanim();
  t.katmanlar = [];
  t.isiklar = [{ id: "i1", tur: "nokta", konum: [1, 2, 3], renk: "mavi", siddet: 1.5, menzil: 8, degiskenler: { hiz: 2, mod: "gece", acik: true } }];
  const sahne = new Scene(new NullEngine());
  const level = levelKur(sahne, t, new Map());
  const k = aktorYetenegiKur({ level: () => level });
  return { level, k, y: k.yetenek, isik: level.isiklar.isik("i1")! };
}

test("var: ışık kimliği bilinir, olmayan değil; level yoksa false", () => {
  const { y } = kur();
  assert.equal(y.var("i1"), true);
  assert.equal(y.var("yok"), false);
  assert.equal(aktorYetenegiKur({ level: () => null }).yetenek.var("i1"), false);
});

test("okuma canlı ışıktan; yazma ışığa doğrudan, level TANIMINA dokunmaz", () => {
  const { y, isik, level } = kur();
  assert.deepEqual([y.alanOku("i1", "siddet"), y.alanOku("i1", "menzil"), y.alanOku("i1", "gizli")], [1.5, 8, false]);
  y.alanYaz("i1", "siddet", 0.25);
  y.alanYaz("i1", "menzil", 3);
  y.alanYaz("i1", "renk", "#ff8800");
  y.alanYaz("i1", "gizli", true);
  assert.deepEqual([isik.intensity, isik.range, isik.isEnabled(false), isik.diffuse.toHexString().toLowerCase()], [0.25, 3, false, "#ff8800"]);
  assert.equal(y.alanOku("i1", "renk"), "#ff8800");
  const tanim = level.tanim().isiklar![0]!;
  assert.deepEqual([tanim.siddet, tanim.menzil, tanim.gizli ?? false, tanim.renk], [1.5, 8, false, "mavi"], "tanım değişmedi");
});

test("geriAl: aktör çalışma öncesi hâline döner (palet adlı renk dahil), ikinci yazma ilk hâli ezmez", () => {
  const { y, k, isik } = kur();
  const once = { s: isik.intensity, r: isik.range, c: isik.diffuse.toHexString(), a: isik.isEnabled(false) };
  y.alanYaz("i1", "siddet", 5);
  y.alanYaz("i1", "siddet", 9);   // ikinci yazma: geri alınacak değer 1.5 kalmalı (5 değil)
  y.alanYaz("i1", "renk", "#00ff00");
  y.alanYaz("i1", "gizli", true);
  assert.deepEqual(k.gecici(), ["i1"]);
  k.geriAl("i1");
  assert.deepEqual({ s: isik.intensity, r: isik.range, c: isik.diffuse.toHexString(), a: isik.isEnabled(false) }, once);
  assert.deepEqual(k.gecici(), []);
  k.geriAl("i1");   // yazma yokken no-op
});

test("şema kapıları: grafta kapalı alan, aralık dışı sayı, yanlış tür, bozuk renk nedenle reddedilir ve ışık değişmez", () => {
  const { y, isik } = kur();
  assert.throws(() => y.alanYaz("i1", "konum", "0,0,0"), /grafta açık değil/);
  assert.throws(() => y.alanOku("i1", "kilitli"), /grafta açık değil/);
  assert.throws(() => y.alanYaz("i1", "siddet", 101), /en çok/);
  assert.throws(() => y.alanYaz("i1", "siddet", "parlak"), /sayı/);
  assert.throws(() => y.alanYaz("i1", "menzil", 0), /en az/);
  assert.throws(() => y.alanYaz("i1", "renk", "kirmizi"), /#rrggbb/);
  assert.throws(() => y.alanYaz("yok", "siddet", 1), /aktör yok/);
  assert.deepEqual([isik.intensity, isik.range], [1.5, 8]);
});

test("nesne: gizli sahne düğümüne geçici yazılır, tanım değişmez, geriAl açar; grafta kapalı alan (kilitli) reddedilir", () => {
  const { level, k } = kur();
  const t = level.tanim();
  t.nesneler = [{ id: "n1", varlik: "kutu", konum: [0, 0, 0], donus: 0, olcek: 1 }];
  level.ayarla(t);
  const y = k.yetenek;
  assert.equal(y.var("n1"), true);
  assert.equal(y.alanOku("n1", "gizli"), false);
  y.alanYaz("n1", "gizli", true);
  assert.equal(y.alanOku("n1", "gizli"), true);
  assert.equal(level.tanim().nesneler![0]!.gizli ?? false, false, "tanım değişmedi");
  assert.throws(() => y.alanYaz("n1", "kilitli", true), /grafta açık değil/);
  k.geriAl("n1");
  assert.equal(y.alanOku("n1", "gizli"), false);
});

test("değişken: tanımdan okunur, yazma ezmedir (tanım değişmez), tür değişmez, tanımsız yazılamaz, geriAl başlangıca döner", () => {
  const { y, k, level } = kur();
  assert.deepEqual([y.degiskenOku("i1", "hiz"), y.degiskenOku("i1", "mod"), y.degiskenOku("i1", "acik"), y.degiskenOku("i1", "yok")], [2, "gece", true, undefined]);
  y.degiskenYaz("i1", "hiz", 9);
  y.degiskenYaz("i1", "mod", "gunduz");
  assert.deepEqual([y.degiskenOku("i1", "hiz"), y.degiskenOku("i1", "mod")], [9, "gunduz"]);
  assert.equal(level.tanim().isiklar![0]!.degiskenler!["hiz"], 2, "tanım değişmedi");
  assert.throws(() => y.degiskenYaz("i1", "hiz", "hızlı"), /türü değişmez/);
  assert.throws(() => y.degiskenYaz("i1", "hiz", NaN), /sonlu/);
  assert.throws(() => y.degiskenYaz("i1", "mod", "x".repeat(201)), /en çok 200/);
  assert.throws(() => y.degiskenYaz("i1", "yok", 1), /tanımlı değil/);
  assert.deepEqual(k.gecici(), ["i1"]);
  k.geriAl("i1");
  assert.deepEqual([y.degiskenOku("i1", "hiz"), y.degiskenOku("i1", "mod")], [2, "gece"]);
});

test("level yokken okuma/yazma 'level açık değil' der", () => {
  const y = aktorYetenegiKur({ level: () => null }).yetenek;
  assert.throws(() => y.alanOku("i1", "siddet"), /level açık değil/);
  assert.throws(() => y.degiskenYaz("i1", "hiz", 1), /level açık değil/);
});
