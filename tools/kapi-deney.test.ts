// tools/kapi-deney.test.ts — Kıyas düzeneği: ölçüler bilinen politikalarda kalibre, akış ve motorlar belirlenimci.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AniMotoru, IcguduIkizi, KuralMotoru, LojistikMotor, MantarMotoru,
  akisKur, kapiVeKod, karistir, olc, ozet32, rastgele, type Akis, type Durum, type Etiketler,
} from "./kapi-deney.ts";

/** Üç durumlu oyuncak havuz: a ve c içgüdüden geçer, b düşer. */
const HAVUZ: Durum[] = [
  { id: "a", kaynak: "terminal", aile: "x", algi: { tur: "terminal", kuyruk: "a", kesildi: false }, kapi: { gecti: true, kural: "refleks.terminal.hata_deseni" }, isaret: ["tur:terminal", "k:alfa", "k:ortak"] },
  { id: "b", kaynak: "terminal", aile: "x", algi: { tur: "terminal", kuyruk: "b", kesildi: false }, kapi: { gecti: false, kural: "refleks.terminal.gurultu" }, isaret: ["tur:terminal", "k:beta", "k:ortak"] },
  { id: "c", kaynak: "terminal", aile: "x", algi: { tur: "terminal", kuyruk: "c", kesildi: false }, kapi: { gecti: true, kural: "refleks.terminal.hata_deseni" }, isaret: ["tur:terminal", "k:gama"] },
];
const ETIKET: Etiketler = { a: true, b: false, c: false };
const AKIS: Akis = { olaylar: ["a", "b", "a", "c", "b", "c"], yeniler: new Set(["c"]) };

test("kalibrasyon: hep-uyan hiç kaçırmaz, boşası öğretmenin 'sus' dediği olay sayısıdır", () => {
  const o = olc("hep-uyan", AKIS, HAVUZ, ETIKET);
  assert.deepEqual({ kacir: o.kacir, bosa: o.bosa, n: o.n }, { kacir: 0, bosa: 4, n: 6 });
});

test("kalibrasyon: hep-sus hiç boşa uyandırmaz, kaçırdığı öğretmenin 'uyan' dediği olay sayısıdır", () => {
  const o = olc("hep-sus", AKIS, HAVUZ, ETIKET);
  assert.deepEqual({ kacir: o.kacir, bosa: o.bosa }, { kacir: 2, bosa: 0 });
});

test("kalibrasyon: kâhin her olayda doğrudur", () => {
  const o = olc("kahin", AKIS, HAVUZ, ETIKET);
  assert.deepEqual({ dogru: o.dogru, n: o.n, bosa: o.bosa, kacir: o.kacir }, { dogru: 6, n: 6, bosa: 0, kacir: 0 });
});

test("içgüdü ikizi içgüdünün kararını verir: c'de öğretmenle ayrışır (2 boşa)", () => {
  const o = olc(new IcguduIkizi(), AKIS, HAVUZ, ETIKET);
  assert.deepEqual({ dogru: o.dogru, bosa: o.bosa, kacir: o.kacir }, { dogru: 4, bosa: 2, kacir: 0 });
});

test("ikinci görülüş ölçüsü yalnız ikinci olayları sayar", () => {
  const o = olc("kahin", AKIS, HAVUZ, ETIKET);
  assert.equal(o.ikinciN, 3);
});

test("sıralı ölçüm: ilk görülüşte ders henüz yok — tam anı c'yi ilk görüşte bilemez", () => {
  const o = olc(new AniMotoru(), AKIS, HAVUZ, ETIKET);
  assert.deepEqual({ yeniN: o.yeniN, yeniKarar: o.yeniKarar }, { yeniN: 1, yeniKarar: 0 });
});

test("TEK DENEME: bir dersten sonra kural, anı ve mantar gövdesi aynı durumu öğretilen yönde verir", () => {
  for (const m of [new KuralMotoru(), new AniMotoru(), new MantarMotoru()]) {
    m.ogren(HAVUZ[1]!.isaret, "sus", "d1");
    assert.equal(m.karar(HAVUZ[1]!.isaret), "sus", m.ad);
  }
});

test("lojistik tek dersle emin olmaz (payı 0,75'i geçmez) — tek denemede öğrenmez", () => {
  const m = new LojistikMotor();
  m.ogren(HAVUZ[1]!.isaret, "sus", "d1");
  assert.equal(m.karar(HAVUZ[1]!.isaret), null);
});

test("akış belirlenimci: aynı tohum aynı sırayı verir", () => {
  const havuz = Array.from({ length: 20 }, (_, i): Durum => ({ ...HAVUZ[0]!, id: `d${i}`, aile: i % 2 ? "x" : "y" }));
  assert.deepEqual(akisKur(havuz, 3, 50).olaylar, akisKur(havuz, 3, 50).olaylar);
});

test("akış: yeni durumlar yalnız ikinci yarıda görünür ve her aileden ~%20'dir", () => {
  const havuz = Array.from({ length: 20 }, (_, i): Durum => ({ ...HAVUZ[0]!, id: `d${i}`, aile: i % 2 ? "x" : "y" }));
  const a = akisKur(havuz, 5, 200);
  const ilkYari = new Set(a.olaylar.slice(0, 100));
  assert.deepEqual({ yeni: a.yeniler.size, ilkYaridaYeni: [...a.yeniler].filter((id) => ilkYari.has(id)).length }, { yeni: 4, ilkYaridaYeni: 0 });
});

test("karıştırılmış öğretmen etiketlerin çokluğunu korur ve belirlenimcidir", () => {
  const e = karistir(ETIKET, HAVUZ, 9);
  const say = (x: Etiketler) => Object.values(x).filter(Boolean).length;
  assert.deepEqual({ evet: say(e), ayni: JSON.stringify(e) === JSON.stringify(karistir(ETIKET, HAVUZ, 9)) }, { evet: say(ETIKET), ayni: true });
});

test("mantar gövdesi kodu en çok 100 hücre ve aynı tohumla aynıdır", () => {
  const a = new MantarMotoru(7).kod(HAVUZ[0]!.isaret), b = new MantarMotoru(7).kod(HAVUZ[0]!.isaret);
  assert.deepEqual({ uzunluk: a.length <= 100 && a.length > 0, ayni: JSON.stringify(a) === JSON.stringify(b) }, { uzunluk: true, ayni: true });
});

test("karma ve rastgele: FNV-1a bilinen değerler; mulberry32 tohumlu", () => {
  assert.deepEqual([ozet32(""), ozet32("a"), rastgele(1)() === rastgele(1)()], [0x811c9dc5, 0xe40c292c, true]);
});

test("kapı kararı ve durum kodu gerçek köprüden: kabuk hatası geçer, konuşma öğrenilemez", () => {
  const hata = kapiVeKod({ tur: "terminal", kuyruk: "PS C:\\x> gti status\ngti : The term 'gti' is not recognized", kesildi: false, kod: 1 });
  const soz = kapiVeKod({ tur: "duydum", metin: "merhaba", kesin: true });
  assert.deepEqual({ kural: hata?.kapi.kural, gecti: hata?.kapi.gecti, soz }, { kural: "refleks.terminal.kod_hata", gecti: true, soz: null });
});
