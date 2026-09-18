// bridge/satirSozlesmesi.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { yanitAyir, cagrilaraCevir, SOZLESME_TALIMATI } from "./satirSozlesmesi.ts";

test("düz cevap söz olur, eylem üretmez", () => {
  const a = yanitAyir("Ekranda bir hata var, bakıyorum.");
  assert.equal(a.soz, "Ekranda bir hata var, bakıyorum.");
  assert.equal(a.komut, undefined);
});

test("GERÇEK cevap: söz + komut önerisi ayrılır", () => {
  // Bu metin gercek olcumden alindi (Ling 3.0 Flash VL, 8.6 sn).
  const ham = "`gti` yazım hatası, muhtemelen `git` demek istiyorsun.\n" +
              "KOMUT: git status | GEREKCE: 'gti' yazım hatası, doğrusu 'git'";
  const a = yanitAyir(ham);
  assert.match(a.soz, /yazım hatası/);
  assert.ok(!a.soz.includes("KOMUT"), "sözleşme satırı söze karışmamalı");
  assert.equal(a.komut?.metin, "git status");
  assert.match(a.komut?.gerekce ?? "", /yazım hatası/);
});

test("komut ters tırnak içinde verilse de temizlenir", () => {
  const a = yanitAyir("Dene.\nKOMUT: `npm test` | GEREKCE: testleri kos");
  assert.equal(a.komut?.metin, "npm test");
});

test("gerekçe verilmezse öneri DÜŞÜRÜLMEZ, varsayılan gerekçe konur", () => {
  // Sessizce dusurmek, oneriyi tamamen kaybetmekten kotudur.
  const a = yanitAyir("Bak.\nKOMUT: git status");
  assert.equal(a.komut?.metin, "git status");
  assert.ok((a.komut?.gerekce ?? "").length > 0);
});

test("TAHTA ve GIDILECEK satırları ayrılır", () => {
  const a = yanitAyir("Not alıyorum.\nGIDILECEK: tahta\nTAHTA: süzgeç bitti");
  assert.equal(a.git, "tahta");
  assert.equal(a.tahta, "süzgeç bitti");
  assert.equal(a.soz, "Not alıyorum.");
});

test("kod bloğu söze karışmaz — sesli okunmasın", () => {
  const a = yanitAyir("Şunu dene:\n```\ngit status\n```\nTamam.");
  assert.ok(!a.soz.includes("git status"));
  assert.match(a.soz, /Şunu dene/);
});

test("etiketler cevabın BAŞINDA olsa da yakalanır", () => {
  const a = yanitAyir("KOMUT: ls | GEREKCE: bakalım\nDizini listeleyelim.");
  assert.equal(a.komut?.metin, "ls");
  assert.equal(a.soz, "Dizini listeleyelim.");
});

test("boş etiket yok sayılır, çökertmez", () => {
  const a = yanitAyir("Tamam.\nKOMUT:   \nTAHTA:");
  assert.equal(a.komut, undefined);
  assert.equal(a.tahta, undefined);
  assert.equal(a.soz, "Tamam.");
});

test("cagrilaraCevir SIRAYI korur: git → tahta → söz → komut", () => {
  const c = cagrilaraCevir({ soz: "bak", git: "tahta", tahta: "not", komut: { metin: "ls", gerekce: "g" } });
  assert.deepEqual(c.map((x) => x.ad),
    ["dunya_git", "dunya_yaz", "dunya_soyle", "dunya_komut"]);
});

test("yalnızca söz varsa tek çağrı üretilir", () => {
  const c = cagrilaraCevir(yanitAyir("Buradayım."));
  assert.deepEqual(c.map((x) => x.ad), ["dunya_soyle"]);
  assert.equal(c[0]?.girdi.metin, "Buradayım.");
});

test("hiçbir şey yoksa çağrı da yok — sessizlik geçerli cevaptır", () => {
  assert.deepEqual(cagrilaraCevir(yanitAyir("   ")), []);
});

// ── ETİKET SEÇİMİ ─────────────────────────────────────────────────────────
// `GIT:` etiketi `git` PROGRAMIYLA çakışıyordu: model "pencereye git" emrini
// kabuk komutu sanıp `KOMUT: pencereye git` üretiyordu ve bu anlamsız öneri
// onay kapısına düşüyordu. Ölçüm (aynı iki senaryo, üç etiket):
//   GIT: 1/2 doğru + 1 kaçak | YURU: 2/2 + 1 kaçak | GIDILECEK: 2/2 + 0 kaçak

test("eski `GIT:` etiketi artık EYLEM üretmez — söze karışır, komuta dönmez", () => {
  const a = yanitAyir("Tamam.\nGIT: pencere");
  assert.equal(a.git, undefined, "eski etiket yer degistirme uretmemeli");
  assert.equal(a.komut, undefined, "eski etiket KOMUT'a da donmemeli");
});

