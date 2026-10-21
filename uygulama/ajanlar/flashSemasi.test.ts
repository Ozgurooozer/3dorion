// uygulama/ajanlar/flashSemasi.test.ts — Flash'ın zihin haritası: tanım ve karar kaydından düğümlere (spec 33 dilim 4).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { FLASH_SEMASI, flashSemaKancasi, type SemaYazici } from "./flashSemasi.ts";
import { flashDuzenegi } from "../../flash/flashTest.ts";

/** Vuruşları biriktiren sahte şema. */
function sahteSema(): SemaYazici & { vurulan: string[]; arizalar: string[] } {
  const vurulan: string[] = [], arizalar: string[] = [];
  return { vurulan, arizalar, vur: (ad) => { vurulan.push(ad); }, ariza: (ad, a) => { if (a) arizalar.push(ad); }, durumYaz: () => {} };
}

/** Gerçek Flash köprüsünü sahte şemaya bağla (karar satırları + niyetler, flashBaglantisi.ts'teki gibi), bir söz söyle. */
async function soyle(metin: string) {
  const s = sahteSema();
  const k = flashSemaKancasi(s);
  const d = flashDuzenegi({ niyetDinle: (n, yon) => k.niyet(n, yon) });
  d.f.kararDinle((satir) => k.karar(satir));
  try { d.soyle(metin); await d.bekle(20); } finally { d.kapat(); }
  return s;
}

test("Flash şemasında LLM (DÜŞÜNCE/beyin) düğümü YOK", () => {
  assert.equal(FLASH_SEMASI.dugumler.some((d) => d.ad === "beyin" || d.lob === "bulut"), false);
});

test("Flash şemasının her oku var olan iki düğümü bağlar", () => {
  const adlar = new Set(FLASH_SEMASI.dugumler.map((d) => d.ad));
  assert.deepEqual(FLASH_SEMASI.oklar.filter(([a, b]) => !adlar.has(a) || !adlar.has(b)), []);
});

test("Flash şemasında sütun başlığı sayısı sütun sayısına eşit", () => {
  assert.equal(FLASH_SEMASI.sutunAdlari.length, Math.max(...FLASH_SEMASI.dugumler.map((d) => d.sutun)) + 1);
});

test("Flash şemasının toplamları var olan düğümleri sayar", () => {
  const adlar = new Set(FLASH_SEMASI.dugumler.map((d) => d.ad));
  assert.deepEqual(FLASH_SEMASI.toplamlar.filter(([, ad]) => !adlar.has(ad)), []);
});

test("'otur': ALGI → DİKKAT → KOMUT → BEDEN yanar, BİLMİYORUM yanmaz", async () => {
  const s = await soyle("otur");
  assert.deepEqual(["algi", "dikkat", "komut", "beden", "secenek"].map((d) => s.vurulan.includes(d)), [true, true, true, true, false]);
});

test("anlaşılmayan söz: BİLMİYORUM ve SÖZ yanar, KOMUT yanmaz", async () => {
  const s = await soyle("bugün hava nasıl");
  assert.deepEqual(["secenek", "soz", "komut"].map((d) => s.vurulan.includes(d)), [true, true, false]);
});

test("NPC'nin yapamadığı niyet BEDEN düğümünü arızalı gösterir", async () => {
  const s = await soyle("bilgisayarı aç");
  assert.deepEqual(s.arizalar, ["beden"]);
});
