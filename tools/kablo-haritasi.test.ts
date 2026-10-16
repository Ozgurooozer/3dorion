// tools/kablo-haritasi.test.ts — kablo çıkarıcısının sınıflandırması (tembel / hesaplı / değer) ve gerçek giris.ts'e karşı sayım.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { kabloCikar, kaynakOzeti, type Kablo } from "./kablo-haritasi.ts";

const sirali = (k: Kablo[]): string[] => k.map((x) => `${x.tuketici}.${x.anahtar}←${x.kaynak}:${x.tur}`).sort();

test("() => ad saf kablodur: tembel", () => {
  assert.deepEqual(sirali(kabloCikar("let a = 1;\nfKur({ x: () => a });")), ["fKur.x←a:tembel"]);
});

test("get x() { return ad } de tembeldir", () => {
  assert.deepEqual(sirali(kabloCikar("let a = 1;\nconst baglam = { get a() { return a; } };")), ["baglam.a←a:tembel"]);
});

test("işlev ad üzerinde iş yapıyorsa hesaplı: () => ad?.sayac()", () => {
  assert.deepEqual(sirali(kabloCikar("let a = null;\nfKur({ x: () => a?.sayac() });")), ["fKur.x←a:hesaplı"]);
});

test("parametreli işlev hesaplıdır ve kendi parametresi kaynak sayılmaz", () => {
  assert.deepEqual(sirali(kabloCikar("const a = 1, n = 2;\nfKur({ x: (n) => a + n });")), ["fKur.x←a:hesaplı"]);
});

test("kısa yazımlı alan ve ifade değerdir: { a } ve s: a.acilis", () => {
  assert.deepEqual(sirali(kabloCikar("const a = {};\nfKur({ a, s: a.acilis });")), ["fKur.a←a:değer", "fKur.s←a:değer"]);
});

test("new X({...}) de tüketicidir", () => {
  assert.deepEqual(sirali(kabloCikar("const a = 1;\nnew X({ a });")), ["X.a←a:değer"]);
});

test("sıralı bağımsız değişken: ad ve işlev de kablodur (nesne olmayan)", () => {
  assert.deepEqual(sirali(kabloCikar("let a = 1;\nlet b = 2;\nfKur(a, () => b);")), ["fKur.#1←a:değer", "fKur.#2←b:tembel"]);
});

test("üst düzey olmayan ad kaynak sayılmaz: yerel sabit haritada yok", () => {
  assert.deepEqual(kabloCikar("function f() { const yerel = 1; fKur({ x: () => yerel }); }"), []);
});

test("nesne anahtarı ve üye adı kablo değildir: { a: 1 } ve o.a", () => {
  assert.deepEqual(kabloCikar("let a = 1;\nfKur({ a: 1, b: o.a });"), []);
});

test("kaynak özeti: tüketici sayısına göre sıralı ve türleri sayar", () => {
  const o = kaynakOzeti(kabloCikar("let a = 1;\nlet b = 2;\nfKur({ x: () => a, y: b });\ngKur({ x: () => a });"));
  assert.deepEqual(o.map((x) => [x.kaynak, x.tuketiciler.length, x.tur.tembel]), [["a", 2, 2], ["b", 1, 0]]);
});

// Gerçek dosya: sayılar `giris.ts` ile birlikte DEĞİŞİR; bu yüzden değer sabitlenmez, yalnız kimin bağlı olduğu denetlenir.
const GIRIS = fs.readFileSync(path.join(import.meta.dirname, "..", "uygulama", "giris.ts"), "utf8");

test("giris.ts: orion ve kopru en az bir tüketiciye TEMBEL bağlanır (sonradan atananlar getter ile okunur)", () => {
  const ozet = kaynakOzeti(kabloCikar(GIRIS));
  for (const ad of ["orion", "kopru"]) assert.ok((ozet.find((o) => o.kaynak === ad)?.tur.tembel ?? 0) > 0, `${ad} tembel bağlı değil`);
});

test("giris.ts: tembel sayısı kaynaktaki '() => ad' biçimleriyle tutuyor (orion)", () => {
  const grepSayisi = (GIRIS.match(/\(\) => orion(?=[,;)}\s])/g) ?? []).length + (GIRIS.match(/get orion\(\) \{ return orion;/g) ?? []).length;
  const arac = kabloCikar(GIRIS).filter((k) => k.kaynak === "orion" && k.tur === "tembel").length;
  assert.equal(arac, grepSayisi);
});
