// tools/kapi-deney.test.ts — Kıyas düzeneği: ölçüler bilinen politikalarda kalibre, akış ve motorlar belirlenimci.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AniMotoru, IcguduIkizi, KuralMotoru, LojistikMotor, MantarMotoru,
  akisKur, icguduOgretmeni, kapiVeKod, karistir, olc, olcLezyonlu, rastgele, tohumlar, tutarsizOgretmen,
  type Akis, type Durum, type Etiketler,
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

test("rastgele: mulberry32 tohumlu (FNV-1a karmasının testi mind/ozet32.test.ts'te)", () => {
  assert.equal(rastgele(1)(), rastgele(1)());
});

test("kapı kararı ve durum kodu gerçek köprüden: kabuk hatası geçer, konuşma öğrenilemez", () => {
  const hata = kapiVeKod({ tur: "terminal", kuyruk: "PS C:\\x> gti status\ngti : The term 'gti' is not recognized", kesildi: false, kod: 1 });
  const soz = kapiVeKod({ tur: "duydum", metin: "merhaba", kesin: true });
  assert.deepEqual({ kural: hata?.kapi.kural, gecti: hata?.kapi.gecti, soz }, { kural: "refleks.terminal.kod_hata", gecti: true, soz: null });
});

// ── Çürütme bataryası ──────────────────────────────────────────────────────

test("olay başına etiket: aynı durum ardışık iki etiketle gelirse ezber ikinciyi bilemez", () => {
  // a dört kez; etiketler sırayla evet, hayır, evet, hayır.
  const akis: Akis = { olaylar: ["a", "a", "a", "a"], yeniler: new Set() };
  const o = olc(new AniMotoru(), akis, HAVUZ, (_id, t) => t % 2 === 0);
  assert.deepEqual({ ikinci: `${o.ikinciDogru}/${o.ikinciN}`, akilN: o.akilN }, { ikinci: "0/1", akilN: 0 });
});

test("tutarsız öğretmen belirlenimci, olay olay değişir, etiketsiz durumda null", () => {
  const e1 = tutarsizOgretmen(ETIKET, HAVUZ, 3), e2 = tutarsizOgretmen(ETIKET, HAVUZ, 3);
  const dizi1 = Array.from({ length: 40 }, (_, t) => e1("a", t)), dizi2 = Array.from({ length: 40 }, (_, t) => e2("a", t));
  assert.deepEqual(
    { ayni: JSON.stringify(dizi1) === JSON.stringify(dizi2), degisiyor: new Set(dizi1).size === 2, etiketsiz: e1("yok", 0) },
    { ayni: true, degisiyor: true, etiketsiz: null },
  );
});

test("içgüdü öğretmeni içgüdünün kararıdır", () => {
  assert.deepEqual(icguduOgretmeni(HAVUZ), { a: true, b: false, c: true });
});

test("lezyon: bütün dersler silinirse karar içgüdüye döner; hiçbiri silinmezse ezber korunur", () => {
  // a'yı öğretmen "sus" diye öğretiyor, içgüdü "uyan" diyor: fark görünür.
  const e: Etiketler = { a: false, b: false };
  // Beşinci olay (a) silmeden sonraki İKİNCİ görülüş: sayılmamalı.
  const akis: Akis = { olaylar: ["a", "b", "a", "b", "a"], yeniler: new Set() };
  const hepsi = olcLezyonlu(() => new AniMotoru(), akis, HAVUZ, e, 1, 1);
  const hic = olcLezyonlu(() => new AniMotoru(), akis, HAVUZ, e, 0, 1);
  assert.deepEqual(
    { silinen: `${hepsi.silinenDogru}/${hepsi.silinenN}`, silinenIcgudu: hepsi.silinenIcgudu, korunan: `${hic.korunanDogru}/${hic.korunanN}` },
    { silinen: "1/2", silinenIcgudu: 1, korunan: "2/2" },
  );
});

test("tohum listesi: aralık ve virgüllü liste", () => {
  assert.deepEqual([tohumlar("11-13"), tohumlar("1,5")], [[11, 12, 13], [1, 5]]);
});

test("Zipf üssü akışı gerçekten şekillendirir: 0'da düz (en sık / en seyrek ≤ 1,5), 2'de dik (≥ 3)", () => {
  const oran = (us: number) => {
    const say = new Map<string, number>();
    for (const id of akisKur(HAVUZ, 2, 600, 0, us).olaylar) say.set(id, (say.get(id) ?? 0) + 1);
    const v = [...say.values()];
    return Math.max(...v) / Math.min(...v);
  };
  const [duz, dik] = [oran(0), oran(2)];
  assert.ok(duz <= 1.5 && dik >= 3, `düz ${duz.toFixed(2)}, dik ${dik.toFixed(2)}`);
});

// ── H-K2: yeni son ölçüsü ve karar ölçüleri ────────────────────────────────

test("kalibrasyon, yeni son: kâhin her yeni durumda doğru; içgüdü ikizi içgüdünün kendisi (c'de yanlış)", () => {
  // c yeni; öğretmen "sus" diyor, içgüdü geçiriyor ("uyan").
  const kahin = olc("kahin", AKIS, HAVUZ, ETIKET), ic = olc(new IcguduIkizi(), AKIS, HAVUZ, ETIKET);
  assert.deepEqual(
    { kahin: `${kahin.yeniSonDogru}/${kahin.yeniN}`, icgudu: `${ic.yeniSonDogru}/${ic.yeniN}`, icguduOlcusu: ic.yeniIcguduDogru },
    { kahin: "1/1", icgudu: "0/1", icguduOlcusu: 0 },
  );
});

test("kalibrasyon, yeni son: hep-sus yeni c'de doğru, hep-uyan yanlış", () => {
  const sus = olc("hep-sus", AKIS, HAVUZ, ETIKET), uyan = olc("hep-uyan", AKIS, HAVUZ, ETIKET);
  assert.deepEqual({ sus: sus.yeniSonDogru, uyan: uyan.yeniSonDogru }, { sus: 1, uyan: 0 });
});

test("kural motorunun adları ayarını söyler", () => {
  const adlar = [new KuralMotoru(), new KuralMotoru({ kapsama: 0.5 }), new KuralMotoru({ olcu: "jaccard" }), new KuralMotoru({ olcu: "karma" })].map((m) => m.ad);
  assert.deepEqual(adlar, ["B kural", "B-K1 0.5", "B-J", "B-JT"]);
});

test("karar ölçüsü motora ulaşır: a'dan sonra b (Jaccard 2/4) B'de kararsız, B-J ve B-JT'de öğretilen yönde", () => {
  const karar = (m: KuralMotoru) => { m.ogren(HAVUZ[0]!.isaret, "uyan", "d1"); return m.karar(HAVUZ[1]!.isaret); };
  assert.deepEqual(
    { B: karar(new KuralMotoru()), BJ: karar(new KuralMotoru({ olcu: "jaccard" })), BJT: karar(new KuralMotoru({ olcu: "karma" })) },
    { B: null, BJ: "uyan", BJT: "uyan" },
  );
});

test("kalibrasyon, yeni son: içgüdü ölçüsü politikadan bağımsız — kâhinde de içgüdünün kendi doğrusu (c'de 0)", () => {
  assert.equal(olc("kahin", AKIS, HAVUZ, ETIKET).yeniIcguduDogru, 0);
});
