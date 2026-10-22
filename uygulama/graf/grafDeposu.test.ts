// uygulama/graf/grafDeposu.test.ts — grafik deposu: yazmadan önce biçim doğrulaması (bozuk diske GİTMEZ), ad = dosya adı, kanonik metin, desen ayrımı,
// bozuk dosyanın listede nedeniyle kalması, sıra; yerel (localStorage) kaynağın kuralları ortak çekirdekten.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { grafDogrula } from "../../protocol/graf.ts";
import { DosyaHatasi, type DosyaKaynagi } from "../dosyaDeposu.ts";
import { grafDeposuKur, grafMetni, grafMetniCoz, yerelGrafKaynagi, YEREL_GRAF_ANAHTARI } from "./grafDeposu.ts";
import { yeniDesenSablonu, yeniGrafSablonu } from "./kutuphane.ts";

function bellekDeposu() {
  const m = new Map<string, string>();
  return { m, depo: { getItem: (a: string) => m.get(a) ?? null, setItem: (a: string, v: string) => { m.set(a, v); } } };
}
/** Yazılanları sayan kaynak (bozuk metin diske gitmiş mi?). */
function sayanKaynak() {
  const b = bellekDeposu();
  const k = yerelGrafKaynagi(b.depo, () => 7);
  const yazilan: string[] = [];
  const sayan: DosyaKaynagi = { ...k, yaz: async (ad, metin) => { yazilan.push(ad); await k.yaz(ad, metin); }, yeni: async (ad, metin) => { yazilan.push(ad); await k.yeni(ad, metin); } };
  return { k: sayan, ham: k, yazilan, b };
}

test("kanonik metin gidiş-dönüş: grafMetni → grafMetniCoz aynı grafiği verir; düğüm başına bir satır", () => {
  const g = yeniGrafSablonu("ornek");
  const m = grafMetni(g);
  const r = grafMetniCoz(m);
  assert.ok(r.ok);
  assert.deepEqual(r.deger, grafDogrula(g).ok ? (grafDogrula(g) as { deger: unknown }).deger : null);
  assert.equal(m.split("\n").filter((s) => s.includes("\"tip\":")).length, g.dugumler.length);
});

test("grafMetniCoz: JSON hatası ve biçim hatası NEDENLE", () => {
  const a = grafMetniCoz("{bozuk");
  const b = grafMetniCoz(JSON.stringify({ surum: 1, ad: "x", tur: "olay", dugumler: [{ id: "a", tip: "KOTU TIP" }], baglar: [] }));
  assert.deepEqual([a.ok ? "" : a.hata.slice(0, 16), b.ok ? "" : b.hata.slice(0, 6)], ["JSON okunamadı: ", "biçim:"]);
});

test("yeni → liste → al/desen: olay grafiği ile desen ayrı; desen() yalnız fonksiyon grafiğini verir", async () => {
  const s = sayanKaynak();
  const d = grafDeposuKur(s.k);
  await d.baslat();
  await d.yeni(yeniGrafSablonu("ornek"));
  await d.yeni(yeniDesenSablonu("selamla"));
  assert.deepEqual(d.liste().map((x) => [x.ad, x.tur, x.hata]), [["ornek", "olay", null], ["selamla", "fonksiyon", null]]);
  assert.deepEqual([d.al("ornek")?.tur, d.desen("selamla")?.ad, d.desen("ornek")], ["olay", "selamla", null]);
});

test("YAZMADAN ÖNCE DOĞRULAMA: bozuk JSON ve biçim hatası diske GİTMEZ, hata nedenle fırlar, eski hâl kalır", async () => {
  const s = sayanKaynak();
  const d = grafDeposuKur(s.k);
  await d.baslat();
  await d.yeni(yeniGrafSablonu("ornek"));
  const once = await d.oku("ornek");
  s.yazilan.length = 0;
  await assert.rejects(d.yaz("ornek", "{bozuk"), (e: DosyaHatasi) => e.kod === "gecersiz-icerik" && /JSON/.test(e.message));
  await assert.rejects(d.yaz("ornek", JSON.stringify({ ...yeniGrafSablonu("ornek"), surum: 9 })), /biçim: surum/);
  assert.deepEqual([s.yazilan, await d.oku("ornek")], [[], once]);
});

test("ad = dosya adı: içerikteki ad farklıysa kaydedilmez (başka adla kayıt ＋ Yeni ile)", async () => {
  const s = sayanKaynak();
  const d = grafDeposuKur(s.k);
  await d.baslat();
  await d.yeni(yeniGrafSablonu("ornek"));
  await assert.rejects(d.yaz("ornek", grafMetni(yeniGrafSablonu("baska"))), /aynı olmalı/);
});

test("yaz: kanonik metni döner ve diske onu yazar (bilinmeyen alanlar atılır); önbellek hemen yeni grafiği görür", async () => {
  const s = sayanKaynak();
  const d = grafDeposuKur(s.k);
  await d.baslat();
  await d.yeni(yeniGrafSablonu("ornek"));
  const g = { ...yeniGrafSablonu("ornek"), aciklama: "yeni açıklama", fazla: "atılır" };
  const yazilan = await d.yaz("ornek", JSON.stringify(g));
  assert.equal(yazilan, await d.oku("ornek"));
  assert.doesNotMatch(yazilan, /fazla/);
  assert.equal(d.al("ornek")?.aciklama, "yeni açıklama");
});

