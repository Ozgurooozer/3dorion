// world/avatar/klipOrnekleyici.test.ts — klip ÖRNEKLEYİCİ (spec 35 Dilim 5a): zaman (kısma/sarma), bitti mi, yumuşatma, iz değeri, gruplama, atlanan izler.
// Saf: Babylon yok. Sayılar elle hesaplanmış beklenen değerlerdir (tolerans 1e-9).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { klipDogrula, type AnimasyonKlibi } from "../../protocol/animasyon.ts";
import { atlananIzler, izDegeri, klipBittiMi, klipOrnekle, klipZamani, uzuvPozlari, yumusat } from "./klipOrnekleyici.ts";

const yakin = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

function klip(ek: Record<string, unknown>): AnimasyonKlibi {
  const r = klipDogrula({ surum: 1, ad: "k", jest: "el_salliyor", sure: 2, izler: [{ uzuv: "bas", kanal: "donme_x", anahtarlar: [{ t: 0, deger: 0 }, { t: 2, deger: 20 }] }], ...ek });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
}

test("döngüsüz zaman [0, süre]'ye kısılır; negatif/NaN 0", () => {
  const k = klip({});
  assert.deepEqual([klipZamani(k, 0.5), klipZamani(k, 2), klipZamani(k, 7), klipZamani(k, -1), klipZamani(k, NaN)], [0.5, 2, 2, 0, 0]);
});

test("döngülü zaman süreye göre sarılır", () => {
  const k = klip({ dongu: true });
  yakin(klipZamani(k, 2.5), 0.5);
  yakin(klipZamani(k, 4), 0);
  yakin(klipZamani(k, 1.25), 1.25);
});

test("döngüsüz klip süre dolunca BİTER, önce bitmez", () => {
  const k = klip({});
  assert.deepEqual([klipBittiMi(k, 1.99), klipBittiMi(k, 2), klipBittiMi(k, 5)], [false, true, true]);
});

test("döngülü klip ASLA kendiliğinden bitmez (1000 sn sonra bile)", () => {
  const k = klip({ dongu: true });
  assert.deepEqual([klipBittiMi(k, 2), klipBittiMi(k, 1000)], [false, false]);
});

test("yumuşatma: doğrusal, yumuşak (smoothstep), basamak; uçlar kısılır", () => {
  assert.deepEqual([yumusat("dogrusal", 0.25), yumusat("yumusak", 0.5), yumusat("yumusak", 0.25), yumusat("basamak", 0.99), yumusat("basamak", 1)], [0.25, 0.5, 0.15625, 0, 1]);
  assert.deepEqual([yumusat("yumusak", -1), yumusat("yumusak", 2)], [0, 1]);
});

test("iz değeri: ilk anahtardan önce ilk değer, sondan sonra son değer, arada ara değer", () => {
  const iz = { anahtarlar: [{ t: 1, deger: 10, yumusatma: "dogrusal" as const }, { t: 3, deger: 30, yumusatma: "dogrusal" as const }] };
  assert.deepEqual([izDegeri(iz, 0), izDegeri(iz, 2), izDegeri(iz, 5)], [10, 20, 30]);
});

test("yumuşatma segmentin BAŞINDAKİ anahtardan okunur", () => {
  const iz = { anahtarlar: [{ t: 0, deger: 0, yumusatma: "basamak" as const }, { t: 1, deger: 10, yumusatma: "dogrusal" as const }, { t: 2, deger: 20, yumusatma: "dogrusal" as const }] };
  assert.deepEqual([izDegeri(iz, 0.9), izDegeri(iz, 1.5)], [0, 15]);
});

test("tek anahtarlı iz sabittir", () => {
  assert.equal(izDegeri({ anahtarlar: [{ t: 0.5, deger: 7, yumusatma: "dogrusal" }] }, 1.5), 7);
});

test("klipOrnekle döngülü klipte sarılmış zamandan okur", () => {
  const k = klip({ dongu: true });
  assert.deepEqual(klipOrnekle(k, 3), [{ uzuv: "bas", kanal: "donme_x", deger: 10 }]);
});

test("klipOrnekle döngüsüz klip bittikten sonra SON değeri verir", () => {
  assert.deepEqual(klipOrnekle(klip({}), 9), [{ uzuv: "bas", kanal: "donme_x", deger: 20 }]);
});

test("uzuvPozlari kanalları uzva toplar; yazılmayan kanal 0", () => {
  const m = uzuvPozlari([
    { uzuv: "bas", kanal: "donme_x", deger: 5 }, { uzuv: "bas", kanal: "donme_y", deger: -3 }, { uzuv: "kok", kanal: "oteleme_y", deger: 0.2 },
  ]);
  assert.deepEqual([m.get("bas"), m.get("kok")], [
    { donme: { x: 5, y: -3, z: 0 }, oteleme: { x: 0, y: 0, z: 0 } },
    { donme: { x: 0, y: 0, z: 0 }, oteleme: { x: 0, y: 0.2, z: 0 } },
  ]);
});

test("atlanan izler: gövdenin uzuv kümesinde olmayan uzuvlar, 'uzuv.kanal' adıyla", () => {
  const k = klip({ izler: [
    { uzuv: "sag_kol", kanal: "donme_z", anahtarlar: [{ t: 0, deger: 0 }] },
    { uzuv: "sag_on_kol", kanal: "donme_z", anahtarlar: [{ t: 0, deger: 0 }] },
    { uzuv: "bas", kanal: "donme_x", anahtarlar: [{ t: 0, deger: 0 }] },
  ] });
  assert.deepEqual(atlananIzler(k, new Set(["sag_kol", "bas"])), ["sag_on_kol.donme_z"]);
  assert.deepEqual(atlananIzler(k, new Set()), ["sag_kol.donme_z", "sag_on_kol.donme_z", "bas.donme_x"]);
});
