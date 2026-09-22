// brain-ir/v03.test.ts — v0.3 ilk milestone kabul testleri.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AliceBob, BeceriMotoru, KucukDunya, calistirOrnek, deneyimOlustur } from "./v03.ts";

test("deterministik dünya aynı başlangıçta aynı sonucu üretir", () => {
  const a = new KucukDunya(); const b = new KucukDunya();
  for (const eylem of ["sol", "ileri", "sag", "ileri"] as const) {
    assert.deepEqual(a.adim(eylem), b.adim(eylem));
  }
});

test("engelle karşılaşma outcome'a ve enerji defterine yansır", () => {
  const dunya = new KucukDunya();
  const once = dunya.gozlemle(); const sonuc = dunya.adim("ileri");
  assert.equal(once.onEngel, true);
  assert.equal(sonuc.carpisma, true);
  assert.equal(sonuc.basarili, false);
  assert.equal(sonuc.enerjiMaliyeti, 0.02);
  assert.deepEqual(sonuc.yeniDurum.konum, { x: 0, y: 0 });
});

test("XP novelty ve information gain ile farming'i azaltır", () => {
  const motor = new BeceriMotoru(); const dunya = new KucukDunya();
  const g = dunya.gozlemle(); const s = dunya.adim("ileri");
  const d1 = deneyimOlustur("EXP-1", g, "ileri", { basarili: true, enerji: 0.02 }, s, "bob");
  motor.deneyimUygula(d1); const xp1 = motor.beceri.xp;
  const d2 = deneyimOlustur("EXP-2", g, "ileri", { basarili: true, enerji: 0.02 }, s, "bob", g);
  motor.deneyimUygula(d2);
  assert.ok(d2.novelty <= d1.novelty);
  assert.ok(motor.beceri.xp >= xp1);
});

test("başarısızlık reflex'i hemen silmeden askıya alır", () => {
  const motor = new BeceriMotoru();
  motor.beceri.level = 5; motor.beceri.reflex = "aktif"; motor.beceri.confidence = 0.9;
  const dunya = new KucukDunya(); const g = dunya.gozlemle(); const s = dunya.adim("ileri");
  const d = deneyimOlustur("EXP-BAD", g, "ileri", { basarili: true, enerji: 0.02 }, s, "alice");
  motor.deneyimUygula(d);
  assert.equal(motor.beceri.reflex, "askida");
  assert.equal(motor.beceri.level, 5);
});

test("Alice/Bob rotası güvenli biçimde Alice'ten Bob'a düşer", () => {
  const yonetici = new AliceBob(); const motor = new BeceriMotoru();
  motor.beceri.level = 5; motor.beceri.reflex = "aktif"; motor.beceri.confidence = 0.9; motor.beceri.predictionError = 0.1;
  const dunya = new KucukDunya(); const g = dunya.gozlemle();
  yonetici.derle(motor.beceri, "sol", g.baglam);
  assert.deepEqual(yonetici.sec(g, motor.beceri), { kaynak: "alice", eylem: "sol" });
  motor.beceri.reflex = "askida";
  assert.equal(yonetici.sec(g, motor.beceri).kaynak, "bob");
});

test("ilk büyük deney experience -> skill -> level -> fast path zincirini çalıştırır", () => {
  const sonuc = calistirOrnek(80);
  assert.ok(sonuc.gecmis.length === 80);
  assert.ok(sonuc.beceri.xp > 0);
  assert.ok(sonuc.beceri.kullanim === 80);
  assert.ok(sonuc.bob > 0);
  assert.ok(sonuc.beceri.level >= 3, `level beklenenden düşük: ${sonuc.beceri.level}`);
  assert.ok(sonuc.yollar > 0 || sonuc.beceri.reflex === "askida");
});
