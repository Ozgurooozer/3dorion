// mind/ajanda.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Ajanda } from "./ajanda.ts";

test("meşgulken hiçbir öneri üretmez", () => {
  const a = new Ajanda({ asgariAralikMs: 1000, azamiSapmaMs: 0 });
  for (let t = 0; t < 50_000; t += 1000) {
    assert.equal(a.tikle(t, true), null);
  }
  assert.equal(a.oneriSayisi(), 0);
});

test("asgari aralıktan önce öneri üretmez", () => {
  const a = new Ajanda({ asgariAralikMs: 10_000, azamiSapmaMs: 0 });
  assert.notEqual(a.tikle(0, false), null);
  assert.equal(a.tikle(1000, false), null);
  assert.equal(a.tikle(5000, false), null);
});

test("asgari aralık geçince yeni bir öneri üretir", () => {
  const a = new Ajanda({ asgariAralikMs: 5000, azamiSapmaMs: 0 });
  assert.notEqual(a.tikle(0, false), null);
  assert.notEqual(a.tikle(6000, false), null);
  assert.equal(a.oneriSayisi(), 2);
});

test("önerdiği niyet yalnızca bak veya jest'tir", () => {
  const a = new Ajanda({ asgariAralikMs: 100, azamiSapmaMs: 0 });
  for (let t = 0; t < 10_000; t += 100) {
    const n = a.tikle(t, false);
    if (n) assert.ok(n.tur === "bak" || n.tur === "jest");
  }
});

test("aynı tohum + aynı zaman dizisi → aynı sonuç (determinizm)", () => {
  const uret = () => {
    const a = new Ajanda({ asgariAralikMs: 1000, azamiSapmaMs: 500, tohum: 3 });
    const sonuclar = [];
    for (let t = 0; t < 5000; t += 200) sonuclar.push(a.tikle(t, false));
    return sonuclar;
  };
  assert.deepEqual(uret(), uret());
});

test("ertele() sonraki öneriyi geciktirir", () => {
  const a = new Ajanda({ asgariAralikMs: 5000, azamiSapmaMs: 0 });
  assert.notEqual(a.tikle(0, false), null);
  a.ertele(2000);
  assert.equal(a.tikle(6000, false), null);
  assert.notEqual(a.tikle(7001, false), null);
});
