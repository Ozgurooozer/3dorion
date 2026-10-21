"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { araclariUret, cagriyiNiyete, turCoz, yuzeyMaliyeti, ARAC_TABLOSU } from "./araclar.ts";
import { POZLAR, SORULAR } from "../protocol/niyet.ts";

// Elle tutulan liste: protokole yeni tür eklenip araç tablosuna eklenmezse
// test kırmızı yanar. Yeni yeteneğin modele görünmez kalmasını engeller.
const BEKLENEN_TURLER = [
  "poz", "jest", "bak", "git", "otur", "kalk", "soyle",
  "yaz", "al", "birak", "odaklan", "dur", "sor", "hatirla",
  // `komut` = terminale komut ÖNERME. Bilerek ve açıkça eklendi.
  // Protokoldeki tek tehlikeli yetenek: Orion komutu ÇALIŞTIRMAZ, yalnızca
  // önerir; çalıştıran şey Ozyn'in onay tuşudur. Bu listeyi güncellemek
  // zorunda kalmak istenen davranıştır — yeni yetenek sessizce eklenemesin.
  "komut",
  // `ortam` = ova'nın ışığı/rengi/stili/zamanı (Ozyn, 2026-10-13: "tahtaya yazmak gibi bir araç olsun"). Dünyanın
  // GÖRÜNÜMÜNÜ değiştirir, onay istemez; özerk turda sunulmaz (OZERK_ARACLAR).
  "ortam",
  // `doktor` = Orion Doktor (Ozyn, 2026-10-15): kendi bedenini/dünyasını muayene eder (WebGL hatası, görünmez mesh). Onay istemez;
  // sağlıklıysa sessiz (token yok). Özerk turda sunulmaz (YAZAN_NIYETLER). Açıklama bilerek KISA: her turun sabit maliyeti.
  "doktor",
  // `emret` = Orion → Flash emri (Ozyn, 2026-10-21): LLM'siz NPC'ye kısa komut teslim eder. YALNIZ Flash varken sunulur (köprü `emirHedefleri`); özerk turda sunulmaz.
  "emret",
];

test("her niyet türünün bir aracı var — sessizce görünmez yetenek yok", () => {
  assert.deepEqual(Object.keys(ARAC_TABLOSU).sort(), [...BEKLENEN_TURLER].sort());
});

test("araç adları ASCII ve önekli, açıklamalar dolu", () => {
  for (const a of araclariUret()) {
    assert.match(a.ad, /^dunya_[a-z]+$/, `ASCII dışı veya öneksiz ad: ${a.ad}`);
    assert.ok(a.aciklama.length > 15, `açıklama çok kısa: ${a.ad}`);
  }
});

test("araç çağrısı doğrulanmış niyete dönüşür", () => {
  const r = cagriyiNiyete("dunya_git", { hedef: { tip: "capa", ad: "tahta" } });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.deger.tur, "git");
});

test("uydurma araç adı reddedilir ve geçerli listeyi söyler", () => {
  const r = cagriyiNiyete("dunya_ucmak", {});
  assert.equal(r.ok, false);
  if (!r.ok) { assert.match(r.hata, /bilinmeyen araç/); assert.match(r.hata, /dunya_git/); }
});

test("önek olmadan çağrı reddedilir", () => {
  assert.equal(cagriyiNiyete("git", { hedef: { tip: "oyuncu" } }).ok, false);
  assert.equal(turCoz("git"), null);
  assert.equal(turCoz("dunya_git"), "git");
});

