// uygulama/yol.test.ts — Yol: olay yayını (sıra, yalıtım, bırakma, yeniden giriş) ve canlı servis kaydı.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { yolKur } from "./yol.ts";

interface Olaylar { tik: { t: number; dt: number }; mesaj: string }
interface Servisler { sayac: { n: number }; ad: string }

const yeni = () => {
  const hatalar: string[] = [];
  const yol = yolKur<Olaylar, Servisler>({ hata: (konu) => { hatalar.push(konu); } });
  return { yol, hatalar };
};

test("yayınlanan yük aboneye aynen gelir", () => {
  const { yol } = yeni();
  const gelen: unknown[] = [];
  yol.dinle("tik", (y) => gelen.push(y));
  yol.yayinla("tik", { t: 1, dt: 0.05 });
  assert.deepEqual(gelen, [{ t: 1, dt: 0.05 }]);
});

test("aboneler kayıt sırasıyla çağrılır", () => {
  const { yol } = yeni();
  const sira: string[] = [];
  yol.dinle("mesaj", () => sira.push("a"));
  yol.dinle("mesaj", () => sira.push("b"));
  yol.dinle("mesaj", () => sira.push("c"));
  yol.yayinla("mesaj", "x");
  assert.deepEqual(sira, ["a", "b", "c"]);
});

test("aynı işlev iki kez dinlenirse iki kez çağrılır ve her abonelik ayrı bırakılır", () => {
  const { yol } = yeni();
  let n = 0;
  const f = (): void => { n++; };
  const birak1 = yol.dinle("mesaj", f);
  yol.dinle("mesaj", f);
  birak1();
  yol.yayinla("mesaj", "x");
  assert.equal(n, 1);
});

test("bırakılan abone bir daha çağrılmaz", () => {
  const { yol } = yeni();
  let n = 0;
  const birak = yol.dinle("mesaj", () => { n++; });
  yol.yayinla("mesaj", "x");
  birak();
  yol.yayinla("mesaj", "y");
  assert.equal(n, 1);
});

test("konular birbirine karışmaz", () => {
  const { yol } = yeni();
  let mesaj = 0;
  yol.dinle("mesaj", () => { mesaj++; });
  yol.yayinla("tik", { t: 0, dt: 0 });
  assert.equal(mesaj, 0);
});

test("abonesiz konuya yayın sessizce geçer", () => {
  const { yol, hatalar } = yeni();
  yol.yayinla("mesaj", "kimse dinlemiyor");
  assert.deepEqual(hatalar, []);
});

test("bir abone fırlatırsa sonrakiler yine çalışır", () => {
  const { yol } = yeni();
  const sira: string[] = [];
  yol.dinle("mesaj", () => { throw new Error("patladı"); });
  yol.dinle("mesaj", () => sira.push("ikinci"));
  yol.yayinla("mesaj", "x");
  assert.deepEqual(sira, ["ikinci"]);
});

test("fırlatan abonenin hatası KONU ADIYLA bildirilir", () => {
  const { yol, hatalar } = yeni();
  yol.dinle("mesaj", () => { throw new Error("patladı"); });
  yol.yayinla("mesaj", "x");
  assert.deepEqual(hatalar, ["mesaj"]);
});

test("yayın sırasında bırakılan, henüz çağrılmamış abone atlanır", () => {
  const { yol } = yeni();
  const sira: string[] = [];
  let birakB = (): void => {};
  yol.dinle("mesaj", () => { sira.push("a"); birakB(); });
  birakB = yol.dinle("mesaj", () => sira.push("b"));
  yol.yayinla("mesaj", "x");
  assert.deepEqual(sira, ["a"]);
});

test("yayın sırasında eklenen abone o yayında çağrılmaz, sonrakinde çağrılır", () => {
  const { yol } = yeni();
  const sira: string[] = [];
  let eklendi = false;
  yol.dinle("mesaj", () => {
    sira.push("a");
    if (!eklendi) { eklendi = true; yol.dinle("mesaj", () => sira.push("yeni")); }
  });
  yol.yayinla("mesaj", "1");
  yol.yayinla("mesaj", "2");
  assert.deepEqual(sira, ["a", "a", "yeni"]);
});

test("servis: kaydedilen servis alınır", () => {
  const { yol } = yeni();
  const s = { n: 3 };
  yol.kaydet("sayac", s);
  assert.equal(yol.al("sayac"), s);
});

test("servis: kayıtsız servis null döner", () => {
  assert.equal(yeni().yol.al("sayac"), null);
});

test("servis: ikinci kez kaydetmek fırlatır (sessiz üzerine yazma yok)", () => {
  const { yol } = yeni();
  yol.kaydet("ad", "ilk");
  assert.throws(() => yol.kaydet("ad", "ikinci"), /zaten kayıtlı/);
});

test("servis: ikinci kayıt denemesi ilk değeri bozmaz", () => {
  const { yol } = yeni();
  yol.kaydet("ad", "ilk");
  try { yol.kaydet("ad", "ikinci"); } catch { /* beklenen */ }
  assert.equal(yol.al("ad"), "ilk");
});

test("servis: bırakılan servis null olur ve yeniden kaydedilebilir", () => {
  const { yol } = yeni();
  yol.kaydet("ad", "ova");
  yol.birak("ad");
  assert.equal(yol.al("ad"), null);
  yol.kaydet("ad", "ofis");
  assert.equal(yol.al("ad"), "ofis");
});

test("servis: kaydı olmayanı bırakmak hata değildir", () => {
  assert.doesNotThrow(() => yeni().yol.birak("ad"));
});

// DERLEME ZAMANI sözleşmesi: çalışma anında bir şey yapmaz; typecheck kapısı tip gevşerse `@ts-expect-error` "kullanılmadı" diye kırmızı olur.
test("tip sözleşmesi (derleme zamanı): yanlış konu, eksik yük ve yanlış servis tipi reddedilir", () => {
  const { yol } = yeni();
  const hicCagrilmaz = (): void => {
    // @ts-expect-error yük eksik: dt yok
    yol.yayinla("tik", { t: 1 });
    // @ts-expect-error olmayan konu
    yol.yayinla("yok", 1);
    // @ts-expect-error servis tipi uymuyor: ad bir string
    yol.kaydet("ad", 5);
    // @ts-expect-error işleyici yanlış yük tipini bekliyor
    yol.dinle("mesaj", (y: number) => y);
  };
  assert.equal(typeof hicCagrilmaz, "function");
});
