// protocol/sekans.test.ts — sekans biçimi (spec 36): temiz kopya, tavanlar, kare tamsayısı, bağlama kimliği, kapalı iz türü, bölüm çakışması; ret NEDENLİ (yol + neden).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { BEN, SEKANS_FPS, SEKANS_SINIRLARI, sekansAdiGecerli, sekansDogrula, sekansOzeti } from "./sekans.ts";
import { grafAdiGecerli } from "./graf.ts";

/** Geçerli küçük sekans: orion'a bağlı bir baş izi ve bir klip izi. */
const ornek = (): Record<string, unknown> => ({
  surum: 1, ad: "deneme", fps: 30, sure_kare: 90,
  baglamalar: [{ id: "b1", ajan: "orion" }],
  izler: [
    { id: "bas", baglama: "b1", tur: "uzuv", uzuv: "bas", kanal: "donme_x", anahtarlar: [{ kare: 0, deger: 0 }, { kare: 30, deger: 12, yumusatma: "yumusak" }] },
    { id: "klip", baglama: "b1", tur: "klip", bolumler: [{ klip: "el_salla", baslangic_kare: 10, uzunluk_kare: 72 }] },
  ],
});
const neden = (ham: unknown): string => { const r = sekansDogrula(ham); return r.ok ? "GEÇTİ" : r.hata; };
const bozuk = (f: (s: Record<string, unknown>) => void): string => { const s = ornek(); f(s); return neden(s); };
const izler = (s: Record<string, unknown>) => s.izler as Record<string, unknown>[];

