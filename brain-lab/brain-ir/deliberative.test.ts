// brain-ir/deliberative.test.ts — Bob planner için deterministik kabul kapısı.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KucukDunya } from "./v03.ts";
import { DeliberativePlanner, adaySayisi } from "./deliberative.ts";

test("planner aynı dünya durumunda aynı ilk eylemi seçer", () => {
  const dunya = new KucukDunya(); const durum = dunya.durumunuVer();
  const planner = new DeliberativePlanner({ derinlik: 4, nodeBudget: 512 });
  const a = planner.planla(durum); const b = planner.planla(durum);
  assert.deepEqual(a, b);
  assert.equal(a.eylem, "sol", "engel önündeyken ileri çarpışma yolunu seçmemeli");
  assert.ok(a.ziyaretEdilenDugum <= 512);
});

test("node budget aramayı keser ama güvenli bir plan döndürür", () => {
  const dunya = new KucukDunya();
  const sonuc = new DeliberativePlanner({ derinlik: 8, nodeBudget: 10 }).planla(dunya.durumunuVer());
  assert.equal(sonuc.kesildi, true);
  assert.ok(sonuc.ziyaretEdilenDugum <= 10);
  assert.ok(["ileri", "sol", "sag", "bekle"].includes(sonuc.eylem));
});

test("arama bütçesi derinlik ve dallanma ile büyür", () => {
  assert.equal(adaySayisi(2, 4), 21);
  assert.equal(adaySayisi(4, 4), 341);
  assert.equal(adaySayisi(6, 4), 5461);
  assert.ok(adaySayisi(8, 4) > adaySayisi(6, 4));
});

test("plan tamamlanmayı hedefleyen ileri adımları tercih eder", () => {
  const dunya = new KucukDunya([]);
  const sonuc = new DeliberativePlanner({ derinlik: 4, nodeBudget: 512 }).planla(dunya.durumunuVer());
  assert.equal(sonuc.eylem, "ileri");
  assert.ok(sonuc.plan.length > 0);
});

test("receding-horizon Bob planlayıcısı engeli aşarak hedefe ulaşır", () => {
  const dunya = new KucukDunya();
  const planner = new DeliberativePlanner({ derinlik: 4, nodeBudget: 512 });
  for (let i = 0; i < 8 && !dunya.durumunuVer().tamamlandi; i++) {
    const karar = planner.planla(dunya.durumunuVer(), dunya.gozlemle());
    dunya.adim(karar.eylem);
  }
  assert.equal(dunya.durumunuVer().tamamlandi, true);
});
