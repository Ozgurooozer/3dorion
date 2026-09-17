// tools/sadakat.test.ts — ÖLÇÜM ALETİNİN KALİBRASYONU.
//
// Alete güvenmeden önce cevabı bilinen girdide koşulur. Aşağıdaki iki metin
// 2026-09-17 `bakdene` koşularının GERÇEK çıktılarıdır; ikisinin de sadık
// OLMADIĞI elle doğrulandı (spec 06 §1).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { puanla } from "./sadakat.ts";

const BEKLENTI = {
  beklenen: [["yönetim terminali"]],
  yabanci: [["masa"], ["monitör"], ["tahta"], ["pencere"], ["sandalye"], ["kapı"]],
};

test("GERÇEK koşu 1: cevabı hiç söylemedi, dört şey uydurdu", () => {
  const p = puanla("Önümde masa ve üzerindeki monitör var. Sol tarafta tahta, sağ tarafta pencere görünüyor.", BEKLENTI);
  assert.equal(p.soyledi, false);
  assert.deepEqual(p.uydurma, ["masa", "monitör", "tahta", "pencere"]);
  assert.equal(p.sadik, false);
});

test("GERÇEK koşu 2: cevabı söyledi AMA uydurma ekledi — sadık değil", () => {
  const p = puanla("Önümde yönetim terminali var, birkaç adım ötede. Yakınında da çalışma masası ve monitör görüyorum.", BEKLENTI);
  assert.equal(p.soyledi, true);
  assert.deepEqual(p.uydurma, ["masa", "monitör"]);
  assert.equal(p.sadik, false, "yarı doğru cevap sadık sayılmamalı");
});

test("temiz cevap sadıktır", () => {
  const p = puanla("Önümde yönetim terminali var, birkaç adım ötede.", BEKLENTI);
  assert.deepEqual(p, { soyledi: true, uydurma: [], sadik: true });
});

test("TÜRKÇE BÜYÜK HARF: 'YÖNETİM TERMİNALİ' eşleşir", () => {
  // Düz toLowerCase 'İ'yi 'i̇' (i + birleşik nokta) yapar ve eşleşme sessizce
  // kaçar — alet sadık cevabı sadakatsiz sayardı.
  assert.equal(puanla("ÖNÜMDE YÖNETİM TERMİNALİ VAR.", BEKLENTI).soyledi, true);
  assert.equal(puanla("KAPI açık.", BEKLENTI).uydurma[0], "kapı");
});

test("VARYANT: herhangi bir yazılışı yeter", () => {
  const b = { beklenen: [["yönetim terminali", "admin ekranı"]], yabanci: [] };
  assert.equal(puanla("Admin ekranı önümde.", b).soyledi, true);
});

test("boş cevap sadık değildir", () => {
  assert.equal(puanla("", BEKLENTI).sadik, false);
});

test("BİLİNEN SINIR: olumsuzlama ayırt edilmez", () => {
  // "masa yok" da uydurma sayılır. Kasıtlı: sayı yanlış tarafa, yani
  // KÖTÜMSER tarafa kayar — iyileşmeyi olduğundan küçük gösterir, büyük değil.
  assert.deepEqual(puanla("Önümde masa yok, yönetim terminali var.", BEKLENTI).uydurma, ["masa"]);
});