test("tür denetimi yazmayı ENGELLEMEZ (yarım program kaydedilebilir): bilinmeyen düğüm türü kaydedilir", async () => {
  const s = sayanKaynak();
  const d = grafDeposuKur(s.k);
  await d.baslat();
  await d.yeni(yeniGrafSablonu("ornek"));
  const g = yeniGrafSablonu("ornek");
  g.dugumler.push({ id: "yeni", tip: "henuz.yok" });
  await d.yaz("ornek", JSON.stringify(g));
  assert.equal(d.al("ornek")?.dugumler.some((x) => x.tip === "henuz.yok"), true);
});

test("bozuk dosya listeden DÜŞMEZ: nedeniyle görünür, al() null (çalıştırılamaz)", async () => {
  const s = sayanKaynak();
  await s.ham.yeni("bozuk", "{bu json değil");
  await s.ham.yeni("adsiz", grafMetni(yeniGrafSablonu("baska_ad")));
  const d = grafDeposuKur(s.k);
  await d.baslat();
  assert.deepEqual(d.liste().map((x) => [x.ad, x.hata !== null]), [["adsiz", true], ["bozuk", true]]);
  assert.match(d.liste()[0]!.hata ?? "", /dosya adıyla aynı değil/);
  assert.equal(d.al("bozuk"), null);
});

test("geçersiz ad reddedilir (yeni de yaz da)", async () => {
  const d = grafDeposuKur(sayanKaynak().k);
  await d.baslat();
  await assert.rejects(d.yeni({ ...yeniGrafSablonu("x"), ad: "../kacis" }), /ad geçersiz|grafik adı/);
  await assert.rejects(d.yaz("a b", "{}"), (e: DosyaHatasi) => e.kod === "gecersiz-ad");
});

test("olaylar: liste ve içerik değişimi haber verilir", async () => {
  const s = sayanKaynak();
  const d = grafDeposuKur(s.k);
  const olaylar: string[] = [];
  d.dinle((o) => olaylar.push(o.tur === "icerik" ? `icerik:${o.ad}` : "liste"));
  await d.baslat();
  await d.yeni(yeniGrafSablonu("ornek"));
  await d.yaz("ornek", grafMetni(yeniGrafSablonu("ornek")));
  assert.deepEqual([olaylar.includes("liste"), olaylar.includes("icerik:ornek")], [true, true]);
});

test("yerel kaynak: kurallar host'unkiyle aynı (yok / var / geçersiz ad), tek anahtar altında saklanır", async () => {
  const b = bellekDeposu();
  const k = yerelGrafKaynagi(b.depo, () => 5);
  await k.yeni("a", "bir");
  await k.yaz("a", "iki");
  assert.equal(await k.oku("a"), "iki");
  assert.deepEqual((await k.liste()).map((x) => [x.ad, x.boyut, x.degisti]), [["a", 3, 5]]);
  await assert.rejects(k.yeni("a", ""), (e: DosyaHatasi) => e.kod === "var");
  await assert.rejects(k.yaz("yok", "x"), (e: DosyaHatasi) => e.kod === "yok");
  await assert.rejects(k.yeni("a.json", ""), (e: DosyaHatasi) => e.kod === "gecersiz-ad");
  assert.deepEqual([...b.m.keys()], [YEREL_GRAF_ANAHTARI]);
});

test("sil: grafik listeden ve önbellekten gider; yoksa nedenli hata; kaynak silmeyi bilmiyorsa nedenli hata", async () => {
  const s = sayanKaynak();
  const depo = grafDeposuKur(s.k);
  await depo.baslat();
  await depo.yeni(yeniGrafSablonu("selam"));
  assert.deepEqual(depo.liste().map((k) => k.ad), ["selam"]);
  await depo.sil("selam");
  assert.deepEqual([depo.liste().length, depo.al("selam")], [0, null]);
  await assert.rejects(depo.sil("selam"), /grafik yok: selam/);
  const silmez = grafDeposuKur({ liste: async () => [], oku: async () => "", yaz: async () => {}, yeni: async () => {} });
  await assert.rejects(silmez.sil("x"), /silme yok/);
  await assert.rejects(depo.sil("../x"), /geçersiz grafik adı/);
});

test("desenKullananlar: deseni 'Desen' düğümüyle çağıran grafikleri söyler (silmeden önce uyarı); kendi kendini ve başka deseni saymaz", async () => {
  const s = sayanKaynak();
  const depo = grafDeposuKur(s.k);
  await depo.baslat();
  await depo.yeni(yeniDesenSablonu("selamla"));
  const g = yeniGrafSablonu("kullanan");
  g.dugumler.push({ id: "c", tip: "desen.cagir", ayar: { desen: "selamla" } });
  await depo.yeni(g);
  await depo.yeni(yeniGrafSablonu("kullanmayan"));
  assert.deepEqual(depo.desenKullananlar("selamla"), ["kullanan"]);
  assert.deepEqual(depo.desenKullananlar("yokboyle"), []);
});
