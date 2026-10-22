// world/avatar/klipKutuphanesi.test.ts — klip KÜTÜPHANESİ ve yükleyici (spec 35 Dilim 5a) + repodaki klip verisinin bekçileri + gövde eşleme tablosu.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { UZUVLAR, type AnimasyonKlibi } from "../../protocol/animasyon.ts";
import { KLIP_DIZINI, KLIP_LISTESI, klipKutuphanesiKur, klipleriYukle, klipListesiCoz, klipMetniCoz } from "./klipKutuphanesi.ts";
import { KOK_DUGUMU, UZUV_ESLEMESI, uzuvlariCoz } from "./uzuvEslemesi.ts";

const ASSETS = new URL("../../assets/", import.meta.url);
const diskten = (yol: string) => readFile(new URL(yol, ASSETS), "utf8");
const gecerli = (ad: string) => JSON.stringify({ surum: 1, ad, jest: "el_salliyor", sure: 1, izler: [{ uzuv: "bas", kanal: "donme_x", anahtarlar: [{ t: 0, deger: 0 }] }] });

/** Sahte klasör: yol → metin; listede olmayan yol "dosya yok" fırlatır. */
const sahte = (dosyalar: Record<string, string>) => async (yol: string) => {
  const m = dosyalar[yol];
  if (m === undefined) throw new Error("dosya yok");
  return m;
};

test("klip metni: bozuk JSON nedenli", () => {
  const r = klipMetniCoz("x.json", "{ bozuk");
  assert.equal(r.ok === false && r.hata.startsWith("JSON okunamadı"), true);
});
test("klip metni: biçim hatası doğrulayıcının metniyle", () => {
  const r = klipMetniCoz("x.json", JSON.stringify({ surum: 1, ad: "x", jest: "el_salliyor", sure: 99, izler: [] }));
  assert.equal(r.ok === false && /sure: 99 aralık dışı/.test(r.hata), true);
});
test("klip metni: ad dosya adıyla aynı olmalı", () => {
  const r = klipMetniCoz("el_salla.json", gecerli("baska"));
  assert.deepEqual(r, { ok: false, hata: "ad 'baska' dosya adıyla ('el_salla') aynı olmalı" });
});

test("liste: dizi, geçerli ad, tekil", () => {
  assert.deepEqual(klipListesiCoz('["a", "b"]'), { ok: true, deger: ["a", "b"] });
  for (const [m, re] of [["{}", /dizisi olmalı/], ['["a", "a"]', /iki kez/], ['["A"]', /adı geçersiz/], ["[", /JSON okunamadı/]] as const) {
    const r = klipListesiCoz(m);
    assert.equal(r.ok === false && re.test(r.hata), true, m);
  }
  assert.equal(klipListesiCoz(JSON.stringify(Array.from({ length: 65 }, (_, i) => `k${i}`))).ok, false);
});

test("yükleyici: BOZUK tek klip yalnız kendisi düşer, nedeni dosya adıyla; sağlamlar liste sırasıyla yüklenir", async () => {
  const r = await klipleriYukle(sahte({
    "animasyon/liste.json": '["b", "bozuk", "a", "eksik"]',
    "animasyon/a.json": gecerli("a"), "animasyon/b.json": gecerli("b"), "animasyon/bozuk.json": "{",
  }));
  assert.deepEqual([r.klipler.map((k) => k.ad), r.hatalar.map((h) => h.dosya)], [["b", "a"], ["bozuk.json", "eksik.json"]]);
  assert.match(r.hatalar[1]!.neden, /okunamadı: dosya yok/);
});

test("yükleyici: liste okunamazsa hiç klip yok, tek hata liste", async () => {
  assert.deepEqual(await klipleriYukle(sahte({})), { klipler: [], hatalar: [{ dosya: KLIP_LISTESI, neden: "okunamadı: dosya yok" }] });
  const r = await klipleriYukle(sahte({ "animasyon/liste.json": "{}" }));
  assert.deepEqual([r.klipler, r.hatalar.length, r.hatalar[0]!.dosya], [[], 1, KLIP_LISTESI]);
});

test("kütüphane: boş kurulur, doldurulunca bulur; aynı ad ikinci kez HATA (ilki kalır)", () => {
  const k = klipKutuphanesiKur();
  assert.deepEqual([k.adlar(), k.bul("a")], [[], null]);
  const a = klipMetniCoz("a.json", gecerli("a"));
  assert.ok(a.ok);
  const ikinci: AnimasyonKlibi = { ...a.deger, sure: 5 };
  k.doldur([a.deger, ikinci]);
  assert.deepEqual([k.adlar(), k.bul("a")?.sure, k.hatalar().length, k.ozetler().map((o) => o.ad)], [["a"], 1, 1, ["a"]]);
});

// ── repodaki klip verisi (assets/animasyon/) ──
test("BEKÇİ: liste.json klasördeki klip dosyalarıyla AYNI (unutulan dosya da, olmayan dosya da kırmızı)", async () => {
  const disk = readdirSync(new URL(`${KLIP_DIZINI}/`, ASSETS)).filter((f) => f.endsWith(".json") && f !== KLIP_LISTESI).map((f) => f.replace(/\.json$/, "")).sort();
  const r = klipListesiCoz(await diskten(`${KLIP_DIZINI}/${KLIP_LISTESI}`));
  assert.ok(r.ok);
  assert.deepEqual([...r.deger].sort(), disk);
});

test("repodaki bütün klipler HATASIZ yüklenir; istenen beş klip var", async () => {
  const r = await klipleriYukle(diskten);
  assert.deepEqual(r.hatalar, []);
  for (const ad of ["el_salla", "basla_onayla", "basla_reddet", "selam_ver", "dusun"]) assert.ok(r.klipler.some((k) => k.ad === ad), ad);
});

test("repodaki klipler: hepsi döngüsüz ve BİTİŞTE sıfıra döner (bitince kol/baş sıçramasın)", async () => {
  const r = await klipleriYukle(diskten);
  for (const k of r.klipler) {
    assert.equal(k.dongu, false, k.ad);
    for (const iz of k.izler) assert.equal(iz.anahtarlar[iz.anahtarlar.length - 1]!.deger, 0, `${k.ad} ${iz.uzuv}.${iz.kanal}`);
  }
});

// ── gövde eşleme tablosu ──
test("BEKÇİ: VRM tablosu BÜTÜN soyut uzuvları eşler (yeni uzuv eklenince karar verilmeden geçmez)", () => {
  assert.deepEqual(Object.keys(UZUV_ESLEMESI.vrm).sort(), [...UZUVLAR].sort());
});
test("LED yüzün tablosu boş (gövdesiz donanım)", () => assert.deepEqual(UZUV_ESLEMESI.ledyuz, {}));

test("uzuvlariCoz: kök ara düğümü atlanır, bulunmayan düğüm 'eksik' sayılır (sessiz yutma yok)", () => {
  const r = uzuvlariCoz("prosedurel", (ad) => (ad === "omuzL" || ad === "boyun" ? { ad } : null));
  assert.deepEqual([[...r.dugumler.keys()], r.eksik], [["bas", "sag_kol"], ["govde → kalca", "sol_kol → omuzR", "sag_bacak → bacakL", "sol_bacak → bacakR"]]);
  assert.equal(UZUV_ESLEMESI.prosedurel.kok, KOK_DUGUMU);
});
