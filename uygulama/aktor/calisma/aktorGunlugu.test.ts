// uygulama/aktor/calisma/aktorGunlugu.test.ts — aktör günlüğü, bayrak ayrıştırma ve sel koruması (spec 45 §13). Saf: zaman ve çıkış enjekte.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { aktorGunluguKur, bayraklariOku, bayraklariUygula, gunlukSatiri, GUNLUK_KAPASITESI, KATEGORILER, type GunlukKaydi } from "./aktorGunlugu.ts";

const kur = (a: Parameters<typeof aktorGunluguKur>[0] = {}) => {
  const cikis: GunlukKaydi[] = [];
  const g = aktorGunluguKur({ cikis: (k) => cikis.push({ ...k }), ...a });
  return { g, cikis };
};

test("bayraklariOku: ayrıntılı + kapatma + hepsi; boşluk/büyük harf yok sayılır; tanınmayan listelenir (sessiz yutulmaz)", () => {
  const o = bayraklariOku(" Olay , TETIK,-hareket ,-olay, uydurma ,");
  assert.deepEqual([...o.ayrintili].sort(), ["olay", "tetik"]);   // büyük harf ('Olay', 'TETIK') küçültülüp tanınır
  assert.deepEqual([...o.kapali], ["hareket"]);
  assert.deepEqual(o.bilinmeyen, ["-olay", "uydurma"]);          // -olay anlamsız: olay kapatılamaz
});

test("bayraklariOku: 'hepsi' bütün kategorileri açar; boş/null boş okur", () => {
  assert.equal(bayraklariOku("hepsi").ayrintili.size, KATEGORILER.length);
  assert.equal(bayraklariOku("sablon").ayrintili.has("sablon"), true, "Details/şablon izi kendi bayrağıyla açılır (spec 45 B7)");
  for (const b of [null, undefined, "", "  "]) { const o = bayraklariOku(b); assert.equal(o.ayrintili.size + o.kapali.size + o.bilinmeyen.length, 0); }
});

test("seviye süzgeci: uyarı/hata HER ZAMAN tutulur; bilgi/iyi yalnız kategorinin ayrıntılı bayrağı açıksa", () => {
  const { g } = kur();
  g.yaz("bilgi", "tetik", "giriş"); g.yaz("iyi", "bag", "kuruldu");
  g.uyari("bag", "AKT-BAG-011", "üst yok"); g.hata("zaman", "AKT-ZMN-001", "patladı");
  assert.deepEqual(g.son().map((k) => k.seviye), ["uyari", "hata"]);
  g.ayrintili("tetik", true);
  g.yaz("bilgi", "tetik", "giriş 2"); g.yaz("bilgi", "hareket", "hareket kapalı kategori");
  assert.deepEqual(g.son().map((k) => k.metin), ["[AKT-BAG-011] üst yok", "[AKT-ZMN-001] patladı", "giriş 2"]);
  g.ayrintili("tetik", false);
  g.yaz("bilgi", "tetik", "artık yok");
  assert.equal(g.son().length, 3);
});

test("herZaman: durum değişimi kaydı (çözüldü/yeniden açıldı) ayrıntılı bayrak KAPALIYKEN de tutulur; bayraksız bilgi yine düşer", () => {
  const { g } = kur();
  g.yaz("iyi", "bag", "çözüldü: x", { herZaman: true });
  g.yaz("iyi", "bag", "sıradan iz");
  assert.deepEqual(g.son().map((k) => k.metin), ["çözüldü: x"]);
});

test("kod: açıkça verilmezse metinden okunur; uyari/hata kısayolu metne '[KOD]' ekler ve kodu kayda yazar", () => {
  const { g } = kur();
  g.yaz("uyari", "olay", "[AKT-OLY-004] derinlik");
  g.hata("dugum", "AKT-DUG-001", "olay adı boş", "lamba");
  const [a, b] = g.son();
  assert.equal(a!.kod, "AKT-OLY-004");
  assert.equal(b!.kod, "AKT-DUG-001"); assert.equal(b!.aktor, "lamba"); assert.equal(b!.metin, "[AKT-DUG-001] olay adı boş");
});

test("SEL KORUMASI: ardışık aynı kayıt tekrar sayacını artırır (yeni satır açmaz), çıkışa yalnız 1/10/100/1000. kez gider", () => {
  const { g, cikis } = kur();
  for (let i = 0; i < 1000; i++) g.hata("zaman", "AKT-ZMN-001", "hareket aşaması: x");
  assert.equal(g.son().length, 1);
  assert.equal(g.son()[0]!.tekrar, 1000);
  assert.deepEqual(cikis.map((k) => k.tekrar), [1, 10, 100, 1000]);
  assert.equal(g.sayim().kodlar["AKT-ZMN-001"], 1000);          // sayaç tekrarları da sayar
});

