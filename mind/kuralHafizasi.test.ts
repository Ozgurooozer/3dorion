// mind/kuralHafizasi.test.ts — Büyüyen kural hafızası: tek deneme, genelleme, istisna, unutmama.
//
// Kodlar elle yazılmış küçük işaret kümeleri: davranışı görünür kılmak için.
// Gerçek kodlarla uçtan uca sınama öğrenen kapı deneyinde (tools/kapi-deney.ts).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KuralHafizasi } from "./kuralHafizasi.ts";

// Aynı içgüdünün iki gürültü çıktısı: çok ortak işaret.
const NPM_UYARI_1 = ["tur:terminal", "icgudu:refleks.terminal.gurultu", "kod:yok", "k:npm", "k:warn", "k:deprecated", "k:inflight"];
const NPM_UYARI_2 = ["tur:terminal", "icgudu:refleks.terminal.gurultu", "kod:yok", "k:npm", "k:warn", "k:deprecated", "k:glob"];
// Elle verilen niyetin hatası ve LLM'in kendi niyetinin hatası: yalnız kaynak farklı.
const ELLE_HATA = ["tur:sonuc", "icgudu:refleks.sonuc.hata", "durum:hata", "niyet_kaynagi:elle", "k:zaten", "k:ayaktasın"];
const LLM_HATA = ["tur:sonuc", "icgudu:refleks.sonuc.hata", "durum:hata", "niyet_kaynagi:n", "k:zaten", "k:ayaktasın"];

test("boş hafıza karar vermez — kapı içgüdüye bırakır", () => {
  assert.equal(new KuralHafizasi().karar(NPM_UYARI_1), null);
});

test("TEK DENEME: bir öğretmen kararından sonra aynı durum o kararla verilir", () => {
  const h = new KuralHafizasi();
  h.ogren(NPM_UYARI_1, "sus", "d1");
  assert.equal(h.karar(NPM_UYARI_1)?.yon, "sus");
});

test("yeni durum yeni nöron doğurur; koşulu durumun tüm kodudur", () => {
  const h = new KuralHafizasi();
  const [olay] = h.ogren(NPM_UYARI_1, "sus", "d1");
  assert.deepEqual(olay, { tur: "dogdu", noron: "K1", kosul: [...NPM_UYARI_1].sort(), yon: "sus", deneyim: "d1" });
});

test("aynı durumun tekrarı yeni nöron doğurmaz, sayacı artırır ve kanıtı ekler", () => {
  const h = new KuralHafizasi();
  h.ogren(NPM_UYARI_1, "sus", "d1");
  const [olay] = h.ogren([...NPM_UYARI_1].reverse(), "sus", "d2");
  assert.deepEqual(
    { olay: olay?.tur, noron: h.noronlar.length, sayac: h.noronlar[0]!.sayac, kanit: h.noronlar[0]!.kanit },
    { olay: "tekrar", noron: 1, sayac: { uyan: 0, sus: 2 }, kanit: ["d1", "d2"] },
  );
});

test("benzer durum aynı kararla gelirse kural genelleşir: koşul ortak işaretlere iner", () => {
  const h = new KuralHafizasi();
  h.ogren(NPM_UYARI_1, "sus", "d1");
  const [olay] = h.ogren(NPM_UYARI_2, "sus", "d2");
  assert.deepEqual(
    { olay: olay?.tur, kosul: h.noronlar[0]!.kosul },
    { olay: "genelledi", kosul: ["icgudu:refleks.terminal.gurultu", "k:deprecated", "k:npm", "k:warn", "kod:yok", "tur:terminal"] },
  );
});

test("genelleşen kural, hiç görülmemiş ama koşulunu taşıyan durumu da verir", () => {
  const h = new KuralHafizasi();
  h.ogren(NPM_UYARI_1, "sus", "d1");
  h.ogren(NPM_UYARI_2, "sus", "d2");
  const yeni = ["tur:terminal", "icgudu:refleks.terminal.gurultu", "kod:yok", "k:npm", "k:warn", "k:deprecated", "k:rimraf"];
  assert.equal(h.karar(yeni)?.yon, "sus");
});

test("benzemeyen durum (benzerlik uyanıklığın altında) kuralı genelleştirmez, yeni nöron doğurur", () => {
  const h = new KuralHafizasi();
  h.ogren(NPM_UYARI_1, "sus", "d1");
  const baska = ["tur:terminal", "icgudu:refleks.terminal.gurultu", "kod:yok", "k:dist", "k:assets", "k:gzip", "k:index"];
  h.ogren(baska, "sus", "d2");
  assert.deepEqual(h.noronlar.map((n) => n.kosul.length), [7, 7]);
});

test("İSTİSNA: benzer ama zıt kararlı durum ayrı bir nöron doğurur; eski kural bozulmaz", () => {
  const h = new KuralHafizasi();
  h.ogren(ELLE_HATA, "sus", "d1");
  h.ogren(LLM_HATA, "uyan", "d2");
  assert.deepEqual(
    { elle: h.karar(ELLE_HATA)?.yon, llm: h.karar(LLM_HATA)?.yon, noron: h.noronlar.length },
    { elle: "sus", llm: "uyan", noron: 2 },
  );
});

test("en özgül kural karar verir: genel kural ile istisnası birlikte eşleşince istisna kazanır", () => {
  const h = new KuralHafizasi();
  const genel = ["tur:sonuc", "icgudu:refleks.sonuc.hata", "durum:hata"];
  h.ogren(genel, "uyan", "d1");
  h.ogren(ELLE_HATA, "sus", "d2");   // koşulu genelin üst kümesi: daha özgül
  assert.deepEqual({ elle: h.karar(ELLE_HATA)?.yon, genel: h.karar(genel)?.yon }, { elle: "sus", genel: "uyan" });
});

