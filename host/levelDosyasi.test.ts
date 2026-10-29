// host/levelDosyasi.test.ts — Level dosyaları: yanlış adla yeni level doğmamalı, var olanın üstüne yazılmamalı,
// yarıda kalan yazım dosyayı bozmamalı (spec 23 A).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { levelAdiGecerli, hazirAdiGecerli, levelListesi, levelKaydet, levelOlustur, levelOku, hazirKaydet, hazirListesi, levelMetniniDenetle, LEVEL_METIN_TAVANI } from "./levelDosyasi.js";

const kok = () => fs.mkdtempSync(path.join(os.tmpdir(), "orion-level-"));
const kodu = (f: () => unknown) => { try { f(); return 0; } catch (e) { return (e as { kod?: number }).kod ?? -1; } };

test("level adı küçük harf, rakam, tire", () => { assert.deepEqual(["ova", "yeni-1", "Ova", "a b", "../x", "ç"].map(levelAdiGecerli), [true, true, false, false, false, false]); });
test("hazır yapı adı Türkçe harf alır, boşluk almaz", () => { assert.deepEqual(["köşe-dükkan", "a b"].map(hazirAdiGecerli), [true, false]); });
test("olmayan level kaydedilemez (404): yanlış adla yeni level doğmaz", () => { assert.equal(kodu(() => levelKaydet(kok(), "yok", "{}")), 404); });
test("var olan adla level oluşturulamaz (409)", () => {
  const k = kok(); levelOlustur(k, "a", "1");
  assert.equal(kodu(() => levelOlustur(k, "a", "2")), 409);
});
test("409 sonrası eski içerik bozulmadan kalır", () => {
  const k = kok(); levelOlustur(k, "a", "1"); kodu(() => levelOlustur(k, "a", "2"));
  assert.equal(levelOku(k, "a"), "1");
});
test("oluşturulan level kaydedilir ve okunur", () => {
  const k = kok(); levelOlustur(k, "a", "1"); levelKaydet(k, "a", "2");
  assert.equal(levelOku(k, "a"), "2");
});
test("yazımdan geriye .tmp kalmaz", () => {
  const k = kok(); levelOlustur(k, "a", "1");
  assert.deepEqual(fs.readdirSync(path.join(k, "a")), ["a.level.json"]);
});
test("geçersiz adla yol üretilmez (400; klasör dışına çıkılmaz)", () => { assert.equal(kodu(() => levelOlustur(kok(), "../dis", "x")), 400); });
test("liste yalnız <ad>/<ad>.level.json olan klasörleri verir", () => {
  const k = kok(); levelOlustur(k, "b", "1"); levelOlustur(k, "a", "1"); fs.mkdirSync(path.join(k, "bos"));
  assert.deepEqual(levelListesi(k).map((l) => l.ad), ["a", "b"]);
});
test("hazır yapı onaysız üstüne yazılmaz", () => {
  const k = kok(); hazirKaydet(k, "ev", "1", false);
  assert.equal(kodu(() => hazirKaydet(k, "ev", "2", false)), 409);
});
test("hazır yapı listesi uzantısız adlar", () => {
  const k = kok(); hazirKaydet(k, "ev", "1", false); hazirKaydet(k, "çit", "1", false);
  assert.deepEqual(hazirListesi(k), ["çit", "ev"].sort());
});
test("oyun içi yazım metni: boş, JSON olmayan ya da tavandan büyük reddedilir (400); geçerli JSON geçer", () => {
  for (const kotu of ["", "   ", "{bozuk", 5, null, undefined, " ".repeat(LEVEL_METIN_TAVANI + 1)]) assert.equal(kodu(() => levelMetniniDenetle(kotu)), 400, String(kotu).slice(0, 10));
  assert.equal(kodu(() => levelMetniniDenetle('{"surum":1}')), 0);
});
test("proje içine oyun içi yazım: geçersiz ad 400, aynı ad 409, kaydet yalnız var olana", () => {
  const k = kok();
  assert.equal(kodu(() => levelOlustur(k, "Büyük Ad", "{}")), 400);
  levelOlustur(k, "yeni-1", '{"a":1}');
  assert.equal(kodu(() => levelOlustur(k, "yeni-1", "{}")), 409);
  levelKaydet(k, "yeni-1", '{"a":2}');
  assert.equal(levelOku(k, "yeni-1"), '{"a":2}');
  assert.equal(kodu(() => levelKaydet(k, "baska", "{}")), 404);
});
