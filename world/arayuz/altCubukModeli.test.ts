// world/arayuz/altCubukModeli.test.ts — alt çubuk modeli: sekme kaydı, sıra, aç/kapa, tekrar tık kapatır, engelli sekme, olaylar, kalıcılık.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { altCubukModeliKur, type AltCubukModeli, type AltCubukOlayi } from "./altCubukModeli.ts";

const sekme = (id: string, sira: number) => ({ id, ad: id.toUpperCase(), simge: "•", sira });
function kur(...idler: string[]): AltCubukModeli {
  const m = altCubukModeliKur();
  idler.forEach((id, i) => m.ekle(sekme(id, (i + 1) * 10)));
  return m;
}

test("sekmeler sıraya göre dizilir; sıra eşitse ekleme sırası", () => {
  const m = altCubukModeliKur();
  m.ekle(sekme("c", 30)); m.ekle(sekme("a", 10)); m.ekle(sekme("b", 10));
  assert.deepEqual(m.sekmeler().map((s) => s.id), ["a", "b", "c"]);
});

test("aynı kimlikli ikinci sekme HATA (sessizce üstüne yazılmaz)", () => {
  const m = kur("asset");
  assert.throws(() => m.ekle(sekme("asset", 5)), /zaten ekli/);
  assert.equal(m.sekmeler().length, 1);
});

test("başlangıçta panel kapalı ve etkin sekme yok", () => {
  assert.deepEqual(kur("a", "b").durum(), { acik: false, etkin: null });
});

test("sec: sekmeyi etkin yapar ve paneli açar; bilinmeyen kimlik HATA", () => {
  const m = kur("a", "b");
  assert.equal(m.sec("b"), true);
  assert.deepEqual(m.durum(), { acik: true, etkin: "b" });
  assert.throws(() => m.sec("yok"), /sekme yok/);
});

test("sekmeyeTikla: kapalıyken açar; başka sekmeye geçer; AYNI sekmeye tekrar tık kapatır", () => {
  const m = kur("a", "b");
  m.sekmeyeTikla("a");
  assert.deepEqual(m.durum(), { acik: true, etkin: "a" });
  m.sekmeyeTikla("b");
  assert.deepEqual(m.durum(), { acik: true, etkin: "b" });
  m.sekmeyeTikla("b");
  assert.deepEqual(m.durum(), { acik: false, etkin: null });
});

test("ac: son etkin sekmeden devam eder; hiç seçilmediyse ilk sekmeyle açar", () => {
  const m = kur("a", "b");
  m.ac();
  assert.equal(m.durum().etkin, "a");
  m.sec("b"); m.kapat();
  m.ac();
  assert.equal(m.durum().etkin, "b");
});

test("ac: hiç sekme yoksa açılmaz (false)", () => {
  const m = altCubukModeliKur();
  assert.equal(m.ac(), false);
  assert.equal(m.durum().acik, false);
});

test("degistir: açıksa kapatır, kapalıysa açar", () => {
  const m = kur("a");
  m.degistir();
  assert.equal(m.durum().acik, true);
  m.degistir();
  assert.equal(m.durum().acik, false);
});

test("engelli sekme seçilemez ve neden söylenir; engel kalkınca seçilir", () => {
  const m = kur("a", "b");
  m.engelle("b", "dünya henüz hazır değil");
  assert.equal(m.sec("b"), false);
  assert.equal(m.sekmeyeTikla("b"), false);
  assert.equal(m.engel("b"), "dünya henüz hazır değil");
  assert.equal(m.durum().acik, false);
  m.engelle("b", null);
  assert.equal(m.sec("b"), true);
  assert.equal(m.engel("b"), null);
});

test("ac: engelli sekmeyi atlar; hepsi engelliyse açılmaz", () => {
  const m = kur("a", "b");
  m.engelle("a", "x");
  m.ac();
  assert.equal(m.durum().etkin, "b");
  m.kapat();
  m.engelle("b", "y");
  assert.equal(m.ac(), false);
});

test("etkin sekme engellenirse panel kapanır (başka sekmeye sessizce düşmez)", () => {
  const m = kur("a", "b");
  m.sec("a");
  m.engelle("a", "x");
  assert.deepEqual(m.durum(), { acik: false, etkin: null });
});

test("dinle: yalnız GERÇEK değişiklikte, önceki ve şimdiki durumla; aboneliği bırakma", () => {
  const m = kur("a", "b");
  const olaylar: AltCubukOlayi[] = [];
  const birak = m.dinle((o) => olaylar.push(o));
  m.kapat();                       // zaten kapalı: olay yok
  m.sec("a");
  m.sec("a");                      // aynı durum: olay yok
  m.sec("b");
  assert.equal(olaylar.length, 2);
  assert.deepEqual(olaylar[1]!.onceki, { acik: true, etkin: "a" });
  assert.deepEqual(olaylar[1]!.simdi, { acik: true, etkin: "b" });
  birak();
  m.kapat();
  assert.equal(olaylar.length, 2);
});

test("kayıt: son etkin sekme saklanır, panel kapalı başlar", () => {
  const m = kur("a", "b");
  m.sec("b");
  const metin = m.yaz();
  const y = kur("a", "b");
  y.yukle(metin);
  assert.equal(y.durum().acik, false);
  y.ac();
  assert.equal(y.durum().etkin, "b");
});

test("kayıt: panel kapatılsa da son sekme hatırlanır", () => {
  const m = kur("a", "b");
  m.sec("b"); m.kapat();
  const y = kur("a", "b");
  y.yukle(m.yaz());
  y.ac();
  assert.equal(y.durum().etkin, "b");
});

test("kayıt: bilinmeyen sekme sessizce düşer (ilk sekmeyle açılır); boş kayıt zararsız", () => {
  const m = kur("a", "b");
  m.yukle(JSON.stringify({ surum: 1, etkin: "silinmis" }));
  m.ac();
  assert.equal(m.durum().etkin, "a");
  m.yukle(null);
});

test("kayıt: bozuk kayıtlar HATA", () => {
  const m = kur("a");
  assert.throws(() => m.yukle("{"), SyntaxError);
  assert.throws(() => m.yukle("3"), /nesne değil/);
  assert.throws(() => m.yukle(JSON.stringify({ surum: 2, etkin: "a" })), /sürümü/);
  assert.throws(() => m.yukle(JSON.stringify({ surum: 1, etkin: 5 })), /bozuk/);
});
