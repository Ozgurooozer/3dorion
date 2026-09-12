"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Dikkat } from "./dikkat.ts";
import type { Algi } from "../protocol/algi.ts";

/** Kontrollü saat: bütçe/tekrar/kısma testleri gerçek zamana bağlı olmamalı. */
function saatli(baslangic = 1_000_000) {
  let t = baslangic;
  return { simdi: () => t, ilerle(ms: number) { t += ms; } };
}

const duydum = (metin: string): Algi => ({ tur: "duydum", metin, kesin: true });
const tik = (): Algi => ({ tur: "tik", t: 1, dt: 0.05, orion: {} as never, oyuncu: {} as never });

test("tik ASLA beyne gitmez — maliyet tavanı kuralı", () => {
  const d = new Dikkat();
  for (let i = 0; i < 100; i++) {
    const k = d.karar(tik());
    assert.equal(k.gecsin, false);
    assert.equal(k.sebep, "tik_yasak");
  }
  assert.equal(d.sayac().gecen, 0);
});

test("konuşma beyne gider", () => {
  const d = new Dikkat();
  assert.equal(d.karar(duydum("merhaba")).gecsin, true);
});

test("yerel kanaldaki algı beyne YÜKSELTİLEMEZ", () => {
  const d = new Dikkat();
  const k = d.karar({ tur: "yakin", nesneler: [] });
  assert.equal(k.gecsin, false);
  assert.equal(k.sebep, "yerel_kanal");
});

test("başarısız niyet sonucu istisnadır — Orion yapamadığını bilmeli", () => {
  const d = new Dikkat();
  const hata = d.karar({ tur: "sonuc", sonuc: { niyet_id: "x", durum: "hata", not: "ulaşılamaz" } });
  assert.equal(hata.gecsin, true);
  const basarili = d.karar({ tur: "sonuc", sonuc: { niyet_id: "y", durum: "bitti" } });
  assert.equal(basarili.gecsin, false);
  assert.equal(basarili.sebep, "yerel_kanal");
});

test("aynı konuşma pencere içinde tekrar geçmez, pencere sonrası geçer", () => {
  const s = saatli();
  const d = new Dikkat({ simdi: s.simdi, tekrarPenceresiMs: 4000 });
  assert.equal(d.karar(duydum("selam")).gecsin, true);
  s.ilerle(1000);
  const tekrar = d.karar(duydum("selam"));
  assert.equal(tekrar.gecsin, false);
  assert.equal(tekrar.sebep, "tekrar");
  s.ilerle(4000);
  assert.equal(d.karar(duydum("selam")).gecsin, true);
});

test("farklı içerik tekrar sayılmaz", () => {
  const s = saatli();
  const d = new Dikkat({ simdi: s.simdi });
  assert.equal(d.karar(duydum("bir")).gecsin, true);
  assert.equal(d.karar(duydum("iki")).gecsin, true);
});

test("terminal çıktısı kısılır — akan derleme beyni her satırda uyandırmaz", () => {
  const s = saatli();
  const d = new Dikkat({ simdi: s.simdi, terminalKisMs: 2500 });
  assert.equal(d.karar({ tur: "terminal", kuyruk: "satir 1", kesildi: false }).gecsin, true);
  s.ilerle(500);
  const k = d.karar({ tur: "terminal", kuyruk: "satir 2", kesildi: false });
  assert.equal(k.gecsin, false);
  assert.equal(k.sebep, "kisildi");
  s.ilerle(2500);
  assert.equal(d.karar({ tur: "terminal", kuyruk: "satir 3", kesildi: false }).gecsin, true);
});

test("dakika bütçesi aşılınca durur, pencere kayınca yeniden açılır", () => {
  const s = saatli();
  const d = new Dikkat({ simdi: s.simdi, dakikaBasinaAzami: 3, tekrarPenceresiMs: 0 });
  for (let i = 0; i < 3; i++) {
    s.ilerle(100);
    assert.equal(d.karar(duydum(`m${i}`)).gecsin, true, `mesaj ${i}`);
  }
  s.ilerle(100);
  const k = d.karar(duydum("fazla"));
  assert.equal(k.gecsin, false);
  assert.equal(k.sebep, "butce");
  s.ilerle(61_000);
  assert.equal(d.karar(duydum("yeni dakika")).gecsin, true);
});

test("önemsiz olaylar gürültü sayılır", () => {
  const d = new Dikkat();
  const k = d.karar({ tur: "olay", ad: "kamera_degisti" });
  assert.equal(k.gecsin, false);
  assert.equal(k.sebep, "onemsiz");
  assert.equal(d.karar({ tur: "olay", ad: "oyuncu_odaya_girdi" }).gecsin, true);
});

test("sifirla kısıtları kaldırır — kullanıcı bekletilemez", () => {
  const s = saatli();
  const d = new Dikkat({ simdi: s.simdi, dakikaBasinaAzami: 1 });
  assert.equal(d.karar(duydum("bir")).gecsin, true);
  assert.equal(d.karar(duydum("iki")).gecsin, false);
  d.sifirla();
  assert.equal(d.karar(duydum("iki")).gecsin, true);
});

test("sayaç geçen ve düşeni ayrı tutar", () => {
  const s = saatli();
  const d = new Dikkat({ simdi: s.simdi, dakikaBasinaAzami: 1 });
  d.karar(duydum("a"));
  s.ilerle(10);
  d.karar(duydum("b"));
  const c = d.sayac();
  assert.equal(c.gecen, 1);
  assert.ok(c.dusen >= 1);
});
