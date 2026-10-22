// world/avatar/bedenKlip.test.ts — BEDEN klibi iskelete nasıl verir (spec 35 Dilim 5a): klip destekleyen gövdeye örneklenmiş değerler, desteklemeyene
// (LED yüz) klibin ANLAMI jest olarak; klip bitince boş değerler (iskelet yazdığını geri alsın); çizim zamanı mantığın bir tik önüne geçmez.
// İskelet sahte: çağrıları kaydeder. Babylon sahnesi yok.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { klipDogrula } from "../../protocol/animasyon.ts";
import type { Jest } from "../../protocol/niyet.ts";
import { Beden } from "./beden.ts";
import type { AvatarIskeleti } from "./iskelet.ts";
import type { UzuvDegeri } from "./klipOrnekleyici.ts";
import { Yurutucu } from "./yurutucu.ts";
import { klipKutuphanesiKur } from "./klipKutuphanesi.ts";

function sahteIskelet(klipli: boolean) {
  const klipCagrilari: (readonly UzuvDegeri[])[] = [];
  const jestCagrilari: [Jest | null, number][] = [];
  const bos = () => {};
  const i: AvatarIskeleti = {
    bilgi: { tur: klipli ? "vrm" : "ledyuz", kaynak: "sahte", agizDestegi: true, kirpmaDestegi: true, basDestegi: true, hamBoy: 1.75 },
    konumUygula: bos, cizimKonumu: () => ({ x: 0, y: 0, z: 0 }), govdeUygula: bos, basUygula: bos, pozUygula: bos,
    jestUygula: (j, p) => { jestCagrilari.push([j, p]); }, agizUygula: bos, bostaUygula: bos, gozKirp: bos, gorunur: bos, yokEt: bos,
    ...(klipli ? { klipUzuvlari: new Set(["sag_kol"] as const), klipUygula: (d: readonly UzuvDegeri[]) => { klipCagrilari.push(d); } } : {}),
  };
  return { i, klipCagrilari, jestCagrilari };
}

function kur(klipli: boolean) {
  const r = klipDogrula({ surum: 1, ad: "kaldir", jest: "el_salliyor", sure: 1, izler: [{ uzuv: "sag_kol", kanal: "donme_z", anahtarlar: [{ t: 0, deger: 0 }, { t: 1, deger: 100 }] }] });
  if (!r.ok) throw new Error(r.hata);
  const kutuphane = klipKutuphanesiKur();
  kutuphane.doldur([r.deger]);
  const s = sahteIskelet(klipli);
  const y = new Yurutucu({ klipler: kutuphane });
  const b = new Beden(s.i);
  const tik = () => { y.ilerle(0.05); b.mantikUygula(y.gorunum()); };
  return { ...s, y, b, tik };
}

test("klip destekleyen gövde: örneklenmiş değerler klipUygula'ya gider, düz jest çağrılmaz", () => {
  const k = kur(true);
  k.y.niyet({ tur: "jest", jest: "el_salliyor", klip: "kaldir" }, "j1");
  for (let i = 0; i < 10; i++) k.tik();                // mantık 0.5 sn
  k.b.cizimGuncelle(0);
  const son = k.klipCagrilari[k.klipCagrilari.length - 1]!;
  assert.deepEqual([son.length, son[0]!.uzuv, Math.round(son[0]!.deger), k.jestCagrilari.length], [1, "sag_kol", 50, 0]);
});

test("çizim zamanı mantığın en çok bir tik (0.05 sn) önüne geçer: uzun kare klibi ileri sardırmaz", () => {
  const k = kur(true);
  k.y.niyet({ tur: "jest", jest: "el_salliyor", klip: "kaldir" }, "j1");
  for (let i = 0; i < 4; i++) k.tik();                 // mantık 0.2 sn
  k.b.cizimGuncelle(0.5);                              // yarım saniyelik kare
  const son = k.klipCagrilari[k.klipCagrilari.length - 1]!;
  assert.equal(Math.round(son[0]!.deger), 25);         // (0.2 + 0.05) × 100
});

test("klip bitince boş değer dizisi gider (iskelet yazdığını geri alır)", () => {
  const k = kur(true);
  k.y.niyet({ tur: "jest", jest: "el_salliyor", klip: "kaldir" }, "j1");
  for (let i = 0; i < 30; i++) k.tik();
  k.b.cizimGuncelle(0.016);
  assert.deepEqual(k.klipCagrilari[k.klipCagrilari.length - 1], []);
});

test("klip DESTEKLEMEYEN gövde (LED yüz): klibin anlamı jest olarak, ilerleme klip süresinden", () => {
  const k = kur(false);
  k.y.niyet({ tur: "jest", jest: "el_salliyor", klip: "kaldir" }, "j1");
  for (let i = 0; i < 10; i++) k.tik();
  k.b.cizimGuncelle(0);
  const [j, p] = k.jestCagrilari[k.jestCagrilari.length - 1]!;
  assert.deepEqual([j, Number(p.toFixed(6))], ["el_salliyor", 0.5]);
});
