// mind/ortamSozlugu.test.ts — Öğrenen ortam sözlüğü: ne öğrenilir, ne eşleşir, neden askıya alınır, nasıl silinir.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OrtamSozlugu, OGRENILEN_SINIRI, GERI_ALMA_MS, ASKI_PAYI, type OgrenilenDeposu, type OgrenilenKayit, type OrtamNiyeti } from "./ortamSozlugu.ts";

const k = (ne: OrtamNiyeti["ne"], deger?: string, sayi?: number): OrtamNiyeti =>
  ({ tur: "ortam", ne, ...(deger !== undefined ? { deger } : {}), ...(sayi !== undefined ? { sayi } : {}) });

function kur(baslangic: OgrenilenKayit[] = []) {
  let simdi = 1_000_000;
  const depo = { veri: structuredClone(baslangic), yazilan: 0 };
  const d: OgrenilenDeposu = { oku: () => structuredClone(depo.veri), yaz: (x) => { depo.veri = structuredClone([...x]); depo.yazilan++; } };
  const s = new OrtamSozlugu({ depo: d, simdi: () => simdi });
  return { s, depo, ilerle: (ms: number) => { simdi += ms; } };
}

test("LLM'in başarıyla yaptığı söz öğrenilir; aynı söz sonra token'sız eşleşir", () => {
  const { s } = kur();
  assert.equal(s.ogren("burası çok karanlık", [k("isik", "ac"), k("sis", "kapat")]), "yeni");
  const e = s.esle("burası çok karanlık");
  assert.equal(e?.program, "komut:ortam-ogrenilen");
  assert.deepEqual(e?.adimlar, [k("isik", "ac"), k("sis", "kapat")]);
});

test("eşleşme normalleşmiş söze göre: büyük harf, noktalama, dolgu sözcükleri önemsiz", () => {
  const { s } = kur();
  s.ogren("Romantik bir hava ver", [k("isik", "sicak"), k("saat", undefined, 20)]);
  assert.ok(s.esle("romantik bir hava ver!"));
  assert.ok(s.esle("Orion lütfen romantik bir hava ver"));
});

test("GENELLEME YOK: yalnız tam söz eşleşir (sözün parçası ya da yakını eşleşmez)", () => {
  const { s } = kur();
  s.ogren("romantik hava ver", [k("isik", "sicak")]);
  assert.equal(s.esle("romantik"), null);
  assert.equal(s.esle("biraz daha romantik hava ver"), null);
  assert.equal(s.esle("hava ver"), null);
  assert.equal(s.esle("romantik hava ver ve gece yap"), null);
});

test("yerleşik sözlüğün bildiği söz ya da beden komutu öğrenilmez (tekrar yok)", () => {
  const { s, depo } = kur();
  assert.equal(s.ogren("gece yap", [k("saat", undefined, 0)]), "reddedildi");
  assert.equal(s.ogren("otur", [k("isik", "kis")]), "reddedildi");
  assert.equal(depo.veri.length, 0);
});

test("uygunsuz öğrenme reddedilir: boş söz, çok uzun söz, boş/çok komut, sıfırla", () => {
  const { s } = kur();
  assert.equal(s.ogren("", [k("isik", "kis")]), "reddedildi");
  assert.equal(s.ogren("lütfen hemen", [k("isik", "kis")]), "reddedildi", "dolgudan ibaret söz");
  assert.equal(s.ogren("a ".repeat(60), [k("isik", "kis")]), "reddedildi");
  assert.equal(s.ogren("bir şey yap", []), "reddedildi");
  assert.equal(s.ogren("bir şey yap", Array(7).fill(k("isik", "kis"))), "reddedildi");
  assert.equal(s.ogren("hepsini başa al", [k("sifirla")]), "reddedildi");
  assert.equal(s.liste().length, 0);
});

test("aynı söz yeniden öğrenilirse güncellenir (son doğru yapılan kazanır), kayıt çoğalmaz", () => {
  const { s } = kur();
  s.ogren("kasvetli yap", [k("isik", "kis")]);
  assert.equal(s.ogren("kasvetli yap", [k("isik", "kis"), k("sis", "ac")]), "guncellendi");
  assert.equal(s.liste().length, 1);
  assert.deepEqual(s.esle("kasvetli yap")?.adimlar, [k("isik", "kis"), k("sis", "ac")]);
});