test("doğrulama atlanmıyor: sözlük dışı poz araç yolundan da geçmez", () => {
  const r = cagriyiNiyete("dunya_poz", { poz: "zıplıyor" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.hata, new RegExp(POZLAR[0]));
});

test("bak: hedef alanı hiç verilmezse serbest bakış sayılır", () => {
  const r = cagriyiNiyete("dunya_bak", {});
  assert.equal(r.ok, true);
  if (r.ok && r.deger.tur === "bak") assert.equal(r.deger.hedef, null);
});

test("argümansız araçlar boş ve null girdiyle çalışır", () => {
  for (const ad of ["dunya_kalk", "dunya_birak", "dunya_dur"]) {
    assert.equal(cagriyiNiyete(ad, {}).ok, true, ad);
    assert.equal(cagriyiNiyete(ad, null).ok, true, `${ad} (null girdi)`);
  }
});

test("bozuk girdi türleri çökertmez", () => {
  for (const kotu of [null, undefined, 42, "metin", []]) {
    assert.equal(cagriyiNiyete("dunya_soyle", kotu).ok, false, `${String(kotu)} kabul edildi`);
  }
});

test("dizi girdisi nesne sayılmaz", () => {
  assert.equal(cagriyiNiyete("dunya_git", [{ tip: "oyuncu" }]).ok, false);
});

test("araç yüzeyi token bütçesi makul", () => {
  const m = yuzeyMaliyeti();
  assert.ok(m > 100, `şüpheli küçük yüzey: ${m}`);
  // 1500 → 1650: `dunya_ortam` (~190 token; değer adları şemada, kısa tutuldu). Yerel modele zararı Faz 3'te ölçülür
  // (docs/olcum/on-kayit-ortam.md): mevcut 28 senaryoda ±1; bozarsa o modelden `cikarilanAraclar` ile çıkarılır.
  // 1650 → 1750: `dunya_doktor` (~55 token, ölçüldü 1704, açıklama bilerek tek cümle). Ozyn'in isteği: LLM'siz söz yolu var ("doktor"), araç yalnız Orion'un kendi
  // kararıyla çağırabilmesi için; sabit maliyeti bu kadar tutuldu.
  // 1750 → 1800: `dunya_emret` (~88 token, ölçüldü 1792; yalnız Flash varken sunulur, yani Flash'sız turun yüzeyi 1704 kalır — bkz. kopruEmir.test.ts).
  assert.ok(m < 1800, `araç yüzeyi çok pahalı: ~${m} token/tur`);
});

// ── BAK zinciri: sözleşme → araç → protokol ───────────────────────────────
// `BAK:` satırı `dunya_sor` çağrısına dönüyor (satirSozlesmesi.test.ts), ama
// o çağrının PROTOKOL DOĞRULAMASINDAN geçtiği ayrıca sınanmalı: `onumde`
// sorusu protokole sonradan eklendi ve iki taraf ayrı dosyalarda.

test("dunya_sor protokolün bütün soruları için geçerli niyet üretir (görme `gor` dahil)", () => {
  for (const ne of SORULAR) {
    const d = cagriyiNiyete("dunya_sor", { ne });
    assert.ok(d.ok, `${ne} reddedildi: ${d.ok ? "" : d.hata}`);
    assert.equal(d.deger.tur, "sor");
    assert.equal((d.deger as { ne: string }).ne, ne);
  }
});

test("dunya_sor uydurma soruyu REDDEDER", () => {
  const d = cagriyiNiyete("dunya_sor", { ne: "arkamda" });
  assert.equal(d.ok, false, "bilinmeyen sorgu kabul edilmemeli");
});

// ── emret: Orion → Flash (spec 33) ──
test("emret: araç çağrısı doğrulanmış niyete döner (kime küçük harfe, söz tek satıra iner)", () => {
  const r = cagriyiNiyete("dunya_emret", { kime: " Flash ", soz: "bana\n gel" });
  assert.deepEqual(r.ok ? r.deger : r, { tur: "emret", kime: "flash", soz: "bana gel" });
});

test("emret: kime ya da soz eksik/boşsa reddedilir ve nedeni söyler", () => {
  for (const girdi of [{}, { kime: "flash" }, { soz: "otur" }, { kime: "", soz: "otur" }, { kime: "flash", soz: "  " }]) {
    assert.equal(cagriyiNiyete("dunya_emret", girdi).ok, false, JSON.stringify(girdi));
  }
});

test("emret: çok uzun söz ve geçersiz ajan kimliği reddedilir (roman ya da yol değil, kısa komut)", () => {
  assert.equal(cagriyiNiyete("dunya_emret", { kime: "flash", soz: "x".repeat(61) }).ok, false);
  assert.equal(cagriyiNiyete("dunya_emret", { kime: "../orion", soz: "otur" }).ok, false);
  assert.equal(cagriyiNiyete("dunya_emret", { kime: "a".repeat(25), soz: "otur" }).ok, false);
});

test("emret açıklamasında anılan her komut Flash'ın komut sözlüğünce tanınır (araç yalan komut öğretmesin)", async () => {
  const { komutCoz } = await import("../mind/komutSozlugu.ts");
  const { takipEylemi } = await import("../mind/takipSozu.ts");
  const aciklama = araclariUret().find((a) => a.ad === "dunya_emret")!.aciklama;
  const komutlar = ["otur", "kalk", "bana gel", "beni takip et", "takibi birak", "pencereye bak"];
  for (const k of komutlar) assert.ok(aciklama.includes(k), `açıklamada yok: ${k}`);
  assert.deepEqual(komutlar.filter((k) => komutCoz(k) === null && takipEylemi(k) === null), []);
});
