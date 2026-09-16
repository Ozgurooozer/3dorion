// world/surfaces/tahtaYazisi.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { TahtaMetni, satirlaraBol, tahtaOlcusu } from "./tahtaYazisi.ts";

test("kısa metin tek satır kalır", () => {
  assert.deepEqual(satirlaraBol("merhaba dünya", 40), ["merhaba dünya"]);
});

test("KELİME sınırından bölünür — tahta insan okuması içindir", () => {
  const s = satirlaraBol("bir iki üç dört beş altı yedi", 10);
  assert.ok(s.every((x) => x.length <= 10), s.join("|"));
  // Hiçbir kelime ortadan kesilmemeli
  assert.ok(!s.join(" ").includes("dö rt"));
  assert.equal(s.join(" ").replace(/\s+/g, " "), "bir iki üç dört beş altı yedi");
});

test("tek başına sığmayan uzun kelime ZORLA kırılır — satır taşmaz", () => {
  const uzun = "C:/cok/uzun/bir/dosya/yolu/olabilir/bu.txt";
  const s = satirlaraBol(uzun, 12);
  assert.ok(s.every((x) => x.length <= 12), s.join("|"));
  assert.equal(s.join(""), uzun);
});

test("açık satır sonları korunur", () => {
  assert.deepEqual(satirlaraBol("bir\niki", 40), ["bir", "iki"]);
});

test("yaz() ekler, temizle=true önce siler", () => {
  const t = new TahtaMetni({ sutun: 20, satir: 5 });
  t.yaz("birinci not");
  t.yaz("ikinci not");
  assert.deepEqual(t.satirlar(), ["birinci not", "ikinci not"]);
  t.yaz("yepyeni", true);
  assert.deepEqual(t.satirlar(), ["yepyeni"]);
});

test("tahta dolunca EN ESKİ satır düşer ve SAYILIR — sessiz kayıp yok", () => {
  const t = new TahtaMetni({ sutun: 20, satir: 3 });
  t.yaz("bir");
  t.yaz("iki");
  t.yaz("uc");
  const r = t.yaz("dort");
  assert.equal(r.eklenen, 1);
  assert.equal(r.dusen, 1, "düşen satır raporlanmalı");
  assert.deepEqual(t.satirlar(), ["iki", "uc", "dort"]);
});

test("boş yazmak tahtayı kirletmez", () => {
  const t = new TahtaMetni();
  const r = t.yaz("   ");
  assert.equal(r.eklenen, 0);
  assert.ok(t.bos);
});

test("kirli bayrağı çizim katmanı için doğru çalışır", () => {
  const t = new TahtaMetni();
  t.temizlendi();
  assert.equal(t.kirli, false);
  t.yaz("bir sey");
  assert.equal(t.kirli, true, "yazınca yeniden çizilmeli");
  t.temizlendi();
  t.yaz("");
  assert.equal(t.kirli, false, "boş yazma yeniden çizim gerektirmez");
});

test("satirlar() kopya döner — dışarıdan bozulamaz", () => {
  const t = new TahtaMetni();
  t.yaz("orjinal");
  const s = t.satirlar();
  s.push("sahte");
  assert.deepEqual(t.satirlar(), ["orjinal"]);
});

test("tahtaOlcusu gerçek tahta ölçüsünden makul sütun üretir", () => {
  // Odadaki tahta: 2.8 m × 1.5 m (world/level/olculer.ts TAHTA).
  const o = tahtaOlcusu(2.8, 1.5, 10);
  assert.equal(o.satir, 10);
  assert.ok(o.sutun >= 25 && o.sutun <= 45, `sütun=${o.sutun}`);
});

test("uzun bir paragraf tahtaya sığacak şekilde bölünür", () => {
  const t = new TahtaMetni({ sutun: 30, satir: 8 });
  const r = t.yaz(
    "Terminal suzgeci bugun bitti. Cikis kodu ile calisiyor, metin tahmini yok. " +
    "Sirada hafiza katmani var.");
  assert.ok(r.eklenen >= 3, `eklenen=${r.eklenen}`);
  assert.ok(t.satirlar().every((s) => s.length <= 30));
});
