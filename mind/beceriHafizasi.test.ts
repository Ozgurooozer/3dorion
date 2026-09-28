// mind/beceriHafizasi.test.ts — Beceri hafızası (spec 10): bir kez başarılan görev,
// parametreleriyle yeniden yapılır. Görevler elle kurulur: davranış görünür olsun diye.
// Kayıttan uçtan uca çıkarma mind/gorev.test.ts'te ve çevrimdışı ölçümde.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { BeceriHafizasi, beceriHafizasiKur } from "./beceriHafizasi.ts";
import { sozAnahtari, type GorevOrnegi, type GorevSonucu } from "./gorev.ts";
import type { Niyet } from "../protocol/niyet.ts";

const git = (ad: string): Niyet => ({ tur: "git", hedef: { tip: "capa", ad } });
const OTUR: Niyet = { tur: "otur" };

/** Bir görev örneği: bütün adımları bitti, sonucu verilen. */
function gorev(soz: string, adimlar: Niyet[], sonuc: GorevSonucu = "basari", t = 1): GorevOrnegi {
  return {
    kaynak: "uyanis", kimlik: `o1/u${t}`, t, soz, anahtar: sozAnahtari(soz)!,
    adimlar: adimlar.map((govde) => ({ govde, durum: "bitti" as const })), eslik: 0, sonuc, sureMs: 2000,
  };
}

test("boş hafıza karar vermez", () => {
  assert.equal(new BeceriHafizasi().karar("masaya git otur"), null);
});

test("anahtarı olmayan söze karar yok (yalnız çapa adı)", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR]));
  assert.equal(h.karar("masaya"), null);
});

test("tek başarı beceri doğurur: aynı söz aynı adımları verir, pay 1", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR]));
  const e = h.karar("masaya git otur");
  assert.deepEqual({ adimlar: e?.adimlar, pay: e?.pay }, { adimlar: [git("masa"), OTUR], pay: 1 });
});

test("öğrenme olayları: ilk başarı doğum, sonraki başarı ve hata sayaç", () => {
  const h = new BeceriHafizasi();
  const olaylar = [
    h.ogren(gorev("masaya git otur", [git("masa"), OTUR], "basari", 1)),
    h.ogren(gorev("masaya git otur", [git("masa"), OTUR], "basari", 2)),
    h.ogren(gorev("masaya git otur", [git("masa"), OTUR], "hata", 3)),
  ].map((o) => o?.tur);
  assert.deepEqual(olaylar, ["dogdu", "basari", "hata"]);
});

test("yuva: sözdeki çapa adımdaki çapaya bağlanır, yeni sözün çapası onun yerine geçer", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR]));
  assert.deepEqual(h.karar("pencereye git otur")?.adimlar, [git("pencere"), OTUR]);
});

test("yuva: `otur`un çapa alanı da bağlanır", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("sandalyeye otur", [{ tur: "otur", capa: "sandalye" }]));
  assert.deepEqual(h.karar("masaya otur")?.adimlar, [{ tur: "otur", capa: "masa" }]);
});

test("yuva bağlama ızgarası: çapa değerli her alan bağlanır; çapa olmayan hedef sabit kalır", () => {
  const capa = (ad: string) => ({ tip: "capa" as const, ad });
  // [öğrenilen söz, adım, yeni söz, yeni sözde beklenen adım]
  const izgara: [string, Niyet, string, Niyet][] = [
    ["masaya bak", { tur: "bak", hedef: capa("masa") }, "pencereye bak", { tur: "bak", hedef: capa("pencere") }],
    ["tahtaya odaklan", { tur: "odaklan", capa: "tahta" }, "monitöre odaklan", { tur: "odaklan", capa: "monitor" }],
    ["kapıyı göster", { tur: "jest", jest: "işaret_ediyor", hedef: capa("kapi") }, "pencereyi göster", { tur: "jest", jest: "işaret_ediyor", hedef: capa("pencere") }],
    ["masaya git", { tur: "git", hedef: { tip: "nesne", ad: "masa" } }, "pencereye git", { tur: "git", hedef: { tip: "nesne", ad: "masa" } }],
    ["masaya bak", { tur: "bak", hedef: { tip: "oyuncu" } }, "pencereye bak", { tur: "bak", hedef: { tip: "oyuncu" } }],
    ["masaya bak", { tur: "bak", hedef: null }, "pencereye bak", { tur: "bak", hedef: null }],
  ];
  const bulunan = izgara.map(([soz, adim, yeni]) => {
    const h = new BeceriHafizasi();
    h.ogren(gorev(soz, [adim]));
    return h.karar(yeni)?.adimlar[0] ?? null;
  });
  assert.deepEqual(bulunan, izgara.map(([, , , beklenen]) => beklenen));
});

