// mind/ogretim.test.ts — Öğretim satırı ve kayıttan yeniden kurulan kural hafızası (toplantı 2026-09-27 K5).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AlgiSatiri, OgretimSatiri } from "./kararKaydi.ts";
import { deneyimKimligi, kuralHafizasiKur, ogretimKur } from "./ogretim.ts";

const ELLE: string[] = ["durum:hata", "icgudu:refleks.sonuc.hata", "k:zaten", "niyet_kaynagi:elle", "tur:sonuc"];

const algi = (ek: Partial<AlgiSatiri> = {}): AlgiSatiri => ({
  tur: "algi", o: "o1", id: "a14", t: 100, algi: "sonuc", ozet: "Intent elle_x → hata",
  kapi: { gecti: true, kural: "refleks.sonuc.hata" }, isaret: ELLE, golge: null, ...ek,
});

const ogretim = (t: number, yon: "uyan" | "sus", isaret = ELLE, id = `a${t}`): OgretimSatiri =>
  ({ tur: "ogretim", o: "ogret", t, hedef: { o: "o1", id }, yon, kaynak: "ozyn", isaret });

test("öğretim satırı hedef algıya bağlanır ve onun durum kodunu kopyalar", () => {
  const s = ogretimKur(algi(), "sus", "ogret", 200);
  assert.deepEqual(s, { tur: "ogretim", o: "ogret", t: 200, hedef: { o: "o1", id: "a14" }, yon: "sus", kaynak: "ozyn", isaret: ELLE });
});

test("öğretim satırının durum kodu algınınkinin kopyasıdır, aynı dizi değil", () => {
  const a = algi();
  const s = ogretimKur(a, "sus", "ogret", 200) as OgretimSatiri;
  assert.notEqual(s.isaret, a.isaret);
});

test("öğrenilemez algıya (durum kodu yok) öğretim kurulmaz — güvenlik içgüdüsü öğretilemez", () => {
  const s = ogretimKur(algi({ isaret: undefined, kapi: { gecti: true, kural: "kopru.konusma" } }), "sus", "ogret", 200);
  assert.ok("hata" in s && s.hata.includes("kopru.konusma"), JSON.stringify(s));
});

test("deneyim kimliği hedefin oturumu ve kimliğidir", () => {
  assert.equal(deneyimKimligi(ogretim(5, "sus")), "o1/a5");
});

test("yeniden kurulum: öğretimler hafızaya uygulanır, kanıt olarak hedefler görünür", () => {
  const { hafiza, uygulanan } = kuralHafizasiKur([ogretim(1, "sus"), ogretim(2, "sus")]);
  assert.deepEqual({ uygulanan, karar: hafiza.karar(ELLE)?.yon, kanit: hafiza.noronlar[0]!.kanit }, { uygulanan: 2, karar: "sus", kanit: ["o1/a1", "o1/a2"] });
});

test("yeniden kurulum zaman sırasıyla oynatır — kayıttaki sıra değil", () => {
  // Önce "sus" (t=1), sonra iki "uyan" (t=2, 3): sayaç 1 sus / 2 uyan → karar yok (pay 0,67).
  // Satırlar ters sırada verilse de sonuç aynı olmalı; ama kanıt listesi zaman sırasında.
  const { hafiza } = kuralHafizasiKur([ogretim(3, "uyan"), ogretim(1, "sus"), ogretim(2, "uyan")]);
  assert.deepEqual(hafiza.noronlar[0]!.kanit, ["o1/a1", "o1/a2", "o1/a3"]);
});

test("eşit zamanda kayıttaki sıra korunur (kararlı sıralama)", () => {
  const { hafiza } = kuralHafizasiKur([ogretim(7, "sus", ELLE, "birinci"), ogretim(7, "sus", ELLE, "ikinci")]);
  assert.deepEqual(hafiza.noronlar[0]!.kanit, ["o1/birinci", "o1/ikinci"]);
});

test("öğretim olmayan satırlar yok sayılır; bozuk öğretim satırı atlanır ve sebebi söylenir", () => {
  const bozuk = { tur: "ogretim", o: "x", t: 1, hedef: { o: "o1" }, yon: "belki", isaret: [] };
  const { uygulanan, atlanan } = kuralHafizasiKur([algi(), { tur: "oturum", o: "o1" }, bozuk, ogretim(2, "sus")]);
  assert.deepEqual({ uygulanan, atlanan: atlanan.map((a) => a.sebep) }, { uygulanan: 1, atlanan: ["bozuk öğretim satırı"] });
});

test("boş durum kodlu öğretim atlanır", () => {
  const { uygulanan, atlanan } = kuralHafizasiKur([ogretim(1, "sus", [])]);
  assert.deepEqual({ uygulanan, atlanan: atlanan.map((a) => a.sebep) }, { uygulanan: 0, atlanan: ["boş durum kodu"] });
});

test("aynı kayıt, aynı hafıza: yeniden kurulum belirlenimci", () => {
  const satirlar = [ogretim(1, "sus"), ogretim(2, "uyan", ["tur:terminal", "icgudu:refleks.terminal.kod_rutin", "kod:0", "k:tests"]), ogretim(3, "sus")];
  assert.equal(JSON.stringify(kuralHafizasiKur(satirlar).hafiza.noronlar), JSON.stringify(kuralHafizasiKur(satirlar).hafiza.noronlar));
});
