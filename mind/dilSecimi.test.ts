// mind/dilSecimi.test.ts — İngilizce iç düşünce sesli okunmasın (spec 13 Faz 5).
// "GERÇEK" metinler karar kaydından (2026-10-02, Ozyn'in testi), olduğu gibi.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ingilizceMi } from "./dilSecimi.ts";

test("GERÇEK: lfm25-tb'nin iç monoloğu İngilizce sayılır", () => {
  for (const m of [
    "I see the user is asking me to respond. The previous context shows I was just looking at the monitor and Ozyn is nearby.",
    "I see you're now in the room and Ozyn just said \"hi\". I'm currently standing",
    "I can see the room setup and my current state. The user has mentioned",
  ]) assert.equal(ingilizceMi(m), true, m);
});

test("GERÇEK: Türkçe sözler Türkçe sayılır (sesli okunur)", () => {
  for (const m of [
    "Merhaba Ozyn, iyi sabahlar.", "Neredeyim, çalışma masamda oturuyorum.", "Sabah iyi Ozyn.",
    "Orta arada bir şiir yazmam gerekiyor gibi bir durum yok",
  ]) assert.equal(ingilizceMi(m), false, m);
});

test("kısa ya da kararsız metin Türkçe sayılır (yanlışlıkla susmak cevapsız bırakır)", () => {
  for (const m of ["OK", "Ozyn", "", "git status"]) assert.equal(ingilizceMi(m), false, JSON.stringify(m));
});

test("içinde Türkçe harf olan karışık metin İngilizce sayılmaz", () => {
  assert.equal(ingilizceMi("I see the user, Ozyn çalışıyor"), false);
});
