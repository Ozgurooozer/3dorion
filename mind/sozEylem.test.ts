// mind/sozEylem.test.ts — "Söyledi ama yapmadı" bekçisi.
//
// "GERÇEK" testlerdeki sözler 2026-10-02 ortak canlı testin log'undan
// (oturum-kayitlari/2026-10-02-ofis-testi.log), olduğu gibi.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { eylemIddialari, sozEylemUcurumu } from "./sozEylem.ts";

test("GERÇEK: 'Oturuyorum Ozyn.' + yalnız soyle → otur eksik", () => {
  assert.deepEqual(sozEylemUcurumu(["Oturuyorum Ozyn."], ["soyle"], ["otur"]), ["otur"]);
});

test("GERÇEK: 'Geliyorum Ozyn.' + yalnız soyle → git eksik", () => {
  assert.deepEqual(sozEylemUcurumu(["Geliyorum Ozyn."], ["soyle"], ["bana gel"]), ["git"]);
});

test("GERÇEK: 'Bilgisayarı açıyorum Ozyn.' + yalnız soyle → odaklan eksik", () => {
  assert.deepEqual(sozEylemUcurumu(["Bilgisayarı açıyorum Ozyn."], ["soyle"], ["önündeki bilgisayarı aç"]), ["odaklan"]);
});

test("söylediğini yaptıysa uçurum yok: 'Yazıyorum' + git + yaz", () => {
  assert.deepEqual(sozEylemUcurumu(["Yazıyorum."], ["soyle", "git", "yaz"], ["tahtaya yaz"]), []);
});

test("GERÇEK: ikinci tekil ve eylem olmayan iddialar sayılmaz", () => {
  for (const s of ["Uzaklaştın Ozyn.", "Yaklaştın Ozyn.", "Ozyn yaklaştı. Bekliyorum.", "Ozyn, gece yarısı mı bu?"]) {
    assert.deepEqual(eylemIddialari(s), [], s);
  }
});

test("gelecek zaman da iddiadır: 'Hemen oturacağım'", () => {
  assert.deepEqual(eylemIddialari("Hemen oturacağım."), ["otur"]);
});

test("büyük harf ve Türkçe karakter önemsiz: 'GELİYORUM'", () => {
  assert.deepEqual(eylemIddialari("GELİYORUM!"), ["git"]);
});

test("'bakıyorum' odaya bakmakla (sor) da karşılanır", () => {
  assert.deepEqual(sozEylemUcurumu(["Bakıyorum."], ["soyle", "sor"], ["pencereye bak"]), []);
});

test("'geliyorum' başka bir yere oturmakla karşılanmaz", () => {
  assert.deepEqual(sozEylemUcurumu(["Geliyorum."], ["soyle", "otur"], ["bana gel"]), ["git"]);
});

test("kelime ortasında eşleşmez: 'açıklıyorum' bilgisayar açmak değildir", () => {
  assert.deepEqual(eylemIddialari("Şimdi açıklıyorum."), []);
});

test("iki iddia, biri karşılanmış: yalnız eksik olan döner", () => {
  assert.deepEqual(sozEylemUcurumu(["Geliyorum, sonra oturuyorum."], ["soyle", "git"], ["gel ve otur"]), ["otur"]);
});

test("GERÇEK (ortak test 3): 'neredesin' → 'masamda oturuyorum' durum anlatımıdır, uçurum DEĞİL", () => {
  assert.deepEqual(sozEylemUcurumu(["Neredeyim, çalışma masamda oturuyorum."], ["soyle"], ["neredesin"]), []);
});

test("Ozyn bu turda konuşmadıysa (olay turu) bekçi işaretlemez", () => {
  assert.deepEqual(sozEylemUcurumu(["Oturuyorum."], ["soyle"], []), []);
});

test("GERÇEK (ortak test 3): 'şiiri tahtaya yaz' + yalnız söz 'yazıyorum' → yaz eksik", () => {
  assert.deepEqual(sozEylemUcurumu(["Şiiri yazıyorum."], ["soyle"], ["şiiri tahtaya yaz"]), ["yaz"]);
});
