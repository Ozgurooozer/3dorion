// bridge/metinKurtarma.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { metinKurtar, adOnar, aracCopuMu } from "./metinKurtarma.ts";

const ADLAR = ["dunya_soyle", "dunya_bak", "dunya_jest", "dunya_komut", "dunya_git"];

test("GERÇEK EKRAN GÖRÜNTÜSÜ: 'orld {...}' çöpü konuşulmaz, çağrılar kurtarılır", () => {
  // Bu metin gercek bir ekran goruntusunden alindi (2026-09-13): Orion bunu
  // SESLI OKUMUSTU.
  const ham =
    'orld {"name": "dunya_bak", "arguments": {"hedef": {"tip": "oyuncu"}}} orld ' +
    '{"name": "dunya_jest", "arguments": {"jest": "gülümsüyor", "hedef": {"tip": "oyuncu"}}}';
  const r = metinKurtar(ham, ADLAR);
  assert.equal(r.konusulabilir, "", "JSON copu ASLA konusulmamali");
  assert.deepEqual(r.cagrilar.map((c) => c.ad), ["dunya_bak", "dunya_jest"]);
  assert.deepEqual(r.cagrilar[1]?.girdi.jest, "gülümsüyor");
});

test("bozuk arac adi onarilir: orlda_komut -> dunya_komut", () => {
  assert.equal(adOnar("orlda_komut", ADLAR), "dunya_komut");
  assert.equal(adOnar("dunya_soyle", ADLAR), "dunya_soyle");
  assert.equal(adOnar("komut", ADLAR), "dunya_komut");
});

test("UYDURMA ad kurtarilmaz — dogrulama atlanmaz", () => {
  assert.equal(adOnar("dunya_ucmak", ADLAR), null);
  const r = metinKurtar('{"name": "dunya_ucmak", "arguments": {}}', ADLAR);
  assert.deepEqual(r.cagrilar, []);
  assert.equal(r.konusulabilir, "", "kurtarilamayan cop yine de konusulmaz");
});

test("temiz cumle oldugu gibi konusulur", () => {
  const r = metinKurtar("Terminalde bir hata var, git status deneyebilirsin.", ADLAR);
  assert.deepEqual(r.cagrilar, []);
  assert.match(r.konusulabilir, /Terminalde bir hata var/);
});

test("cumle + arac karisimi: cumle kalir, arac kurtarilir", () => {
  const r = metinKurtar(
    'Bir hata gordum. {"name": "dunya_komut", "arguments": {"metin": "git status", "gerekce": "yazim hatasi"}}',
    ADLAR);
  assert.equal(r.cagrilar.length, 1);
  assert.equal(r.cagrilar[0]?.girdi.metin, "git status");
  assert.match(r.konusulabilir, /Bir hata gordum/);
});

test("function sarmalayicili bicim de kurtarilir", () => {
  const r = metinKurtar('{"function": {"name": "dunya_soyle", "arguments": {"metin": "selam"}}}', ADLAR);
  assert.equal(r.cagrilar[0]?.ad, "dunya_soyle");
  assert.equal(r.cagrilar[0]?.girdi.metin, "selam");
});

test("ic ice suslu parantez blogu dogru ayristirilir", () => {
  const r = metinKurtar('{"name":"dunya_bak","arguments":{"hedef":{"tip":"oyuncu"}}}', ADLAR);
  assert.equal(r.cagrilar.length, 1);
  assert.deepEqual(r.cagrilar[0]?.girdi, { hedef: { tip: "oyuncu" } });
});

test("aracCopuMu bariz copu yakalar, duz cumleyi yakalamaz", () => {
  assert.equal(aracCopuMu('{"name": "dunya_bak"}'), true);
  assert.equal(aracCopuMu("dunya_soyle({...})"), true);
  assert.equal(aracCopuMu("Merhaba Ozyn, buradayim."), false);
});

test("bozuk JSON cokertmez, sessizce atlanir", () => {
  const r = metinKurtar('{"name": "dunya_bak", bozuk', ADLAR);
  assert.deepEqual(r.cagrilar, []);
});
