// uygulama/yapi/assetSuzgeci.test.ts — asset sekmesi mantığı: süzgeç, arama, sayılar, son/favori listeleri, kayıt biçimi.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { SUZGEC_FAVORI, SUZGEC_SON, SUZGEC_TUM, SON_SINIRI, favoriDegistir, kartlariSuz, listeyiOku, listeyiYaz, sonEkle, suzgeciDogrula, suzgecSayilari } from "./assetSuzgeci.ts";
import type { AssetKarti } from "../assetListesi.ts";

const kart = (varlik: string, ad: string, kategori: string): AssetKarti => ({ varlik, ad, kategori, onizleme: "", boyut: [1, 1, 1] });
const KARTLAR = [kart("PROP_Bench", "Bank", "eşya"), kart("PROP_Lamp", "Lamba", "eşya"), kart("BLD_Kule", "Kule", "binalar"), kart("NEON_Ok", "Ok tabelası", "neon")];
const ad = (l: readonly AssetKarti[]) => l.map((k) => k.ad);
const bos: ReadonlySet<string> = new Set();

test("tümü: hepsi, sırayı bozmadan; girdi dizisi değişmez", () => {
  const girdi = [...KARTLAR];
  assert.deepEqual(ad(kartlariSuz(girdi, SUZGEC_TUM, "", bos, [])), ["Bank", "Lamba", "Kule", "Ok tabelası"]);
  assert.deepEqual(girdi, KARTLAR);
});

test("kategori süzgeci yalnız o kategorinin kartlarını verir", () => {
  assert.deepEqual(ad(kartlariSuz(KARTLAR, "eşya", "", bos, [])), ["Bank", "Lamba"]);
  assert.deepEqual(kartlariSuz(KARTLAR, "yok", "", bos, []), []);
});

test("favori süzgeci yalnız favorileri verir", () => {
  assert.deepEqual(ad(kartlariSuz(KARTLAR, SUZGEC_FAVORI, "", new Set(["BLD_Kule"]), [])), ["Kule"]);
});

test("son süzgeci: en yeni önce; katalogda olmayan atlanır", () => {
  assert.deepEqual(ad(kartlariSuz(KARTLAR, SUZGEC_SON, "", bos, ["NEON_Ok", "SILINMIS", "PROP_Bench"])), ["Ok tabelası", "Bank"]);
});

test("arama: ad, kategori ya da katalog adında geçer; büyük/küçük harf ve Türkçe İ/ı duyarsız", () => {
  assert.deepEqual(ad(kartlariSuz(KARTLAR, SUZGEC_TUM, "LAMB", bos, [])), ["Lamba"]);
  assert.deepEqual(ad(kartlariSuz(KARTLAR, SUZGEC_TUM, "binalar", bos, [])), ["Kule"]);
  assert.deepEqual(ad(kartlariSuz(KARTLAR, SUZGEC_TUM, "prop_bench", bos, [])), ["Bank"]);
  assert.deepEqual(ad(kartlariSuz([kart("X", "ILIK", "k")], SUZGEC_TUM, "ılık", bos, [])), ["ILIK"]);
});

test("arama: sözcüklerin HEPSİ eşleşmeli; boş/boşluk araması süzmez; süzgeçle birlikte çalışır", () => {
  assert.deepEqual(ad(kartlariSuz(KARTLAR, SUZGEC_TUM, "eşya bank", bos, [])), ["Bank"]);
  assert.deepEqual(kartlariSuz(KARTLAR, SUZGEC_TUM, "eşya kule", bos, []), []);
  assert.equal(kartlariSuz(KARTLAR, SUZGEC_TUM, "   ", bos, []).length, 4);
  assert.deepEqual(ad(kartlariSuz(KARTLAR, "eşya", "la", bos, [])), ["Lamba"]);
});

test("sayılar: tümü / favori / son (katalogda olanlar) / kategoriler Türkçe sıralı", () => {
  const s = suzgecSayilari(KARTLAR, new Set(["PROP_Bench", "SILINMIS"]), ["PROP_Bench", "SILINMIS", "PROP_Bench"]);
  assert.deepEqual([s.tum, s.favori, s.son], [4, 1, 1]);
  assert.deepEqual(s.kategoriler, [{ ad: "binalar", sayi: 1 }, { ad: "eşya", sayi: 2 }, { ad: "neon", sayi: 1 }]);
});

test("sonEkle: en başa, yinelenen öne alınır, sınırı aşmaz; girdi değişmez", () => {
  const girdi = ["a", "b", "c"];
  assert.deepEqual(sonEkle(girdi, "c"), ["c", "a", "b"]);
  assert.deepEqual(girdi, ["a", "b", "c"]);
  assert.equal(sonEkle(Array.from({ length: SON_SINIRI }, (_, i) => `v${i}`), "yeni").length, SON_SINIRI);
  assert.deepEqual(sonEkle(["a", "b"], "z", 2), ["z", "a"]);
});

test("favoriDegistir: ekler, ikinci kez çıkarır; girdi küme değişmez", () => {
  const f0 = new Set(["a"]);
  const f1 = favoriDegistir(f0, "b");
  assert.deepEqual([...f1].sort(), ["a", "b"]);
  assert.deepEqual([...f0], ["a"]);
  assert.deepEqual([...favoriDegistir(f1, "a")], ["b"]);
});

test("süzgeçDoğrula: kalkmış kategori 'tümü'ne düşer; özel anahtarlar korunur", () => {
  const s = suzgecSayilari(KARTLAR, bos, []);
  assert.equal(suzgeciDogrula("eşya", s), "eşya");
  assert.equal(suzgeciDogrula("kalkmis", s), SUZGEC_TUM);
  assert.equal(suzgeciDogrula(SUZGEC_SON, s), SUZGEC_SON);
  assert.equal(suzgeciDogrula(SUZGEC_FAVORI, s), SUZGEC_FAVORI);
});

test("kayıt: yaz → oku gidiş-dönüş (sıra korunur); boş → []", () => {
  assert.deepEqual(listeyiOku(listeyiYaz(["b", "a"])), ["b", "a"]);
  assert.deepEqual(listeyiOku(listeyiYaz(new Set(["x"]))), ["x"]);
  assert.deepEqual(listeyiOku(null), []);
});

test("kayıt: bozuk kayıtlar HATA", () => {
  assert.throws(() => listeyiOku("{"), SyntaxError);
  assert.throws(() => listeyiOku("3"), /nesne değil/);
  assert.throws(() => listeyiOku(JSON.stringify({ surum: 2, liste: [] })), /sürümü/);
  assert.throws(() => listeyiOku(JSON.stringify({ surum: 1, liste: [1] })), /bozuk/);
  assert.throws(() => listeyiOku(JSON.stringify({ surum: 1 })), /bozuk/);
});
