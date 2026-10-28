// uygulama/yapi/sekans/sekansBekci.test.ts — SEKANSIN GÜVENLİK VE DOM KAYNAK BEKÇİLERİ (spec 36).
//
// (1) Sekansı OYNATMAK yalnız Ozyn'in gerçek tıklaması: `sekansiOynat(` üretimde YALNIZ izin listesindeki yerlerde — editörün ▶ düğmesi (işleyici önce
// `isTrusted`a bakar; yoklama graf bekçisiyle ORTAK: tools/isTrustedBekcisi.ts) ve `sekansdene` senaryosunun yüzü (çağrıdan önce "senaryo koşusu mu"
// denetimi). (2) Orion'un araç yüzeyinde sekans yok. (3) Editör açıkken tuşlar oyuna sızmaz (graf editörünün kalıbı). Bu bekçiler METİN bekçisidir:
// satır silinir/değişirse kırmızı yanar; tuşun gerçekten sızmadığını ya da konsoldan `.click()`'in gerçekten oynatmadığını KANITLAMAZ — canlı deneme listesi spec 36.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { KOK, depoYolu, kaynaklar } from "../../../tools/ithaller.ts";
import { isTrustedYoklamasi } from "../../../tools/isTrustedBekcisi.ts";

const oku = (d: string) => fs.readFileSync(path.join(KOK, d), "utf8");
const uretim = (): string[] => ["uygulama", "bridge", "mind", "flash", "world", "voice", "protocol", "host"]
  .flatMap((k) => kaynaklar(path.join(KOK, k), { testler: false })).map(depoYolu);

/** `.sekansiOynat(` çağrısının BİLİNÇLİ İZİN LİSTESİ, dosya başına TAM sayıyla (fazladan bir çağrı yeri gerekçesiz geçemez). */
const OYNATMA_YERLERI: Readonly<Record<string, number>> = {
  "uygulama/yapi/sekans/oynatmaDugmeleri.ts": 1,
  "uygulama/yapi/sekans/kurulum.ts": 1,
};
const CAGRI = /\.sekansiOynat\(/g;

test("BEKÇİ: `sekansiOynat(` üretimde YALNIZ izin listesindeki dosyalarda ve TAM sayıda", () => {
  const bulunan = Object.fromEntries(uretim().map((d) => [d, [...oku(d).matchAll(CAGRI)].length] as const).filter(([, n]) => n > 0));
  assert.deepEqual(bulunan, OYNATMA_YERLERI);
});

test("BEKÇİ: editörün ▶ işleyicisi `sekansiOynat`tan ÖNCE `if (!e.isTrusted) return;` taşır", () => {
  const k = oku("uygulama/yapi/sekans/oynatmaDugmeleri.ts");
  assert.deepEqual([...k.matchAll(CAGRI)].map((m) => isTrustedYoklamasi(k, m.index)), [null]);
});

test("BEKÇİ: senaryo yüzü `sekansiOynat`tan ÖNCE 'senaryo koşusu değilse reddet' denetimini taşır", () => {
  const k = oku("uygulama/yapi/sekans/kurulum.ts");
  const i = k.search(CAGRI);
  const govde = k.slice(k.lastIndexOf("oynat(s, istek) {", i), i);
  assert.match(govde, /if \(!a\.senaryoKosusu\) return \{ ok: false/);
});

test("BEKÇİ'nin kendisi: senaryo denetimi olmayan yüz yakalanır (kalibrasyon)", () => {
  const k = "oynat(s, istek) {\n  return oynatici.sekansiOynat(s, istek);\n}";
  const i = k.search(CAGRI);
  assert.doesNotMatch(k.slice(k.lastIndexOf("oynat(s, istek) {", i), i), /if \(!a\.senaryoKosusu\) return \{ ok: false/);
});

test("BEKÇİ: Orion'un araç yüzeyinde ve niyet sözleşmesinde sekans YOK (oynatma/yazma aracı eklenmedi)", () => {
  assert.deepEqual(["bridge/araclar.ts", "protocol/niyet.ts", "protocol/dogrula.ts"].filter((d) => /sekans/i.test(oku(d))), []);
});

test("BEKÇİ (tuş sızıntısı): editör kökü keydown, keyup ve keypress'i durdurur", () => {
  const k = oku("uygulama/yapi/sekans/sekansEditoru.ts");
  assert.match(k, /kok\.addEventListener\("keydown", \(e\) => \{ e\.stopPropagation\(\);/);
  assert.match(k, /kok\.addEventListener\("keyup", \(e\) => e\.stopPropagation\(\)\)/);
  assert.match(k, /kok\.addEventListener\("keypress", \(e\) => e\.stopPropagation\(\)\)/);
});

test("BEKÇİ (tuş sızıntısı): odak dışarıdayken pencere yakalayıcısı tuşu yutar; açılınca kurulur, gizlenince kaldırılır", () => {
  const k = oku("uygulama/yapi/sekans/sekansEditoru.ts");
  const yakala = k.slice(k.indexOf("const yakala = (e: KeyboardEvent)"), k.indexOf("};", k.indexOf("const yakala = (e: KeyboardEvent)")));
  assert.match(yakala, /e\.stopImmediatePropagation\(\);/);
  for (const tur of ["keydown", "keyup"]) {
    assert.match(k, new RegExp(`addEventListener\\("${tur}", yakala, \\{ capture: true \\}\\)`));
    assert.match(k, new RegExp(`removeEventListener\\("${tur}", yakala, \\{ capture: true \\}\\)`));
  }
});

test("BEKÇİ (tuş sızıntısı): proje tarayıcısı (.pp-kok) iki editörün pencere yakalayıcısında İSTİSNA — yoksa Esc'i yutulur (spec 39 D2: projedene P13 yakaladı)", () => {
  for (const yol of ["uygulama/yapi/sekans/sekansEditoru.ts", "uygulama/yapi/graf/grafEditoru.ts"]) {
    assert.match(oku(yol), /closest\?\.\("\.ep-pencere, \.pp-kok"\)/, yol);
  }
  assert.match(oku("uygulama/yapi/proje/projePenceresi.ts"), /el\("div", "pp-kok"\)/, "sınıf adı değişirse istisna sessizce kırılmasın");
});

test("BEKÇİ (sil): Sekans sekmesinde silmenin ikinci adımı gerçek tık ister", () => {
  const k = oku("uygulama/yapi/sekans/sekansSekmesi.ts");
  const i = k.indexOf("a.depo.sil(");
  assert.equal(isTrustedYoklamasi(k, i), null);
});