test("sel koruması yalnız ARDIŞIK aynıyı birleştirir: araya başka kayıt girince yeni satır (hata kaybolmaz); aktör farkı da ayrı satır", () => {
  const { g } = kur();
  g.hata("zaman", "AKT-ZMN-001", "a"); g.hata("zaman", "AKT-ZMN-001", "b"); g.hata("zaman", "AKT-ZMN-001", "a");
  assert.equal(g.son().length, 3);
  g.hata("bag", "AKT-BAG-001", "x", "k1"); g.hata("bag", "AKT-BAG-001", "x", "k2");
  assert.equal(g.son().length, 5);
});

test("halka bellek: kapasiteyi aşınca en eski düşer; sayım düşenleri de sayar", () => {
  const { g } = kur({ kapasite: 5 });
  for (let i = 0; i < 12; i++) g.uyari("bag", "AKT-BAG-011", `aktör ${i}`);
  assert.equal(g.son(100).length, 5);
  assert.equal(g.son(100)[0]!.metin, "[AKT-BAG-011] aktör 7");
  assert.equal(g.sayim().seviyeler.uyari, 12);
  assert.equal(GUNLUK_KAPASITESI, 200);
});

test("son(n, süzgeç): son n kayıt, seviye/kategori/kod süzgeci", () => {
  const { g } = kur();
  g.uyari("bag", "AKT-BAG-011", "1"); g.hata("zaman", "AKT-ZMN-001", "2"); g.uyari("olay", "AKT-OLY-004", "3");
  assert.equal(g.son(2).length, 2);
  assert.deepEqual(g.son(10, { seviye: "hata" }).map((k) => k.kod), ["AKT-ZMN-001"]);
  assert.deepEqual(g.son(10, { kategori: "olay" }).map((k) => k.kod), ["AKT-OLY-004"]);
  assert.deepEqual(g.son(10, { kod: "AKT-BAG-011" }).map((k) => k.metin), ["[AKT-BAG-011] 1"]);
});

test("kapat/kapaliMi + bayraklar(): bileşen kapatma açılıp kapanır", () => {
  const { g } = kur({ bayrak: bayraklariOku("olay,-tetik") });
  assert.equal(g.kapaliMi("tetik"), true); assert.equal(g.kapaliMi("hareket"), false);
  g.kapat("tetik", false); g.kapat("hareket", true);
  assert.deepEqual(g.bayraklar(), { ayrintili: ["olay"], kapali: ["hareket"] });
});

test("bayraklariUygula: eski bayrakları SİLER, yenisini kurar; tanınmayan AKT-BYR-001 uyarısı yazar", () => {
  const { g } = kur({ bayrak: bayraklariOku("olay,-bag") });
  const o = bayraklariUygula(g, "tetik,-hareket,uydurma");
  assert.deepEqual(g.bayraklar(), { ayrintili: ["tetik"], kapali: ["hareket"] });
  assert.deepEqual(o.bilinmeyen, ["uydurma"]);
  assert.equal(g.son()[0]!.kod, "AKT-BYR-001");
  bayraklariUygula(g, "");
  assert.deepEqual(g.bayraklar(), { ayrintili: [], kapali: [] });
});

test("zaman damgası: enjekte saatten", () => {
  let t = 5;
  const { g } = kur({ simdi: () => t });
  g.hata("zaman", "AKT-ZMN-001", "a"); t = 9; g.hata("zaman", "AKT-ZMN-001", "b");
  assert.deepEqual(g.son().map((k) => k.t), [5, 9]);
});

test("temizle: kayıt ve sayımlar sıfırlanır, bayraklar KALIR", () => {
  const { g } = kur({ bayrak: bayraklariOku("olay") });
  g.hata("zaman", "AKT-ZMN-001", "a");
  g.temizle();
  assert.equal(g.son().length, 0); assert.equal(g.sayim().seviyeler.hata, 0); assert.deepEqual(g.sayim().kodlar, {});
  assert.deepEqual(g.bayraklar().ayrintili, ["olay"]);
});

test("gunlukSatiri: seviye etiketi, aktör, tekrar; hata/uyarıda İLK satırda çözüm önerisi, tekrarda yok", () => {
  const { g } = kur();
  g.hata("zaman", "AKT-ZMN-001", "tetik aşaması: x", "kapi");
  const k = g.son()[0]!;
  const s = gunlukSatiri(k);
  assert.match(s, /^HATA zaman \[kapi\] \[AKT-ZMN-001\] tetik aşaması: x\n {4}↳ çalışma zamanı: /);
  g.hata("zaman", "AKT-ZMN-001", "tetik aşaması: x", "kapi");
  assert.ok(!gunlukSatiri(g.son()[0]!).includes("↳"), "tekrar satırında çözüm önerisi basılmaz (gürültü)");
  assert.match(gunlukSatiri(g.son()[0]!), /\(×2\)/);
  assert.match(gunlukSatiri({ ...k, seviye: "iyi", kod: null, tekrar: 1, metin: "ok" }), /^OK zaman /);
});
