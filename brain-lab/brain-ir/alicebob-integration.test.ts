// brain-ir/alicebob-integration.test.ts — Alice/Bob + dünya + outcome + skill tam döngüsü.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AliceBob, BeceriMotoru, KucukDunya, deneyimOlustur } from "./v03.ts";
import { DeliberativePlanner } from "./deliberative.ts";

test("Bob planner AliceBob yönlendirmesine bağlı olarak dünyada hedefe ulaşır", () => {
  const dunya = new KucukDunya();
  const motor = new BeceriMotoru();
  const yonetici = new AliceBob(new DeliberativePlanner({ derinlik: 4, nodeBudget: 512 }));
  let bobSayisi = 0; let planDugumleri = 0;
  for (let i = 0; i < 8 && !dunya.durumunuVer().tamamlandi; i++) {
    const gozlem = dunya.gozlemle();
    const karar = yonetici.sec(gozlem, motor.beceri, dunya.durumunuVer());
    assert.equal(karar.kaynak, "bob");
    assert.ok(karar.plan && karar.plan.length > 0);
    bobSayisi++; planDugumleri += karar.ziyaretEdilenDugum ?? 0;
    const sonuc = dunya.adim(karar.eylem);
    motor.deneyimUygula(deneyimOlustur(`FULL-${i}`, gozlem, karar.eylem, { basarili: !gozlem.onEngel || karar.eylem !== "ileri", enerji: sonuc.enerjiMaliyeti }, sonuc, karar.kaynak));
  }
  assert.equal(dunya.durumunuVer().tamamlandi, true);
  assert.equal(bobSayisi > 0, true);
  assert.ok(planDugumleri > 0);
});

test("yanlış Alice reflex'i outcome sonrası askıya alınır ve Bob planner devralır", () => {
  const dunya = new KucukDunya();
  const motor = new BeceriMotoru();
  motor.beceri.level = 5; motor.beceri.reflex = "aktif"; motor.beceri.confidence = 0.95; motor.beceri.successRate = 0.95; motor.beceri.predictionError = 0.1;
  const yonetici = new AliceBob(new DeliberativePlanner({ derinlik: 4, nodeBudget: 512 }));
  const gozlem = dunya.gozlemle();
  yonetici.derle(motor.beceri, "ileri", gozlem.baglam);
  const alice = yonetici.sec(gozlem, motor.beceri, dunya.durumunuVer());
  assert.deepEqual(alice, { kaynak: "alice", eylem: "ileri" });
  const sonuc = dunya.adim(alice.eylem);
  assert.equal(sonuc.carpisma, true);
  motor.deneyimUygula(deneyimOlustur("FULL-BAD", gozlem, alice.eylem, { basarili: true, enerji: 0.02 }, sonuc, "alice"));
  assert.equal(motor.beceri.reflex, "askida");
  const bob = yonetici.sec(dunya.gozlemle(), motor.beceri, dunya.durumunuVer());
  assert.equal(bob.kaynak, "bob");
  assert.notEqual(bob.eylem, "ileri");
  assert.ok((bob.ziyaretEdilenDugum ?? 0) > 0);
});
