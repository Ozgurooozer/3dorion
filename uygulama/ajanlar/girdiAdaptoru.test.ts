// uygulama/ajanlar/girdiAdaptoru.test.ts — tek girdi, çok ajan (spec 33 dilim 1).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Algi } from "../../protocol/algi.ts";
import { HEPSI, type AjanKaydi, type HedefSecimi } from "./ajanKaydi.ts";
import { girdiAdaptoruKur, hitapAyikla } from "./girdiAdaptoru.ts";

/** Gelen algıları biriktiren ajan. */
function dinleyenAjan(id: string): AjanKaydi & { gelen: Algi[] } {
  const gelen: Algi[] = [];
  return { id, ad: id, renk: "#ffffff", kume: null, algi: (a) => { gelen.push(a); }, gelen };
}

function kur(hedef: HedefSecimi) {
  const orion = dinleyenAjan("orion"), flash = dinleyenAjan("flash");
  const adaptor = girdiAdaptoruKur({ ajanlar: () => [orion, flash], hedef: () => hedef });
  return { orion, flash, adaptor };
}

test("Orion'a giden algı eskiden kopru.algi'ya giden nesnenin aynısıdır", () => {
  const { orion, adaptor } = kur("orion");
  adaptor.ilet("otur", "klavye");
  assert.deepEqual(orion.gelen, [{ tur: "duydum", metin: "otur", kesin: true, kaynak: "klavye" }]);
});

test("hedef Orion iken Flash sözü duymaz", () => {
  const { flash, adaptor } = kur("orion");
  adaptor.ilet("otur", "klavye");
  assert.equal(flash.gelen.length, 0);
});

test("mikrofon sözü kaynağıyla iletilir", () => {
  const { flash, adaptor } = kur("flash");
  adaptor.ilet("sit down", "mikrofon");
  assert.equal(flash.gelen[0]?.tur === "duydum" ? flash.gelen[0].kaynak : null, "mikrofon");
});

test("ikisi birden: iki ajan da sözü alır ve ikisi de döner", () => {
  const { adaptor } = kur(HEPSI);
  assert.deepEqual(adaptor.ilet("bana gel", "klavye").map((a) => a.id), ["orion", "flash"]);
});

test("ikisi birden: ajanlar AYRI algı nesnesi alır", () => {
  const { orion, flash, adaptor } = kur(HEPSI);
  adaptor.ilet("dur", "klavye");
  assert.notEqual(orion.gelen[0], flash.gelen[0]);
});

test("bir ajanın hatası öbürünü kesmez; hata veren alanlar listesine girmez", () => {
  const bozuk: AjanKaydi = { id: "orion", ad: "orion", renk: "#000000", kume: null, algi: () => { throw new Error("bozuk"); } };
  const flash = dinleyenAjan("flash");
  const adaptor = girdiAdaptoruKur({ ajanlar: () => [bozuk, flash], hedef: () => HEPSI });
  const hata = console.error; console.error = () => {};
  try { assert.deepEqual(adaptor.ilet("dur", "klavye").map((a) => a.id), ["flash"]); }
  finally { console.error = hata; }
});

test("hedefler() iletmeden kimin alacağını söyler (altyazı önce yazılabilsin)", () => {
  const { orion, flash, adaptor } = kur(HEPSI);
  const once = adaptor.hedefler().map((a) => a.id);
  assert.deepEqual([once, orion.gelen.length + flash.gelen.length], [["orion", "flash"], 0]);
});

test("hedef ajan kayıtlı değilse kimse almaz (boş döner)", () => {
  const { adaptor } = kur("yok");
  assert.deepEqual(adaptor.ilet("dur", "klavye"), []);
});

// ── Hitap: "Flash otur" ──

test("hitapAyikla: baştaki ad (büyük/küçük, virgüllü/virgülsüz) ayıklanır", () => {
  assert.deepEqual(["Flash otur", "flash, otur", "FLASH: otur", "  Flash   bana gel"].map((s) => hitapAyikla(s, "Flash")), ["otur", "otur", "otur", "bana gel"]);
});

test("hitapAyikla: ortadaki ad, tek başına ad ve başka ad DOKUNULMAZ", () => {
  assert.deepEqual(["otur flash", "Flash", "Orion otur", "flashlight aç"].map((s) => hitapAyikla(s, "Flash")), ["otur flash", "Flash", "Orion otur", "flashlight aç"]);
});

test("hitapAyikla: Türkçe harfli ad katlanarak eşleşir", () => {
  assert.equal(hitapAyikla("Işık otur", "ışık"), "otur");
});

test("hitap yalnız KAYDI isteyen ajanda ayıklanır: Flash'a 'Flash otur' → 'otur', Orion'a metin AYNEN gider", () => {
  const orion = dinleyenAjan("orion");
  const flash = { ...dinleyenAjan("flash"), hitapAyiklar: true };
  const adaptor = girdiAdaptoruKur({ ajanlar: () => [orion, flash], hedef: () => HEPSI });
  adaptor.ilet("Flash otur", "klavye");
  assert.deepEqual([orion.gelen.map((a) => (a.tur === "duydum" ? a.metin : "")), flash.gelen.map((a) => (a.tur === "duydum" ? a.metin : ""))], [["Flash otur"], ["otur"]]);
});
