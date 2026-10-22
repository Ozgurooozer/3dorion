// protocol/animasyon.test.ts — JSON animasyon klibi BİÇİMİ (spec 35 Dilim 5a): temiz kopya, tavanlar, değer aralıkları, hata yeri; `jest` niyetinin `klip`i.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { KLIP_SINIRLARI, klipAdiGecerli, klipDogrula, klipOzeti, UZUVLAR } from "./animasyon.ts";
import { niyetDogrula } from "./dogrula.ts";

const anahtar = (t: number, deger: number, yumusatma?: string) => ({ t, deger, ...(yumusatma ? { yumusatma } : {}) });
const iz = (uzuv: string, kanal: string, anahtarlar: unknown[] = [anahtar(0, 0), anahtar(1, 10)]) => ({ uzuv, kanal, anahtarlar });
const klip = (ek: Record<string, unknown> = {}) => ({ surum: 1, ad: "deneme", jest: "el_salliyor", sure: 2, izler: [iz("sag_kol", "donme_z")], ...ek });
const hatasi = (ham: unknown): string => { const r = klipDogrula(ham); assert.equal(r.ok, false, "geçmemeliydi"); return r.ok ? "" : r.hata; };

test("geçerli klip: temiz kopya — bilinmeyen alan atılır, yumuşatma 'dogrusal' dolar, döngü yazılmadıysa false", () => {
  const r = klipDogrula({ ...klip(), fazla: 1, izler: [{ ...iz("sag_kol", "donme_z"), fazla: true }] });
  assert.deepEqual(r, {
    ok: true,
    deger: { surum: 1, ad: "deneme", jest: "el_salliyor", sure: 2, dongu: false, izler: [{ uzuv: "sag_kol", kanal: "donme_z", anahtarlar: [{ t: 0, deger: 0, yumusatma: "dogrusal" }, { t: 1, deger: 10, yumusatma: "dogrusal" }] }] },
  });
});

test("açıklama ve döngü kopyalanır", () => {
  const r = klipDogrula(klip({ aciklama: "selam", dongu: true }));
  assert.deepEqual(r.ok && [r.deger.aciklama, r.deger.dongu], ["selam", true]);
});

test("sürüm 1 olmalı", () => assert.match(hatasi(klip({ surum: 2 })), /surum 1 olmalı/));
test("ad: küçük harf/rakam/_ (Türkçe harf ve büyük harf yok: dosya adı)", () => {
  assert.deepEqual(["el_salla", "a1", "x".repeat(48)].map(klipAdiGecerli), [true, true, true]);
  assert.deepEqual(["", "El", "baş", "a-b", "a.json", "x".repeat(49), 5].map(klipAdiGecerli), [false, false, false, false, false, false, false]);
});
test("ad geçersizse nedenli hata", () => assert.match(hatasi(klip({ ad: "Baş" })), /^ad geçersiz/));
test("jest protokol sözlüğünden olmalı (klibin anlamı)", () => assert.match(hatasi(klip({ jest: "dans" })), /jest geçersiz.*el_salliyor/));

test("süre: 0 ve negatif reddedilir", () => {
  assert.match(hatasi(klip({ sure: 0 })), /sure: 0 aralık dışı/);
  assert.match(hatasi(klip({ sure: -1 })), /sure: -1 aralık dışı/);
});
test("süre tavanı 10 sn", () => {
  assert.equal(KLIP_SINIRLARI.sure, 10);
  assert.equal(klipDogrula(klip({ sure: 10, izler: [iz("bas", "donme_x", [anahtar(10, 1)])] })).ok, true);
  assert.match(hatasi(klip({ sure: 10.01 })), /en çok 10 sn/);
});
test("süre sonlu sayı olmalı (NaN, Infinity, metin)", () => {
  for (const s of [NaN, Infinity, "2"]) assert.match(hatasi(klip({ sure: s })), /sure: sonlu sayı/);
});
test("döngü true/false olmalı", () => assert.match(hatasi(klip({ dongu: "evet" })), /dongu: true\/false/));

test("en az bir iz; iz tavanı", () => {
  assert.match(hatasi(klip({ izler: [] })), /en az bir iz/);
  const cok = UZUVLAR.flatMap((u) => ["donme_x", "donme_y"].map((k) => iz(u, k))).slice(0, KLIP_SINIRLARI.iz + 1);
  assert.equal(cok.length, KLIP_SINIRLARI.iz + 1);
  assert.match(hatasi(klip({ izler: cok })), /en çok 24 iz/);
  assert.equal(klipDogrula(klip({ izler: cok.slice(0, KLIP_SINIRLARI.iz) })).ok, true);
});

test("anahtar tavanı (iz başına) ve en az bir anahtar", () => {
  const sure = 10;
  const l = (n: number) => Array.from({ length: n }, (_, i) => anahtar(i * 0.25, 0));
  assert.equal(klipDogrula(klip({ sure, izler: [iz("bas", "donme_x", l(KLIP_SINIRLARI.anahtar))] })).ok, true);
  assert.match(hatasi(klip({ sure, izler: [iz("bas", "donme_x", l(KLIP_SINIRLARI.anahtar + 1))] })), /en çok 32 anahtar/);
  assert.match(hatasi(klip({ izler: [iz("bas", "donme_x", [])] })), /en az bir anahtar/);
});

