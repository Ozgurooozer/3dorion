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

// ── Karar anının benzerlik ölçüsü (H-K2) ───────────────────────────────────

const OLCULER = ["altkume", "jaccard", "karma"] as const;
// Öğretilen durum ve ondan bir içerik kelimesiyle ayrılan algı: Jaccard 5/7.
const OGRETILEN = ["tur:terminal", "icgudu:x", "kod:0", "k:a", "k:b", "k:c"];
const KISMI = ["tur:terminal", "icgudu:x", "kod:0", "k:a", "k:b", "k:d"];

test("jaccard: koşulunun bir işareti algıda olmayan ama benzer (5/7) kural karar verir", () => {
  const h = new KuralHafizasi({ kararOlcusu: "jaccard" });
  h.ogren(OGRETILEN, "sus", "d1");
  assert.equal(h.karar(KISMI)?.yon, "sus");
});

test("altküme aynı kısmi algıda karar vermez: koşulun bir işareti eksik", () => {
  const h = new KuralHafizasi();
  h.ogren(OGRETILEN, "sus", "d1");
  assert.equal(h.karar(KISMI), null);
});

test("jaccard: benzerlik 0,5'in altındaysa (2/5) karar yok — genel kural zengin algıda susar", () => {
  const h = new KuralHafizasi({ kararOlcusu: "jaccard" });
  h.ogren(["tur:terminal", "icgudu:x", "k:a"], "sus", "d1");
  h.ogren(["tur:terminal", "icgudu:x", "k:b"], "sus", "d2");   // genelleşir: {tur, icgudu}
  assert.equal(h.karar(["tur:terminal", "icgudu:x", "k:c", "k:d", "k:e"]), null);
});

test("jaccard eşik sınırı: tam 0,5'te (3/6) karar verir, 3/7'de vermez", () => {
  const h = new KuralHafizasi({ kararOlcusu: "jaccard" });
  h.ogren(["tur:olay", "icgudu:y", "k:a", "k:b"], "uyan", "d1");
  const sinirda = h.karar(["tur:olay", "icgudu:y", "k:a", "k:x", "k:y"])?.yon ?? null;
  const altinda = h.karar(["tur:olay", "icgudu:y", "k:a", "k:x", "k:y", "k:z"])?.yon ?? null;
  assert.deepEqual({ sinirda, altinda }, { sinirda: "uyan", altinda: null });
});

// Genel kural algıda tam bulunur ama azını kapsar (2/5); özgül kural kısmi eşleşir ama daha benzerdir (4/6).
function genelVeOzgul(kararOlcusu: (typeof OLCULER)[number]): KuralHafizasi {
  const h = new KuralHafizasi({ kararOlcusu });
  h.ogren(["tur:sonuc", "icgudu:z"], "uyan", "d1");
  h.ogren(["tur:sonuc", "icgudu:z", "k:a", "k:b", "k:c"], "sus", "d2");   // benzerlik 2/5 < 0,5: yeni nöron
  return h;
}
const GENEL_OZGUL_ALGI = ["tur:sonuc", "icgudu:z", "k:a", "k:b", "k:x"];

test("jaccard: en benzer kural, daha az benzer tam eşleşmeyi yener", () => {
  assert.equal(genelVeOzgul("jaccard").karar(GENEL_OZGUL_ALGI)?.yon, "sus");
});

test("karma: tam eşleşen kural algının yarısından azını kapsıyorsa en benzer kural konuşur", () => {
  assert.equal(genelVeOzgul("karma").karar(GENEL_OZGUL_ALGI)?.yon, "sus");
});

test("altküme aynı algıda tam eşleşen genel kuralla karar verir (eski davranış)", () => {
  assert.equal(genelVeOzgul("altkume").karar(GENEL_OZGUL_ALGI)?.yon, "uyan");
});

// Taramadaki örnek (havuz 2, `node -e`): genel "rutin → sus" kuralı ve bir içerik kelimesiyle ayrılan ters istisna.
function rutinVeIstisna(kararOlcusu: (typeof OLCULER)[number]): KuralHafizasi {
  const h = new KuralHafizasi({ kararOlcusu });
  h.ogren(["tur:terminal", "icgudu:rutin", "kod:0"], "sus", "d1");
  h.ogren(["tur:terminal", "icgudu:rutin", "kod:0", "komut:node", "komut:node -e", "k:w"], "uyan", "d2");
  return h;
}
const ISTISNASIZ = ["tur:terminal", "icgudu:rutin", "kod:0", "komut:node", "komut:node -e"];

test("karma: yarıyı kapsayan tam eşleşme (3/5), ayırt edici işareti algıda olmayan istisnayı (5/6) yener", () => {
  assert.equal(rutinVeIstisna("karma").karar(ISTISNASIZ)?.yon, "sus");
});

