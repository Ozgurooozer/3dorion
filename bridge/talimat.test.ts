// bridge/talimat.test.ts
//
// Metin İngilizceye döndü (spec 06 §6.8, canlı talimat 2026-09-19). Testlerin
// NİYETİ aynı kaldı: hangi bölüm hangi durumda gelir. Kalıplar yeni metne göre.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { talimatUret, TEMEL_TALIMAT } from "./talimat.ts";
import { baglamMetni } from "./baglam.ts";

const bos = { konusma: false, terminal: false, anilar: false, olay: false };

test("çekirdek her zaman var", () => {
  for (const b of [bos, { ...bos, konusma: true }, { ...bos, terminal: true }]) {
    const t = talimatUret(b);
    assert.match(t, /you have a body/i, "cekirdek bedeni anmali");
    assert.match(t, /dunya_soyle/);
    assert.match(t, /TWO SENTENCES/, "kisalik kurali cekirdekte olmali");
  }
});

test("terminal kuralları YALNIZCA terminal algısı varken gelir", () => {
  assert.ok(!talimatUret(bos).includes("dunya_komut"), "terminal yokken komut kuralı gönderilmemeli");
  const t = talimatUret({ ...bos, terminal: true });
  assert.match(t, /dunya_komut/, "komut onerme araci terminal baglaminda anilmali");
  assert.match(t, /typed by OZYN/);
});

test("konuşma kuralları yalnızca Ozyn konuşunca gelir", () => {
  assert.ok(!talimatUret(bos).includes("Staying silent is not acceptable"));
  assert.match(talimatUret({ ...bos, konusma: true }), /Staying silent is not acceptable/);
});

test("hafıza kuralı yalnızca anı getirildiyse gelir", () => {
  assert.ok(!/You remember/.test(talimatUret(bos)), "ani yokken hafiza kurali gonderilmemeli");
  assert.match(talimatUret({ ...bos, anilar: true }), /You remember/, "hafiza kurali gelmeli");
});

test("KAYMA BEKÇİSİ: talimattaki hafıza etiketi bağlamın ÜRETTİĞİ etiketle aynı", () => {
  // Bulundu (2026-09-19): talimat "'Hatırladıkların' listesi" diyordu ama
  // bağlam §6.8'den beri "You remember:" üretiyordu — talimat, var olmayan bir
  // etikete işaret ediyordu. Etiket bağlamdan OKUNUR, elle yazılmaz.
  const { kullanici } = baglamMetni({ talimat: "", dunya: "", ozetler: [], gecmis: [], araclar: [], anilar: ["x"] });
  const etiket = kullanici.split(":")[0]!;
  assert.ok(talimatUret({ ...bos, anilar: true }).includes(etiket),
    `talimat "${etiket}" etiketini anmiyor — kayma`);
});

test("DİL kuralı HER ZAMAN ve EN SONDA — sesin dili son okunan şey", () => {
  // Ölçüldü: Türkçe bağlam yerel modeli zehirliyordu; İngilizce çerçeve +
  // sonda Türkçe ses kuralı Haiku'da 10/10 Türkçe söz verdi.
  for (const b of [bos, { konusma: true, terminal: true, anilar: true, olay: true }]) {
    const t = talimatUret(b);
    assert.match(t, /hears only Turkish/, "dil kurali yok");
    assert.ok(t.trimEnd().endsWith("never translate them into English."), "dil kurali sonda degil");
  }
});

test("olay kuralı konuşma varken TEKRARLANMAZ — çakışma yok", () => {
  const ikisi = talimatUret({ ...bos, konusma: true, olay: true });
  assert.ok(!ikisi.includes("Something changed in the room"),
    "konuşma varken olay kuralı gereksiz, dikkati böler");
});

test("DURUMA GÖRE KISALIR: her şey açıkken bile taban+ilgili kadar", () => {
  const hepsi = talimatUret({ konusma: true, terminal: true, anilar: true, olay: true });
  const taban = TEMEL_TALIMAT;
  assert.ok(hepsi.length > taban.length, "bağlam varken uzamalı");
  // Asıl kazanç: bağlamsız tur belirgin kısa. DİL bölümü tabana eklendiği
  // için oran 0,6'dan 0,7'ye gevşetildi — bölüm HER turda gerekli (ölçüldü).
  assert.ok(taban.length < hepsi.length * 0.7,
    `taban ${taban.length}, hepsi ${hepsi.length} — bağlamsız tur belirgin kısa olmalı`);
});

test("talimat tek satır — çok satırlı metin bağlamda şişer", () => {
  const t = talimatUret({ konusma: true, terminal: true, anilar: true, olay: false });
  assert.ok(!t.includes("\n"));
});

test("tahta kuralı her zaman var — `yaz` aracı her turda sunuluyor", () => {
  assert.match(talimatUret(bos), /walk in front of it/);
});

test("ALGI aracı öğretilir — araç sunmak yetmez, kullanılacağı söylenmeli", () => {
  // `dunya_sor` uzun süre araç listesinde vardı ama talimatta hiç anılmıyordu:
  // model onu kullanmayı düşünmek zorunda değildi. Kimlik onu tanıtır.
  assert.match(talimatUret(bos), /dunya_sor/, "cekirdek algi aracini tanitmali");
});

test("algı kuralının AYRINTISI yalnızca gerektiğinde gelir", () => {
  // Çekirdekte tek tanıtım cümlesi var; "önce bak" kuralı konuşma/olay
  // bağlamına ait. Hepsini her tura koymak talimatı şişiriyordu.
  assert.ok(!/not what you remember/.test(talimatUret(bos)),
    "baglamsiz turda ayrintili algi kurali gonderilmemeli");
  assert.match(talimatUret({ ...bos, konusma: true }), /not what you remember/);
  assert.match(talimatUret({ ...bos, olay: true }), /look with dunya_sor/);
});

test("talimatta Türkçe ÇERÇEVE kalmadı — yalnızca örnek nesne adları", () => {
  // Kaçan bir Türkçe cümle yerel modeli yeniden zehirler (0/10 → 9/10 farkı).
  const t = talimatUret({ konusma: true, terminal: true, anilar: true, olay: true });
  const izinli = /yönetim terminali|beyaz tahta/g;
  const turkce = t.replace(izinli, "").match(/[çğıöşüÇĞİÖŞÜ]\w*/g) ?? [];
  assert.deepEqual(turkce, [], `Türkçe kalıntı: ${turkce.join(", ")}`);
});