test("uzuv ve kanal sözlükten; hata yeri ve seçenekler söylenir", () => {
  assert.match(hatasi(klip({ izler: [iz("kuyruk", "donme_x")] })), /izler\[0\]\.uzuv geçersiz: "kuyruk" \(geçerli: kok, govde/);
  assert.match(hatasi(klip({ izler: [iz("bas", "olcek_x")] })), /izler\[0\]\.kanal geçersiz.*donme_x/);
});

test("öteleme YALNIZ kok uzvunda (tek kemiği ötelemek gövdeyi yırtar)", () => {
  assert.match(hatasi(klip({ izler: [iz("sag_kol", "oteleme_y", [anahtar(0, 0.1)])] })), /yalnız 'kok' uzvunda/);
  assert.equal(klipDogrula(klip({ izler: [iz("kok", "oteleme_y", [anahtar(0, 0), anahtar(0.5, 0.2)])] })).ok, true);
});

test("anahtar zamanı süre içinde ve KESİN artan", () => {
  assert.match(hatasi(klip({ izler: [iz("bas", "donme_x", [anahtar(-0.1, 0)])] })), /süresi dışında/);
  assert.match(hatasi(klip({ izler: [iz("bas", "donme_x", [anahtar(2.5, 0)])] })), /süresi dışında \(0–2 sn\)/);
  assert.match(hatasi(klip({ izler: [iz("bas", "donme_x", [anahtar(1, 0), anahtar(1, 5)])] })), /KESİN artmalı \(1 → 1\)/);
  assert.match(hatasi(klip({ izler: [iz("bas", "donme_x", [anahtar(1, 0), anahtar(0.5, 5)])] })), /KESİN artmalı/);
});

test("değer aralığı: dönme ±180°, öteleme ±0.5 m; sınırın kendisi geçer", () => {
  assert.equal(klipDogrula(klip({ izler: [iz("bas", "donme_x", [anahtar(0, -180), anahtar(1, 180)])] })).ok, true);
  assert.match(hatasi(klip({ izler: [iz("bas", "donme_x", [anahtar(0, 181)])] })), /181° aralık dışı \(±180°\)/);
  assert.match(hatasi(klip({ izler: [iz("kok", "oteleme_y", [anahtar(0, 0.6)])] })), /0\.6m aralık dışı \(±0\.5m\)/);
});

test("değer ve zaman SONLU sayı olmalı (NaN/Infinity/metin)", () => {
  for (const d of [NaN, Infinity, "5", null]) assert.match(hatasi(klip({ izler: [iz("bas", "donme_x", [{ t: 0, deger: d }])] })), /deger: sonlu sayı/);
  for (const t of [NaN, Infinity, "0"]) assert.match(hatasi(klip({ izler: [iz("bas", "donme_x", [{ t, deger: 0 }])] })), /\.t: sonlu sayı/);
});

test("yumuşatma sözlükten", () => {
  assert.match(hatasi(klip({ izler: [iz("bas", "donme_x", [anahtar(0, 0, "zıpla")])] })), /yumusatma geçersiz.*dogrusal, yumusak, basamak/);
});

test("aynı uzuv+kanal iki kez reddedilir (sessiz ezme yok)", () => {
  assert.match(hatasi(klip({ izler: [iz("bas", "donme_x"), iz("bas", "donme_x")] })), /'bas\.donme_x' iki kez/);
  assert.equal(klipDogrula(klip({ izler: [iz("bas", "donme_x"), iz("bas", "donme_y")] })).ok, true);
});

test("klip nesne olmalı", () => {
  for (const v of [null, [], "x", 3]) assert.match(hatasi(v), /klip nesne olmalı/);
});

test("özet: uzuvlar tekil, ilk görülme sırasıyla; izler yok", () => {
  const r = klipDogrula(klip({ izler: [iz("bas", "donme_x"), iz("sag_kol", "donme_z"), iz("bas", "donme_y")] }));
  assert.ok(r.ok);
  assert.deepEqual(klipOzeti(r.deger), { ad: "deneme", jest: "el_salliyor", sure: 2, dongu: false, uzuvlar: ["bas", "sag_kol"] });
});

// ── `jest` niyetinin `klip` alanı (protokol: alan eklemek kırıcı değil) ──
test("jest niyeti klipsiz: ESKİ biçim aynen (klip anahtarı eklenmez)", () => {
  assert.deepEqual(niyetDogrula({ tur: "jest", jest: "el_salliyor" }), { ok: true, deger: { tur: "jest", jest: "el_salliyor" } });
});
test("jest niyeti klipli: klip adı taşınır (hedefle birlikte de)", () => {
  assert.deepEqual(niyetDogrula({ tur: "jest", jest: "el_salliyor", klip: "el_salla" }), { ok: true, deger: { tur: "jest", jest: "el_salliyor", klip: "el_salla" } });
  assert.deepEqual(niyetDogrula({ tur: "jest", jest: "işaret_ediyor", hedef: { tip: "oyuncu" }, klip: "dusun" }),
    { ok: true, deger: { tur: "jest", jest: "işaret_ediyor", hedef: { tip: "oyuncu" }, klip: "dusun" } });
});
test("jest niyetinin klip adı biçimsizse nedenli ret; klip varken jest yine zorunlu", () => {
  for (const k of ["", "El Salla", 3, null]) {
    const r = niyetDogrula({ tur: "jest", jest: "el_salliyor", klip: k });
    assert.equal(r.ok === false && /klip geçersiz/.test(r.hata), true, JSON.stringify(k));
  }
  assert.equal(niyetDogrula({ tur: "jest", klip: "el_salla" }).ok, false);
});
