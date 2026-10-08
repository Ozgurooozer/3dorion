// mind/hafizaGorunumu.test.ts — Hafıza bulutunun kelimeleri gerçek kayıtlardan (spec 13 Faz 5).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { hafizaKelimeleri, type HafizaGirdisi } from "./hafizaGorunumu.ts";
import { AnlikBenlik } from "./benlik.ts";
import type { Ani } from "./hafiza.ts";

const SIMDI = 10 * 24 * 3600_000;
const ani = (metin: string, onem: number, gunOnce: number): Ani =>
  ({ metin, tur: "konusma", onem, olusma: SIMDI - gunOnce * 24 * 3600_000, sonErisim: SIMDI - gunOnce * 24 * 3600_000 });

function girdi(ek: Partial<HafizaGirdisi> = {}): HafizaGirdisi {
  const b = new AnlikBenlik({ simdi: () => SIMDI });
  return {
    icguduler: [{ id: "onay.insan", aciklama: "Komut yalnız Ozyn'in tuşuyla", ezilebilir: false }],
    benlik: b.oku(), calisma: [], gecmis: [], derin: [], getirilen: [], simdi: SIMDI, ...ek,
  };
}

test("SABİT: her içgüdü bir kelime, açıklamasıyla", () => {
  const k = hafizaKelimeleri(girdi()).filter((x) => x.kabuk === 0);
  assert.deepEqual(k.map((x) => [x.metin, x.not.includes("Komut yalnız")]), [["onay.insan", true]]);
});

test("ANLIK: benliğin yaptığı ve konuşma penceresi", () => {
  const b = new AnlikBenlik({ simdi: () => SIMDI });
  b.niyetGonderildi("n_1", { tur: "git", hedef: { tip: "capa", ad: "tahta" } });
  const k = hafizaKelimeleri(girdi({ benlik: b.oku(), gecmis: [{ rol: "kullanici", metin: "tahtaya git" }] })).filter((x) => x.kabuk === 1);
  assert.deepEqual(k.map((x) => x.metin), ["git → tahta", "tahtaya git"]);
});

test("ANLIK: durum defteri satırları kalıcı diye işaretli görünür (spec 16 F2)", () => {
  const k = hafizaKelimeleri(girdi({ durum: [{ anahtar: "konum", deger: "beyaz tahta", t: SIMDI - 4 * 60_000 }] })).filter((x) => x.kabuk === 1);
  assert.deepEqual([k[0]?.metin, k[0]?.not.startsWith("durum defteri (kalıcı"), k[0]?.sayi], ["konum: beyaz tahta", true, "4 minutes"]);
});

test("DERİN: bu turda getirilen anı kırmızı ve sınırdan bağımsız hep görünür", () => {
  const derin = [ani("çok önemli", 10, 0), ani("az önemli eski", 1, 9), ani("getirilen", 2, 8)];
  const getirilen = [{ ani: derin[2]!, skor: 0.81, parca: { tazelik: 0.1, onem: 0.2, ilgi: 0.9 } }];
  const k = hafizaKelimeleri(girdi({ derin, getirilen, enFazlaDerin: 1 })).filter((x) => x.kabuk === 2);
  assert.deepEqual(k.map((x) => [x.metin, x.kirmizi ?? false, x.sayi]), [["getirilen", true, "0.81"]]);
});

test("DERİN: önem boyuta, yaş soluklığa döner (yeni ve önemli: büyük ve canlı)", () => {
  const k = hafizaKelimeleri(girdi({ derin: [ani("yeni önemli", 9, 0), ani("eski", 2, 9)] })).filter((x) => x.kabuk === 2);
  const [yeni, eski] = [k.find((x) => x.metin === "yeni önemli")!, k.find((x) => x.metin === "eski")!];
  assert.ok(yeni.boyut > eski.boyut && yeni.soluk < eski.soluk, JSON.stringify([yeni, eski]));
});

test("DERİN: sınır kadar anı (en önemli ve taze olanlar)", () => {
  const derin = Array.from({ length: 100 }, (_, i) => ani(`anı ${i}`, i % 10, i % 9));
  assert.equal(hafizaKelimeleri(girdi({ derin, enFazlaDerin: 60 })).filter((x) => x.kabuk === 2).length, 60);
});

test("uzun metin bulutta kısalır, kutuda tam kalır", () => {
  const uzun = "Ozyn bugün tahtaya uzun bir matematik formülü yazmamı istedi ve ben yazdım";
  const k = hafizaKelimeleri(girdi({ derin: [ani(uzun, 5, 1)] })).find((x) => x.kabuk === 2)!;
  assert.ok(k.metin.length <= 26 && k.not.includes(uzun), k.metin);
});
