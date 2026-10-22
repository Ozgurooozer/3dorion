// protocol/npc.test.ts — NPC KAYDI biçimi (spec 35 dilim 3): güvenilmez girdi doğrulanır, temiz kopya döner, tavanlar, hata yeri söylenir.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { NPC_SINIRLARI, npcAdiGecerli, npcDogrula } from "./npc.ts";
import { grafAdiGecerli } from "./graf.ts";

const temel = () => ({ surum: 1, ad: "kapi_nobetcisi", ajan: "flash", graflar: ["nobetci"], parametreler: { parola: "Ay ışığı", gece_basi: 21, sert: true } });
const hataMetni = (v: unknown) => { const r = npcDogrula(v); return r.ok ? "" : r.hata; };

test("geçerli kayıt kabul edilir; parametreler verilmezse boş nesne olur", () => {
  const r = npcDogrula(temel());
  assert.deepEqual(r.ok ? r.deger : r, temel());
  const p = npcDogrula({ ...temel(), parametreler: undefined });
  assert.deepEqual(p.ok ? p.deger.parametreler : p, {});
});

test("bilinmeyen alanlar atılır (temiz kopya)", () => {
  const r = npcDogrula({ ...temel(), gizli: 1 });
  assert.equal(r.ok && "gizli" in r.deger, false);
});

test("sürüm, ad, ajan nedenle reddedilir; ajan '@ben' olamaz (çözülecek olan odur)", () => {
  assert.match(hataMetni({ ...temel(), surum: 2 }), /surum 1/);
  assert.match(hataMetni({ ...temel(), ad: "iki sözcük" }), /ad geçersiz/);
  assert.match(hataMetni({ ...temel(), ajan: "@ben" }), /ajan geçersiz/);
  assert.match(hataMetni({ ...temel(), ajan: "" }), /ajan geçersiz/);
  assert.match(hataMetni(null), /nesne olmalı/);
});

test("graflar: dizi, en az bir, tekrarsız, geçerli ad, tavan", () => {
  assert.match(hataMetni({ ...temel(), graflar: "nobetci" }), /dizi olmalı/);
  assert.match(hataMetni({ ...temel(), graflar: [] }), /en az bir/);
  assert.match(hataMetni({ ...temel(), graflar: ["a", "a"] }), /iki kez/);
  assert.match(hataMetni({ ...temel(), graflar: ["../x"] }), /graflar\[0\] geçersiz/);
  assert.match(hataMetni({ ...temel(), graflar: Array.from({ length: NPC_SINIRLARI.graf + 1 }, (_, i) => `g${i}`) }), /en çok 8 grafik/);
  assert.equal(hataMetni({ ...temel(), graflar: Array.from({ length: NPC_SINIRLARI.graf }, (_, i) => `g${i}`) }), "");
});

test("parametreler: tavan (adet, metin uzunluğu), geçersiz ad, null/nesne/sonsuz değer reddedilir", () => {
  const cok = Object.fromEntries(Array.from({ length: NPC_SINIRLARI.parametre + 1 }, (_, i) => [`p${i}`, i]));
  assert.match(hataMetni({ ...temel(), parametreler: cok }), /en çok 32 parametre/);
  assert.match(hataMetni({ ...temel(), parametreler: { uzun: "x".repeat(NPC_SINIRLARI.metin + 1) } }), /parametreler\.uzun: metin en çok 200/);
  assert.equal(hataMetni({ ...temel(), parametreler: { tam: "x".repeat(NPC_SINIRLARI.metin) } }), "");
  assert.match(hataMetni({ ...temel(), parametreler: { "a b": 1 } }), /geçersiz ad/);
  assert.match(hataMetni({ ...temel(), parametreler: { p: null } }), /parametreler\.p: yalnız metin/);
  assert.match(hataMetni({ ...temel(), parametreler: { p: { x: 1 } } }), /parametreler\.p: yalnız metin/);
  assert.match(hataMetni({ ...temel(), parametreler: { p: Infinity } }), /sonlu/);
  assert.match(hataMetni({ ...temel(), parametreler: [1] }), /parametreler nesne olmalı/);
});

test("NPC ad kuralı grafik adınınkiyle AYNI fonksiyon (kopya kural yok)", () => {
  assert.equal(npcAdiGecerli, grafAdiGecerli);
});
