// world/player/imlecKipi.test.ts — imleç kipi durum makinesi: aç/kapa, kilit, engel, Esc kapanışı.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { imlecKipiKur } from "./imlecKipi.ts";

function duzenek(engelli = false) {
  const sayac = { birak: 0, iste: 0, degisim: [] as boolean[], engelli };
  const kip = imlecKipiKur({
    kilidiBirak: () => { sayac.birak++; },
    kilidiIste: () => { sayac.iste++; },
    engelli: () => sayac.engelli,
    degisti: (a) => { sayac.degisim.push(a); },
  });
  return { kip, sayac };
}

test("başlangıçta kapalı", () => {
  assert.equal(duzenek().kip.acik, false);
});

test("Tab (degistir) açar: kilit bırakılır, değişiklik bildirilir", () => {
  const { kip, sayac } = duzenek();
  assert.equal(kip.degistir(), true);
  assert.deepEqual([kip.acik, sayac.birak, sayac.degisim], [true, 1, [true]]);
});

test("ikinci Tab kapatır ve kilidi YENİDEN ister", () => {
  const { kip, sayac } = duzenek();
  kip.degistir(); kip.degistir();
  assert.deepEqual([kip.acik, sayac.iste, sayac.degisim], [false, 1, [true, false]]);
});

test("Esc kapanışı (kilitle=false) kilit İSTEMEZ: tarayıcı Esc'ten hemen sonra kilidi reddeder", () => {
  const { kip, sayac } = duzenek();
  kip.ac();
  assert.equal(kip.kapat(false), true);
  assert.deepEqual([kip.acik, sayac.iste], [false, 0]);
});

test("engelliyken AÇILMAZ (odak, sohbet, onay): kilit de bırakılmaz", () => {
  const { kip, sayac } = duzenek(true);
  assert.equal(kip.degistir(), false);
  assert.deepEqual([kip.acik, sayac.birak, sayac.degisim], [false, 0, []]);
});

test("açıkken engel çıkarsa KAPANMAZ ama kapatılabilir (engel yalnız açmayı durdurur)", () => {
  const { kip, sayac } = duzenek();
  kip.ac();
  sayac.engelli = true;
  assert.equal(kip.acik, true);
  assert.equal(kip.degistir(), true);
  assert.equal(kip.acik, false);
});

test("zaten açıkken ac(), zaten kapalıyken kapat() değişiklik yapmaz ve bildirmez", () => {
  const { kip, sayac } = duzenek();
  assert.equal(kip.kapat(), false);
  kip.ac();
  assert.equal(kip.ac(), false);
  assert.deepEqual([sayac.birak, sayac.degisim], [1, [true]]);
});
