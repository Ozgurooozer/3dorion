// host/hafizaDosyasi.test.ts — Orion'un hafızası diskte, kaybolmamalı.
//
// Bu testler NAİF ÇÖZÜMDEN ÖNCE yazıldı (spec 07 Faz 1). Hedefledikleri
// çöküş biçimleri:
//   - yarıda kalan yazım dosyayı bozar (naif `writeFileSync` doğrudan hedefe)
//   - bozuk dosya "boş hafıza" sanılır ve bir sonraki yazım GERÇEK hafızayı
//     boş diziyle ezer — en tehlikelisi, çünkü sessiz ve geri dönüşsüz
//   - bozuk dosya silinir; içindeki kurtarılabilir veri kaybolur
//   - çökmüş bir yazımdan kalan `.tmp` okumayı zehirler
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hafizaDosyasiOku, hafizaDosyasiYaz } from "./hafizaDosyasi.js";

function geciciDizin(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "orion-hafiza-"));
}

test("dosya YOKSA durum 'yok' — boş dizi değil", () => {
  const d = geciciDizin();
  const s = hafizaDosyasiOku(path.join(d, "hafiza.json"));
  // Ayrım önemli: "yok" göçü tetikler, "boş dizi" tetiklemez.
  assert.equal(s.durum, "yok");
});

test("yazılan aynen okunur", () => {
  const d = geciciDizin();
  const yol = path.join(d, "hafiza.json");
  const kayitlar = [{ metin: "kırmızı kalem masada", olusma: 1 }, { metin: "gti yazım hatası", olusma: 2 }];
  hafizaDosyasiYaz(yol, kayitlar);
  const s = hafizaDosyasiOku(yol);
  assert.equal(s.durum, "var");
  assert.deepEqual(s.durum === "var" && s.kayitlar, kayitlar);
});

test("ATOMİK: yazımdan sonra geride .tmp kalmaz", () => {
  const d = geciciDizin();
  const yol = path.join(d, "hafiza.json");
  hafizaDosyasiYaz(yol, [{ a: 1 }]);
  hafizaDosyasiYaz(yol, [{ a: 2 }]);
  const artik = fs.readdirSync(d).filter((f) => f !== "hafiza.json");
  assert.deepEqual(artik, [], `geride kalan: ${artik.join(", ")}`);
});

test("ATOMİK: çökmüş bir yazımdan kalan .tmp okumayı zehirlemez", () => {
  const d = geciciDizin();
  const yol = path.join(d, "hafiza.json");
  hafizaDosyasiYaz(yol, [{ metin: "gerçek anı" }]);
  // Yarıda kalmış yazımı taklit et: yarım JSON'lu geçici dosya.
  fs.writeFileSync(`${yol}.tmp`, '[{"metin": "yarım');
  const s = hafizaDosyasiOku(yol);
  assert.equal(s.durum, "var");
  assert.deepEqual(s.durum === "var" && s.kayitlar, [{ metin: "gerçek anı" }]);
});

test("BOZUK dosya 'yok' ya da BOŞ sayılmaz — yoksa bir sonraki yazım hafızayı ezer", () => {
  const d = geciciDizin();
  const yol = path.join(d, "hafiza.json");
  fs.writeFileSync(yol, '[{"metin": "yarıda kesilmiş');
  const s = hafizaDosyasiOku(yol);
  assert.equal(s.durum, "bozuk", `bozuk dosya '${s.durum}' olarak okundu`);
});

test("BOZUK dosya SİLİNMEZ — kurtarılabilsin diye yanına taşınır", () => {
  const d = geciciDizin();
  const yol = path.join(d, "hafiza.json");
  const ham = '[{"metin": "kurtarılabilir ama bozuk';
  fs.writeFileSync(yol, ham);
  const s = hafizaDosyasiOku(yol);
  assert.equal(s.durum, "bozuk");
  const tasindi = s.durum === "bozuk" ? s.tasindi : "";
  assert.ok(tasindi && fs.existsSync(tasindi), "bozuk dosya korunmadı");
  assert.equal(fs.readFileSync(tasindi, "utf8"), ham, "bozuk dosyanın içeriği değişti");
  // Asıl yol artık boş: bir sonraki okuma "yok" görür ve göç devreye girer.
  assert.equal(hafizaDosyasiOku(yol).durum, "yok");
});

test("dizi OLMAYAN geçerli JSON da bozuk sayılır", () => {
  const d = geciciDizin();
  const yol = path.join(d, "hafiza.json");
  fs.writeFileSync(yol, '{"beklenmeyen": "nesne"}');
  assert.equal(hafizaDosyasiOku(yol).durum, "bozuk");
});

test("Türkçe karakterler bozulmadan gidip gelir", () => {
  const d = geciciDizin();
  const yol = path.join(d, "hafiza.json");
  const k = [{ metin: "önünde yönetim terminali — ışık, çığ, şöyle, İstanbul" }];
  hafizaDosyasiYaz(yol, k);
  const s = hafizaDosyasiOku(yol);
  assert.deepEqual(s.durum === "var" && s.kayitlar, k);
});

test("dizin yoksa oluşturulur", () => {
  const d = geciciDizin();
  const yol = path.join(d, "alt", "klasor", "hafiza.json");
  hafizaDosyasiYaz(yol, [{ a: 1 }]);
  assert.equal(hafizaDosyasiOku(yol).durum, "var");
});
