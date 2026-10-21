// protocol/graf.test.ts — düğüm grafiği BİÇİMİ: güvenilmez girdi (LLM/elle) doğrulanır, temiz kopya döner, hata yeri söylenir.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { GRAF_SINIRLARI, grafAdiGecerli, grafDogrula } from "./graf.ts";

const temel = () => ({
  surum: 1, ad: "selam", tur: "olay",
  dugumler: [{ id: "b", tip: "olay.basla" }, { id: "s", tip: "ajan.soyle", ayar: { metin: "merhaba" }, konum: [10, 20] }],
  baglar: [{ kaynak: ["b", "sonra"], hedef: ["s", "giris"] }],
});
const hataMetni = (v: unknown) => { const r = grafDogrula(v); return r.ok ? "" : r.hata; };

test("geçerli grafik kabul edilir; girisler/cikislar verilmezse boş dizi olur", () => {
  const r = grafDogrula(temel());
  assert.deepEqual(r.ok ? [r.deger.girisler, r.deger.cikislar, r.deger.dugumler.length] : r, [[], [], 2]);
});

test("bilinmeyen alanlar atılır (temiz kopya: LLM'in uydurduğu alan dünyaya geçmez)", () => {
  const r = grafDogrula({ ...temel(), gizli: "x", dugumler: [{ id: "b", tip: "olay.basla", fazla: 1 }], baglar: [] });
  assert.deepEqual(r.ok ? [("gizli" in r.deger), ("fazla" in r.deger.dugumler[0]!)] : r, [false, false]);
});

test("sürüm, ad, tür yanlışsa nedenle reddedilir", () => {
  assert.match(hataMetni({ ...temel(), surum: 2 }), /surum/);
  assert.match(hataMetni({ ...temel(), ad: "../x" }), /ad geçersiz/);
  assert.match(hataMetni({ ...temel(), tur: "betik" }), /tur/);
});

test("aynı düğüm kimliği iki kez: ret", () => {
  assert.match(hataMetni({ ...temel(), dugumler: [{ id: "b", tip: "olay.basla" }, { id: "b", tip: "ajan.soyle" }] }), /iki kez/);
});

test("bağ olmayan düğüme gidiyorsa ret ve hangi bağ olduğu söylenir", () => {
  assert.match(hataMetni({ ...temel(), baglar: [{ kaynak: ["b", "sonra"], hedef: ["yok", "giris"] }] }), /baglar\[0\]\.hedef: 'yok' adlı düğüm yok/);
});

test("düğüm türü noktalı küçük harf olmalı", () => {
  assert.match(hataMetni({ ...temel(), dugumler: [{ id: "b", tip: "Olay Başla" }], baglar: [] }), /tip geçersiz/);
});

test("ayar yalnız düz değer taşır (iç içe nesne, sonsuz sayı, çok uzun metin ret)", () => {
  const d = (ayar: unknown) => ({ ...temel(), dugumler: [{ id: "b", tip: "olay.basla", ayar }], baglar: [] });
  assert.match(hataMetni(d({ x: { y: 1 } })), /yalnız metin/);
  assert.match(hataMetni(d({ x: Infinity })), /sonlu/);
  assert.match(hataMetni(d({ x: "a".repeat(GRAF_SINIRLARI.metin + 1) })), /çok uzun/);
});

test("olay grafiğinin giriş/çıkış pini olmaz; desende pin türü veri olmalı (akış değil)", () => {
  assert.match(hataMetni({ ...temel(), girisler: [{ ad: "x", tip: "sayi" }] }), /olay grafiğinin/);
  assert.match(hataMetni({ ...temel(), tur: "fonksiyon", girisler: [{ ad: "x", tip: "akis" }] }), /veri türü/);
});

test("tavanlar: çok düğüm ya da çok bağ reddedilir", () => {
  const cok = Array.from({ length: GRAF_SINIRLARI.dugum + 1 }, (_, i) => ({ id: `n${i}`, tip: "veri.sayi" }));
  assert.match(hataMetni({ ...temel(), dugumler: cok, baglar: [] }), /en çok/);
});

test("aynı bağ iki kez: ret", () => {
  const b = { kaynak: ["b", "sonra"], hedef: ["s", "giris"] };
  assert.match(hataMetni({ ...temel(), baglar: [b, b] }), /aynı bağ/);
});

test("ad kuralı: Türkçe harf, rakam, _ ve - serbest; boşluk, yol ayracı, boş ad yasak", () => {
  assert.deepEqual(["ağaç_kes", "al-getir2", "", "a b", "a/b", 5].map(grafAdiGecerli), [true, true, false, false, false, false]);
});
