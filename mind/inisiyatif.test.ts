// mind/inisiyatif.test.ts — Orion'un kendi gündemi: güç bütçesi + fayda kararı.
//
// NAİF ÇÖZÜMDEN ÖNCE yazıldı. Hedeflenen çöküş biçimleri:
//   - inisiyatif maliyet tavanını deler: boşta her dakika beyni uyandırır
//     (`tik` yasağının inisiyatif karşılığı — test edilmezse sessizce olur)
//   - Ozyn monitörde odaklanmış çalışırken araya girer
//   - beyin zaten düşünürken ikinci bir tur tetiklenir
//   - güç tükenmişken de söze girer (bütçe süs olur)
//   - güç eksiye düşer ya da 1'i aşar
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GucButcesi, Inisiyatif, type InisiyatifDurumu } from "./inisiyatif.ts";

const DK = 60_000;

// ── Güç bütçesi ────────────────────────────────────────────────────────────

test("GÜÇ: dolu başlar, 0..1 aralığından hiç çıkmaz", () => {
  const g = new GucButcesi();
  assert.equal(g.seviye, 1);
  for (let i = 0; i < 1000; i++) g.dusundu();
  assert.equal(g.seviye, 0, "eksiye dustu");
  for (let i = 0; i < 100_000; i++) g.tikle(1, 0);
  assert.equal(g.seviye, 1, "1'i asti");
});

test("GÜÇ: yürümek harcar, durmak doldurur", () => {
  const g = new GucButcesi();
  for (let i = 0; i < 20 * 10; i++) g.tikle(1 / 20, 1.25);   // 10 sn yürüyüş = 12,5 m
  const yurumeSonrasi = g.seviye;
  assert.ok(yurumeSonrasi < 0.95, `yurume harcamadi: ${yurumeSonrasi}`);
  for (let i = 0; i < 20 * 60; i++) g.tikle(1 / 20, 0);      // 1 dk dinlenme
  assert.ok(g.seviye > yurumeSonrasi, "dinlenme doldurmadi");
});

test("GÜÇ: hareket halindeyken DOLMAZ — yürürken dinlenmek yok", () => {
  const g = new GucButcesi();
  g.dusundu(); g.dusundu();
  const once = g.seviye;
  for (let i = 0; i < 20 * 5; i++) g.tikle(1 / 20, 0.3);      // yavaş yürüyüş
  assert.ok(g.seviye < once, `yururken doldu: ${once} -> ${g.seviye}`);
});

// ── İnisiyatif ─────────────────────────────────────────────────────────────

/** Uygun koşullar: uzun sessizlik, boşta, Ozyn odada, güç dolu. */
function durum(ek: Partial<InisiyatifDurumu> = {}): InisiyatifDurumu {
  return { simdiMs: 60 * DK, mesgul: false, ozynMonitorde: false, ozynOdada: true,
           sessizlikMs: 30 * DK, guc: 1, ...ek };
}

test("uzun sessizlik + boşta + güç var → söze girme fırsatı", () => {
  const k = new Inisiyatif().karar(durum());
  assert.ok(k, "hic karar uretmedi");
  assert.equal(k.tur, "soze_gir");
  assert.ok(k.fayda > 0 && k.fayda <= 1, `fayda araligi: ${k.fayda}`);
});

test("sessizlik eşiğin altındaysa hiçbir şey yok", () => {
  assert.equal(new Inisiyatif().karar(durum({ sessizlikMs: 2 * DK })), null);
});

test("MEŞGULKEN asla — beyin düşünürken ikinci tur yok", () => {
  assert.equal(new Inisiyatif().karar(durum({ mesgul: true })), null);
});

test("Ozyn MONİTÖRDE çalışırken araya GİRMEZ — odak işi bölünmez", () => {
  assert.equal(new Inisiyatif().karar(durum({ ozynMonitorde: true, sessizlikMs: 120 * DK })), null,
    "Ozyn terminalde calisirken soze girdi");
});

test("Ozyn odada değilse kime konuşsun — hiçbir şey yok", () => {
  assert.equal(new Inisiyatif().karar(durum({ ozynOdada: false })), null);
});

test("GÜÇ eşiğin altındaysa söze girmez — bütçe süs değil", () => {
  assert.equal(new Inisiyatif().karar(durum({ guc: 0.2 })), null);
});

test("REFRAKTER: bir kez söze girdikten sonra hemen tekrar girmez", () => {
  const i = new Inisiyatif();
  assert.ok(i.karar(durum({ simdiMs: 60 * DK })));
  assert.equal(i.karar(durum({ simdiMs: 61 * DK })), null, "1 dk sonra tekrar tetiklendi");
  assert.equal(i.karar(durum({ simdiMs: 70 * DK })), null, "10 dk sonra tekrar tetiklendi");
});

test("MALİYET TAVANI: 1 saat boşta, 20 Hz → beyin en fazla 4 kez uyanır", () => {
  // `tik` yasağının inisiyatif karşılığı. Bu test olmadan bir eşik hatası
  // saatte binlerce LLM çağrısına dönüşür ve kimse fark etmez.
  const i = new Inisiyatif();
  const g = new GucButcesi();
  let uyanma = 0;
  const DT = 1 / 20;
  for (let t = 0; t < 3600; t += DT) {
    g.tikle(DT, 0);
    const k = i.karar({ simdiMs: t * 1000, mesgul: false, ozynMonitorde: false,
                        ozynOdada: true, sessizlikMs: t * 1000, guc: g.seviye });
    if (k) { uyanma++; g.dusundu(); }
  }
  assert.ok(uyanma >= 1, "bir saatlik sessizlikte hic soze girmedi — inisiyatif olu");
  assert.ok(uyanma <= 4, `maliyet tavani delindi: 1 saatte ${uyanma} uyanma`);
});

test("uzun yürüyüş sonrası güç düşükse söze girmez — beden ile zihin bağlı", () => {
  const i = new Inisiyatif();
  const g = new GucButcesi();
  // 60 m yürüyüş + 8 düşünce turu: yorgun beden.
  for (let k = 0; k < 20 * 48; k++) g.tikle(1 / 20, 1.25);
  for (let k = 0; k < 8; k++) g.dusundu();
  assert.equal(i.karar(durum({ guc: g.seviye })), null,
    `yorgunken soze girdi (guc=${g.seviye.toFixed(2)})`);
});