test("sözleşme talimatı GIDILECEK öğretir ve ÖRNEK içerir", () => {
  assert.match(SOZLESME_TALIMATI, /GIDILECEK:/);
  assert.ok(!/^GIT:/m.test(SOZLESME_TALIMATI), "eski etiket ogretilmemeli");
  // Örnekler ölçümde anlatımdan güçlü çıktı; kaybolmasınlar.
  assert.match(SOZLESME_TALIMATI, /EXAMPLES/);
  assert.match(SOZLESME_TALIMATI, /KOMUT: python --version/);
});

// Anlatım İngilizceye döndü (spec 06 §6.8) ama ETİKETLER protokol kimliği:
// `ETIKET` regexi ve `BAK_SORULARI` onları birebir arıyor. Çevrilirlerse
// sözleşme SESSİZCE kırılır — model doğru satırı yazar, ayrıştırıcı görmez.
test("etiketler ve BAK değerleri ÇEVRİLMEDEN kalır", () => {
  for (const e of ["KOMUT:", "GEREKCE:", "TAHTA:", "GIDILECEK:", "BAK:"]) {
    assert.ok(SOZLESME_TALIMATI.includes(e), `etiket kayboldu: ${e}`);
  }
  assert.match(SOZLESME_TALIMATI, /onumde\|yakin\|oyuncu\|dunya/, "BAK değerleri çevrilmiş");
  // Örnekteki SÖZ kısmı Türkçe kalmalı: Orion'un sesi Türkçe ve örnek tam da
  // sesin nasıl olacağını gösteriyor.
  assert.match(SOZLESME_TALIMATI, /yazım hatası/, "örnek söz Türkçeliğini yitirdi");
});

test("KOMUT satırı yürüme emrine dönüşmez — onay kapısı kabuk komutu için", () => {
  // Modelin kaçtığı durum: yürümeyi komut sanmak. Ayrıştırıcı bunu
  // düzeltemez (komut gerçekten komut alanında), ama etiketin doğru
  // öğretilmesi bu vakayı baştan önler; burada sözleşmenin ne ürettiğini sabitliyoruz.
  const a = yanitAyir("Tamam.\nGIDILECEK: pencere");
  assert.equal(a.git, "pencere");
  assert.equal(a.komut, undefined);
  const c = cagrilaraCevir(a);
  assert.ok(c.some((x) => x.ad === "dunya_git"), "dunya_git uretilmeli");
  assert.ok(!c.some((x) => x.ad === "dunya_komut"), "dunya_komut UREMEMELI");
});

// ── BAK: algı hizmetine erişim ────────────────────────────────────────────
// `dunya_sor` aracı ve algı hizmeti yazılmıştı, talimat modele "odaya bakmak
// için dunya_sor kullan" diyordu — ama sözleşmede karşılığı YOKTU. Yani model
// bakma isteğini ifade edemiyordu ve algı hizmeti canlıda ULAŞILAMAZDI.

test("BAK satırı dunya_sor çağrısına dönüşür", () => {
  const a = yanitAyir("Bakıyorum.\nBAK: onumde");
  assert.equal(a.bak, "onumde");
  const c = cagrilaraCevir(a);
  const sor = c.find((x) => x.ad === "dunya_sor");
  assert.ok(sor, "dunya_sor uretilmeli");
  assert.deepEqual(sor.girdi, { ne: "onumde" });
  assert.ok(!a.soz.includes("BAK"), "sozlesme satiri soze karismamali");
});

test("BAK bilinmeyen soruyu REDDEDER — protokole gereksiz tur attırmaz", () => {
  for (const kotu of ["arkamda", "tavan", "her sey", ""]) {
    const a = yanitAyir(`Tamam.\nBAK: ${kotu}`);
    assert.equal(a.bak, undefined, `gecersiz sorgu kabul edildi: "${kotu}"`);
  }
});

test("BAK dört geçerli soruyu da tanır", () => {
  for (const q of ["onumde", "yakin", "oyuncu", "dunya"]) {
    assert.equal(yanitAyir(`x\nBAK: ${q}`).bak, q);
  }
  // Büyük/küçük harf ve noktalama toleransı.
  assert.equal(yanitAyir("x\nBAK: Onumde.").bak, "onumde");
});

test("BAK çağrı sırasında EN ÖNDE — bilgi eylemden önce gelir", () => {
  const a = yanitAyir("Bakıp gideceğim.\nBAK: yakin\nGIDILECEK: tahta");
  const c = cagrilaraCevir(a);
  assert.equal(c[0]?.ad, "dunya_sor", `sira yanlis: ${c.map((x) => x.ad).join(",")}`);
});

test("sözleşme talimatı BAK'ı öğretir ve örnekler", () => {
  assert.match(SOZLESME_TALIMATI, /BAK: <onumde\|yakin\|oyuncu\|dunya>/);
  assert.match(SOZLESME_TALIMATI, /BAK: onumde/, "ornek de olmali");
});
