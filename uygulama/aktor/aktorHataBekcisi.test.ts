// uygulama/aktor/aktorHataBekcisi.test.ts — AKTÖR HATA KODU BEKÇİSİ (spec 45 §13).
//
// Amaç: "hata nerede" sorusunun cevabı HER ZAMAN kodda yazsın. Üç kural, kaynak taranarak (çalışma zamanı değil):
//   1. Aktör altyapısı dosyalarında çıplak `throw new Error(` YOK (her fırlatma `aktorHatasi`/`kodluHata`/`kodlu` ile kodlu).
//   2. Kaynakta geçen her `AKT-XXX-NNN` literali katalogda tanımlı (yazım hatası/uydurma kod yakalanır).
//   3. Katalogdaki her kod kaynakta (katalog ve test dışında) EN AZ BİR kez kullanılıyor (ölü kod = yalan belge).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AKTOR_ALANLARI, AKTOR_HATALARI } from "../../world/level/cekirdek/aktorHatalari.ts";

/** Çıplak fırlatma yasağına bağlı dosyalar: yalnız aktör altyapısı (giris.ts/levelBaglantisi.ts aktör-dışı kodu da taşır, burada değil). */
const FIRLATMA_DOSYALARI = [
  "world/level/cekirdek/aktorOlayYolu.ts",
  "uygulama/aktor/aktorCalismaZamani.ts",
  "uygulama/aktor/aktorBaglari.ts",
  "uygulama/aktor/aktorHareketi.ts",
  "uygulama/aktor/aktorTetikleri.ts",
  "uygulama/aktor/taslakKapisi.ts",
  "uygulama/aktor/taslakIslemleri.ts",
  "uygulama/aktor/aktorGunlugu.ts",
  "uygulama/aktor/aktorSablonu.ts",
  "uygulama/aktor/bilesenIslemleri.ts",
  "uygulama/aktor/glbDugumleri.ts",
  "uygulama/aktor/sablonIslemleri.ts",
  "uygulama/aktor/hareketModeli.ts",
  "uygulama/aktor/hiyerarsiEzmesi.ts",
  "uygulama/aktor/tetikModeli.ts",
  "uygulama/aktorYetenegi.ts",
  "uygulama/graf/aktorDugumleri.ts",
  "uygulama/graf/aktorOlayKaynagi.ts",
] as const;
/** Kod literali taranan dosyalar: yukarıdakiler + kodu KULLANAN kablolama (kompozisyon kökü ve level bağlantısı). */
const DOSYALAR = [...FIRLATMA_DOSYALARI, "uygulama/levelBaglantisi.ts", "uygulama/giris.ts"] as const;

const KOD_ARA = /AKT-[A-Z]{3}-\d{3}/g;
const oku = (yol: string): string => readFileSync(yol, "utf8");

test("bekçi: aktör altyapısı dosyalarında çıplak `throw new Error(` yok (her fırlatma kodlu)", () => {
  const kacaklar: string[] = [];
  for (const d of FIRLATMA_DOSYALARI) {
    oku(d).split(/\r?\n/).forEach((satir, i) => {
      if (/throw new Error\(/.test(satir)) kacaklar.push(`${d}:${i + 1}: ${satir.trim()}`);
    });
  }
  assert.deepEqual(kacaklar, [], `kodsuz fırlatma: aktorHatasi(kod, ayrıntı) kullan\n${kacaklar.join("\n")}`);
});

test("bekçi: kaynakta geçen her AKT-… kodu katalogda tanımlı", () => {
  const bilinmeyen: string[] = [];
  for (const d of DOSYALAR) {
    for (const m of oku(d).matchAll(KOD_ARA)) if (!(m[0] in AKTOR_HATALARI)) bilinmeyen.push(`${d}: ${m[0]}`);
  }
  assert.deepEqual(bilinmeyen, [], `katalogda olmayan kod:\n${bilinmeyen.join("\n")}`);
});

test("bekçi: katalogdaki her kod kaynakta en az bir kez kullanılıyor (ölü kod yok)", () => {
  const kullanilan = new Set<string>();
  for (const d of DOSYALAR) for (const m of oku(d).matchAll(KOD_ARA)) kullanilan.add(m[0]);
  const olu = Object.keys(AKTOR_HATALARI).filter((k) => !kullanilan.has(k));
  assert.deepEqual(olu, [], `kullanılmayan kod (katalogdan çıkar ya da kullan; kod YENİDEN numaralanmaz):\n${olu.join("\n")}`);
});

test("bekçi: katalog biçimi — kod deseni, alan öneki, benzersiz, anlam ve çözüm dolu", () => {
  const alanlar = new Set<string>(Object.keys(AKTOR_ALANLARI));
  for (const [kod, k] of Object.entries(AKTOR_HATALARI)) {
    assert.match(kod, /^AKT-[A-Z]{3}-\d{3}$/, kod);
    assert.ok(alanlar.has(k.alan), `${kod}: bilinmeyen alan '${k.alan}'`);
    assert.equal(kod.split("-")[1], k.alan, `${kod}: kodun alan parçası kaydın alanıyla aynı olmalı`);
    assert.ok(k.anlam.trim().length >= 8, `${kod}: anlam boş/çok kısa`);
    assert.ok(k.cozum.trim().length >= 8, `${kod}: çözüm önerisi boş/çok kısa`);
  }
  const anlamlar = Object.values(AKTOR_HATALARI).map((k) => k.anlam);
  assert.equal(new Set(anlamlar).size, anlamlar.length, "iki kod aynı anlamı taşımamalı (kopya kod)");
});
