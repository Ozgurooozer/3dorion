// mind/yerelTepki.test.ts
//
// En önemli iddia: sağ lob EMİN OLMADAN konuşmaz. Bu katmanın tek değeri
// budur; gevşerse odada sürekli yanlış öneri üreten bir gürültü kaynağı olur.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { duzeltmeOner, duzenlemeMesafesi, taninmayanKomut, yerelTepki } from "./yerelTepki.ts";

test("düzenleme mesafesi bilinen değerleri verir", () => {
  assert.equal(duzenlemeMesafesi("git", "git"), 0);
  // Yer değiştirme TEK işlem sayılır (Damerau): en sık yapılan yazım hatası.
  assert.equal(duzenlemeMesafesi("gti", "git"), 1);
  assert.equal(duzenlemeMesafesi("gi", "git"), 1);
  assert.equal(duzenlemeMesafesi("", "git"), 3);
});

test("PowerShell 'not recognized' mesajından komut adı çıkar", () => {
  assert.equal(
    taninmayanKomut("gti : The term 'gti' is not recognized as the name of a cmdlet."),
    "gti");
});

test("bash ve cmd biçimleri de tanınır — kabuk değişebilir", () => {
  assert.equal(taninmayanKomut("bash: gti: command not found"), "gti");
  assert.equal(taninmayanKomut("npmm: command not found"), "npmm");
  assert.equal(
    taninmayanKomut("'gti' is not recognized as an internal or external command"),
    "gti");
});

test("ilgisiz çıktıdan komut adı ÇIKARILMAZ", () => {
  assert.equal(taninmayanKomut("npm WARN deprecated foo@1.0.0"), null);
  assert.equal(taninmayanKomut("Segmentation fault"), null);
});

test("yazım hatası düzeltilir — YER DEĞİŞTİRME dahil", () => {
  // Canlıda görülen gerçek hata: `gti status`.
  assert.equal(duzeltmeOner("gti"), "git");
  assert.equal(duzeltmeOner("nmp"), "npm", "yer degistirme yakalanmali");
  assert.equal(duzeltmeOner("pytho"), "python");
  assert.equal(duzeltmeOner("noed"), "node");
});

test("EMİN DEĞİLSE ÖNERMEZ — bu katmanın tek değeri budur", () => {
  // Çok uzak: hiçbir bilinen komuta benzemiyor.
  assert.equal(duzeltmeOner("zxqwvbn"), null);
  // Çok kısa: tek harften her şey türetilebilir.
  assert.equal(duzeltmeOner("g"), null);
  // Zaten geçerli bir komut: hata yazımdan değil (yol, izin, eksik kurulum).
  assert.equal(duzeltmeOner("git"), null);
  assert.equal(duzeltmeOner("docker"), null);
});

test("BERABERE kalan adaylarda susar — yanlış tahmin yok", () => {
  // "gt" → "git" ve "go" ikisine de 1 mesafede; hangisi olduğu belirsiz.
  const o = duzeltmeOner("gt");
  assert.equal(o, null, `berabere durumda oneri verilmemeli, verilen: ${o}`);
});

test("tanınmayan komut → ONAY KAPISINA öneri (çalıştırma DEĞİL)", () => {
  const n = yerelTepki({
    tur: "terminal", kod: 1,
    ozet: "gti : The term 'gti' is not recognized as the name of a cmdlet.",
  });
  assert.ok(n, "oneri uretilmeli");
  assert.equal(n.tur, "komut", "komut niyeti onay kapisindan gecer");
  assert.equal((n as { metin: string }).metin, "git");
  assert.match((n as { gerekce: string }).gerekce, /yazım hatası/i,
    "gerekce zorunlu ve anlasilir olmali");
});

test("düzeltme bilinmiyorsa komut ÖNERMEZ, sadece ekrana bakar", () => {
  const n = yerelTepki({
    tur: "terminal", kod: 1,
    ozet: "zxqwvbn : The term 'zxqwvbn' is not recognized as the name of a cmdlet.",
  });
  assert.ok(n);
  assert.equal(n.tur, "bak", "emin olmadan komut onerilmemeli");
});

test("başarılı komut tepki üretmez — rutinde susmak doğrudur", () => {
  assert.equal(yerelTepki({ tur: "terminal", kod: 0, ozet: "dir çıktısı" }), null);
});

test("hatalı ama tanınmayan-komut olmayan çıktıda ekrana bakılır", () => {
  const n = yerelTepki({ tur: "terminal", kod: 1, ozet: "error TS2339: Property does not exist" });
  assert.ok(n);
  assert.equal(n.tur, "bak");
});

test("Ozyn konuşunca ONA bakılır — duyulduğu görünsün", () => {
  const n = yerelTepki({ tur: "duydum", ozet: "Ozyn dedi: orada mısın" });
  assert.ok(n);
  assert.equal(n.tur, "bak");
  assert.deepEqual((n as { hedef: unknown }).hedef, { tip: "oyuncu" });
});

test("sağ lob ASLA konuşmaz — uydurma cevap sessizlikten kötüdür", () => {
  const girdiler = [
    { tur: "duydum" as const, ozet: "Ozyn dedi: bugün ne yaptık" },
    { tur: "terminal" as const, kod: 1, ozet: "gti : The term 'gti' is not recognized" },
    { tur: "terminal" as const, kod: 1, ozet: "Segmentation fault" },
    { tur: "olay" as const, ozet: "Ozyn yaklaştı" },
  ];
  for (const g of girdiler) {
    const n = yerelTepki(g);
    assert.ok(n === null || n.tur !== "soyle", `sag lob konustu: ${JSON.stringify(n)}`);
  }
});

test("olay tepkisi yok — ajanda zaten boşluğu dolduruyor", () => {
  assert.equal(yerelTepki({ tur: "olay", ozet: "Ozyn yaklaştı" }), null);
});