test("farklı yazılmış çapa iç adla öğrenilir: tarif birleşir, yuva bağlanır (BY39-2d; eski kayıt)", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("pencereye git", [{ tur: "git", hedef: { tip: "capa", ad: "Pencere" } }], "basari", 1));
  h.ogren(gorev("sandalyeye git", [git("sandalye")], "basari", 2));
  assert.deepEqual(
    { sayi: h.beceriler.length, sayac: h.beceriler[0]?.sayac, oneri: h.karar("kapıya git")?.adimlar },
    { sayi: 1, sayac: { basari: 2, hata: 0 }, oneri: [git("kapi")] },
  );
});

test("etiketle yazılmış sabit çapa iç adla önerilir: refleksin göndereceği, gölgede yazılanla aynı", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("odaya git", [{ tur: "git", hedef: { tip: "capa", ad: "beyaz tahta" } }, { tur: "otur", capa: "Sandalye" }]));
  assert.deepEqual(h.karar("odaya git")?.adimlar, [git("tahta"), { tur: "otur", capa: "sandalye" }]);
});

test("sözde geçmeyen argüman sabit kalır", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git", [git("sandalye")]));
  assert.deepEqual(h.karar("pencereye git")?.adimlar, [git("sandalye")]);
});

test("çerçeve farklıysa eşleşmez (masaya gidip otur)", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR]));
  assert.equal(h.karar("masaya gidip otur"), null);
});

test("yuva sayısı farklıysa eşleşmez (yuvasız ve iki yuvalı söz)", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR]));
  assert.deepEqual([h.karar("git otur"), h.karar("masadan pencereye git otur")], [null, null]);
});

test("hatadan beceri doğmaz", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR], "hata"));
  assert.equal(h.beceriler.length, 0);
});

test("belirsiz görev hiçbir şeyi değiştirmez", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR], "basari", 1));
  const once = JSON.stringify(h.beceriler);
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR], "belirsiz", 2));
  assert.equal(JSON.stringify(h.beceriler), once);
});

test("hata payı düşürür: 1 başarı 1 hata (0,5) askıya alır; iki başarı daha (0,75) geri getirir", () => {
  const h = new BeceriHafizasi();
  const tarif = [git("masa"), OTUR];
  h.ogren(gorev("masaya git otur", tarif, "basari", 1));
  h.ogren(gorev("masaya git otur", tarif, "hata", 2));
  const askida = h.karar("masaya git otur");
  h.ogren(gorev("masaya git otur", tarif, "basari", 3));
  h.ogren(gorev("masaya git otur", tarif, "basari", 4));
  assert.deepEqual({ askida, geri: h.karar("masaya git otur")?.pay }, { askida: null, geri: 0.75 });
});

test("aynı çerçevede farklı çapalarla gelen başarılar tek beceride birikir", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR], "basari", 1));
  h.ogren(gorev("pencereye git otur", [git("pencere"), OTUR], "basari", 2));
  assert.deepEqual(h.beceriler.map((b) => b.sayac), [{ basari: 2, hata: 0 }]);
});

