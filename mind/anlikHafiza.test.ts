// mind/anlikHafiza.test.ts — anlık hafıza dosyası: otomatik bölüm üretimi, yalnız işaretli bölgeyi güncelleme, kaydetme birleştirmesi.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { ISARET_BASI, ISARET_SONU, bolumuGuncelle, bolumuOku, kaydetBirlestir, otomatikBlok } from "./anlikHafiza.ts";
import type { DurumKaydi } from "./durumDefteri.ts";

const k = (anahtar: DurumKaydi["anahtar"], deger: string, t = new Date(2026, 9, 18, 14, 32).getTime()): DurumKaydi => ({ anahtar, deger, t });
const dosya = (blok: string, onde = "ÖN", arka = "ARKA") => `${onde}\n${ISARET_BASI}\n${blok}\n${ISARET_SONU}\n${arka}`;

test("blok: sabit sırada, mutlak saatle ('14:32'); kayıt yoksa bunu söyler", () => {
  const b = otomatikBlok([k("son_is", "git status"), k("konum", "masanın başı")]);
  assert.equal(b, "- Yer: masanın başı (14:32)\n- Son iş: git status (14:32)");
  assert.match(otomatikBlok([]), /henüz kaydedilmiş/);
});

test("blok: boş değerler atlanır, çok satırlı değer tek satıra iner", () => {
  assert.equal(otomatikBlok([k("konum", "  "), k("yapiyor", "yazıyor\n  ve bekliyor")]), "- Şu an yaptığı: yazıyor ve bekliyor (14:32)");
});

test("blok aynı durumda aynı metindir (dosya her tikte yeniden yazılmasın)", () => {
  assert.equal(otomatikBlok([k("konum", "a")]), otomatikBlok([k("konum", "a")]));
});

test("güncelle: yalnız işaretli bölge değişir; Ozyn'in yazdığı öncesi ve sonrası aynen kalır", () => {
  const y = bolumuGuncelle(dosya("eski"), "yeni");
  assert.equal(y, dosya("yeni"));
  assert.equal(bolumuOku(y), "yeni");
});

test("güncelle: idempotent", () => {
  const bir = bolumuGuncelle(dosya("eski"), "yeni");
  assert.equal(bolumuGuncelle(bir, "yeni"), bir);
});

test("güncelle: işaretler silinmişse blok sona yeniden eklenir, mevcut metin korunur", () => {
  const y = bolumuGuncelle("Ozyn'in notu", "blok");
  assert.equal(y, `Ozyn'in notu\n\n${ISARET_BASI}\nblok\n${ISARET_SONU}\n`);
  assert.equal(bolumuOku(y), "blok");
});

test("güncelle: yalnız başlangıç işareti kalmışsa (yarım) kalıntı atılır, bozuk bölge çoğalmaz", () => {
  const y = bolumuGuncelle(`x\n${ISARET_BASI}\nyarım`, "blok");
  assert.equal(bolumuOku(y), "blok");
  assert.equal(y.split(ISARET_BASI).length, 2);
});

test("oku: işaret yoksa null", () => {
  assert.equal(bolumuOku("düz metin"), null);
});

test("kaydetBirlestir: Ozyn'in bölüm dışı değişikliği KALIR, bölüm içindeki değişikliği atılır (bölüm sistemin)", () => {
  const disk = dosya("sistem-yeni", "ÖN", "ARKA");
  const ozyn = dosya("OZYN-ELLE-DEĞİŞTİRDİ", "ÖN + yeni not", "ARKA");
  const sonuc = kaydetBirlestir(ozyn, disk);
  assert.equal(bolumuOku(sonuc), "sistem-yeni");
  assert.match(sonuc, /ÖN \+ yeni not/);
});

test("kaydetBirlestir: diskte bölüm yoksa Ozyn'in metni olduğu gibi gider", () => {
  assert.equal(kaydetBirlestir("serbest", "disk"), "serbest");
});
