// world/level/ufuk/ufuk.test.ts — Gece ufuk katmanı (ışık dili adım 2, ön kayıt docs/olcum/on-kayit-isik-dili-2.md K1):
// şehir deterministik ve kubbenin içinde, gece/gündüz görünürlüğü, renk sınıfları, `?ufuk=0`. Işık ayrımı (lambalar ofisi
// aydınlatmaz) birleşik dünyanın testinde: `world/yer/birlesikDunya.test.ts`.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import {
  GECE_ESIGI, HALKALAR, LAMBA, SEHIR, geceAgirligi, sehirGeometrisi, sinifRenkleri, sinifNo, ufukAcikMi, ufukBinalari, ufukTanimi,
} from "./ufukSehri.ts";
import { PALET_HARITASI_VARSAYILAN } from "../shader/moduller/paletHaritasi.ts";
import { ornekTanim } from "../cekirdek/ornekTanim.ts";
import type { LevelTanimi } from "../cekirdek/levelTanimi.ts";
import { ufukKur } from "./ufuk.ts";
import { dunyaDurumuYap, durumuSaateGoreYaz, paletZamanda } from "../shader/dunyaDurumu.ts";
import { dunyaPaleti } from "../shader/paletler.ts";
import { gokGeometrisi, GOK_VARSAYILAN } from "../moduller/gok.ts";
import type { Renk } from "../cekirdek/renk.ts";

/** Saatin dünya durumu (ova paleti, güneş yörüngesi eğimi 35°: ova.level.json). */
function saatte(saat: number) {
  const d = dunyaDurumuYap();
  durumuSaateGoreYaz(d, saat, 35);
  d.palet = paletZamanda(dunyaPaleti(0).kareler, saat);
  return d;
}

test("şehir deterministik: aynı tohum aynı bina listesi ve aynı geometri", () => {
  const a = ufukBinalari(1453), b = ufukBinalari(1453);
  assert.deepEqual(a, b);
  assert.deepEqual(sehirGeometrisi(a), sehirGeometrisi(b));
});

test("şehir: farklı tohum farklı bina listesi", () => {
  assert.notDeepEqual(ufukBinalari(1453), ufukBinalari(1454));
});

test("şehir boş değil: her halkada bina var, pencere yüzlerce", () => {
  const binalar = ufukBinalari();
  for (let h = 0; h < HALKALAR.length; h++) assert.ok(binalar.filter((b) => b.halka === h).length >= 30, `halka ${h}`);
  assert.ok(sehirGeometrisi(binalar).pencere >= 500);
});

test("şehrin bütün köşeleri gök kubbesinin İÇİNDE (kubbenin en yakın yüz düzleminden yakın): kubbe binayı kesmez", () => {
  const kubbe = gokGeometrisi(GOK_VARSAYILAN, [0, 0, 0], [0, 0, 0], [0, 0, 0]);
  let enYakin = Infinity;
  for (let i = 0; i < kubbe.konum.length; i += 9) {
    const n = [kubbe.normal[i]!, kubbe.normal[i + 1]!, kubbe.normal[i + 2]!];
    enYakin = Math.min(enYakin, Math.abs(kubbe.konum[i]! * n[0]! + kubbe.konum[i + 1]! * n[1]! + kubbe.konum[i + 2]! * n[2]!));
  }
  const g = sehirGeometrisi(ufukBinalari());
  let enUzak = 0;
  for (let i = 0; i < g.konum.length; i += 3) enUzak = Math.max(enUzak, Math.hypot(g.konum[i]!, g.konum[i + 1]!, g.konum[i + 2]!));
  assert.ok(enUzak < enYakin, `şehir ${enUzak.toFixed(1)} m ≥ kubbe ${enYakin.toFixed(1)} m`);
});

test("şehir uzak arazinin tepe halkasının (≤ 430 m) ARKASINDA ve tabanı göz hizasının altında", () => {
  const g = sehirGeometrisi(ufukBinalari());
  let enYakin = Infinity, enAlt = Infinity;
  for (let i = 0; i < g.konum.length; i += 3) {
    enYakin = Math.min(enYakin, Math.hypot(g.konum[i]!, g.konum[i + 2]!));
    enAlt = Math.min(enAlt, g.konum[i + 1]!);
  }
  assert.ok(enYakin > 430, `en yakın köşe ${enYakin.toFixed(1)} m`);
  assert.equal(enAlt, SEHIR.taban);
});

test("gece ağırlığı: saat 22 → 1, saat 12 → 0", () => {
  assert.equal(geceAgirligi(saatte(22), true), 1);
  assert.equal(geceAgirligi(saatte(12), true), 0);
});

test("gece ağırlığı: ova'nın kayıtlı saati 5,25 (şafak öncesi) → yanık (> 0,5)", () => {
  assert.ok(geceAgirligi(saatte(5.25), true) > 0.5);
});