test("UNUTMAMA: sonradan öğrenilen başka durumlar eski kararı değiştirmez", () => {
  const h = new KuralHafizasi();
  h.ogren(ELLE_HATA, "sus", "d1");
  for (let i = 0; i < 30; i++) h.ogren(["tur:terminal", "icgudu:refleks.terminal.kod_hata", "kod:hata", `k:hata${i}`], "uyan", `t${i}`);
  assert.equal(h.karar(ELLE_HATA)?.yon, "sus");
});

test("çelişen öğretmen kararları güveni düşürür: 1'e 1'de karar yok", () => {
  const h = new KuralHafizasi();
  h.ogren(NPM_UYARI_1, "sus", "d1");
  h.ogren(NPM_UYARI_1, "uyan", "d2");
  assert.equal(h.karar(NPM_UYARI_1), null);
});

test("güven payı: 3'e 1 çoğunluk (0,75) karar verir, 2'ye 1 (0,67) vermez", () => {
  const h = new KuralHafizasi();
  for (const [i, y] of (["sus", "sus", "uyan"] as const).entries()) h.ogren(NPM_UYARI_1, y, `d${i}`);
  const ikiyeBir = h.karar(NPM_UYARI_1);
  h.ogren(NPM_UYARI_1, "sus", "d9");
  assert.deepEqual({ ikiyeBir, ucteBir: h.karar(NPM_UYARI_1)?.yon }, { ikiyeBir: null, ucteBir: "sus" });
});

test("genelleşme koşulu en az iki işarete kadar indirir, daha aza değil", () => {
  const h = new KuralHafizasi({ uyaniklik: 0.3 });
  h.ogren(["tur:olay", "icgudu:x", "k:a", "k:b"], "sus", "d1");
  h.ogren(["tur:olay", "k:c", "k:d"], "sus", "d2");  // ortak yalnız "tur:olay": genelleşemez
  assert.deepEqual(h.noronlar.map((n) => n.kosul.length), [4, 3]);
});

test("boş kod ne öğrenir ne karar verir", () => {
  const h = new KuralHafizasi();
  assert.deepEqual({ olay: h.ogren([], "sus", "d1"), noron: h.noronlar.length, karar: h.karar([]) }, { olay: [], noron: 0, karar: null });
});

test("her kararın arkasındaki nöron ve kanıtı görünür — izlenebilirlik", () => {
  const h = new KuralHafizasi();
  h.ogren(ELLE_HATA, "sus", "a14");
  h.ogren(ELLE_HATA, "sus", "a19");
  const k = h.karar(ELLE_HATA)!;
  assert.deepEqual({ noron: k.noron.id, kanit: k.noron.kanit, pay: k.pay }, { noron: "K1", kanit: ["a14", "a19"], pay: 1 });
});

test("belirlenimci: aynı olay dizisi aynı hafızayı kurar", () => {
  const kur = () => {
    const h = new KuralHafizasi();
    h.ogren(NPM_UYARI_1, "sus", "d1"); h.ogren(NPM_UYARI_2, "sus", "d2"); h.ogren(ELLE_HATA, "sus", "d3"); h.ogren(LLM_HATA, "uyan", "d4");
    return JSON.stringify(h.noronlar);
  };
  assert.equal(kur(), kur());
});

// ── Karar anında kapsama (H-K1) ────────────────────────────────────────────

test("kapsama eşiği varsayılan 0: genel kural, kendinden çok daha zengin bir algıda da karar verir (eski davranış)", () => {
  const h = new KuralHafizasi();
  h.ogren(["tur:terminal", "icgudu:x", "k:a"], "sus", "d1");
  h.ogren(["tur:terminal", "icgudu:x", "k:b"], "sus", "d2");   // genelleşir: {tur, icgudu}
  const zengin = ["tur:terminal", "icgudu:x", "k:c", "k:d", "k:e", "k:f", "k:g", "k:h"];
  assert.equal(h.karar(zengin)?.yon, "sus");
});

test("kapsama eşiği 0,5: kural algının yarısından azını kapsıyorsa karar yok — kapı içgüdüye bırakır", () => {
  const h = new KuralHafizasi({ kapsamaEsigi: 0.5 });
  h.ogren(["tur:terminal", "icgudu:x", "k:a"], "sus", "d1");
  h.ogren(["tur:terminal", "icgudu:x", "k:b"], "sus", "d2");
  const zengin = ["tur:terminal", "icgudu:x", "k:c", "k:d", "k:e", "k:f", "k:g", "k:h"];
  assert.equal(h.karar(zengin), null);
});

test("kapsama eşiği tek denemeyi bozmaz: aynı durum tam kapsanır (1,0)", () => {
  const h = new KuralHafizasi({ kapsamaEsigi: 0.5 });
  h.ogren(ELLE_HATA, "sus", "d1");
  assert.equal(h.karar(ELLE_HATA)?.yon, "sus");
});

test("kapsama sınırı: tam 0,5 kapsanan algıda karar verir", () => {
  const h = new KuralHafizasi({ kapsamaEsigi: 0.5 });
  h.ogren(["tur:olay", "icgudu:y", "k:a", "k:b"], "uyan", "d1");
  h.ogren(["tur:olay", "icgudu:y", "k:a", "k:c"], "uyan", "d2");   // {tur, icgudu, k:a}
  assert.equal(h.karar(["tur:olay", "icgudu:y", "k:a", "k:x", "k:y", "k:z"])?.yon, "uyan");
});
