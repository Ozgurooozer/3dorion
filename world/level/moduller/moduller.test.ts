// world/level/moduller/moduller.test.ts — Level modüllerinin saf geometrisi ve sözleşmesi.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULLER } from "./index.ts";
import { GOK_VARSAYILAN, gokGeometrisi } from "./gok.ts";
import { ZEMIN_VARSAYILAN, zeminGeometrisi, zeminYuksekligi, zeminRenkAdi } from "./zemin.ts";
import { BULUT_VARSAYILAN, bulutGeometrisi, bulutYerleri } from "./bulut.ts";
import { KAYA_VARSAYILAN, kayaGeometrisi } from "./kaya.ts";
import { CIM_VARSAYILAN, cimOrnekleri, tutamGeometrisi } from "./cim.ts";
import { ayarBirlestir } from "../cekirdek/modul.ts";
import { ucgenSayisi, type Geometri } from "../cekirdek/geometri.ts";
import type { Renk } from "../cekirdek/renk.ts";

const MAVI: Renk = [0.2, 0.3, 0.9], ACIK: Renk = [0.8, 0.9, 1], BEYAZ: Renk = [1, 1, 1], GRI: Renk = [0.5, 0.5, 0.5];
const renkAdla = (ad: string): Renk => [ad.length / 20, 0.5, 0.5];
const normalY = (g: Geometri) => Array.from({ length: g.normal.length / 3 }, (_, i) => g.normal[i * 3 + 1]!);
const konumY = (g: Geometri) => Array.from({ length: g.konum.length / 3 }, (_, i) => g.konum[i * 3 + 1]!);

test("her modülün varsayılanı kendi şemasından geçer", () => {
  for (const m of MODULLER.values()) assert.doesNotThrow(() => ayarBirlestir(m.tur, m.varsayilan, m.varsayilan), m.tur);
});

test("modül aralıkları yalnız o modülün SAYI ayarlarını gösterir ve varsayılanı içerir", () => {
  for (const m of MODULLER.values()) {
    for (const [k, a] of Object.entries(m.aralik ?? {})) {
      const v = m.varsayilan[k];
      const sayilar = Array.isArray(v) ? v : [v];
      assert.ok(sayilar.every((x) => typeof x === "number"), `${m.tur}.${k} sayı değil`);
      assert.ok(a && sayilar.every((x) => (x as number) >= a.min && (x as number) <= a.max), `${m.tur}.${k} aralık dışı`);
    }
  }
});

test("kayıttaki ad modülün türüyle aynı", () => {
  for (const [ad, m] of MODULLER) assert.equal(ad, m.tur);
});

// ── gök ──
test("gök normalleri içe bakar", () => {
  const g = gokGeometrisi({ ...GOK_VARSAYILAN, dilim: 8, bant: 4, yaricap: 100 }, ACIK, MAVI, MAVI);
  for (let i = 0; i < g.normal.length; i += 9) assert.ok(g.normal[i]! * g.konum[i]! + g.normal[i + 1]! * g.konum[i + 1]! + g.normal[i + 2]! * g.konum[i + 2]! < 0);
});
test("gök ufkun altından başlar", () => {
  assert.ok(Math.min(...konumY(gokGeometrisi(GOK_VARSAYILAN, ACIK, MAVI, MAVI))) < 0);
});
test("gök: tepe bandı zenit rengine, alt bant ufuk rengine yakın", () => {
  const g = gokGeometrisi(GOK_VARSAYILAN, ACIK, GRI, MAVI);
  const y = konumY(g), ust = y.indexOf(Math.max(...y)), alt = y.indexOf(Math.min(...y));
  assert.ok(g.renk[ust * 4 + 2]! - g.renk[ust * 4]! > g.renk[alt * 4 + 2]! - g.renk[alt * 4]!);
});

// ── zemin ──
test("zemin üçgen sayısı 2·bölüm²", () => {
  assert.equal(ucgenSayisi(zeminGeometrisi({ ...ZEMIN_VARSAYILAN, bolum: 6, yaricap: 10 }, renkAdla)), 72);
});
test("zemin normalleri yukarı", () => {
  assert.ok(normalY(zeminGeometrisi({ ...ZEMIN_VARSAYILAN, bolum: 12, yaricap: 50 }, renkAdla)).every((y) => y > 0));
});
test("zemin renk adı daima tanımdaki renklerden", () => {
  for (let i = 0; i < 100; i++) assert.ok(ZEMIN_VARSAYILAN.renkler.includes(zeminRenkAdi(ZEMIN_VARSAYILAN, i * 3.1, -i * 1.7)));
});
test("zemin yüksekliği tepe sınırını aşmaz ve merkez sakindir", () => {
  const y = zeminYuksekligi(ZEMIN_VARSAYILAN);
  for (let i = 0; i < 200; i++) assert.ok(Math.abs(y(i * 13 - 300, 250 - i * 9)) <= ZEMIN_VARSAYILAN.tepeYukseklik);
  assert.ok(Math.abs(y(1, 1)) * 4 <= ZEMIN_VARSAYILAN.tepeYukseklik);
});

