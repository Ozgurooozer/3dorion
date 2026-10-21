// world/arayuz/editorModeli.test.ts — düzenleyici modeli: kirli, dışarıdan değişim kararı, imleç yeri, sayılar, Tab girintisi.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { diskDegisti, girintile, imlecYeri, kirliMi, sayilar } from "./editorModeli.ts";

test("kirli: ekrandaki metin diskteki bilinenden farklıysa", () => {
  assert.equal(kirliMi({ metin: "a", disk: "a" }), false);
  assert.equal(kirliMi({ metin: "ab", disk: "a" }), true);
});

test("dışarıdan değişim: aynıysa yok; kirli değilse sessizce yenile; kirliyse ÇAKIŞMA (Ozyn'in yazdığı ezilmez)", () => {
  assert.equal(diskDegisti({ metin: "a", disk: "a" }, "a"), "yok");
  assert.equal(diskDegisti({ metin: "a", disk: "a" }, "b"), "yenile");
  assert.equal(diskDegisti({ metin: "ozyn", disk: "a" }, "b"), "catisma");
  assert.equal(diskDegisti({ metin: "ozyn", disk: "a" }, "a"), "yok");   // disk kendi bildiğimizse çakışma yok
});

test("imleç yeri: 1 tabanlı satır/sütun; sınır dışı konum kırpılır", () => {
  assert.deepEqual(imlecYeri("abc\ndef", 0), { satir: 1, sutun: 1 });
  assert.deepEqual(imlecYeri("abc\ndef", 5), { satir: 2, sutun: 2 });
  assert.deepEqual(imlecYeri("abc\ndef", 4), { satir: 2, sutun: 1 });
  assert.deepEqual(imlecYeri("abc", 99), { satir: 1, sutun: 4 });
  assert.deepEqual(imlecYeri("", 0), { satir: 1, sutun: 1 });
});

test("sayılar: karakter, satır, sözcük; boş metin 0 satır", () => {
  assert.deepEqual(sayilar(""), { karakter: 0, satir: 0, sozcuk: 0 });
  assert.deepEqual(sayilar("bir iki\nüç"), { karakter: 10, satir: 2, sozcuk: 3 });
});

test("Tab seçimsiz/tek satır: imlece girinti ekler, imleç girintinin sonuna gider; seçili metnin yerini alır", () => {
  assert.deepEqual(girintile("abc", 1, 1, false), { metin: "a  bc", bas: 3, son: 3 });
  assert.deepEqual(girintile("abc", 0, 2, false), { metin: "  c", bas: 2, son: 2 });
});

test("Tab çok satırlı seçim: seçili satırların hepsi girintilenir, seçim korunur", () => {
  const r = girintile("a\nb\nc", 0, 3, false);   // seçim "a\nb"
  assert.equal(r.metin, "  a\n  b\nc");
  assert.deepEqual([r.bas, r.son], [2, 7]);
});

test("Shift+Tab: satır başındaki girintiyi azaltır; girintisiz satıra dokunmaz; tek satırda da çalışır", () => {
  assert.equal(girintile("    a", 4, 4, true).metin, "  a");
  assert.equal(girintile("a", 0, 0, true).metin, "a");
  assert.equal(girintile("\ta", 1, 1, true).metin, "a");
  assert.equal(girintile("  a\n b\nc", 0, 7, true).metin, "a\nb\nc");
});

test("çok satırlı seçim satır başında bitiyorsa son (boş seçili) satır girintilenmez", () => {
  const r = girintile("a\nb\nc", 0, 4, false);   // seçim "a\nb\n" — c seçili değil
  assert.equal(r.metin, "  a\n  b\nc");
});

test("girinti başlangıç konumu satır başının gerisine düşmez", () => {
  const r = girintile("a\n  b", 3, 3, true);   // satırın başında, girinti kaldırılırken imleç ilerisi
  assert.ok(r.bas >= 2);
  assert.equal(r.metin, "a\nb");
});
