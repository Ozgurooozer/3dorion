// mind/inisiyatifNeden.test.ts — Kendiliğinden uyanmanın NEDENİ, VARLIK kuralı ve BÜTÇESİ (Orion Beyin Ofisi T2-K2/K3/K5).
//
// Düşman senaryolar (12 Ekim kaydı): kimse yokken 8,6 saatte 69 inisiyatif uyanışı; tavan "uyanma sayısı" olduğu için
// tutuyor ama gerçek maliyet (model-saniye, token) ölçülmüyordu; "söyleyecek varsa söyle" nedensizdi.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Inisiyatif, UyanisButcesi, VARLIK_MS, ACIK_IS_BEKLEME_MS, type InisiyatifDurumu } from "./inisiyatif.ts";

const DK = 60_000;
const durum = (ek: Partial<InisiyatifDurumu> = {}): InisiyatifDurumu => ({
  simdiMs: 60 * DK, mesgul: false, ozynMonitorde: false, ozynOdada: true, sessizlikMs: 60 * DK, guc: 1, girdiYasiMs: 1 * DK, ...ek,
});
const is = (yasMs: number, anahtar = "n_1") => ({ ozet: "komut `git status`", yasMs, anahtar });

// ── Varlık ─────────────────────────────────────────────────────

test("VARLIK: son girdi 10 dk'dan eskiyse Ozyn burada değildir ve uyanılmaz", () => {
  assert.equal(new Inisiyatif().karar(durum({ girdiYasiMs: VARLIK_MS + 1 })), null);
});

test("VARLIK: son girdi pencerenin içindeyse sessizlik nedeniyle uyanılır", () => {
  assert.equal(new Inisiyatif().karar(durum({ girdiYasiMs: VARLIK_MS - 1 }))?.neden, "sessizlik");
});

test("VARLIK: kimse yokken 8,6 saatte HİÇ uyanma (12 Ekim kaydının karşılığı)", () => {
  const i = new Inisiyatif();
  let uyanma = 0;
  for (let t = 0; t < 8.6 * 3600; t += 1) {
    if (i.karar(durum({ simdiMs: t * 1000, sessizlikMs: t * 1000, girdiYasiMs: t * 1000 + 11 * DK }))) uyanma++;
  }
  assert.equal(uyanma, 0);
});

test("VARLIK: mesafe varlık sinyali DEĞİL — yakın ama girdisiz ise uyanılmaz", () => {
  assert.equal(new Inisiyatif().karar(durum({ ozynOdada: true, girdiYasiMs: 40 * DK })), null);
});

// ── Neden: açık iş ─────────────────────────────────────────────

test("NEDEN: zaman aşımına uğrayan öneri 2 dk beklediyse acik_is ile uyanılır (sessizlik eşiği beklenmez)", () => {
  const k = new Inisiyatif().karar(durum({ sessizlikMs: 1 * DK, acikIs: is(ACIK_IS_BEKLEME_MS) }));
  assert.equal(k?.neden, "acik_is");
  assert.equal(k?.acikIs?.anahtar, "n_1");
});

test("NEDEN: açık iş çok tazeyse (2 dk'dan az) acik_is değildir", () => {
  assert.equal(new Inisiyatif().karar(durum({ sessizlikMs: 1 * DK, acikIs: is(ACIK_IS_BEKLEME_MS - 1) })), null);
});

test("NEDEN: aynı açık iş TEK kez hatırlatılır (refrakter geçse de)", () => {
  const i = new Inisiyatif();
  assert.equal(i.karar(durum({ simdiMs: 60 * DK, sessizlikMs: 1 * DK, acikIs: is(5 * DK) }))?.neden, "acik_is");
  assert.equal(i.karar(durum({ simdiMs: 90 * DK, sessizlikMs: 1 * DK, acikIs: is(35 * DK) })), null, "ikinci hatırlatma");
});

test("NEDEN: farklı açık iş yeniden hatırlatır", () => {
  const i = new Inisiyatif();
  i.karar(durum({ simdiMs: 60 * DK, sessizlikMs: 1 * DK, acikIs: is(5 * DK, "n_1") }));
  assert.equal(i.karar(durum({ simdiMs: 90 * DK, sessizlikMs: 1 * DK, acikIs: is(5 * DK, "n_2") }))?.neden, "acik_is");
});

test("NEDEN: açık iş varken bile Ozyn yoksa (girdi eski) hatırlatma YOK", () => {
  assert.equal(new Inisiyatif().karar(durum({ girdiYasiMs: 30 * DK, acikIs: is(10 * DK) })), null);
});

test("NEDEN: Ozyn monitördeyken (yazıyor) açık iş de bölmez", () => {
  assert.equal(new Inisiyatif().karar(durum({ ozynMonitorde: true, acikIs: is(10 * DK) })), null);
});

// ── Bütçe ve devre kesici ──────────────────────────────────────

test("BÜTÇE: saatlik model-saniye dolunca kapı kapanır (uyanma sayısı az olsa bile)", () => {
  const b = new UyanisButcesi({ saatlikModelMs: 10_000 });
  b.sonuc(1000, 12_000, 100, true);
  assert.deepEqual(b.izin(2000), { acik: false, sebep: "saatlik_model_suresi" });
});

test("BÜTÇE: saatlik token dolunca kapanır; bir saat sonra pencere kayar ve açılır", () => {
  const b = new UyanisButcesi({ saatlikToken: 3000 });
  b.sonuc(0, 1000, 3500, true);
  assert.equal(b.izin(10 * DK).acik, false);
  assert.equal(b.izin(61 * DK).acik, true);
});

test("BÜTÇE: günlük token tavanı saatlik pencere dışında da tutar", () => {
  const b = new UyanisButcesi({ saatlikToken: 1e9, gunlukToken: 5000, saatlikUyanma: 100, saatlikModelMs: 1e9 });
  for (let h = 0; h < 6; h++) b.sonuc(h * 70 * DK, 100, 1000, true);
  assert.deepEqual(b.izin(7 * 70 * DK), { acik: false, sebep: "gunluk_token" });
});

test("BÜTÇE: BAŞARISIZ çağrı da düşer (token bilinmese de uyanma sayısına yazılır)", () => {
  const b = new UyanisButcesi({ saatlikUyanma: 2, devreBosSayisi: 99 });
  b.sonuc(0, 0, undefined, false); b.sonuc(1000, 0, undefined, false);
  assert.deepEqual(b.izin(2000), { acik: false, sebep: "saatlik_uyanma" });
});

test("DEVRE KESİCİ: üst üste iki BOŞ uyanış → 30 dk kapalı, sonra açılır", () => {
  const b = new UyanisButcesi({ saatlikUyanma: 99 });
  b.sonuc(0, 100, 100, false); b.sonuc(1000, 100, 100, false);
  assert.deepEqual(b.izin(10 * DK), { acik: false, sebep: "devre_kesici" });
  assert.equal(b.izin(31 * DK).acik, true);
});

test("DEVRE KESİCİ: eylemli bir uyanış boş sayacını sıfırlar", () => {
  const b = new UyanisButcesi({ saatlikUyanma: 99 });
  b.sonuc(0, 100, 100, false); b.sonuc(1000, 100, 100, true); b.sonuc(2000, 100, 100, false);
  assert.equal(b.izin(3000).acik, true);
});

test("KAPI: bütçe tükenince karar null (model çağrılmaz)", () => {
  const i = new Inisiyatif({ butce: { saatlikModelMs: 5000 } });
  i.butce.sonuc(0, 6000, 100, true);
  assert.equal(i.karar(durum({ simdiMs: 30 * DK })), null);
});
