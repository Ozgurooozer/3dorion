// world/surfaces/ciktiToplayici.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { CiktiToplayici } from "./ciktiToplayici.ts";

test("akış sürerken rapor üretmez", () => {
  const t = new CiktiToplayici({ sessizlikMs: 800, azamiBekleyisMs: 99_999 });
  t.ekle("satir1", 0);
  assert.equal(t.topla(100), null);
  t.ekle("satir2", 200);
  assert.equal(t.topla(500), null, "akış devam ederken susmalı");
});

test("akış durunca TEK rapor üretir", () => {
  const t = new CiktiToplayici({ sessizlikMs: 800 });
  t.ekle("satir1", 0);
  t.ekle("satir2", 200);
  assert.equal(t.topla(500), null);
  const r = t.topla(1100);
  assert.equal(r, "satir1\nsatir2");
  assert.equal(t.topla(2000), null, "aynı blok ikinci kez raporlanmaz");
});

test("hiç durmayan akış azami bekleyişte raporlanır — Orion kör kalmaz", () => {
  const t = new CiktiToplayici({ sessizlikMs: 800, azamiBekleyisMs: 3000 });
  for (let ms = 0; ms <= 2500; ms += 100) t.ekle(`s${ms}`, ms);
  assert.equal(t.topla(2600), null, "henüz azami dolmadı");
  t.ekle("s3000", 3000);
  assert.notEqual(t.topla(3100), null, "azami bekleyiş dolunca rapor çıkmalı");
});

test("uzun blok özetlenir: baş ve SON korunur, orta atlanır", () => {
  const t = new CiktiToplayici({ sessizlikMs: 100, azamiSatir: 10 });
  for (let i = 0; i < 100; i++) t.ekle(`satir${i}`, 0);
  const r = t.topla(500) ?? "";
  assert.ok(r.includes("satir0"), "baş korunmalı");
  assert.ok(r.includes("satir99"), "SON korunmalı — sonuç sondadır");
  assert.ok(r.includes("satır atlandı"), "atlama görünür olmalı");
  assert.ok(r.split("\n").length <= 10, "tavan aşılmamalı");
});

test("kısa blok olduğu gibi geçer", () => {
  const t = new CiktiToplayici({ sessizlikMs: 100, azamiSatir: 16 });
  t.ekle("a\nb\nc", 0);
  assert.equal(t.topla(200), "a\nb\nc");
});

test("boş parça tamponu kirletmez", () => {
  const t = new CiktiToplayici({ sessizlikMs: 100 });
  t.ekle("   ", 0);
  t.ekle("\n\n", 10);
  assert.equal(t.bekleyenSatir, 0);
  assert.equal(t.topla(500), null);
});

test("GERÇEK SENARYO: npm test akışı tek uyandırma üretir", () => {
  // 190 satırlık gerçek koşuyu taklit et: hızlı akış, sonra sessizlik.
  const t = new CiktiToplayici({ sessizlikMs: 800, azamiBekleyisMs: 99_999 });
  let ms = 0, rapor = 0;
  for (let i = 0; i < 190; i++) {
    t.ekle(`✔ test ${i} (hata sayılır)`, ms);   // "hata" içeren test ADLARI
    ms += 10;
    if (t.topla(ms)) rapor++;
  }
  t.ekle("ℹ pass 171\nℹ fail 0", ms);
  ms += 900;
  if (t.topla(ms)) rapor++;
  assert.equal(rapor, 1, "190 satır, 1 uyandırma");
});

test("zorlaTopla sessizlik beklemeden hemen toplar — kabuk sinyali gelince", () => {
  const t = new CiktiToplayici({ sessizlikMs: 99_999 });
  t.ekle("satir1\nsatir2", 0);
  assert.equal(t.topla(10), null, "sessizlik dolmadan zamanlayici vermez");
  assert.equal(t.zorlaTopla(), "satir1\nsatir2", "kabuk sinyali beklemez");
  assert.equal(t.zorlaTopla(), null, "ikinci cagri bos doner");
});
