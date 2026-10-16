// tools/kablo-haritasi.test.ts — kablo çıkarıcısının sınıflandırması (tembel / hesaplı / değer) ve gerçek giris.ts'e karşı sayım.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { kabloCikar, kaynakOzeti, abonelikCikar, type Kablo } from "./kablo-haritasi.ts";

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

test("yol servisi: () => yol.al(\"ad\") tembel kablodur, kaynağı servis:ad", () => {
  assert.deepEqual(sirali(kabloCikar("const yol = {};\nfKur({ x: () => yol.al(\"orion\") });")), ["fKur.x←servis:orion:tembel"]);
});

test("yol servisi: iş yapan okuma hesaplıdır: () => yol.al(\"kopru\")?.sayac()", () => {
  assert.deepEqual(sirali(kabloCikar("const yol = {};\nfKur({ x: () => yol.al(\"kopru\")?.sayac() });")), ["fKur.x←servis:kopru:hesaplı"]);
});

test("yol servisi: başka nesnenin al() çağrısı servis sayılmaz", () => {
  assert.deepEqual(kabloCikar("const harita = {};\nfKur({ x: () => harita.al(\"orion\") });").map((k) => k.kaynak), ["harita"]);
});

test("kaynak özeti: tüketici sayısına göre sıralı ve türleri sayar", () => {
  const o = kaynakOzeti(kabloCikar("let a = 1;\nlet b = 2;\nfKur({ x: () => a, y: b });\ngKur({ x: () => a });"));
  assert.deepEqual(o.map((x) => [x.kaynak, x.tuketiciler.length, x.tur.tembel]), [["a", 2, 2], ["b", 1, 0]]);
});

// Gerçek dosya: sayılar `giris.ts` ile birlikte DEĞİŞİR; bu yüzden değer sabitlenmez, yalnız kimin bağlı olduğu denetlenir.
const GIRIS = fs.readFileSync(path.join(import.meta.dirname, "..", "uygulama", "giris.ts"), "utf8");

test("giris.ts: orion ve kopru en az bir tüketiciye TEMBEL bağlanır (yol servisi: () => yol.al(\"ad\"))", () => {
  const ozet = kaynakOzeti(kabloCikar(GIRIS));
  for (const ad of ["servis:orion", "servis:kopru"]) assert.ok((ozet.find((o) => o.kaynak === ad)?.tur.tembel ?? 0) > 0, `${ad} tembel bağlı değil`);
});

test("giris.ts: orion'un tembel sayısı kaynaktaki '() => yol.al(\"orion\")' biçimleriyle tutuyor", () => {
  const grepSayisi = (GIRIS.match(/\(\) => yol\.al\("orion"\)(?=[,;)}\s])/g) ?? []).length + (GIRIS.match(/get orion\(\) \{ return yol\.al\("orion"\);/g) ?? []).length;
  const arac = kabloCikar(GIRIS).filter((k) => k.kaynak === "servis:orion" && k.tur === "tembel").length;
  assert.equal(arac, grepSayisi);
});

test("abonelik: a.dinle((x) => b.f(x)) — olay kaynağı a, geri çağrı b'ye dokunur", () => {
  assert.deepEqual(abonelikCikar("const b = {};\na.dinle((x) => b.f(x));"), [{ alici: "a", metot: "dinle", olay: null, dokunur: ["b"] }]);
});

test("abonelik: olay adı sabit yazıysa kaydedilir ve işleyici sondaki bağımsız değişkendir", () => {
  assert.deepEqual(abonelikCikar('const c = 1;\nE.dinle("basladi", (o) => c + o);'), [{ alici: "E", metot: "dinle", olay: "basladi", dokunur: ["c"] }]);
});

test("abonelik: adlı işleyici verilirse o ad dokunulan sayılır: x.sonucDinle(h)", () => {
  assert.deepEqual(abonelikCikar("const h = () => 1;\nx.sonucDinle(h);").map((a) => a.dokunur), [["h"]]);
});

test("abonelik: runRenderLoop çizim saatine abonelik sayılır", () => {
  assert.deepEqual(abonelikCikar("const s = 1;\nmotor.runRenderLoop(() => s);").map((a) => `${a.alici}.${a.metot}→${a.dokunur}`), ["motor.runRenderLoop→s"]);
});

test("abonelik değil: p.then(() => a) bir söz zinciridir, olay kaynağı değil", () => {
  assert.deepEqual(abonelikCikar("const a = 1;\np.then(() => a);"), []);
});

test("abonelik: geri çağrının kendi parametresi üst düzey adı gölgeler", () => {
  assert.deepEqual(abonelikCikar("const b = 1;\na.dinle((b) => b);").map((a) => a.dokunur), [[]]);
});

test("abonelik: olay adı değişkeni işleyici sayılmaz, yalnız SON bağımsız değişken", () => {
  assert.deepEqual(abonelikCikar("const adi = 'x';\na.dinle(adi, (z) => z);").map((a) => a.dokunur), [[]]);
});

test("giris.ts: saat.dinle (20Hz mantık) oyuncuyu ve kamerayı sürer", () => {
  const saat = abonelikCikar(GIRIS).find((a) => a.alici === "saat" && a.metot === "dinle");
  assert.ok(saat, "saat.dinle bulunamadı");
  for (const ad of ["oyuncu", "rig"]) assert.ok(saat.dokunur.includes(ad), `saat.dinle ${ad}'a dokunmuyor`);
});

test("giris.ts: bulunan abonelik sayısı kaynaktaki dinle-ailesi çağrılarıyla tutuyor", () => {
  const satirlar = GIRIS.split("\n").filter((s) => !s.trim().startsWith("//"));
  const grepSayisi = (satirlar.join("\n").match(/\.(?:dinle|[A-Za-z]*Dinle|runRenderLoop)\(/g) ?? []).length;
  assert.equal(abonelikCikar(GIRIS).length, grepSayisi);
});
