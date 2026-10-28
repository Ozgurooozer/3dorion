// uygulama/yapi/outliner/outlinerModeli.test.ts — Level Outliner modeli (spec 39 D6): gruplama, sıra, arama, yinelenen kimlik, imza, konum metni.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { gruplariKur, imza, konumMetni, satirSayisi, turAdi, type OutlinerNesnesi } from "./outlinerModeli.ts";

const n = (id: string, ad: string, tur: string, x = 0, y = 0, z = 0): OutlinerNesnesi => ({ id, ad, tur, kutu: { x, y, z } });
const ORNEK: OutlinerNesnesi[] = [
  n("masa", "masa", "mobilya", 1.26, 0.4, -2), n("sandalye", "sandalye", "mobilya"), n("raf", "raf", "mobilya"),
  n("ayakli_lamba", "ayaklı lamba", "aydinlatma"), n("monitor", "monitör", "yuzey"), n("bank", "bank", "esya"),
  n("bina_2", "Bina 2", "yapi"), n("bina_10", "Bina 10", "yapi"), n("bina_1", "Bina 1", "yapi"),
  n("garip", "garip şey", "uzayli"), n("tabela1", "Işıklı tabela", "tabela"),
];

test("gruplama: sabit tür sırası (yapı, mobilya, eşya, aydınlatma, yüzey, tabela…), bilinmeyen tür sona; boş grup yok", () => {
  assert.deepEqual(gruplariKur(ORNEK).map((g) => g.tur), ["yapi", "mobilya", "esya", "aydinlatma", "yuzey", "tabela", "uzayli"]);
  assert.deepEqual(gruplariKur(ORNEK).map((g) => g.ad), ["Yapı", "Mobilya", "Eşya", "Aydınlatma", "Yüzey", "Tabela", "uzayli"]);
  assert.deepEqual(gruplariKur([]), []);
  assert.deepEqual(gruplariKur([n("a", "a", "bitki")]).map((g) => g.tur), ["bitki"]);
});

test("grup içi: ada göre, Türkçe harf ve sayılar sayı gibi (Bina 1, Bina 2, Bina 10); aynı adda kimliğe göre", () => {
  const g = gruplariKur(ORNEK).find((x) => x.tur === "yapi")!;
  assert.deepEqual(g.satirlar.map((s) => s.ad), ["Bina 1", "Bina 2", "Bina 10"]);
  const e = gruplariKur([n("b", "kutu", "esya"), n("a", "kutu", "esya"), n("c", "çanta", "esya")]).find((x) => x.tur === "esya")!;
  assert.deepEqual(e.satirlar.map((s) => s.id), ["c", "a", "b"]);
});

test("arama: ad, kimlik ve tür adında; harf/Türkçe farkı gözetmez (I→ı); boş ve boşluk süzmez; eşleşmeyen grup düşer", () => {
  const ara = (q: string): string[] => gruplariKur(ORNEK, q).flatMap((g) => g.satirlar.map((s) => s.id)).sort();
  assert.deepEqual(ara("MASA"), ["masa"]);
  assert.deepEqual(ara("ayakli"), ["ayakli_lamba"], "kimlikte geçer (ayakli_lamba), adında 'ayaklı' var");
  assert.deepEqual(ara("AYAKLI"), ["ayakli_lamba"], "'AYAKLI' → 'ayaklı' (Türkçe küçük harf): kimlikle değil ADLA ('ayaklı lamba') eşleşir");
  assert.deepEqual(ara("ayaklı"), ["ayakli_lamba"]);
  assert.deepEqual(ara("IŞIKLI"), ["tabela1"], "I → ı: 'Işıklı tabela'");
  assert.deepEqual(ara("monitör"), ["monitor"]);
  assert.deepEqual(ara("mobilya"), ["masa", "raf", "sandalye"], "tür adı");
  assert.deepEqual(ara("Yüzey"), ["monitor"]);
  assert.equal(satirSayisi(gruplariKur(ORNEK, "   ")), ORNEK.length);
  assert.equal(satirSayisi(gruplariKur(ORNEK, "")), ORNEK.length);
  assert.deepEqual(gruplariKur(ORNEK, "yok-boyle-bir-sey"), []);
  assert.deepEqual(gruplariKur(ORNEK, "bina").map((g) => g.tur), ["yapi"]);
});

test("aynı kimlik iki kez gelirse İLKİ kalır (seçim anahtarı kimliktir)", () => {
  const g = gruplariKur([n("x", "birinci", "esya"), n("x", "ikinci", "mobilya")]);
  assert.deepEqual(g.map((x) => [x.tur, x.satirlar.map((s) => s.ad)]), [["esya", ["birinci"]]]);
});

test("konum metni: bir ondalık, NaN/∞ 0; satırlar konumu taşır", () => {
  assert.equal(konumMetni({ x: 1.26, y: -0.04, z: 12 }), "1.3, -0.0, 12.0");
  assert.equal(konumMetni({ x: Number.NaN, y: Infinity, z: 2.25 }), "0.0, 0.0, 2.3");
  assert.equal(gruplariKur(ORNEK).find((g) => g.tur === "mobilya")!.satirlar.find((s) => s.id === "masa")!.konum, "1.3, 0.4, -2.0");
});

test("imza: kimlik/ad/tür/konum değişince değişir, aynı listede aynı kalır; sıra değişimi de değişim sayılır", () => {
  const a = imza(ORNEK);
  assert.equal(imza([...ORNEK]), a);
  assert.notEqual(imza([...ORNEK.slice(1)]), a, "nesne çıktı");
  assert.notEqual(imza([...ORNEK, n("yeni", "yeni", "esya")]), a, "nesne girdi");
  assert.notEqual(imza(ORNEK.map((x) => (x.id === "masa" ? { ...x, ad: "masa 2" } : x))), a, "ad");
  assert.notEqual(imza(ORNEK.map((x) => (x.id === "masa" ? { ...x, tur: "esya" } : x))), a, "tür");
  assert.notEqual(imza(ORNEK.map((x) => (x.id === "masa" ? { ...x, kutu: { x: 5, y: 0.4, z: -2 } } : x))), a, "konum");
  assert.equal(imza([]), "");
});

test("tür adı: bilinen Türkçe ad, bilinmeyen kendi adı", () => {
  assert.deepEqual(["yapi", "aydinlatma", "altyapi", "uzayli"].map(turAdi), ["Yapı", "Aydınlatma", "Altyapı", "uzayli"]);
});