test("jaccard aynı algıda istisnaya gider: kural anlamı kaybolur (taramadaki ikinci görülüş hatası)", () => {
  assert.equal(rutinVeIstisna("jaccard").karar(ISTISNASIZ)?.yon, "uyan");
});

test("karma: hiçbir kural yeterince benzer değilse karar yok", () => {
  const h = new KuralHafizasi({ kararOlcusu: "karma" });
  h.ogren(["tur:terminal", "icgudu:x", "k:a"], "sus", "d1");
  h.ogren(["tur:terminal", "icgudu:x", "k:b"], "sus", "d2");   // {tur, icgudu}: 2/5
  assert.equal(h.karar(["tur:terminal", "icgudu:x", "k:c", "k:d", "k:e"]), null);
});

test("eşit benzerlikte (2/4 ve 3/6) daha özgül kural karar verir", () => {
  const h = new KuralHafizasi({ kararOlcusu: "jaccard" });
  h.ogren(["tur:olay", "icgudu:q"], "uyan", "d1");
  h.ogren(["tur:olay", "icgudu:q", "k:c", "k:e", "k:f"], "sus", "d2");   // benzerlik 2/5: yeni nöron
  const k = h.karar(["tur:olay", "icgudu:q", "k:c", "k:d"]);
  assert.deepEqual({ yon: k?.yon, noron: k?.noron.id }, { yon: "sus", noron: "K2" });
});

test("tek deneme her ölçüde: öğretilen durum bir dersten sonra öğretilen yönde verilir", () => {
  const yonler = OLCULER.map((kararOlcusu) => {
    const h = new KuralHafizasi({ kararOlcusu });
    h.ogren(ELLE_HATA, "sus", "d1");
    return h.karar(ELLE_HATA)?.yon;
  });
  assert.deepEqual(yonler, ["sus", "sus", "sus"]);
});

test("güven payı her ölçüde: 1'e 1 çelişen kural karar vermez", () => {
  const kararlar = OLCULER.map((kararOlcusu) => {
    const h = new KuralHafizasi({ kararOlcusu });
    h.ogren(NPM_UYARI_1, "sus", "d1");
    h.ogren(NPM_UYARI_1, "uyan", "d2");
    return h.karar(NPM_UYARI_1);
  });
  assert.deepEqual(kararlar, [null, null, null]);
});

test("boş kod her ölçüde karar almaz", () => {
  const kararlar = OLCULER.map((kararOlcusu) => {
    const h = new KuralHafizasi({ kararOlcusu });
    h.ogren(NPM_UYARI_1, "sus", "d1");
    return h.karar([]);
  });
  assert.deepEqual(kararlar, [null, null, null]);
});

test("öğrenme ölçüden bağımsız: aynı olay dizisi üç ölçüde aynı nöronları kurar (hafıza küçük kalır)", () => {
  const kur = (kararOlcusu: (typeof OLCULER)[number]) => {
    const h = new KuralHafizasi({ kararOlcusu });
    const dizi: [string[], "uyan" | "sus"][] = [
      [NPM_UYARI_1, "sus"], [NPM_UYARI_2, "sus"], [ELLE_HATA, "sus"], [LLM_HATA, "uyan"],
      [OGRETILEN, "uyan"], [KISMI, "sus"], [ISTISNASIZ, "sus"], [GENEL_OZGUL_ALGI, "uyan"],
    ];
    for (const [i, [kod, yon]] of dizi.entries()) {
      h.ogren(kod, yon, `d${i}`);
      h.karar(KISMI);   // karar yan etkisiz olmalı
    }
    return JSON.stringify(h.noronlar);
  };
  const altkume = kur("altkume");
  assert.deepEqual([kur("jaccard"), kur("karma")], [altkume, altkume]);
});

test("kapsama eşiği (H-K1) başka bir ölçüyle birlikte verilirse hata: ölçülmemiş birleşim", () => {
  assert.throws(() => new KuralHafizasi({ kapsamaEsigi: 0.5, kararOlcusu: "karma" }), /kapsamaEsigi/);
});

test("eşit özgüllükte daha çok kanıtlı kural karar verir, her ölçüde (1 kanıta karşı 3)", () => {
  const yonler = OLCULER.map((kararOlcusu) => {
    const h = new KuralHafizasi({ kararOlcusu });
    h.ogren(["tur:olay", "icgudu:w", "k:a"], "sus", "d1");                 // K1, 1 kanıt
    for (const d of ["d2", "d3", "d4"]) h.ogren(["tur:olay", "icgudu:w", "k:b"], "uyan", d);   // K2 (istisna), 3 kanıt
    return h.karar(["tur:olay", "icgudu:w", "k:a", "k:b"])?.yon;              // ikisi de tam eşleşir, J ikisinde 3/4
  });
  assert.deepEqual(yonler, ["uyan", "uyan", "uyan"]);
});
