// world/level/cekirdek/donusum.test.ts — Dönüş/ölçek kısa ↔ tam biçim, kimlik üretimi, grup zinciri, şema (spec 22).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { donusVec, olcekVec, kisaDonus, kisaOlcek, aciIndir, kisaKonum } from "./donusum.ts";
import { yeniId, yeniIdler, kimlikleriDoldur } from "./kimlik.ts";
import { grupZinciri, etkinBayrak } from "./grup.ts";
import { levelTanimiDogrula } from "./levelTanimi.ts";
import { ornekTanim } from "./ornekTanim.ts";

// ── dönüşüm biçimleri ──
test("sayı dönüş yalnız Y ekseni", () => { assert.deepEqual(donusVec(90), [0, 90, 0]); });
test("sayı ölçek üç eksene eşit", () => { assert.deepEqual(olcekVec(2), [2, 2, 2]); });
test("yalnız Y dönüşü dosyaya sayı olarak yazılır", () => { assert.equal(kisaDonus([0, 45, 0]), 45); });
test("eğik dönüş dosyaya dizi olarak yazılır", () => { assert.deepEqual(kisaDonus([10, 45, 0]), [10, 45, 0]); });
test("370° dosyada 10°", () => { assert.equal(kisaDonus([0, 370, 0]), 10); });
test("açı indirme: -180 → 180 (tek gösterim)", () => { assert.equal(aciIndir(-180), 180); });
test("eşit ölçek dosyaya tek sayı", () => { assert.equal(kisaOlcek([1.5, 1.5, 1.5]), 1.5); });
test("eşit olmayan ölçek dizi", () => { assert.deepEqual(kisaOlcek([1, 2, 1]), [1, 2, 1]); });
test("konum mm'ye yuvarlanır", () => { assert.deepEqual(kisaKonum([1.23456, -0.00001, 2]), [1.235, 0, 2]); });

// ── kimlik ──
test("yeni kimlik en büyüğün bir fazlası", () => { assert.equal(yeniId(["n1", "n7", "n3"]), "n8"); });
test("başka önekli kimlikler sayılmaz", () => { assert.equal(yeniId(["g9", "n2"]), "n3"); });
test("toplu kimlik sırayla artar", () => { assert.deepEqual(yeniIdler(["n2"], 2), ["n3", "n4"]); });
test("eksik kimlikler doldurulur, var olanlara dokunulmaz", () => {
  assert.deepEqual(kimlikleriDoldur([{ id: "n5" }, {}, {}]).map((x) => x.id), ["n5", "n6", "n7"]);
});
test("eksik yoksa aynı dizi döner (gereksiz kopya yok)", () => {
  const l = [{ id: "n1" }];
  assert.equal(kimlikleriDoldur(l), l);
});

// ── grup ──
const GRUPLAR = [{ id: "g1", ad: "şehir", kilitli: true }, { id: "g2", ad: "ev", ust: "g1" }];
test("grup zinciri içten dışa", () => { assert.deepEqual(grupZinciri("g2", GRUPLAR).map((g) => g.id), ["g2", "g1"]); });
test("üst grubun kilidi içtekine geçer", () => {
  assert.equal(etkinBayrak({ varlik: "A", konum: [0, 0, 0], donus: 0, olcek: 1, grup: "g2" }, GRUPLAR, "kilitli"), true);
});
test("grupsuz nesnede bayrak yalnız kendisinden", () => {
  assert.equal(etkinBayrak({ varlik: "A", konum: [0, 0, 0], donus: 0, olcek: 1 }, GRUPLAR, "kilitli"), false);
});

// ── şema ──
const NESNE = { varlik: "A", konum: [0, 0, 0], donus: 0, olcek: 1 };
const hata = (ek: Record<string, unknown>) => { const d = levelTanimiDogrula({ ...ornekTanim(), ...ek }); return d.ok ? "" : d.hata; };
test("üç eksen dönüş ve ölçek geçerli", () => { assert.equal(hata({ nesneler: [{ ...NESNE, donus: [1, 2, 3], olcek: [1, 2, 3] }] }), ""); });
test("ölçek ekseni sıfırsa hata", () => { assert.match(hata({ nesneler: [{ ...NESNE, olcek: [1, 0, 1] }] }), /olcek/); });
test("yinelenen nesne kimliği hata", () => { assert.match(hata({ nesneler: [{ ...NESNE, id: "n1" }, { ...NESNE, id: "n1" }] }), /yinelenen/); });
test("olmayan gruba bağlı nesne hata", () => { assert.match(hata({ nesneler: [{ ...NESNE, grup: "g9" }] }), /olmayan grup/); });
test("grup döngüsü hata", () => {
  assert.match(hata({ gruplar: [{ id: "a", ad: "a", ust: "b" }, { id: "b", ad: "b", ust: "a" }] }), /döngü/);
});
test("gizli alanı mantıksal değilse hata", () => { assert.match(hata({ nesneler: [{ ...NESNE, gizli: "evet" }] }), /gizli/); });
test("kamera yer imi konum+hedef ister", () => { assert.match(hata({ kameraYerleri: [{ ad: "a", konum: [0, 0, 0] }] }), /kameraYerleri/); });
