// world/level/cekirdek/bilesen.test.ts — Aktör bileşen şeması (spec 43 A1): okuma/yazma, doğrulama nedenleri, değişkenler, graf atama, geriye uyum.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AKTOR_DEGISKEN_SINIRI, levelTanimiDogrula, type LevelTanimi } from "./levelTanimi.ts";
import { ornekTanim } from "./ornekTanim.ts";
import {
  BILESEN_SEMALARI, ISIK_BILESENI, NESNE_BILESENI, aktorBul, aktorKimlikleri, alanDegeriHatasi, alanOku, alanSemasi, alanYaz, degiskenOku, degiskenSayisiDoluMu, degiskenYaz, grafAta,
} from "./bilesen.ts";

const taban = (): LevelTanimi => {
  const t = ornekTanim(); t.katmanlar = [];
  t.nesneler = [{ id: "n0", varlik: "sandik", konum: [9, 0, 9], donus: 0, olcek: 1 }, { id: "n1", varlik: "kutu", konum: [1, 0, 2], donus: 90, olcek: 2 }];
  t.isiklar = [{ id: "i0", tur: "nokta", ad: "Ilk", konum: [7, 2, 7], renk: "#ffffff", siddet: 3, menzil: 5 }, { id: "i1", tur: "nokta", ad: "Lamba", konum: [0, 2, 0], renk: "#ffd9a0", siddet: 1.5, menzil: 8 }];
  return t;
};
const hata = (r: { ok: boolean }): string => { assert.equal(r.ok, false); return (r as unknown as { neden: string }).neden; };

test("bulma: kimlik nesne ya da ışık, yoksa null; kimlik listesi nesneler önce", () => {
  const t = taban();
  assert.deepEqual(aktorBul(t, "n0"), { tur: "nesne", sira: 0 });
  assert.deepEqual(aktorBul(t, "n1"), { tur: "nesne", sira: 1 });
  assert.deepEqual(aktorBul(t, "i0"), { tur: "isik", sira: 0 });
  assert.deepEqual(aktorBul(t, "i1"), { tur: "isik", sira: 1 });
  assert.equal(aktorBul(t, "yok"), null);
  assert.deepEqual(aktorKimlikleri(t), ["n0", "n1", "i0", "i1"]);
});

test("şema: her alanın adı tekil; sayı alanlarında en ≤ cok ve varsayılan aralıkta; varsayılan kendi türünde", () => {
  for (const b of Object.values(BILESEN_SEMALARI)) {
    assert.equal(new Set(b.alanlar.map((a) => a.ad)).size, b.alanlar.length, `${b.tur}: yinelenen alan adı`);
    for (const a of b.alanlar) {
      assert.equal(alanDegeriHatasi(a, a.varsayilan), null, `${b.tur}.${a.ad} varsayılanı kendi şemasına uymuyor`);
      if (a.en !== undefined && a.cok !== undefined) assert.ok(a.en <= a.cok, `${b.tur}.${a.ad}: en > cok`);
    }
  }
  assert.equal(alanSemasi("isik", "siddet")?.tip, "sayi");
  assert.equal(alanSemasi("isik", "yok"), null);
});

test("graf alanları yalnız tek değerli türler (vec3 grafa açılmaz)", () => {
  for (const b of [ISIK_BILESENI, NESNE_BILESENI]) for (const a of b.alanlar) if (a.grafta) assert.notEqual(a.tip, "vec3", `${b.tur}.${a.ad}`);
});

test("okuma: ışık alanı ve varsayılan; nesnenin sayı dönüş/ölçeği vec3'e açılır", () => {
  const t = taban();
  assert.deepEqual(alanOku(t, "i1", "siddet"), { ok: true, deger: 1.5 });
  assert.deepEqual(alanOku(t, "i1", "gizli"), { ok: true, deger: false });   // alan yok = şemanın varsayılanı
  assert.deepEqual(alanOku(t, "n1", "donus"), { ok: true, deger: [0, 90, 0] });
  assert.deepEqual(alanOku(t, "n1", "olcek"), { ok: true, deger: [2, 2, 2] });
  assert.match(hata(alanOku(t, "i1", "kalinlik")), /yok .*alanlar: konum, renk, siddet/);
  assert.equal(hata(alanOku(t, "yok", "siddet")), "aktör yok: yok");
});

test("yazma: değer yazılır, kaynak tanım bozulmaz, sonuç geçerli tanım", () => {
  const t = taban();
  const r = alanYaz(t, "i1", "siddet", 4);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.deger.isiklar![1]!.siddet, 4); assert.equal(r.deger.isiklar![0]!.siddet, 3, "ötekine dokunulmaz"); assert.equal(levelTanimiDogrula(r.deger).ok, true); }
  assert.equal(t.isiklar![1]!.siddet, 1.5, "kaynak aynı");
  const k = alanYaz(t, "n1", "konum", [5, 0, 5]);
  assert.ok(k.ok);
  if (k.ok) { assert.deepEqual(k.deger.nesneler![1]!.konum, [5, 0, 5]); assert.deepEqual(k.deger.nesneler![0]!.konum, [9, 0, 9], "ötekine dokunulmaz"); }
});

