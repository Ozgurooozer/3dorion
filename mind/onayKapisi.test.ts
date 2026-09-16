// mind/onayKapisi.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OnayKapisi } from "./onayKapisi.ts";

function saatli(t0 = 1_000_000) {
  let t = t0;
  return { simdi: () => t, ilerle(ms: number) { t += ms; } };
}

test("öneri bekler, onaylanmadan komut ÇIKMAZ", () => {
  const k = new OnayKapisi();
  assert.equal(k.durum, "bos");
  k.oner("n1", "npm test", "testleri koşmak için");
  assert.equal(k.durum, "bekliyor");
  assert.equal(k.bekleyen?.komut, "npm test");
});

test("onayla() komutu döner ve kapıyı boşaltır", () => {
  const k = new OnayKapisi();
  k.oner("n1", "npm test", "gerekçe");
  const o = k.onayla();
  assert.equal(o?.komut, "npm test");
  assert.equal(k.durum, "bos");
  assert.equal(k.sayac().onaylanan, 1);
});

test("reddet() komutu ÇALIŞTIRMAZ, kapıyı boşaltır", () => {
  const k = new OnayKapisi();
  k.oner("n1", "rm -rf .", "gerekçe");
  const o = k.reddet();
  assert.equal(o?.komut, "rm -rf .");
  assert.equal(k.durum, "bos");
  assert.equal(k.sayac().reddedilen, 1);
  assert.equal(k.sayac().onaylanan, 0);
});

test("bekleyen öneri EZİLEMEZ — ikinci öneri reddedilir", () => {
  // Kritik: model arka arkaya öneri gönderirse kullanıcı bir komutu okurken
  // ekran değişir ve onay tuşu BAŞKA komuta basmış olur.
  const k = new OnayKapisi();
  assert.equal(k.oner("n1", "npm test", "g").kabul, true);
  const ikinci = k.oner("n2", "rm -rf .", "g");
  assert.equal(ikinci.kabul, false);
  assert.match(ikinci.sebep ?? "", /zaten onay bekleyen/);
  assert.equal(k.bekleyen?.komut, "npm test", "ilk öneri korunmalı");
  assert.equal(k.sayac().ezilmeyeCalisan, 1);
});

test("ZAMAN AŞIMI onaylamaz, DÜŞÜRÜR", () => {
  // "Beklerken kabul edildi" diye bir sey olmamali.
  const s = saatli();
  const k = new OnayKapisi({ zamanAsimiMs: 5000, simdi: s.simdi });
  k.oner("n1", "rm -rf .", "g");
  s.ilerle(5001);
  const dusen = k.tikle();
  assert.equal(dusen?.komut, "rm -rf .");
  assert.equal(k.durum, "bos");
  assert.equal(k.sayac().dusen, 1);
  assert.equal(k.sayac().onaylanan, 0, "zaman aşımı ASLA onay sayılmaz");
});

test("süresi dolmuş öneri onaylanamaz", () => {
  const s = saatli();
  const k = new OnayKapisi({ zamanAsimiMs: 5000, simdi: s.simdi });
  k.oner("n1", "rm -rf .", "g");
  s.ilerle(9999);
  assert.equal(k.onayla(), null, "süresi geçmiş öneri onaylanamamalı");
  assert.equal(k.sayac().onaylanan, 0);
  assert.equal(k.sayac().dusen, 1);
});

test("boş kapıda onay/ret null döner, çökmez", () => {
  const k = new OnayKapisi();
  assert.equal(k.onayla(), null);
  assert.equal(k.reddet(), null);
});

test("boş komut önerilemez", () => {
  const k = new OnayKapisi();
  assert.equal(k.oner("n1", "   ", "g").kabul, false);
  assert.equal(k.durum, "bos");
});

test("risk sınıflandırması öneriye İLİŞTİRİLİR — onay ekranı bilgilendirsin", () => {
  const k = new OnayKapisi();
  k.oner("n1", "Remove-Item -Recurse -Force dist", "eski derlemeyi sil");
  assert.equal(k.bekleyen?.risk.seviye, "yikici");
  k.reddet();
  k.oner("n2", "git status", "duruma bak");
  assert.equal(k.bekleyen?.risk.seviye, "okur");
});

test("her karar DENETİM İZİNE yazılır", () => {
  const s = saatli();
  const k = new OnayKapisi({ zamanAsimiMs: 5000, simdi: s.simdi });
  k.oner("n1", "npm test", "g"); s.ilerle(100); k.onayla();
  k.oner("n2", "rm -rf .", "g"); s.ilerle(200); k.reddet();
  k.oner("n3", "npm i", "g"); s.ilerle(6000); k.tikle();

  const g = k.gecmis();
  assert.deepEqual(g.map((x) => x.karar), ["onay", "ret", "dustu"]);
  assert.equal(g[0]?.sureMs, 100);
  assert.deepEqual(g.map((x) => x.oneri.komut), ["npm test", "rm -rf .", "npm i"]);
});

test("denetim izi sınırsız büyümez", () => {
  const k = new OnayKapisi();
  for (let i = 0; i < 250; i++) { k.oner(`n${i}`, `komut${i}`, "g"); k.reddet(); }
  assert.ok(k.gecmis().length <= 200, `gecmis=${k.gecmis().length}`);
});

test("bekleyen() kopya döner — dışarıdan bozulamaz", () => {
  const k = new OnayKapisi();
  k.oner("n1", "npm test", "g");
  const b = k.bekleyen!;
  b.komut = "rm -rf .";
  assert.equal(k.bekleyen?.komut, "npm test", "bekleyen öneri dışarıdan değiştirilememeli");
});