test("gece ağırlığı: zamanı olmayan level'da 0 (gündüz sayılır)", () => {
  assert.equal(geceAgirligi(saatte(22), false), 0);
});

test("renk sınıfları: gece ağırlığı 0'da her şey sis rengine solar", () => {
  const sis: Renk = [0.3, 0.35, 0.5];
  for (const r of sinifRenkleri(saatte(22).palet, sis, 0)) assert.deepEqual(r, sis);
});

test("renk sınıfları: saat 22'de pencere SICAK (R > B), duvar SOĞUK (B > R)", () => {
  const sis: Renk = [0.17, 0.17, 0.35];
  const t = sinifRenkleri(saatte(22).palet, sis, 1);
  for (let h = 0; h < HALKALAR.length; h++) {
    const duvar = t[sinifNo(h, 0)]!, pencere = t[sinifNo(h, 1)]!;
    assert.ok(duvar[2] > duvar[0], `halka ${h} duvar ${duvar}`);
    assert.ok(pencere[0] > pencere[2], `halka ${h} pencere ${pencere}`);
  }
});

test("?ufuk=0 kapatır; yokluğu ve başka değerler açık", () => {
  assert.equal(ufukAcikMi("?ufuk=0"), false);
  assert.equal(ufukAcikMi("?poz=2.6,12,0&ufuk=0"), false);
  assert.equal(ufukAcikMi(""), true);
  assert.equal(ufukAcikMi("?ufuk=1"), true);
});

// ── Palet haritası sıcak koruması (ön kayıt "sapma 3") ──

const paletli = (ayar: Record<string, unknown>): LevelTanimi => ({ ...ornekTanim(), shaderlar: [{ tur: "paletHaritasi", acik: true, ayar }] });
const sicak = (t: LevelTanimi) => t.shaderlar!.find((s) => s.tur === "paletHaritasi")!.ayar["sicakKoru"];

test("palet haritası: sıcak koruma varsayılanı KAPALI (başka level'ların görünüşü değişmez)", () => {
  assert.equal(PALET_HARITASI_VARSAYILAN.sicakKoru, 0);
});

test("ufukTanimi: palet haritasında alan yoksa sicakKoru = 1", () => {
  assert.equal(sicak(ufukTanimi(paletli({ gece: 0.75 }))), 1);
});

test("ufukTanimi: Ozyn'in elle koyduğu değere dokunmaz", () => {
  assert.equal(sicak(ufukTanimi(paletli({ sicakKoru: 0.3 }))), 0.3);
});

test("ufukTanimi: girdiyi değiştirmez ve eşgüçlü", () => {
  const t = paletli({ gece: 0.75 });
  const kopya = structuredClone(t);
  const bir = ufukTanimi(t);
  assert.deepEqual(t, kopya);
  assert.deepEqual(ufukTanimi(bir), bir);
});

// ── Babylon (ekransız) ──

function kur() {
  const sahne = new Scene(new NullEngine());
  return { sahne, ufuk: ufukKur({ sahne }) };
}
const SIS: Renk = [0.2, 0.2, 0.4];

test("gündüz (gece ağırlığı 0): şehir, direk, başlık ve lamba ışıkları KAPALI", () => {
  const { ufuk } = kur();
  ufuk.guncelle(saatte(12), true, SIS);
  assert.ok(ufuk.meshler.every((m) => !m.isEnabled()));
  assert.ok(ufuk.isiklar.every((l) => !l.isEnabled()));
});

test("gece (saat 22): hepsi AÇIK, lamba şiddeti tam", () => {
  const { ufuk } = kur();
  ufuk.guncelle(saatte(22), true, SIS);
  assert.ok(ufuk.meshler.every((m) => m.isEnabled()));
  assert.ok(ufuk.isiklar.every((l) => l.isEnabled() && l.intensity === LAMBA.siddet));
});

test("geceden gündüze dönünce yeniden kapanır (eşik altı)", () => {
  const { ufuk } = kur();
  ufuk.guncelle(saatte(22), true, SIS);
  ufuk.guncelle({ gece: GECE_ESIGI / 2, alacakaranlik: 0, palet: {} }, true, SIS);
  assert.ok(ufuk.isiklar.every((l) => !l.isEnabled()));
});

test("lamba ışığı kısa menzilli, sıcak: menzil ve renk sabitten", () => {
  const { ufuk } = kur();
  assert.equal(ufuk.isiklar.length, 2);
  for (const l of ufuk.isiklar) {
    assert.equal(l.range, LAMBA.menzil);
    assert.ok(l.diffuse.r > l.diffuse.b);
  }
});

test("şehir stil çizgisinin dışında (cizgisiz) ve kameraya yapışık", () => {
  const { ufuk } = kur();
  const sehir = ufuk.meshler.find((m) => m.name === "ufuk_sehir")!;
  assert.equal((sehir.metadata as { cizgisiz?: boolean }).cizgisiz, true);
  assert.equal(sehir.infiniteDistance, true);
});
