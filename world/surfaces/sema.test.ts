// world/surfaces/sema.test.ts — panelin canvas gerektirmeyen saf kısımları.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { sonrakiDeger } from "./sema.ts";
import type { DugmeGoruntu } from "../../protocol/pano.ts";

const d = (u: Partial<DugmeGoruntu>): DugmeGoruntu => ({
  ad: "x", etiket: "x", sinif: "guvenli", etki: "aninda", birim: "", kaynak: "",
  aciklama: "", deger: null, hata: "", yazilabilir: true, kilitSebebi: "",
  adim: 0, secenekler: [], ...u,
});

test("sayı: adım kadar artar/azalır", () => {
  assert.equal(sonrakiDeger(d({ deger: 4000, adim: 500 }), 1), 4500);
  assert.equal(sonrakiDeger(d({ deger: 4000, adim: 500 }), -1), 3500);
});

test("metin: listede ilerler ve UÇTA BAŞA döner", () => {
  // İki beyin arasında gidip gelmek tek tuşla olmalı; uçta durmak kullanıcıyı
  // ters tuşa zorlar.
  const b = d({ deger: "yerel", secenekler: ["opencode", "yerel"] });
  assert.equal(sonrakiDeger(b, 1), "opencode");
  assert.equal(sonrakiDeger(b, -1), "opencode");
  const c = d({ deger: "a", secenekler: ["a", "b", "c"] });
  assert.equal(sonrakiDeger(c, -1), "c");
  assert.equal(sonrakiDeger(c, 1), "b");
});

test("listede OLMAYAN değer ilk seçeneğe gider — kilitlenmez", () => {
  assert.equal(sonrakiDeger(d({ deger: "eski-ad", secenekler: ["a", "b"] }), 1), "a");
});

test("ayarlanamayan düğme null döner", () => {
  assert.equal(sonrakiDeger(d({ deger: true }), 1), null);
  assert.equal(sonrakiDeger(d({ deger: "tek", secenekler: ["tek"] }), 1), null);
  assert.equal(sonrakiDeger(d({ deger: "liste-yok" }), 1), null);
});