test("yazma: tür, aralık ve bilinmeyen alan NEDENLE reddedilir (tanım değişmez)", () => {
  const t = taban();
  assert.match(hata(alanYaz(t, "i1", "siddet", "çok")), /Şiddet: sayı olmalı/);
  assert.match(hata(alanYaz(t, "i1", "siddet", -1)), /en az 0/);
  assert.match(hata(alanYaz(t, "i1", "siddet", 101)), /en çok 100/);
  assert.equal(hata(alanYaz(t, "i1", "siddet", NaN)), "Şiddet: sayı olmalı");
  assert.match(hata(alanYaz(t, "i1", "gizli", "evet")), /doğru\/yanlış/);
  assert.equal(hata(alanYaz(t, "i1", "konum", [1, 2])), "Konum: [x, y, z] (3 sayı) olmalı");
  assert.equal(hata(alanYaz(t, "i1", "konum", [1, 2, 3, 4])), "Konum: [x, y, z] (3 sayı) olmalı");
  assert.match(hata(alanYaz(t, "n1", "olcek", [0, 1, 1])), /en az 0.01/);
  assert.match(hata(alanYaz(t, "i1", "renk", "")), /boş olmayan/);
  assert.match(hata(alanYaz(t, "i1", "renk", "yok-renk")), /renk/);   // şema geçer, tanım doğrulaması palet adını reddeder
  assert.match(hata(alanYaz(t, "i1", "bilinmeyen", 1)), /bileşeninde yok/);
  assert.equal(hata(alanYaz(t, "yok", "siddet", 1)), "aktör yok: yok");
});

test("yazma: nesne ve ışık kendi dizisini değiştirir, ötekine dokunmaz", () => {
  const t = taban();
  const r = alanYaz(t, "n1", "gizli", true);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.deger.nesneler![1]!.gizli, true); assert.equal(r.deger.nesneler![0]!.gizli, undefined); assert.deepEqual(r.deger.isiklar, t.isiklar); }
  const dizi: [number, number, number] = [1, 1, 1];
  const k = alanYaz(t, "i1", "konum", dizi);
  dizi[0] = 99;
  assert.ok(k.ok);
  if (k.ok) assert.equal(k.deger.isiklar![1]!.konum[0], 1, "girdi dizisi sonradan değişse tanım değişmez (kopya)");
});

test("graf atama: yazılır, null kaldırır (alan silinir), geçersiz ad reddedilir", () => {
  const t = taban();
  const a = grafAta(t, "i1", "titrek-isik");
  assert.ok(a.ok);
  if (a.ok) {
    assert.equal(a.deger.isiklar![1]!.graf, "titrek-isik");
    const k = grafAta(a.deger, "i1", null);
    assert.ok(k.ok);
    if (k.ok) assert.equal("graf" in k.deger.isiklar![1]!, false, "alan kalkmalı: dosya eski biçime döner");
  }
  assert.match(hata(grafAta(t, "i1", "boşluklu ad")), /^geçerli graf adı/);
  assert.match(hata(grafAta(t, "yok", "g")), /aktör yok/);
});

test("değişkenler: yaz/oku/sil; son değişken silinince alan kalkar", () => {
  const t = taban();
  const a = degiskenYaz(t, "i1", "hiz", 2.5);
  assert.ok(a.ok);
  if (!a.ok) return;
  assert.deepEqual(degiskenOku(a.deger, "i1", "hiz"), { ok: true, deger: 2.5 });
  const b = degiskenYaz(a.deger, "i1", "mod", "gece");
  assert.ok(b.ok);
  if (!b.ok) return;
  assert.deepEqual(b.deger.isiklar![1]!.degiskenler, { hiz: 2.5, mod: "gece" });
  const s1 = degiskenYaz(b.deger, "i1", "hiz", undefined);
  assert.ok(s1.ok);
  if (!s1.ok) return;
  const s2 = degiskenYaz(s1.deger, "i1", "mod", undefined);
  assert.ok(s2.ok);
  if (s2.ok) assert.equal("degiskenler" in s2.deger.isiklar![1]!, false);
  assert.deepEqual(degiskenOku(t, "i1", "hiz"), { ok: true, deger: undefined });
});

test("değişkenler: geçersiz ad, uzun metin, sonsuz sayı ve tavan reddedilir", () => {
  const t = taban();
  assert.match(hata(degiskenYaz(t, "i1", "boşluk var", 1)), /^değişken adı geçersiz/);
  assert.match(hata(degiskenYaz(t, "i1", "m", "x".repeat(AKTOR_DEGISKEN_SINIRI.metin + 1))), /karakteri aşmayan/);
  assert.match(hata(degiskenYaz(t, "i1", "s", Infinity)), /sayı/);
  let cur = t;
  for (let n = 0; n < AKTOR_DEGISKEN_SINIRI.adet; n++) { const r = degiskenYaz(cur, "i1", `v${n}`, n); assert.ok(r.ok); if (r.ok) cur = r.deger; }
  assert.equal(degiskenSayisiDoluMu(cur, "i1"), true);
  assert.match(hata(degiskenYaz(cur, "i1", "fazla", 1)), /en çok 16/);
  assert.equal(degiskenSayisiDoluMu(t, "i1"), false);
  assert.equal(degiskenSayisiDoluMu(t, "yok"), true);
});

test("geriye uyum: graf/degiskenler alanı olmayan level aynen geçerli; bozuk alanlar tanım doğrulamasında reddedilir", () => {
  const t = taban();
  assert.equal(levelTanimiDogrula(t).ok, true);
  const bozukGraf = { ...t, isiklar: [{ ...t.isiklar![0]!, graf: "boşluk var" }] };
  assert.equal(levelTanimiDogrula(bozukGraf).ok, false);
  const bozukDeg = { ...t, nesneler: [{ ...t.nesneler![0]!, degiskenler: { a: [1] } }] };
  assert.equal(levelTanimiDogrula(bozukDeg).ok, false);
  const diziDeg = { ...t, isiklar: [{ ...t.isiklar![0]!, degiskenler: [1] }] };
  assert.equal(levelTanimiDogrula(diziDeg as unknown).ok, false);
});
