// bridge/kayitBeyni.test.ts
//
// En önemli iddia: SARMALAYICI DAVRANIŞI DEĞİŞTİRMEZ. Kayıt almak için
// beynin cevabını bozarsak, kaydettiğimiz şey gerçek de olmaz.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KayitBeyni, KAYIT_ONEK } from "./kayitBeyni.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";

const GIRDI: BeyinGirdisi = { ozetler: ["ekranda hata"], dunya: "oda", gecmis: [], araclar: [] };

/** Sahte beyin: ne döneceğini ya da patlayacağını testler belirler. */
function sahte(cevap: BeyinCikti | Error, hazir = true): Beyin {
  return {
    ad: "sahte",
    hazirMi: async () => hazir,
    dusun: async () => { if (cevap instanceof Error) throw cevap; return cevap; },
  };
}

/** Yakalanan kayıt satırlarını çözer. */
function kayitci() {
  const satirlar: string[] = [];
  return {
    yaz: (s: string) => { satirlar.push(s); },
    kayitlar: () => satirlar
      .filter((s) => s.startsWith(KAYIT_ONEK))
      .map((s) => JSON.parse(s.slice(KAYIT_ONEK.length + 1))),
  };
}

test("beynin cevabı OLDUĞU GİBİ geçer — sarmalayıcı bozmaz", async () => {
  const cevap: BeyinCikti = {
    metin: "merhaba",
    cagrilar: [{ ad: "dunya_soyle", girdi: { metin: "merhaba" } }],
    bilgi: { model: "x" },
  };
  const k = kayitci();
  const c = await new KayitBeyni(sahte(cevap), { yaz: k.yaz }).dusun(GIRDI);
  assert.deepEqual(c, cevap);
});

test("girdi VE çıktı birlikte kaydedilir — fixture ikisini de ister", async () => {
  const k = kayitci();
  await new KayitBeyni(sahte({ metin: "x", cagrilar: [] }), { yaz: k.yaz }).dusun(GIRDI);
  const [kayit] = k.kayitlar();
  assert.deepEqual(kayit.girdi.ozetler, ["ekranda hata"]);
  assert.equal(kayit.cikti.metin, "x");
  assert.equal(kayit.beyin, "sahte");
  assert.equal(kayit.sira, 1);
});

test("HATA da kaydedilir ve YENİDEN FIRLATILIR — patlatan girdi en değerlisi", async () => {
  const k = kayitci();
  const b = new KayitBeyni(sahte(new Error("kota doldu")), { yaz: k.yaz });
  await assert.rejects(() => b.dusun(GIRDI), /kota doldu/);
  const [kayit] = k.kayitlar();
  assert.equal(kayit.hata, "kota doldu");
  assert.deepEqual(kayit.girdi.ozetler, ["ekranda hata"], "patlatan girdi saklanmali");
  assert.equal(kayit.cikti, undefined);
});

test("sıra numarası artar — turlar karışmasın", async () => {
  const k = kayitci();
  const b = new KayitBeyni(sahte({ metin: "", cagrilar: [] }), { yaz: k.yaz });
  await b.dusun(GIRDI); await b.dusun(GIRDI); await b.dusun(GIRDI);
  assert.deepEqual(k.kayitlar().map((x) => x.sira), [1, 2, 3]);
});

test("ÇOK UZUN kayıt kırpılmaz, ATILIR ve söylenir", async () => {
  // Kırpmak bozuk JSON üretir; ayıklayıcı onu sessizce düşürür ve "kayıt var
  // sanıp aslında olmaması" durumu doğar. Atıldığını bilmek yeğdir.
  const k = kayitci();
  const dev = { metin: "x".repeat(5000), cagrilar: [] };
  await new KayitBeyni(sahte(dev), { yaz: k.yaz, azamiUzunluk: 500 }).dusun(GIRDI);
  const [kayit] = k.kayitlar();
  assert.match(String(kayit.hata), /cok uzun/);
  assert.equal(kayit.cikti, undefined);
});

test("serileşmeyen kayıt ÇÖKERTMEZ — döngüsel yapı da olabilir", async () => {
  const k = kayitci();
  const dongusel: Record<string, unknown> = { metin: "x", cagrilar: [] };
  dongusel.kendisi = dongusel;
  const c = await new KayitBeyni(sahte(dongusel as unknown as BeyinCikti), { yaz: k.yaz })
    .dusun(GIRDI);
  assert.equal(c.metin, "x", "cevap yine de gecmeli");
  assert.match(String(k.kayitlar()[0]?.hata), /serilestirilemedi/);
});

test("ad ve hazirMi İÇ BEYİNDEN gelir — sarmalayıcı görünmez olmalı", async () => {
  const b = new KayitBeyni(sahte({ metin: "", cagrilar: [] }, false));
  assert.equal(b.ad, "sahte");
  assert.equal(await b.hazirMi(), false);
});

test("AD canlı okunur — içteki beyin değişirse kayıt yeni adı taşır", async () => {
  // `SecilebilirBeyin` gibi çalışırken değişen bir beynin etrafında
  // dondurulmuş ad, fixture'ları yanlış beyne atfederdi.
  const satirlar: string[] = [];
  let ad = "A";
  const ic = {
    get ad() { return ad; },
    hazirMi: async () => true,
    dusun: async () => ({ metin: "", cagrilar: [] }),
  };
  const k = new KayitBeyni(ic, { yaz: (s) => satirlar.push(s) });
  ad = "B";
  assert.equal(k.ad, "B");
  await k.dusun({ talimat: "", mesajlar: [], araclar: [] } as never);
  assert.match(satirlar[0]!, /"beyin":"B"/, "kayıt eski adı taşıyor");
});
