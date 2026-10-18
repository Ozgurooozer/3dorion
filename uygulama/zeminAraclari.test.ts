// uygulama/zeminAraclari.test.ts — zemin kalemi araç tablosu ve ayar sınırları.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { KALEM_SINIRLARI, KALEM_VARSAYILAN, ZEMIN_ARACLARI, aracBilgisi, gucEtiketi, kalemAyariniDuzelt, yaricapAdimi } from "./zeminAraclari.ts";

test("araç tablosu: kimlikler benzersiz; her araçta ad, simge ve ipucu var", () => {
  assert.equal(new Set(ZEMIN_ARACLARI.map((a) => a.id)).size, ZEMIN_ARACLARI.length);
  for (const a of ZEMIN_ARACLARI) assert.ok(a.ad && a.simge && a.ipucu, a.id);
});

test("aracBilgisi: bilinmeyen araç HATA", () => {
  assert.equal(aracBilgisi("duzle").ad, "Düzle");
  assert.throws(() => aracBilgisi("yok" as never), /zemin aracı yok/);
});

test("gücün birimi araca göre: metre mi oran mı", () => {
  assert.equal(gucEtiketi("yukselt", 0.25), "0.25 m");
  assert.equal(gucEtiketi("puruz", 0.5), "0.50 m");
  assert.equal(gucEtiketi("yumusat", 0.25), "%25");
  assert.equal(gucEtiketi("duzle", 1), "%100");
});

test("ayar düzeltme: sınırlara oturur, verilmeyen alan değişmez, girdi değişmez", () => {
  const m = { ...KALEM_VARSAYILAN };
  const y = kalemAyariniDuzelt(m, { yaricap: 500, guc: 0, sertlik: 3 });
  assert.deepEqual([y.yaricap, y.guc, y.sertlik], [KALEM_SINIRLARI.yaricap.max, KALEM_SINIRLARI.guc.min, KALEM_SINIRLARI.sertlik.max]);
  assert.equal(y.nesneleriOturt, m.nesneleriOturt);
  assert.deepEqual(m, KALEM_VARSAYILAN);
  assert.equal(kalemAyariniDuzelt(m, { nesneleriOturt: false }).nesneleriOturt, false);
  assert.equal(kalemAyariniDuzelt(m, {}).yaricap, m.yaricap);
});

test("ayar düzeltme: sayı olmayan değer HATA (sessizce sıfıra düşmez)", () => {
  assert.throws(() => kalemAyariniDuzelt(KALEM_VARSAYILAN, { guc: Number.NaN }), /guc sayı olmalı/);
  assert.throws(() => kalemAyariniDuzelt(KALEM_VARSAYILAN, { yaricap: Infinity }), /yaricap sayı olmalı/);
});

test("yarıçap adımı: %15 büyür/küçülür, sınırda kalır", () => {
  assert.equal(yaricapAdimi(10, 1), 11.5);
  assert.ok(yaricapAdimi(10, -1) < 10);
  assert.equal(yaricapAdimi(KALEM_SINIRLARI.yaricap.max, 1), KALEM_SINIRLARI.yaricap.max);
  assert.equal(yaricapAdimi(KALEM_SINIRLARI.yaricap.min, -1), KALEM_SINIRLARI.yaricap.min);
});
