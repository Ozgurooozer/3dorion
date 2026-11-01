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
import { aktorYetenegiKur, gunlukluYetenek, levelHiyerarsisi } from "./aktorYetenegi.ts";
import { aktorOlayYoluKur } from "../world/level/cekirdek/aktorOlayYolu.ts";
import { aktorGunluguKur, bayraklariOku } from "./aktor/aktorGunlugu.ts";
import { kodOku } from "../world/level/cekirdek/aktorHatalari.ts";

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

test("olay yolu (spec 45 B3): yayın yönü aktör/üst/alt hiyerarşiyi level tanımından izler; üst/alt arama; yol yoksa ve level yokken nedenle", () => {
  const t: LevelTanimi = ornekTanim();
  t.katmanlar = [];
  t.isiklar = [
    { id: "a", tur: "nokta", konum: [0, 1, 0], renk: "mavi", siddet: 1, menzil: 5 },
    { id: "b", tur: "nokta", konum: [0, 1, 0], renk: "mavi", siddet: 1, menzil: 5, ust: "a" },
    { id: "c", tur: "nokta", konum: [0, 1, 0], renk: "mavi", siddet: 1, menzil: 5, ust: "b" },
    { id: "d", tur: "nokta", konum: [0, 1, 0], renk: "mavi", siddet: 1, menzil: 5, ust: "beden:orion" },
  ];
  const level = levelKur(new Scene(new NullEngine()), t, new Map());
  const olay = aktorOlayYoluKur({ ...levelHiyerarsisi(() => level), hata: () => {} });
  const y = aktorYetenegiKur({ level: () => level, olay }).yetenek;
  const gelen: string[] = [];
  olay.dinle("*", "*", (o) => gelen.push(`${o.aktor}<-${o.kaynak}:${o.ad}${o.veri["deger"] !== undefined ? `=${o.veri["deger"]}` : ""}`));
  y.olayYayinla!("b", "x", {}, "aktor");
  y.olayYayinla!("b", "u", { deger: 1 }, "ust");
  y.olayYayinla!("b", "d", {}, "alt");
  assert.deepEqual(gelen, ["b<-b:x", "a<-b:u=1", "c<-b:d"], "yön hiyerarşiyi izler: aktör yalnız kendine, ust üst zincirine, alt alt ağacına");
  assert.deepEqual([y.ustBul!("c"), y.ustBul!("a"), y.ustBul!("d")], ["b", null, "beden:orion"], "beden üstü olduğu gibi, üstü olmayan null");
  assert.deepEqual([y.altlar!("a"), y.altlar!("c")], [["b"], []]);
  assert.throws(() => y.olayYayinla!("b", "bozuk ad", {}, "aktor"), /olay adı/, "yol reddi fırlatır (sessiz yutulmaz)");
  assert.throws(() => aktorYetenegiKur({ level: () => level }).yetenek.olayYayinla!("b", "x", {}, "aktor"), /olay yolu kurulu değil/);
  assert.throws(() => aktorYetenegiKur({ level: () => null, olay }).yetenek.ustBul!("a"), /level açık değil/);
});

// ── günlük sarmalayıcısı (spec 45 §13) ──
function gunlukluKur(bayrak = "") {
  const t: LevelTanimi = ornekTanim();
  t.katmanlar = [];
  t.isiklar = [{ id: "i1", tur: "nokta", konum: [1, 2, 3], renk: "mavi", siddet: 1.5, menzil: 8 }];
  const sahne = new Scene(new NullEngine());
  const level = levelKur(sahne, t, new Map());
  const gunluk = aktorGunluguKur({ bayrak: bayraklariOku(bayrak) });
  return { gunluk, y: aktorYetenegiKur({ level: () => level, gunluk }).yetenek };
}

test("günlük: yetenek hatası KODLU ve aktör adıyla günlüğe düşer, hata YİNE fırlar (düğüm hatayı alır)", () => {
  const { gunluk, y } = gunlukluKur();
  let yakalanan: unknown = null;
  try { y.alanYaz("yok", "siddet", 1); } catch (e) { yakalanan = e; }
  assert.equal(kodOku(yakalanan), "AKT-YTN-002");
  const [k] = gunluk.son(5, { seviye: "hata" });
  assert.equal(k!.kod, "AKT-YTN-002");
  assert.equal(k!.kategori, "dugum");
  assert.equal(k!.aktor, "yok");
  assert.match(k!.metin, /^\[AKT-YTN-002\] alanYaz: aktör yok: yok$/, "kod iki kez basılmaz");
});

test("günlük: grafta kapalı alan YTN-003, olay yolu yokken OLY-007 (yetenek olmayan yoldan geçen kodlar korunur)", () => {
  const { gunluk, y } = gunlukluKur();
  assert.throws(() => y.alanYaz("i1", "olmayanalan", 1));
  assert.throws(() => y.olayYayinla!("i1", "x", {}, "aktor"));
  assert.deepEqual(gunluk.son(5, { seviye: "hata" }).map((k) => k.kod), ["AKT-YTN-003", "AKT-OLY-007"]);
});

test("günlük: salt okuma sessiz, yazma ayrıntılı 'dugum' bayrağı açıkken izlenir (kapalıyken günlüğü şişirmez)", () => {
  const kapali = gunlukluKur();
  kapali.y.alanOku("i1", "siddet"); kapali.y.alanYaz("i1", "siddet", 2);
  assert.equal(kapali.gunluk.son().length, 0);
  const acik = gunlukluKur("dugum");
  acik.y.alanOku("i1", "siddet"); acik.y.alanYaz("i1", "siddet", 2);
  const m = acik.gunluk.son().map((k) => k.metin);
  assert.deepEqual(m, ['alanYaz("i1", "siddet", 2)'], "yalnız yazma izlenir; okuma yok");
  assert.equal(acik.gunluk.son()[0]!.aktor, "i1");
});

test("günlük: dönüş değeri ve geriAl/gecici değişmez (sarmalayıcı şeffaf)", () => {
  const { y } = gunlukluKur();
  assert.equal(y.var("i1"), true);
  assert.equal(y.alanOku("i1", "siddet"), 1.5);
  assert.equal(y.degiskenOku("i1", "yok"), undefined);
});

test("günlük: kodsuz (beklenmeyen) istisna uydurma koda bağlanmaz: kod boş, metin olduğu gibi, yine fırlar", () => {
  const { gunluk } = gunlukluKur();
  const ham = { var: () => { throw new Error("beklenmedik"); }, alanOku: () => 0, alanYaz: () => {}, degiskenOku: () => undefined, degiskenYaz: () => {} };
  const y = gunlukluYetenek(ham, gunluk);
  assert.throws(() => y.var("x"), /beklenmedik/);
  const k = gunluk.son(1)[0]!;
  assert.equal(k.kod, null);
  assert.equal(k.seviye, "hata");
  assert.equal(k.metin, "var: beklenmedik");
});
