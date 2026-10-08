// world/level/cekirdek/levelKur.test.ts — Level yöneticisi: kurma, canlı düzenleme, yalnız değişeni yeniden kurma.
//
// Ekransız Babylon (NullEngine) + sahte modüller: modülün kaç kez kurulup yıkıldığı sayılır.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { levelKur } from "./levelKur.ts";
import type { LevelModulu } from "./modul.ts";
import type { LevelTanimi } from "./levelTanimi.ts";
import { ornekTanim } from "./ornekTanim.ts";

function kur(katmanlar: LevelTanimi["katmanlar"], golge = false) {
  const sayac: Record<string, { kur: number; yik: number }> = {};
  const modul = (tur: string, ek: Partial<LevelModulu> = {}): LevelModulu => ({
    tur, aciklama: tur, varsayilan: { deger: 1, renk: "mavi" },
    kur(b) {
      const s = (sayac[tur] ??= { kur: 0, yik: 0 });
      s.kur++;
      const m = new Mesh(tur, b.sahne);
      b.golge(m, { atar: true, alir: true });
      return { meshler: [m], yokEt() { s.yik++; m.dispose(); } };
    },
    ...ek,
  });
  const zemin = modul("zemin", {
    kur(b) {
      const s = (sayac["zemin"] ??= { kur: 0, yik: 0 }); s.kur++;
      const m = new Mesh("zemin", b.sahne);
      return { meshler: [m], yukseklik: () => 5, yokEt() { s.yik++; m.dispose(); } };
    },
  });
  let gorulenYukseklik = NaN;
  const ust = modul("ust", {
    kur(b) {
      const s = (sayac["ust"] ??= { kur: 0, yik: 0 }); s.kur++;
      gorulenYukseklik = b.yukseklik(0, 0);
      const m = new Mesh("ust", b.sahne);
      return { meshler: [m], yokEt() { s.yik++; m.dispose(); } };
    },
  });
  const kayit = new Map<string, LevelModulu>([["a", modul("a")], ["zemin", zemin], ["ust", ust]]);
  const t = ornekTanim();
  t.katmanlar = katmanlar;
  t.isik.gunes.golge.acik = golge;
  const sahne = new Scene(new NullEngine());
  const level = levelKur(sahne, t, kayit);
  return { level, sayac, sahne, yukseklikGordu: () => gorulenYukseklik };
}
const katman = (tur: string, ad = tur, ayar: Record<string, unknown> = {}) => ({ tur, ad, acik: true, ayar });

test("her açık katman bir kez kurulur", () => {
  const { sayac } = kur([katman("a"), katman("zemin")]);
  assert.deepEqual([sayac["a"]?.kur, sayac["zemin"]?.kur], [1, 1]);
});

test("tanım, katman ayarlarını varsayılanla tamamlanmış verir (panel bütün alanları görsün)", () => {
  const { level } = kur([katman("a")]);
  assert.deepEqual(level.tanim().katmanlar[0]?.ayar, { deger: 1, renk: "mavi" });
});

test("yalnız değişen katman yeniden kurulur", () => {
  const { level, sayac } = kur([katman("zemin"), katman("a")]);
  const t = level.tanim(); t.katmanlar[1]!.ayar["deger"] = 2;
  level.ayarla(t);
  assert.deepEqual([sayac["zemin"]?.kur, sayac["a"]?.kur], [1, 2]);
});

test("katman sırası = bağımlılık: önceki değişince sonrakiler de yeniden kurulur", () => {
  const { level, sayac } = kur([katman("zemin"), katman("ust")]);
  const t = level.tanim(); t.katmanlar[0]!.ayar["deger"] = 2;
  level.ayarla(t);
  assert.equal(sayac["ust"]?.kur, 2);
});

test("sonraki katman önceki zeminin yüksekliğini görür", () => {
  assert.equal(kur([katman("zemin"), katman("ust")]).yukseklikGordu(), 5);
});

test("ışık değişince hiçbir katman yeniden kurulmaz", () => {
  const { level, sayac } = kur([katman("a")]);
  const t = level.tanim(); t.isik.gunes.siddet = 3;
  level.ayarla(t);
  assert.equal(sayac["a"]?.kur, 1);
});

test("palet değişince bütün katmanlar yeniden kurulur", () => {
  const { level, sayac } = kur([katman("zemin"), katman("a")]);
  const t = level.tanim(); t.palet["mavi"] = "#000000";
  level.ayarla(t);
  assert.deepEqual([sayac["zemin"]?.kur, sayac["a"]?.kur], [2, 2]);
});

test("kapatılan katman yıkılır", () => {
  const { level, sayac } = kur([katman("a")]);
  const t = level.tanim(); t.katmanlar[0]!.acik = false;
  level.ayarla(t);
  assert.deepEqual([sayac["a"]?.yik, level.sayim().katman], [1, 0]);
});

test("geçersiz düzenleme reddedilir ve level önceki hâlinde kalır", () => {
  const { level } = kur([katman("a")]);
  const t = level.tanim(); t.katmanlar[0]!.ayar["olmayan"] = 1;
  assert.throws(() => level.ayarla(t), /bilinmeyen ayar/);
  assert.equal(level.tanim().katmanlar[0]?.ayar["olmayan"], undefined);
});

test("bilinmeyen modül türü kurulumda hata verir", () => {
  assert.throws(() => kur([katman("yok")]), /bilinmeyen modül/);
});

// Not: CascadedShadowGenerator ekransız motorda (Node, NullEngine) kurulamıyor (Babylon içinden
// "super constructor" hatası); gölge üreteci tarayıcıda, ekran görüntüsüyle doğrulanır. Burada gölge
// KAYDININ kendisi: gölge alan mesh `receiveShadows` olur.
test("gölge alan mesh receiveShadows olur", () => {
  const { sahne } = kur([katman("a")]);
  assert.equal(sahne.getMeshByName("a")?.receiveShadows, true);
});

test("yokEt bütün katmanları yıkar", () => {
  const { level, sayac } = kur([katman("a"), katman("zemin")]);
  level.yokEt();
  assert.deepEqual([sayac["a"]?.yik, sayac["zemin"]?.yik], [1, 1]);
});