test("geçerli sekans: temiz kopya — aralık varsayılanı tüm süre, bayraklar false, yumuşatma dolar, ofset 0, bilinmeyen alan atılır", () => {
  const r = sekansDogrula({ ...ornek(), fazla: 1 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual([r.deger.aralik, r.deger.izler[0]!.gizli, r.deger.izler[0]!.kilitli, "fazla" in r.deger], [{ bas: 0, bit: 90 }, false, false, false]);
  assert.deepEqual(r.deger.izler[0]!.tur === "uzuv" ? r.deger.izler[0]!.anahtarlar[0] : null, { kare: 0, deger: 0, yumusatma: "dogrusal" });
  assert.deepEqual(r.deger.izler[1]!.tur === "klip" ? r.deger.izler[1]!.bolumler[0] : null, { klip: "el_salla", baslangic_kare: 10, uzunluk_kare: 72, ofset_kare: 0 });
});

test("ad kuralı grafik adınınkiyle AYNI fonksiyon (kopya kural yok)", () => assert.equal(sekansAdiGecerli, grafAdiGecerli));

test("fps yalnız 30; süre 1–1800 tamsayı kare", () => {
  assert.match(bozuk((s) => { s.fps = 60; }), /fps: yalnız 30/);
  assert.match(bozuk((s) => { s.sure_kare = SEKANS_SINIRLARI.sure_kare + 1; }), /sure_kare: 1–1800/);
  assert.match(bozuk((s) => { s.sure_kare = 12.5; }), /sure_kare/);
});

test("anahtar karesi TAMSAYI ve süre içinde; karece KESİN artan", () => {
  assert.match(bozuk((s) => { (izler(s)[0]!.anahtarlar as Record<string, unknown>[])[1]!.kare = 7.5; }), /izler\[0\]\.anahtarlar\[1\]\.kare: tamsayı/);
  assert.match(bozuk((s) => { (izler(s)[0]!.anahtarlar as Record<string, unknown>[])[1]!.kare = 91; }), /sekansın dışında \(0–90\)/);
  assert.match(bozuk((s) => { (izler(s)[0]!.anahtarlar as Record<string, unknown>[])[1]!.kare = 0; }), /KESİN artmalı \(0 → 0\)/);
});

test("anahtar değeri klip tavanında: dönme ±180°, öteleme ±0.5 m ve öteleme yalnız kok", () => {
  assert.match(bozuk((s) => { (izler(s)[0]!.anahtarlar as Record<string, unknown>[])[1]!.deger = 181; }), /aralık dışı \(±180°\)/);
  assert.match(bozuk((s) => { izler(s)[0]!.kanal = "oteleme_y"; }), /yalnız 'kok' uzvunda/);
});

test("iz türü KAPALI birleşim: bilinmeyen tür (olay, kamera) nedenle reddedilir", () => {
  assert.match(bozuk((s) => { izler(s)[1]!.tur = "olay"; }), /bilinmeyen iz türü "olay" \(bu sürümde: uzuv, klip\)/);
});

test("iz bağlamaya KİMLİKLE bağlanır: olmayan bağlama nedenle reddedilir", () => {
  assert.match(bozuk((s) => { izler(s)[0]!.baglama = "orion"; }), /izler\[0\]\.baglama: "orion" bağlamalarda yok \(var: b1\)/);
});

test("bağlama: ajan kimliği ya da @ben; aynı ajan iki bağlamada reddedilir", () => {
  assert.equal(bozuk((s) => { s.baglamalar = [{ id: "b1", ajan: BEN }]; }), "GEÇTİ");
  assert.match(bozuk((s) => { s.baglamalar = [{ id: "b1", ajan: "Orion!" }]; }), /baglamalar\[0\]\.ajan geçersiz/);
  assert.match(bozuk((s) => { s.baglamalar = [{ id: "b1", ajan: "orion" }, { id: "b2", ajan: "orion" }]; }), /başka bir bağlamada da var/);
});

test("aynı bağlamanın aynı uzuv+kanalı iki izde reddedilir", () => {
  assert.match(bozuk((s) => { izler(s).push({ ...izler(s)[0]!, id: "bas2" }); }), /'b1\.bas\.donme_x' iki kez/);
});

test("klip bölümleri: sıralanır; üst üste binen iki bölüm nedenle reddedilir; sekans sonunu aşan bölüm reddedilir", () => {
  const s = ornek();
  izler(s)[1]!.bolumler = [{ klip: "dusun", baslangic_kare: 50, uzunluk_kare: 10 }, { klip: "el_salla", baslangic_kare: 0, uzunluk_kare: 20 }];
  const r = sekansDogrula(s);
  assert.deepEqual(r.ok && r.deger.izler[1]!.tur === "klip" ? r.deger.izler[1]!.bolumler.map((b) => b.klip) : null, ["el_salla", "dusun"]);
  assert.match(bozuk((x) => { izler(x)[1]!.bolumler = [{ klip: "a", baslangic_kare: 0, uzunluk_kare: 20 }, { klip: "b", baslangic_kare: 19, uzunluk_kare: 5 }]; }), /üst üste biniyor/);
  assert.match(bozuk((x) => { izler(x)[1]!.bolumler = [{ klip: "a", baslangic_kare: 80, uzunluk_kare: 20 }]; }), /sonunu aşıyor \(80 \+ 20 > 90\)/);
});

test("aralık: 0 ≤ bas < bit ≤ süre", () => {
  assert.match(bozuk((s) => { s.aralik = { bas: 30, bit: 30 }; }), /aralik: 0 ≤ bas < bit ≤ 90/);
});

test(`tavanlar: en çok ${SEKANS_SINIRLARI.iz} iz, iz başına ${SEKANS_SINIRLARI.anahtar} anahtar, ${SEKANS_SINIRLARI.baglama} bağlama`, () => {
  assert.match(bozuk((s) => { s.izler = Array.from({ length: SEKANS_SINIRLARI.iz + 1 }, (_, i) => ({ id: `k${i}`, baglama: "b1", tur: "klip", bolumler: [] })); }), /en çok 32 iz/);
  assert.match(bozuk((s) => { s.sure_kare = 1800; izler(s)[0]!.anahtarlar = Array.from({ length: SEKANS_SINIRLARI.anahtar + 1 }, (_, i) => ({ kare: i, deger: 0 })); }), /en çok 256 anahtar/);
  assert.match(bozuk((s) => { s.baglamalar = Array.from({ length: SEKANS_SINIRLARI.baglama + 1 }, (_, i) => ({ id: `b${i}`, ajan: `a${i}` })); }), /en çok 8/);
});

test("özet: ajanlar, iz sayısı, kullanılan klipler (tekil)", () => {
  const r = sekansDogrula(ornek());
  assert.deepEqual(r.ok ? sekansOzeti(r.deger) : null, { ad: "deneme", sure_kare: 90, ajanlar: ["orion"], iz: 2, klipler: ["el_salla"] });
  assert.equal(SEKANS_FPS, 30);
});
