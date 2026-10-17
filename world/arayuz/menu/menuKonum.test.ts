// world/arayuz/menu/menuKonum.test.ts — kök ve alt liste konumu: sağa aç, sığmazsa sola, ikisi de sığmazsa ekrana çek.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { altKonumu, kokKonumu } from "./menuKonum.ts";

const EKRAN = { en: 1000, boy: 600 };
const ata = { sol: 100, ust: 100, en: 200, boy: 150 };

test("kök: imleç konumuna konur", () => {
  assert.deepEqual(kokKonumu(300, 200, 200, 150, EKRAN.en, EKRAN.boy), { sol: 300, ust: 200 });
});

test("kök: sağ/alt kenara taşarsa içeri çekilir; sol/üst kenarda pay kalır", () => {
  assert.deepEqual(kokKonumu(950, 580, 200, 150, EKRAN.en, EKRAN.boy), { sol: 792, ust: 442 });
  assert.deepEqual(kokKonumu(0, 0, 200, 150, EKRAN.en, EKRAN.boy), { sol: 8, ust: 8 });
});

test("alt liste: sağda yer varsa SAĞA açılır, ata listeyle 3 px bindirir", () => {
  const k = altKonumu(ata, 120, 180, 100, EKRAN.en, EKRAN.boy);
  assert.deepEqual(k, { sol: 297, ust: 120, yon: "sag" });
});

test("alt liste: sağda yer yoksa SOLA döner", () => {
  const sagda = { sol: 700, ust: 100, en: 200, boy: 150 };   // sağ kenar 900, alt liste 180 → 897+180 > 992
  const k = altKonumu(sagda, 120, 180, 100, EKRAN.en, EKRAN.boy);
  assert.equal(k.yon, "sol");
  assert.equal(k.sol, 700 - 180 + 3);
});

test("alt liste: dikeyde alta taşarsa yukarı çekilir, üst pay korunur", () => {
  assert.equal(altKonumu(ata, 560, 180, 100, EKRAN.en, EKRAN.boy).ust, 492);
  assert.equal(altKonumu(ata, -20, 180, 100, EKRAN.en, EKRAN.boy).ust, 8);
});

test("alt liste: ne sağa ne sola sığıyorsa ekrana yaslanır (taşmaz)", () => {
  const dar = { sol: 20, ust: 0, en: 100, boy: 100 };   // ekran 150 genişliğinde, alt liste 140
  const k = altKonumu(dar, 0, 140, 50, 150, 600);
  assert.ok(k.sol >= 8 && k.sol + 140 <= 150 - 8 + 1e-9 || k.sol === 8, JSON.stringify(k));
});
