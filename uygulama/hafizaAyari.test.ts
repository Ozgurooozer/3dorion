// uygulama/hafizaAyari.test.ts — bağlamı şişirmeme ayarlarının kalıcılığı: yükleme, aralık kapısı, bozuk kayıt, yazınca kaydetme.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { tel } from "../protocol/pano.ts";
import { HAFIZA_AYAR_ANAHTARI, hafizaAyariniKaliciYap, hafizaAyariniYukle, type HafizaAyarTelleri } from "./hafizaAyari.ts";

function depo(baslangic?: string) {
  const m = new Map<string, string>(baslangic === undefined ? [] : [[HAFIZA_AYAR_ANAHTARI, baslangic]]);
  return { m, d: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } } };
}
const teller = (): HafizaAyarTelleri => ({ otoEsik: tel(100), otoAralikDk: tel(15), mdToplam: tel(5000), mdDosya: tel(2000) });
const degerler = (t: HafizaAyarTelleri) => [t.otoEsik(), t.otoAralikDk(), t.mdToplam(), t.mdDosya()];

test("kayıt yoksa hiçbir şey değişmez ve rapor boştur", () => {
  const t = teller();
  const r = hafizaAyariniYukle(depo().d, t);
  assert.deepEqual([degerler(t), r.uygulanan, r.atlanan], [[100, 15, 5000, 2000], [], []]);
});

test("kayıtlı geçerli ayarlar tellere yazılır", () => {
  const t = teller();
  const r = hafizaAyariniYukle(depo(JSON.stringify({ otoEsik: 80, otoAralikDk: 30, mdToplam: 3000, mdDosya: 1000 })).d, t);
  assert.deepEqual([degerler(t), r.uygulanan.length], [[80, 30, 3000, 1000], 4]);
});

test("aralık dışı ayar ATLANIR ve nedeni söylenir; geçerli komşusu uygulanır", () => {
  const t = teller();
  const r = hafizaAyariniYukle(depo(JSON.stringify({ otoEsik: 10, mdToplam: 3000 })).d, t);
  assert.deepEqual(degerler(t), [100, 15, 3000, 2000]);
  assert.match(r.atlanan[0]?.neden ?? "", /aralık dışı/);
});

test("kesirli ya da sayı olmayan değer atlanır", () => {
  const t = teller();
  const r = hafizaAyariniYukle(depo(JSON.stringify({ otoEsik: 80.5, otoAralikDk: "30" })).d, t);
  assert.deepEqual([degerler(t), r.atlanan.map((x) => x.ayar)], [[100, 15, 5000, 2000], ["otoEsik", "otoAralikDk"]]);
});

test("bozuk JSON: varsayılan kalır, 'kayit' atlandı diye raporlanır (sessiz yutulmaz), fırlatmaz", () => {
  const t = teller();
  const r = hafizaAyariniYukle(depo("{bozuk").d, t);
  assert.deepEqual([degerler(t), r.atlanan.map((x) => x.ayar)], [[100, 15, 5000, 2000], ["kayit"]]);
});

test("depo hiç yoksa (null) hiçbir şey olmaz", () => {
  const t = teller();
  assert.deepEqual(hafizaAyariniYukle(null, t), { uygulanan: [], atlanan: [] });
});

test("kalıcı yap: tele yazınca dört ayarın GÜNCEL değeri depoya gider", () => {
  const { m, d } = depo();
  const t = teller();
  hafizaAyariniKaliciYap(d, t);
  t.otoEsik.yaz(70);
  assert.deepEqual(JSON.parse(m.get(HAFIZA_AYAR_ANAHTARI)!), { otoEsik: 70, otoAralikDk: 15, mdToplam: 5000, mdDosya: 2000 });
});

test("kaydet-yükle turu: yazılan değer yeni açılışta geri gelir", () => {
  const { d } = depo();
  const bir = teller();
  hafizaAyariniKaliciYap(d, bir);
  bir.mdToplam.yaz(2500);
  const iki = teller();
  hafizaAyariniYukle(d, iki);
  assert.equal(iki.mdToplam(), 2500);
});

test("yazma hatası (kota) ayarı bozmaz: bellekte değişir, uyarı basılır, fırlatmaz", () => {
  const uyarilar: string[] = [];
  const t = teller();
  hafizaAyariniKaliciYap({ getItem: () => null, setItem: () => { throw new Error("kota doldu"); } }, t, (m) => uyarilar.push(m));
  t.otoEsik.yaz(90);
  assert.deepEqual([t.otoEsik(), uyarilar.length], [90, 1]);
});