test("kullanımdan sonra 20 sn içinde sıfırla gelirse kayıt olumsuz sayılır ve askıya alınır", () => {
  const { s, ilerle } = kur();
  s.ogren("kasvetli yap", [k("isik", "kis")]);
  assert.ok(s.esle("kasvetli yap"));
  ilerle(GERI_ALMA_MS - 1);
  s.sifirlandi();
  const kayit = s.liste()[0]!;
  assert.equal(kayit.hata, 1);
  assert.equal(kayit.basari, 1, "kullanımda eklenen başarı geri alınmalı (öğrenme anındaki 1 kalır)");
  assert.ok(OrtamSozlugu.pay(kayit) < ASKI_PAYI);
  assert.equal(s.esle("kasvetli yap"), null, "askıdaki kayıt eşleşmez (LLM'e gider)");
});

test("sıfırla geç gelirse ya da hiç kullanılmadıysa kayda dokunmaz", () => {
  const { s, ilerle } = kur();
  s.ogren("kasvetli yap", [k("isik", "kis")]);
  s.sifirlandi();   // hiç kullanılmadı
  assert.equal(s.liste()[0]!.hata, 0);
  s.esle("kasvetli yap");
  ilerle(GERI_ALMA_MS + 1);
  s.sifirlandi();
  assert.equal(s.liste()[0]!.hata, 0);
});

test("askıdaki söz LLM'in yeniden doğru yapmasıyla geri gelir (başarı payı toparlanır)", () => {
  const { s, ilerle } = kur();
  s.ogren("kasvetli yap", [k("isik", "kis")]);
  s.esle("kasvetli yap"); ilerle(1000); s.sifirlandi();
  assert.equal(s.esle("kasvetli yap"), null);
  s.ogren("kasvetli yap", [k("isik", "kis")]);   // LLM yeniden doğru yaptı
  s.ogren("kasvetli yap", [k("isik", "kis")]);
  assert.ok(s.esle("kasvetli yap"));
});

test("sil: Ozyn bir kaydı unutturur; olmayan kayıt false", () => {
  const { s } = kur();
  s.ogren("kasvetli yap", [k("isik", "kis")]);
  const soz = s.liste()[0]!.soz;
  assert.equal(s.sil("yok"), false);
  assert.equal(s.sil(soz), true);
  assert.equal(s.esle("kasvetli yap"), null);
  assert.equal(s.liste().length, 0);
});

test("temizle hepsini siler", () => {
  const { s } = kur();
  s.ogren("kasvetli yap", [k("isik", "kis")]); s.ogren("neşeli yap", [k("isik", "ac")]);
  s.temizle();
  assert.equal(s.liste().length, 0);
});

test(`üst sınır ${OGRENILEN_SINIRI}: en eski kayıt düşer`, () => {
  const { s, ilerle } = kur();
  for (let i = 0; i < OGRENILEN_SINIRI + 5; i++) { s.ogren(`ozel ifade numara ${i} ver`, [k("isik", "kis")]); ilerle(10); }
  assert.equal(s.liste().length, OGRENILEN_SINIRI);
  assert.equal(s.esle("ozel ifade numara 0 ver"), null, "en eskisi düşmüş olmalı");
  assert.ok(s.esle(`ozel ifade numara ${OGRENILEN_SINIRI + 4} ver`));
});

test("depoya yazılır ve yeni örnek aynı kayıtları okur", () => {
  const { s, depo } = kur();
  s.ogren("kasvetli yap", [k("isik", "kis")]);
  assert.ok(depo.yazilan >= 1);
  const ikinci = new OrtamSozlugu({ depo: { oku: () => structuredClone(depo.veri), yaz: () => {} } });
  assert.ok(ikinci.esle("kasvetli yap"));
});

test("eşleşme ve liste kopya döner (dışarıdan değiştirilemez)", () => {
  const { s } = kur();
  s.ogren("kasvetli yap", [k("isik", "kis")]);
  s.liste()[0]!.komutlar.length = 0;
  const e = s.esle("kasvetli yap")!;
  e.adimlar.length = 0;
  assert.equal(s.esle("kasvetli yap")?.adimlar.length, 1);
});