test("aynı anahtarda iki tarif: çok başarılı olan kazanır", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya otur", [OTUR], "basari", 1));
  h.ogren(gorev("masaya otur", [OTUR], "basari", 2));
  h.ogren(gorev("masaya otur", [git("masa"), OTUR], "basari", 3));
  assert.deepEqual(h.karar("masaya otur")?.adimlar, [OTUR]);
});

test("aynı anahtarda iki tarif, eşit başarı: en yeni doğan kazanır", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya otur", [OTUR], "basari", 1));
  h.ogren(gorev("masaya otur", [git("masa"), OTUR], "basari", 2));
  assert.deepEqual(h.karar("masaya otur")?.adimlar, [git("masa"), OTUR]);
});

test("tarif kimliği üçüne bağlı: çerçeve, yuva sayısı ya da adımlar farklıysa ayrı beceri", () => {
  const cift = (a: GorevOrnegi, b: GorevOrnegi) => beceriHafizasiKur([a, b]).beceriler.length;
  assert.deepEqual([
    cift(gorev("masaya git otur", [git("masa"), OTUR], "basari", 1), gorev("masaya yürü otur", [git("masa"), OTUR], "basari", 2)),
    cift(gorev("masaya git", [git("sandalye")], "basari", 1), gorev("git", [git("sandalye")], "basari", 2)),
    cift(gorev("masaya git otur", [git("masa"), OTUR], "basari", 1), gorev("masaya git otur", [git("masa")], "basari", 2)),
  ], [2, 2, 2]);
});

test("adımın anahtar sırası ve tanımsız alanı tarifi değiştirmez: başarılar tek beceride birikir", () => {
  const ters = { hedef: { ad: "masa", tip: "capa" }, tur: "git" } as unknown as Niyet;
  const tanimsiz = { tur: "git", hedef: { tip: "capa", ad: "masa" }, mesafe: undefined } as Niyet;
  const h = beceriHafizasiKur([
    gorev("masaya git", [git("masa")], "basari", 1),
    gorev("masaya git", [ters], "basari", 2),
    gorev("masaya git", [tanimsiz], "basari", 3),
  ]);
  assert.deepEqual(h.beceriler.map((b) => b.sayac), [{ basari: 3, hata: 0 }]);
});

test("kimlik içerikten türer: görevler başka sırayla gelse de aynı tarifin kimliği aynı", () => {
  const a = gorev("masaya git otur", [git("masa"), OTUR], "basari", 1);
  const b = gorev("kapıya git", [git("kapi")], "basari", 2);
  const ileri = beceriHafizasiKur([a, b]).beceriler.map((x) => x.id).sort();
  const geri = beceriHafizasiKur([{ ...b, t: 1 }, { ...a, t: 2 }]).beceriler.map((x) => x.id).sort();
  assert.deepEqual(ileri, geri);
});

test("yeniden kurma belirlenimci ve zaman sıralı: aynı görevler aynı hafızayı kurar", () => {
  const liste = [
    gorev("masaya git otur", [git("masa"), OTUR], "basari", 3),
    gorev("masaya git otur", [git("masa"), OTUR], "hata", 1),
    gorev("pencereye git", [git("pencere")], "basari", 2),
  ];
  // t sırası: hata (t1) önce gelir ve henüz beceri yokken yok sayılır; başarı (t3) doğurur.
  const h = beceriHafizasiKur(liste);
  assert.deepEqual(
    { ayni: JSON.stringify(h.beceriler) === JSON.stringify(beceriHafizasiKur(liste).beceriler), sayac: h.beceriler.map((b) => b.sayac) },
    { ayni: true, sayac: [{ basari: 1, hata: 0 }, { basari: 1, hata: 0 }] },
  );
});

test("karar kopya döner: dönen adımı değiştirmek hafızayı değiştirmez", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR]));
  const e = h.karar("masaya git otur")!;
  (e.adimlar[0] as { hedef: { ad: string } }).hedef.ad = "tahta";
  assert.deepEqual(h.karar("masaya git otur")?.adimlar[0], git("masa"));
});