// ── bulut ──
test("bulutlar tohumla belirleyici", () => {
  const a = bulutGeometrisi(BULUT_VARSAYILAN, BEYAZ, GRI), b = bulutGeometrisi(BULUT_VARSAYILAN, BEYAZ, GRI);
  assert.deepEqual(Array.from(a.konum.slice(0, 30)), Array.from(b.konum.slice(0, 30)));
});
test("bulut yerleri gök kubbesinin içinde", () => {
  for (const y of bulutYerleri({ ...BULUT_VARSAYILAN, sayi: 40 })) assert.ok(Math.hypot(y.x, y.y, y.z) + y.olcek * 2 < GOK_VARSAYILAN.yaricap);
});
test("bulutun alt yüzleri üstünden koyu (pişmiş gölge)", () => {
  const g = bulutGeometrisi({ ...BULUT_VARSAYILAN, sayi: 1 }, BEYAZ, GRI);
  let ust = 0, alt = 0, nu = 0, na = 0;
  for (let i = 0; i < g.normal.length / 3; i++) {
    const ny = g.normal[i * 3 + 1]!, r = g.renk[i * 4]!;
    if (ny > 0.5) { ust += r; nu++; } else if (ny < -0.5) { alt += r; na++; }
  }
  assert.ok(ust / nu > alt / na);
});

// ── kaya ──
test("kayalar zemine oturur: en alt köşe zeminin biraz altında, havada değil", () => {
  const zemin = () => 1.5;
  const g = kayaGeometrisi({ ...KAYA_VARSAYILAN, sayi: 5 }, zemin, GRI, GRI);
  const enAlt = Math.min(...konumY(g));
  assert.ok(enAlt < 1.5 && enAlt > 1.5 - KAYA_VARSAYILAN.boyMax * 0.2, String(enAlt));
});
test("kaya sayısı 0 olunca geometri boş", () => {
  assert.equal(ucgenSayisi(kayaGeometrisi({ ...KAYA_VARSAYILAN, sayi: 0 }, () => 0, GRI, GRI)), 0);
});

// ── çim ──
const CIM_AZ = { ...CIM_VARSAYILAN, sayi: 2000 };
const yerY = (o: { matris: Float32Array }, i: number) => o.matris[i * 16 + 13]!;
const yerXZ = (o: { matris: Float32Array }, i: number) => Math.hypot(o.matris[i * 16 + 12]!, o.matris[i * 16 + 14]!);
const ADLI: Record<string, Renk> = { cimOrta: [0, 0.5, 0], cimUc: [1, 1, 0] };
const adla = (ad: string): Renk => ADLI[ad]!;

test("çim tutamı rüzgâr sözleşmesine uyar: kök y = 0, uç y = 1", () => {
  const y = konumY(tutamGeometrisi(CIM_VARSAYILAN));
  assert.deepEqual([Math.min(...y), Math.max(...y)], [0, 1]);
});
test("çim tutamı yaprak başına 3 üçgen", () => {
  assert.equal(ucgenSayisi(tutamGeometrisi({ ...CIM_VARSAYILAN, yaprak: 4 })), 12);
});
test("çim normalleri yukarı (zeminle aynı ışık)", () => {
  assert.ok(normalY(tutamGeometrisi(CIM_VARSAYILAN)).every((y) => y === 1));
});
test("çim kökü zemine oturur (örneğin y'si zemin yüksekliği)", () => {
  const o = cimOrnekleri(CIM_AZ, (x, z) => 0.01 * x + 0.02 * z, () => null, adla);
  for (let i = 0; i < o.adet; i++) {
    const x = o.matris[i * 16 + 12]!, z = o.matris[i * 16 + 14]!;
    assert.ok(Math.abs(yerY(o, i) - (0.01 * x + 0.02 * z)) < 1e-4);
  }
});
test("çim alanın içinde", () => {
  const o = cimOrnekleri(CIM_AZ, () => 0, () => null, adla);
  for (let i = 0; i < o.adet; i++) assert.ok(yerXZ(o, i) <= CIM_AZ.yaricap + 1e-3);
});
test("çim açıklığı: bosluk büyüdükçe daha az tutam (açıklıklar açılır)", () => {
  const hep = cimOrnekleri({ ...CIM_AZ, bosluk: 0 }, () => 0, () => null, adla).adet;
  const az = cimOrnekleri({ ...CIM_AZ, bosluk: 0.5 }, () => 0, () => null, adla).adet;
  assert.ok(az < hep * 0.75, `${hep} ${az}`);
});
test("çim merkeze yığılır: merkezYogunluk büyüdükçe iç yarıdaki pay artar", () => {
  const ic = (k: number) => {
    const o = cimOrnekleri({ ...CIM_AZ, bosluk: 0, merkezYogunluk: k }, () => 0, () => null, adla);
    let n = 0;
    for (let i = 0; i < o.adet; i++) if (yerXZ(o, i) < CIM_AZ.yaricap / 2) n++;
    return n / o.adet;
  };
  assert.ok(ic(2.5) > ic(1) + 0.15, `${ic(1)} ${ic(2.5)}`);
});
test("çim rengi altındaki zeminden (uç karışımı 0 ve oynama 0 iken tam zemin rengi)", () => {
  const o = cimOrnekleri({ ...CIM_AZ, ucKarisim: 0, renkOynama: 0 }, () => 0, () => [0.2, 0.4, 0.1], adla);
  assert.deepEqual(Array.from(o.renk.slice(0, 3)).map((v) => +v.toFixed(4)), [0.2, 0.4, 0.1]);
});
test("çim tohumla belirleyici", () => {
  const a = cimOrnekleri(CIM_AZ, () => 0, () => null, adla), b = cimOrnekleri(CIM_AZ, () => 0, () => null, adla);
  assert.deepEqual(Array.from(a.matris.slice(0, 64)), Array.from(b.matris.slice(0, 64)));
});
