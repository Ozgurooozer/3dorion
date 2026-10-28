// uygulama/eklentiler/dusunmeKipi/dogrulayici.test.ts — doğrulayıcının YANLIŞ RET verebileceği yerler: serbest bakış, farklı alan, süre penceresi, söz biçimi, halka boyutu.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { dogrulayiciKur } from "./dogrulayici.ts";
import type { Niyet } from "../../../protocol/niyet.ts";

const git = (ad: string): Niyet => ({ tur: "git", hedef: { tip: "capa", ad } });
const soyle = (metin: string): Niyet => ({ tur: "soyle", metin });
const ret = (r: { ok: boolean }): boolean => !r.ok;

test("V1: aynı beden eylemi yakın zamanda tekrar edilirse RET; ilk kez, farklı alan ve pencere dışı GEÇER", () => {
  const d = dogrulayiciKur({ eylemPenceresiMs: 1000 });
  assert.equal(d.dogrula(git("tahta"), 0).ok, true);
  const r = d.dogrula(git("tahta"), 500);
  assert.equal(ret(r), true); assert.match(r.ok ? "" : r.neden, /same action \(git\)/);
  assert.equal(d.dogrula(git("kapi"), 600).ok, true, "farklı hedef");
  assert.equal(d.dogrula(git("tahta"), 5000).ok, true, "pencere dışı (halkada hâlâ olsa bile)");
});

test("V1: alan sırası farkı AYNI eylemdir; serbest bakış (hedef null) tekrar edilebilir; otur/kalk dönüşümü tekrar sayılmaz", () => {
  const d = dogrulayiciKur();
  assert.equal(d.dogrula({ tur: "git", hedef: { tip: "capa", ad: "x" }, mesafe: 1 } as Niyet, 0).ok, true);
  assert.equal(ret(d.dogrula({ mesafe: 1, hedef: { ad: "x", tip: "capa" }, tur: "git" } as Niyet, 10)), true);
  assert.equal(d.dogrula({ tur: "bak", hedef: null }, 20).ok, true); assert.equal(d.dogrula({ tur: "bak", hedef: null }, 30).ok, true);
  assert.equal(d.dogrula({ tur: "otur" }, 40).ok, true); assert.equal(d.dogrula({ tur: "kalk" }, 50).ok, true); assert.equal(d.dogrula({ tur: "otur" }, 60).ok, true, "araya kalk girdi: ardışık tekrar DEĞİL");
});

test("V1: yalnız HEMEN önceki beden eylemiyle karşılaştırır (a, b, a → ikinci a geçer; b, b → ret)", () => {
  const d = dogrulayiciKur();
  d.dogrula(git("a"), 0); d.dogrula(git("b"), 1);
  assert.equal(d.dogrula(git("a"), 2).ok, true, "araya b girdi");
  d.dogrula(git("b"), 3);
  assert.equal(ret(d.dogrula(git("b"), 4)), true);
});

test("V2: aynı söz (büyük/küçük harf, boşluk, sondaki noktalama farkı yok sayılır) tekrar edilirse RET; farklı söz ve pencere dışı GEÇER", () => {
  const d = dogrulayiciKur({ sozPenceresiMs: 1000 });
  assert.equal(d.dogrula(soyle("Merhaba Ozyn."), 0).ok, true);
  assert.equal(ret(d.dogrula(soyle("  merhaba   ozyn!! "), 100)), true);
  assert.equal(d.dogrula(soyle("Nasılsın?"), 200).ok, true);
  assert.equal(d.dogrula(soyle("merhaba ozyn"), 9000).ok, true, "pencere dışı");
  assert.equal(d.dogrula(soyle("   "), 9100).ok, true, "boş söz protokolün işi; burada geçer");
});

test("V3: komut gerekçesi 6 harften kısaysa RET (boşluklar sayılmaz); yeterliyse GEÇER; öteki türlere dokunmaz", () => {
  const d = dogrulayiciKur();
  assert.equal(ret(d.dogrula({ tur: "komut", metin: "git status", gerekce: "  ok  " }, 0)), true);
  assert.equal(d.dogrula({ tur: "komut", metin: "git status", gerekce: "değişiklikleri görmek" }, 0).ok, true);
  assert.equal(d.dogrula({ tur: "dur" }, 0).ok, true);
});

test("sıfırla: kip kapanıp açılınca eski kabuller sayılmaz", () => {
  const d = dogrulayiciKur();
  d.dogrula(git("tahta"), 0); d.dogrula(soyle("selam"), 0);
  d.sifirla();
  assert.equal(d.dogrula(git("tahta"), 1).ok, true); assert.equal(d.dogrula(soyle("selam"), 1).ok, true);
});

test("V2: söz halkası 3 — araya iki farklı söz girse de ilk söz hâlâ tekrar sayılır; dördüncüde halkadan düşer", () => {
  const d = dogrulayiciKur();
  d.dogrula(soyle("a"), 0); d.dogrula(soyle("b"), 1); d.dogrula(soyle("c"), 2);
  assert.equal(ret(d.dogrula(soyle("a"), 3)), true, "a hâlâ son 3 söz içinde");
  d.dogrula(soyle("d"), 4); d.dogrula(soyle("e"), 5); d.dogrula(soyle("f"), 6);
  assert.equal(d.dogrula(soyle("a"), 7).ok, true, "a halkadan düştü");
});

test("V1: yer listesi verilirse git/bak retleri geçerli hedefleri söyler (en çok 8); listesiz ya da hedefsiz eylemde söylemez", () => {
  const yerler = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  const d = dogrulayiciKur();
  d.dogrula(git("x"), 0, yerler);
  const r = d.dogrula(git("x"), 1, yerler);
  assert.match(r.ok ? "" : r.neden, /Valid targets: a, b, c, d, e, f, g, h\.$/);
  const e = dogrulayiciKur(); e.dogrula(git("x"), 0); const r2 = e.dogrula(git("x"), 1);
  assert.doesNotMatch(r2.ok ? "" : r2.neden, /Valid targets/);
  const o = dogrulayiciKur(); o.dogrula({ tur: "otur" }, 0, yerler); const r3 = o.dogrula({ tur: "otur" }, 1, yerler);
  assert.doesNotMatch(r3.ok ? "" : r3.neden, /Valid targets/);
});
