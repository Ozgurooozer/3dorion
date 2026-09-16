// world/surfaces/kabukIsaret.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KabukIsaretAyiklayici, powershellEntegrasyonu } from "./kabukIsaret.ts";

const E = "\x1b";
const BEL = "\x07";
const im = (govde: string) => `${E}]133;${govde}${BEL}`;

test("işaretsiz veri olduğu gibi geçer", () => {
  const a = new KabukIsaretAyiklayici();
  const r = a.isle("merhaba dünya\r\n");
  assert.equal(r.metin, "merhaba dünya\r\n");
  assert.deepEqual(r.isaretler, []);
});

test("işaret metinden AYIKLANIR — terminale çöp yazılmaz", () => {
  const a = new KabukIsaretAyiklayici();
  const r = a.isle(`${im("A")}PS C:\\> ${im("B")}`);
  assert.equal(r.metin, "PS C:\\> ", "işaretler ekrana sızmamalı");
  assert.deepEqual(r.isaretler.map((x) => x.tur), ["istem", "girdi"]);
});

test("çıkış kodu okunur: 0 başarı, 1 başarısızlık", () => {
  const a = new KabukIsaretAyiklayici();
  const r = a.isle(`cikti${im("D;0")}${im("A")}`);
  assert.equal(r.metin, "cikti");
  assert.deepEqual(r.isaretler, [{ tur: "bitti", kod: 0 }, { tur: "istem" }]);

  const b = new KabukIsaretAyiklayici();
  assert.deepEqual(b.isle(im("D;1")).isaretler, [{ tur: "bitti", kod: 1 }]);
  const c = new KabukIsaretAyiklayici();
  assert.deepEqual(c.isle(im("D;9009")).isaretler, [{ tur: "bitti", kod: 9009 }]);
});

test("kodsuz D kabul edilir — cmd.exe kod yaymaz", () => {
  const a = new KabukIsaretAyiklayici();
  assert.deepEqual(a.isle(im("D")).isaretler, [{ tur: "bitti" }]);
});

test("ESC \\ sonlandırıcısı da desteklenir (BEL'in yanında)", () => {
  const a = new KabukIsaretAyiklayici();
  const r = a.isle(`${E}]133;D;0${E}\\metin`);
  assert.equal(r.metin, "metin");
  assert.deepEqual(r.isaretler, [{ tur: "bitti", kod: 0 }]);
});

test("İKİYE BÖLÜNMÜŞ dizi kaybolmaz — pty verisi rastgele bölünür", () => {
  const a = new KabukIsaretAyiklayici();
  const r1 = a.isle(`once${E}]133;D`);
  assert.equal(r1.metin, "once");
  assert.deepEqual(r1.isaretler, [], "yarım dizi henüz işaret üretmemeli");

  const r2 = a.isle(`;0${BEL}sonra`);
  assert.equal(r2.metin, "sonra");
  assert.deepEqual(r2.isaretler, [{ tur: "bitti", kod: 0 }]);
});

test("ÖNEK ortasından bölünme de kaybolmaz", () => {
  const a = new KabukIsaretAyiklayici();
  // "\x1b]13" ile bitiyor: yarım önek, saklanmalı
  const r1 = a.isle(`metin${E}]13`);
  assert.equal(r1.metin, "metin", "yarım önek ekrana yazılmamalı");
  assert.ok(a.bekleyen.length > 0);

  const r2 = a.isle(`3;D;2${BEL}`);
  assert.deepEqual(r2.isaretler, [{ tur: "bitti", kod: 2 }]);
});

test("tanınmayan alt komut sessizce atılır, metin bozulmaz", () => {
  const a = new KabukIsaretAyiklayici();
  const r = a.isle(`x${im("Z;99")}y`);
  assert.equal(r.metin, "xy");
  assert.deepEqual(r.isaretler, []);
});

test("gerçek akış: iki komut, biri basarili biri basarisiz", () => {
  // Canlı sondadan alınan sıra: D;0 A B D;0 A B D;1 A
  const a = new KabukIsaretAyiklayici();
  const akis =
    `${im("D;0")}${im("A")}PS> ${im("B")}echo merhaba\r\nmerhaba\r\n` +
    `${im("D;0")}${im("A")}PS> ${im("B")}yok_boyle\r\nhata\r\n` +
    `${im("D;1")}${im("A")}PS> `;
  const r = a.isle(akis);
  const bitenler = r.isaretler.filter((x) => x.tur === "bitti").map((x) => x.kod);
  assert.deepEqual(bitenler, [0, 0, 1]);
  assert.ok(!r.metin.includes("133"), "hiçbir işaret metne sızmamalı");
  assert.ok(r.metin.includes("merhaba"));
});

test("powershellEntegrasyonu çıkış kodunu ve üç işareti içerir", () => {
  const k = powershellEntegrasyonu();
  assert.ok(k.includes("LASTEXITCODE"), "çıkış kodu okunmalı");
  assert.ok(k.includes("133;D;"), "bitti işareti kod taşımalı");
  assert.ok(k.includes("133;A"), "istem işareti");
  assert.ok(k.includes("133;B"), "girdi işareti");
});
