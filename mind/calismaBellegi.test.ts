// mind/calismaBellegi.test.ts — durumun ANI GİBİ davranmadığı yerler.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { calismaBellegiKur } from "./calismaBellegi.ts";

function düzenek(azamiYasMs = 30_000) {
  let t = 1_000_000;
  const cb = calismaBellegiKur({ azamiYasMs, simdi: () => t });
  return { cb, ilerle: (ms: number) => { t += ms; } };
}

test("ÜZERİNE YAZILIR — aynı anahtar birikmez, son gözlem geçerlidir", () => {
  // Biriktirseydi Orion "önümde hem tahta hem terminal var" derdi.
  const { cb } = düzenek();
  cb.yaz("onumde", "beyaz tahta");
  cb.yaz("onumde", "yönetim terminali");
  assert.deepEqual(cb.oku().map((g) => g.deger), ["yönetim terminali"]);
});

test("ESKİR — azami yaşı geçen gözlem okunmaz", () => {
  const { cb, ilerle } = düzenek(30_000);
  cb.yaz("onumde", "yönetim terminali");
  ilerle(29_000);
  assert.equal(cb.oku().length, 1, "henüz eskimemeli");
  ilerle(2_000);
  assert.deepEqual(cb.oku(), [], "31 sn sonra hâlâ 'şu an' sayılıyor");
  assert.deepEqual(cb.satirlar(), []);
});

test("YAŞ satırda yazar — model şimdiki ile biraz öncekini ayırabilsin", () => {
  const { cb, ilerle } = düzenek();
  cb.yaz("onumde", "yönetim terminali");
  ilerle(3_000);
  assert.deepEqual(cb.satirlar(), ["in front of you: yönetim terminali (you looked 3 sec ago)"]);
});

// Çerçeve İngilizce, NESNE ADI Türkçe (spec 06 §6.8): "masa, monitör" Ozyn'in
// dünyasına ait, çevrilmez; "in front of you" makineye konuşan çerçevedir.
test("iç adlar okunur karşılığına çevrilir, bilinmeyen ad olduğu gibi kalır", () => {
  const { cb } = düzenek();
  cb.yaz("yakin", "masa, monitör");
  cb.yaz("bilinmeyen", "x");
  const s = cb.satirlar().join("|");
  assert.match(s, /near you: masa, monitör/);
  assert.match(s, /bilinmeyen: x/);
  assert.doesNotMatch(s, /\byakin\b/, "iç ad bağlama sızdı");
});

test("EN YENİ ÖNCE — sıralama yaşa göre", () => {
  const { cb, ilerle } = düzenek();
  cb.yaz("onumde", "tahta");
  ilerle(5_000);
  cb.yaz("yakin", "terminal");
  assert.deepEqual(cb.oku().map((g) => g.anahtar), ["yakin", "onumde"]);
});

test("unut() tek anahtarı siler; boş bellek boş satır verir", () => {
  const { cb } = düzenek();
  cb.yaz("onumde", "x");
  cb.unut("onumde");
  assert.deepEqual(cb.satirlar(), []);
});
