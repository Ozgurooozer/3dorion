// uygulama/ajanlar/ajanAlgisi.test.ts — Flash'ın gözü: dünya olayları AJANIN gövdesine göre üretilir (saf, Babylon yok).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Niyet } from "../../protocol/niyet.ts";
import type { Algi, OrionDurumu, OyuncuDurumu } from "../../protocol/algi.ts";
import type { NpcTepkisi } from "../../flash/npcTanimi.ts";
import { ajandanOyuncu, ajanAlgisiKur } from "./ajanAlgisi.ts";

function ozyn(x: number, ek: Partial<OyuncuDurumu> = {}): OyuncuDurumu {
  // Ozyn (x, göz 1.7, 0), −x yönüne bakıyor; `mesafe`/`bakiyor` ORION'a göre ham değer: ajan bunları kullanmamalı.
  return { konum: { x, y: 1.7, z: 0 }, bakis: { x: -1, y: 0, z: 0 }, bakiyor: false, mesafe: 99, etkilesim: null, ...ek };
}
function beden(x: number, mesgul = false): { durum(): OrionDurumu } {
  return { durum: () => ({ konum: { x, y: 0, z: 0 }, bakis: { x: 1, y: 0, z: 0 }, poz: "duruyor", mesgul, elinde: null, oturuyor_mu: false }) };
}
const adlar = (l: readonly Algi[]): string[] => l.map((a) => (a.tur === "olay" ? a.ad : a.tur));
const TEPKI: NpcTepkisi[] = [{ olay: "ozyn_yaklasti", niyet: { tur: "bak", hedef: { tip: "oyuncu" } } }];

test("ajandanOyuncu: mesafe ve bakış AJANIN gövdesine göre, ham (Orion'a göre) değer yok sayılır", () => {
  const a = ajandanOyuncu(ozyn(4), { x: 1, y: 0, z: 0 });   // Ozyn x=4'te, −x'e bakıyor → x=1'deki gövdeye bakıyor
  assert.equal(a.bakiyor, true);
  assert.ok(Math.abs(a.mesafe - Math.hypot(3, 0.7)) < 1e-9, `mesafe ${a.mesafe}`);
});

test("ajandanOyuncu: arkasında kalan gövdeye 'bakmıyor'; konum, bakış ve etkileşim aynen kalır", () => {
  const ham = ozyn(4, { etkilesim: "monitor" });
  const a = ajandanOyuncu(ham, { x: 9, y: 0, z: 0 });
  assert.equal(a.bakiyor, false);
  assert.deepEqual([a.konum, a.bakis, a.etkilesim], [ham.konum, ham.bakis, "monitor"]);
});

test("aynı Ozyn, iki gövde: biri yakın biri uzak (olay gövdeye göre)", () => {
  const yakin = ajandanOyuncu(ozyn(2), { x: 1, y: 0, z: 0 });
  const uzak = ajandanOyuncu(ozyn(2), { x: -6, y: 0, z: 0 });
  assert.ok(yakin.mesafe < 1.8 && uzak.mesafe > 2.6);
});

test("Ozyn yaklaşınca köprüye 'olay' gider ve tepki niyeti bedene verilir", () => {
  const algilar: Algi[] = [], niyetler: Niyet[] = [];
  let ozynX = 6;
  const g = ajanAlgisiKur({ beden: () => beden(0), oyuncu: () => ozyn(ozynX), algi: (a) => algilar.push(a), tepkiler: TEPKI, niyet: (n) => niyetler.push(n) });
  g.tikle(0);                       // ilk örnek sessiz (başlangıç durumu, değişim değil)
  assert.deepEqual(algilar, []);
  ozynX = 1;
  g.tikle(100);
  assert.deepEqual(adlar(algilar), ["ozyn_yaklasti"]);
  assert.deepEqual(niyetler, [{ tur: "bak", hedef: { tip: "oyuncu" } }]);
});

test("beden meşgulken (yürüyor) köprüye haber gider ama tepki verilmez", () => {
  const algilar: Algi[] = [], niyetler: Niyet[] = [];
  let ozynX = 6;
  const g = ajanAlgisiKur({ beden: () => beden(0, true), oyuncu: () => ozyn(ozynX), algi: (a) => algilar.push(a), tepkiler: TEPKI, niyet: (n) => niyetler.push(n) });
  g.tikle(0); ozynX = 1; g.tikle(100);
  assert.equal(algilar.length, 1);
  assert.deepEqual(niyetler, []);
});

test("tepki tanımı yoksa yalnız algı gider (Orion'un köprüsü gibi)", () => {
  const algilar: Algi[] = [], niyetler: Niyet[] = [];
  let ozynX = 6;
  const g = ajanAlgisiKur({ beden: () => beden(0), oyuncu: () => ozyn(ozynX), algi: (a) => algilar.push(a), niyet: (n) => niyetler.push(n) });
  g.tikle(0); ozynX = 1; g.tikle(100);
  assert.deepEqual([algilar.length, niyetler.length], [1, 0]);
});

test("olay ABONESİ köprüyle AYNI olayı alır (tek üretici); sıra: köprü → tepki niyeti → abone", () => {
  const sira: string[] = [];
  let ozynX = 6;
  const g = ajanAlgisiKur({ beden: () => beden(0), oyuncu: () => ozyn(ozynX), algi: (a) => sira.push(`kopru:${a.tur === "olay" ? a.ad : a.tur}`), tepkiler: TEPKI, niyet: (n) => sira.push(`niyet:${n.tur}`) });
  const gelen: unknown[] = [];
  g.olayDinle((o) => { sira.push(`abone:${o.ad}`); gelen.push(o.ayrinti); });
  g.tikle(0); ozynX = 1; g.tikle(100);
  assert.deepEqual(sira, ["kopru:ozyn_yaklasti", "niyet:bak", "abone:ozyn_yaklasti"]);
  assert.equal(typeof (gelen[0] as { mesafe?: unknown }).mesafe, "number");
});

test("abonenin hatası köprüyü ve öteki aboneyi kesmez; çıkan abone olay almaz", () => {
  const algilar: Algi[] = [];
  let ozynX = 6;
  const g = ajanAlgisiKur({ beden: () => beden(0), oyuncu: () => ozyn(ozynX), algi: (a) => algilar.push(a) });
  const ikinci: string[] = [], cikan: string[] = [];
  g.olayDinle(() => { throw new Error("bozuk abone"); });
  g.olayDinle((o) => ikinci.push(o.ad));
  const cik = g.olayDinle((o) => cikan.push(o.ad));
  cik();
  const hata = console.error;
  console.error = () => {};
  try { g.tikle(0); ozynX = 1; g.tikle(100); } finally { console.error = hata; }
  assert.deepEqual([adlar(algilar), ikinci, cikan], [["ozyn_yaklasti"], ["ozyn_yaklasti"], []]);
});

test("gövde yoksa (yüklenmedi) hiçbir şey üretilmez", () => {
  const algilar: Algi[] = [];
  const g = ajanAlgisiKur({ beden: () => null, oyuncu: () => ozyn(1), algi: (a) => algilar.push(a) });
  g.tikle(0); g.tikle(100);
  assert.deepEqual(algilar, []);
});
