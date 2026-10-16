// world/arayuz/nesnePaneli.test.ts — panelin SAF kısmı: görünüm modeli (özellikler, gruplar, gri düğme nedeni) ve ekrana sığdırma.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { panelModeli, panelKonumu, type PanelNesne, type PanelEylem } from "./nesnePaneli.ts";

const BANK: PanelNesne = { id: "bank", ad: "bank", tur: "mobilya", capa: "bank", kutu: { x: 4.6, y: 0.39, z: 6.6, g: 1.6, yuk: 0.88, d: 0.5 } };
const EYLEMLER: PanelEylem[] = [
  { kimlik: "orion.git", ad: "Yanına git", kim: "orion", uygun: true },
  { kimlik: "orion.otur", ad: "Otur", kim: "orion", uygun: false, neden: "Orion şimdilik yalnız ofis sandalyesine oturabilir" },
  { kimlik: "ozyn.otur", ad: "Otur", kim: "ozyn", uygun: true },
];

test("başlık nesnenin adı, altbaşlık tür ve çapa", () => {
  const m = panelModeli(BANK, EYLEMLER);
  assert.deepEqual([m.baslik, m.altbaslik], ["bank", "mobilya · çapa: bank"]);
});

test("çapasız nesnenin altbaşlığında çapa yazmaz; çapa satırı '—'", () => {
  const m = panelModeli({ ...BANK, id: "raf", ad: "raf", capa: null }, []);
  assert.equal(m.altbaslik, "mobilya");
  assert.deepEqual(m.ozellikler.find(([k]) => k === "Çapa"), ["Çapa", "—"]);
});

test("özellikler: kimlik, tür, çapa, konum (x, z ve yükseklik), boyut", () => {
  const o = Object.fromEntries(panelModeli(BANK, []).ozellikler);
  assert.deepEqual(o, { Kimlik: "bank", Tür: "mobilya", Çapa: "bank", Konum: "4.6, 6.6 (yükseklik 0.39)", Boyut: "1.6 × 0.5 × 0.88 m" });
});

test("Orion'a not varsa özelliklerde görünür, yoksa satır yok", () => {
  assert.equal(panelModeli(BANK, []).ozellikler.some(([k]) => k === "Orion'a not"), false);
  assert.deepEqual(panelModeli({ ...BANK, not: "Ozyn'in sevdiği bank" }, []).ozellikler.at(-1), ["Orion'a not", "Ozyn'in sevdiği bank"]);
});

test("iki grup: 'Orion yapsın' ve 'Ben yapayım', düğmeler kendi grubunda", () => {
  const g = panelModeli(BANK, EYLEMLER).gruplar;
  assert.deepEqual(g.map((x) => [x.baslik, x.dugmeler.map((d) => d.kimlik)]), [["Orion yapsın", ["orion.git", "orion.otur"]], ["Ben yapayım", ["ozyn.otur"]]]);
});

test("gri düğme nedenini taşır, uygun düğmenin nedeni null", () => {
  const d = panelModeli(BANK, EYLEMLER).gruplar[0]!.dugmeler;
  assert.deepEqual(d.map((x) => [x.uygun, x.neden]), [[true, null], [false, "Orion şimdilik yalnız ofis sandalyesine oturabilir"]]);
});

test("eylemi olmayan grup HİÇ görünmez (boş başlık yok)", () => {
  const g = panelModeli(BANK, EYLEMLER.filter((e) => e.kim === "orion")).gruplar;
  assert.deepEqual(g.map((x) => x.baslik), ["Orion yapsın"]);
});

test("panelKonumu: sığıyorsa imleç konumuna konur", () => {
  assert.deepEqual(panelKonumu(100, 120, 300, 200, 1280, 720), { sol: 100, ust: 120 });
});

test("panelKonumu: sağa/alta taşarsa içeri çekilir (pay kadar boşluk)", () => {
  assert.deepEqual(panelKonumu(1200, 700, 300, 200, 1280, 720), { sol: 1280 - 300 - 8, ust: 720 - 200 - 8 });
});

test("panelKonumu: eksi konum ekranın içine alınır", () => {
  assert.deepEqual(panelKonumu(-50, -50, 300, 200, 1280, 720), { sol: 8, ust: 8 });
});
