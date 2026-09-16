// world/davranisDenemesi.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DavranisDefteri, kusurlar, konudanSapti, type SenaryoSonucu } from "./davranisDenemesi.ts";

const s = (uzerine: Partial<SenaryoSonucu> = {}): SenaryoSonucu => ({
  ad: "deneme", soyledi: [], niyetler: [], duyulmayanMetin: [],
  gecenMs: 1000, ilkTepkiMs: 500, ...uzerine,
});

test("defter söylenenleri, niyetleri ve duyulmayanı ayrı tutar", () => {
  const d = new DavranisDefteri();
  const k = d.kayit();
  k.soyle("merhaba");
  k.niyet("soyle");
  k.duyulmayan("düşünüyorum...");
  const r = d.topla("t", 500);
  assert.deepEqual(r.soyledi, ["merhaba"]);
  assert.deepEqual(r.niyetler, ["soyle"]);
  assert.deepEqual(r.duyulmayanMetin, ["düşünüyorum..."]);
  d.sifirla();
  assert.equal(d.topla("t", 0).soyledi.length, 0);
});

test("konudanSapti boş listede asla sapma demez", () => {
  assert.equal(konudanSapti(["merhaba"], []), false);
  assert.equal(konudanSapti([], ["hata"]), false);
});

test("konuşması beklenirken sessizlik KUSURDUR", () => {
  const k = kusurlar(s({ niyetler: ["bak"] }), true);
  assert.equal(k.length, 1);
  assert.equal(k[0]?.tur, "sessiz");
});

test("konuşması beklenmeyen yerde sessizlik kusur DEĞİLDİR", () => {
  assert.deepEqual(kusurlar(s({ niyetler: ["bak"] }), false), []);
});

test("araç yerine düz metin üretmek kusurdur — kullanıcı duymaz", () => {
  const k = kusurlar(s({ duyulmayanMetin: ["Tabii, bakayım."] }), false);
  assert.equal(k.length, 1);
  assert.equal(k[0]?.tur, "araci_yok");
});

test("düz metin ÜSTÜNE gerçekten konuştuysa kusur sayılmaz", () => {
  const k = kusurlar(s({ soyledi: ["hata var"], duyulmayanMetin: ["düşünce"] }), true);
  assert.deepEqual(k, []);
});

test("yavaşlık ÖLÇÜM PENCERESİNE değil, ilk tepki anına bakar", () => {
  // Gerileme koruması: eski sürüm gecenMs'i (benim bekleme sürem) gecikme
  // sanıyordu ve her senaryo sabit "22 sn" çıkıyordu.
  const yavas = kusurlar(s({ soyledi: ["a"], gecenMs: 25_000, ilkTepkiMs: 21_000 }), true, { yavasEsikMs: 12_000 });
  assert.equal(yavas[0]?.tur, "yavas");
  const hizli = kusurlar(s({ soyledi: ["a"], gecenMs: 25_000, ilkTepkiMs: 900 }), true, { yavasEsikMs: 12_000 });
  assert.deepEqual(hizli, [], "uzun ölçüm penceresi tek başına yavaşlık değildir");
});

test("konudan sapma: gördüğü şeyle ilgisiz cevap işaretlenir", () => {
  const sapan = kusurlar(
    s({ soyledi: ["Merhaba, nasıl yardımcı olabilirim?"] }), true,
    { beklenenKelimeler: ["komut", "bulunamad", "hata"] });
  assert.ok(sapan.some((k) => k.tur === "konudan_sapma"));

  const ilgili = kusurlar(
    s({ soyledi: ["Komut bulunamadı diyor, yazımını kontrol et."] }), true,
    { beklenenKelimeler: ["komut", "bulunamad", "hata"] });
  assert.ok(!ilgili.some((k) => k.tur === "konudan_sapma"));
});

test("beklenen kelime verilmezse konu denetimi yapılmaz", () => {
  assert.deepEqual(kusurlar(s({ soyledi: ["herhangi bir sey"] }), true), []);
});

test("GERİLEME: şimdiki zamanlı yanlış atıf da yakalanır", () => {
  // Canlı koşudan (2026-09-12): dedektörün ilk hâli bu cümleyi kaçırdı.
  const kacan = "Ozyn terminalinde bir komut veriyorum. Bekleyin...";
  assert.ok(kusurlar(s({ soyledi: [kacan] }), true).some((k) => k.tur === "yanlis_atif"));

  // Geçmiş zamanlı hâli zaten yakalanıyordu — kırılmadığını doğrula.
  const eski = "Terminalde yazdığım komut tanınmıyor.";
  assert.ok(kusurlar(s({ soyledi: [eski] }), true).some((k) => k.tur === "yanlis_atif"));

  // DOĞRU atıf kusur sayılmamalı (yanlış pozitif kontrolü).
  const dogru = "Terminalde `x` komutu tanımlı değil. Bu komutu çalıştırmaya çalıştığın görünüyor.";
  assert.ok(!kusurlar(s({ soyledi: [dogru] }), true).some((k) => k.tur === "yanlis_atif"));
});