test("öğrenme kopya alır: görevin adımını sonradan değiştirmek beceriyi değiştirmez", () => {
  // Adımlar bu teste özgü yeni nesneler: paylaşılan OTUR sabiti değiştirilirse öbür testler kirlenir.
  const h = new BeceriHafizasi();
  const g = gorev("masaya git otur", [git("masa"), { tur: "otur" }]);
  h.ogren(g);
  (g.adimlar[1]!.govde as { capa?: string }).capa = "tahta";
  assert.deepEqual(h.karar("masaya git otur")?.adimlar, [git("masa"), { tur: "otur" }]);
});

test("güvenlik: bedensel olmayan adım taşıyan görev reddedilir — komut asla beceri olmaz", () => {
  const h = new BeceriHafizasi();
  const olay = h.ogren(gorev("dizini listele", [{ tur: "komut", metin: "dir", gerekce: "g" }]));
  assert.deepEqual({ olay, sayi: h.beceriler.length }, { olay: null, sayi: 0 });
});

test("kanıt: beceriyi doğuran ve besleyen görevlerin kimlikleri", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR], "basari", 1));
  h.ogren(gorev("pencereye git otur", [git("pencere"), OTUR], "basari", 2));
  assert.deepEqual(h.beceriler[0]?.kanit, ["o1/u1", "o1/u2"]);
});

// ── Refleks görevleri (spec 10, Faz D) ─────────────────────────────────────

/** Bir refleks görevi: yürütülen becerinin kimliğiyle; adımlar verilen durumlarla. */
function refleksGorevi(beceri: string, soz: string, adimlar: [Niyet, "bitti" | "hata" | "iptal"][], sonuc: GorevSonucu, t: number): GorevOrnegi {
  return {
    kaynak: "refleks", kimlik: `o1/r${t}`, t, soz, anahtar: sozAnahtari(soz)!, beceri,
    adimlar: adimlar.map(([govde, durum]) => ({ govde, durum })), eslik: 0, sonuc, sureMs: 0,
  };
}

test("refleks görevi yürüttüğü becerinin sayacına yazılır: başarı artar", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR], "basari", 1));
  const id = h.beceriler[0]!.id;
  const olay = h.ogren(refleksGorevi(id, "pencereye git otur", [[git("pencere"), "bitti"], [OTUR, "bitti"]], "basari", 2));
  assert.deepEqual({ olay: olay?.tur, sayac: h.beceriler[0]!.sayac, kanit: h.beceriler[0]!.kanit }, { olay: "basari", sayac: { basari: 2, hata: 0 }, kanit: ["o1/u1", "o1/r2"] });
});

test("refleksin hatası, adımları eksik kalsa da (kalanlar gönderilmedi) yürüttüğü beceriye yazılır", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("masaya git otur", [git("masa"), OTUR], "basari", 1));
  h.ogren(refleksGorevi(h.beceriler[0]!.id, "kapıya git otur", [[git("kapi"), "hata"]], "hata", 2));
  assert.deepEqual({ sayi: h.beceriler.length, sayac: h.beceriler[0]!.sayac }, { sayi: 1, sayac: { basari: 1, hata: 1 } });
});

test("refleks görevi beceri doğurmaz: hafızada olmayan beceri kimliği yok sayılır", () => {
  const h = new BeceriHafizasi();
  const olay = h.ogren(refleksGorevi("B00000000", "pencereye git", [[git("pencere"), "bitti"]], "basari", 1));
  assert.deepEqual({ olay, sayi: h.beceriler.length }, { olay: null, sayi: 0 });
});

test("belirsiz refleks görevi (kesildi, zaman aşımı) sayaca yazılmaz", () => {
  const h = new BeceriHafizasi();
  h.ogren(gorev("pencereye git", [git("pencere")], "basari", 1));
  const olay = h.ogren(refleksGorevi(h.beceriler[0]!.id, "sandalyeye git", [[git("sandalye"), "iptal"]], "belirsiz", 2));
  assert.deepEqual({ olay, sayac: h.beceriler[0]!.sayac }, { olay: null, sayac: { basari: 1, hata: 0 } });
});
