// mind/hafizaYonlendirici.test.ts — Bağlama hangi hafıza parçası girer (spec 16 F4).
//
// Izgara KURALLAR tablosundan türer: her kuralın her örneği o kuralı tetiklemeli.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { yonlendir, sadelestir, KURALLAR, DURUM_KURALLARI } from "./hafizaYonlendirici.ts";

for (const k of KURALLAR) {
  for (const o of k.ornekler) {
    test(`"${o}" → ${k.id}`, () => {
      assert.ok(yonlendir({ sozler: [o] }).kurallar.includes(k.id));
    });
  }
}

// Sorulmayan şey girmez (Ozyn'in kuralı; spec 16 P6).
for (const s of ["otur", "bana gel", "tahtaya merhaba yaz", "naber", "monitörü aç", "come here", "terminale ls yaz", "bugün hava güzel"]) {
  test(`sorulmayan söz boş istek üretir: "${s}"`, () => {
    assert.deepEqual(yonlendir({ sozler: [s] }), { durum: [], cekmece: [], kurallar: [] });
  });
}

test("sözsüz, olaysız uyanış boş istek üretir", () => {
  assert.deepEqual(yonlendir({ sozler: [] }).kurallar, []);
});

test("Türkçe harfler sadeleşir", () => {
  assert.equal(sadelestir("NEREDEYDİN, ne konuşmuştuk, çöğüş"), "neredeydin, ne konusmustuk, cogus");
});

test("'neredesin' yalnız şimdiki konumu ister", () => {
  assert.deepEqual(yonlendir({ sozler: ["neredesin"] }).durum, ["konum"]);
});

test("'neredeydin' önceki konumu ve önceki oturumu da ister", () => {
  assert.deepEqual(yonlendir({ sozler: ["neredeydin"] }).durum, ["konum", "onceki_konum", "onceki_oturum"]);
});

test("'ne konuşmuştuk' konuşma çekmecesinin en yenilerini ister (kelime ilgisi değil)", () => {
  assert.deepEqual(yonlendir({ sozler: ["ne konuşmuştuk"] }).cekmece, [{ cekmeceler: ["konusma"], mod: "son", adet: 4 }]);
});

test("sözde odadaki bir yerin adı geçerse konum istenir", () => {
  assert.deepEqual(yonlendir({ sozler: ["beyaz tahtaya git"], yerAdlari: ["beyaz tahta", "pencere"] }).durum, ["konum"]);
});

test("terminal hatası ders ve iş çekmecesini ister", () => {
  assert.deepEqual(yonlendir({ sozler: [], terminal: "hatali" }).cekmece, [DURUM_KURALLARI.terminalHata.cekmece]);
});

test("başarılı terminal çıktısı hiçbir şey istemez", () => {
  assert.deepEqual(yonlendir({ sozler: [], terminal: "basarili" }).kurallar, []);
});

test("başarısız niyet ders çekmecesini ister", () => {
  assert.deepEqual(yonlendir({ sozler: [], niyetHatasi: true }).kurallar, [DURUM_KURALLARI.niyetHata.id]);
});

test("aynı durum anahtarı iki kuraldan gelse de bir kez istenir", () => {
  const d = yonlendir({ sozler: ["neredesin ne yapıyorsun"] }).durum;
  assert.equal(d.filter((x) => x === "konum").length, 1);
});
