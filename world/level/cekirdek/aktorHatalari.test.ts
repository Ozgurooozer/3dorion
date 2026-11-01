// world/level/cekirdek/aktorHatalari.test.ts — hata kodu kataloğunun davranışı (spec 45 §13). Biçim/ölü-kod taraması: uygulama/aktor/aktorHataBekcisi.test.ts.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { AKTOR_HATALARI, AktorHatasi, aktorHatasi, kodAciklamasi, kodluHata, kodlu, kodOku, kodOnekiniSil } from "./aktorHatalari.ts";

test("kodlu: '[KOD] ayrıntı' biçimi", () => {
  assert.equal(kodlu("AKT-OLY-001", "ad boş"), "[AKT-OLY-001] ad boş");
});

test("aktorHatasi: Error'dır, kod alanı programla okunur, mesajda kod öne yazılır", () => {
  const e = aktorHatasi("AKT-BAG-001", "aktör yok: kutu");
  assert.ok(e instanceof Error && e instanceof AktorHatasi);
  assert.equal(e.kod, "AKT-BAG-001");
  assert.equal(e.message, "[AKT-BAG-001] aktör yok: kutu");
  assert.equal(e.name, "AktorHatasi");
});

test("kodOku: AktorHatasi, Error mesajı ve düz metinden okur; kodsuz/katalogda olmayan kod null (uydurma kod sayılmaz)", () => {
  assert.equal(kodOku(aktorHatasi("AKT-HRK-001", "x")), "AKT-HRK-001");
  assert.equal(kodOku(new Error("[AKT-OLY-004] derinlik")), "AKT-OLY-004");
  assert.equal(kodOku("başında yazı [AKT-ZMN-001] sonda"), "AKT-ZMN-001");
  assert.equal(kodOku("kodsuz hata"), null);
  assert.equal(kodOku("[AKT-XXX-999] katalogda yok"), null);
  assert.equal(kodOku(undefined), null);
  assert.equal(kodOku(42), null);
});

test("kodluHata: başka katmandan gelen kodlu metni fırlatılabilir yapar; kod korunur, mesaj yeniden biçimlenir", () => {
  const e = kodluHata("kutu: [AKT-HRK-003]   hız   çok büyük");
  assert.equal(e.kod, "AKT-HRK-003");
  assert.match(e.message, /^\[AKT-HRK-003\] /);
  assert.ok(!/\s{2,}/.test(e.message), "çift boşluk kalmamalı");
  assert.equal(e.message, "[AKT-HRK-003] kutu: hız çok büyük", "kod yalnız BİR kez, başta; ayrıntıdaki eski kod silinir");
});

test("kodluHata: kodsuz ya da katalogda olmayan kod PROGRAMCI HATASIdır (TypeError): sessizce kod uydurmaz", () => {
  assert.throws(() => kodluHata("kodsuz"), TypeError);
  assert.throws(() => kodluHata("[AKT-XXX-999] yok"), TypeError);
});

test("kodAciklamasi: alan adı + anlam + çözüm önerisi", () => {
  const a = kodAciklamasi("AKT-OLY-004");
  assert.match(a, /^olay yolu: /);
  assert.ok(a.includes(AKTOR_HATALARI["AKT-OLY-004"].anlam) && a.includes(AKTOR_HATALARI["AKT-OLY-004"].cozum));
});

test("kodOnekiniSil: yalnız BAŞTAKİ '[KOD] ' atılır; ortadaki kod, kodsuz metin ve boşluksuz biçim olduğu gibi kalır", () => {
  assert.equal(kodOnekiniSil(kodlu("AKT-BAG-001", "aktör yok: kutu")), "aktör yok: kutu");
  assert.equal(kodOnekiniSil("önce [AKT-BAG-001] sonra"), "önce [AKT-BAG-001] sonra");
  assert.equal(kodOnekiniSil("kodsuz metin"), "kodsuz metin");
  assert.equal(kodOnekiniSil("[AKT-BAG-001]boşluksuz"), "[AKT-BAG-001]boşluksuz");
});
