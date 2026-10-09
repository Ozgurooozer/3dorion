// world/level/moduller/moduller.test.ts — Level modüllerinin saf geometrisi ve sözleşmesi.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULLER } from "./index.ts";
import { GOK_VARSAYILAN, gokGeometrisi } from "./gok.ts";
import { ZEMIN_VARSAYILAN, zeminGeometrisi, zeminYuksekligi, zeminRenkAdi } from "./zemin.ts";
import { BULUT_VARSAYILAN, bulutGeometrisi, bulutYerleri } from "./bulut.ts";
import { KAYA_VARSAYILAN, kayaGeometrisi } from "./kaya.ts";
import { CIM_VARSAYILAN, cimAltKume, cimHucreleri, cimOrnekleri, tutamGeometrisi, yaprakUcgeni } from "./cim.ts";
import { DEKOR_VARSAYILAN, dekorYerleri, dekorGeometrisi, silindir, kutu, kure } from "./dekor.ts";
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
test("çim yaprağı dilim başına 2 üçgen, uç tek üçgen (2·dilim − 1)", () => {
  const g = (dilim: number) => ucgenSayisi(tutamGeometrisi({ ...CIM_VARSAYILAN, yaprak: 4, dilim }));
  assert.deepEqual([g(1), g(3), g(4)], [4 * yaprakUcgeni(1), 4 * yaprakUcgeni(3), 4 * yaprakUcgeni(4)]);
});
test("çim detay seviyeleri üçgeni azaltır, her seviye rüzgâr sözleşmesine uyar (kök 0, uç 1)", () => {
  const u = [0, 1, 2].map((s) => ucgenSayisi(tutamGeometrisi(CIM_VARSAYILAN, s)));
  const sinir = [0, 1, 2].map((s) => { const y = konumY(tutamGeometrisi(CIM_VARSAYILAN, s)); return [Math.min(...y), Math.max(...y)]; });
  assert.deepEqual([u[0]! > u[1]! && u[1]! > u[2]!, sinir], [true, [[0, 1], [0, 1], [0, 1]]]);
});
test("çim yaprağı kavisli: uç kökten yatay uzakta (düz çubuk değil)", () => {
  const g = tutamGeometrisi({ ...CIM_VARSAYILAN, yaprak: 1 });
  let uzak = 0;
  for (let i = 0; i < g.konum.length; i += 3) if (g.konum[i + 1] === 1) uzak = Math.hypot(g.konum[i]!, g.konum[i + 2]!);
  assert.ok(uzak > CIM_VARSAYILAN.yatma * 0.55, String(uzak));
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
test("çim boyları çeşitli: uzun tutamlar var, ama azınlıkta", () => {
  const o = cimOrnekleri({ ...CIM_AZ, bosluk: 0, merkezYogunluk: 1 }, () => 0, () => null, adla);
  const boylar = Array.from({ length: o.adet }, (_, i) => o.matris[i * 16 + 5]!);
  const uzun = boylar.filter((b) => b > CIM_AZ.boyMax * 1.4).length / o.adet;
  assert.ok(uzun > 0.01 && uzun < 0.2, String(uzun));
});
test("çim hücreleri her tutamı tam bir kez kapsar ve hücreye düşer", () => {
  const o = cimOrnekleri(CIM_AZ, () => 0, () => null, adla), hucre = 16;
  const hs = cimHucreleri(o, hucre);
  const hepsi = hs.flatMap((h) => h.idx).sort((a, b) => a - b);
  const dogru = hs.every((h) => h.idx.every((i) => Math.floor(o.matris[i * 16 + 12]! / hucre) === h.ix && Math.floor(o.matris[i * 16 + 14]! / hucre) === h.iz));
  assert.deepEqual([hepsi.length === o.adet && hepsi.every((v, i) => v === i), dogru], [true, true]);
});
test("çim alt kümesi: her adim'inci tutam kalır, boy/konum aynı, yatay ölçek genişlik kat", () => {
  const o = cimOrnekleri(CIM_AZ, () => 0, () => null, adla), idx = Array.from({ length: 40 }, (_, i) => i);
  const k = cimAltKume(o, idx, 4, 2);
  const bakis = [k.adet, k.matris[5] === o.matris[5], k.matris[12] === o.matris[12], k.matris[0] === o.matris[0]! * 2];
  assert.deepEqual(bakis, [10, true, true, true]);
});
test("çim tohumla belirleyici", () => {
  const a = cimOrnekleri(CIM_AZ, () => 0, () => null, adla), b = cimOrnekleri(CIM_AZ, () => 0, () => null, adla);
  assert.deepEqual(Array.from(a.matris.slice(0, 64)), Array.from(b.matris.slice(0, 64)));
});

// ── dekor (Nightfall City Props.js'ten) ──
test("dekor yerleri halkanın içinde", () => {
  for (const y of dekorYerleri(DEKOR_VARSAYILAN)) {
    const r = Math.hypot(y.x, y.z);
    assert.ok(r >= DEKOR_VARSAYILAN.icYaricap - 1e-9 && r <= DEKOR_VARSAYILAN.disYaricap + 1e-9, String(r));
  }
});
test("dekor nesneleri birbirine en az `aralik` uzak", () => {
  const y = dekorYerleri(DEKOR_VARSAYILAN);
  let enAz = Infinity;
  for (let i = 0; i < y.length; i++) for (let j = i + 1; j < y.length; j++) enAz = Math.min(enAz, Math.hypot(y[i]!.x - y[j]!.x, y[i]!.z - y[j]!.z));
  assert.ok(enAz >= DEKOR_VARSAYILAN.aralik, String(enAz));
});
test("dekor tohumla belirleyici", () => {
  assert.deepEqual(dekorYerleri(DEKOR_VARSAYILAN), dekorYerleri(DEKOR_VARSAYILAN));
});
test("dekor sayısı 0 olunca geometri boş", () => {
  assert.equal(ucgenSayisi(dekorGeometrisi({ ...DEKOR_VARSAYILAN, agac: 0, bank: 0, lamba: 0 }, () => 0, renkAdla)), 0);
});
test("dekor zemine oturur: en alt köşe zemin yüksekliğinin hemen altında", () => {
  const g = dekorGeometrisi({ ...DEKOR_VARSAYILAN, agac: 1, bank: 0, lamba: 0 }, () => 3, (ad) => (ad.startsWith("#") ? [0.5, 0.5, 0.5] : renkAdla(ad)));
  const y = Math.min(...konumY(g));
  assert.ok(y < 3 && y > 2.8, String(y));
});
test("silindir: kenar başına 4 üçgen (yan 2 + iki kapak)", () => {
  assert.equal(silindir(1, 1, 0, 1, 6).length, 24);
});
test("kutu 12 üçgen", () => {
  assert.equal(kutu(0, 0, 0, 1, 1, 1).length, 12);
});
test("küre: kutuplarda tek üçgen, arada iki (dilim·(2·bant−2))", () => {
  assert.equal(kure(1, 8, 6, 0, 1, () => 0.5).length, 8 * (2 * 6 - 2));
});
test("dekor normalleri parça merkezinden dışa (ağaç tacının üst yüzleri yukarı bakar)", () => {
  const g = dekorGeometrisi({ ...DEKOR_VARSAYILAN, agac: 1, bank: 0, lamba: 0, tacBozma: 0 }, () => 0, (ad) => (ad.startsWith("#") ? [0.5, 0.5, 0.5] : renkAdla(ad)));
  const y = konumY(g), ny = normalY(g);
  const tepe = y.indexOf(Math.max(...y));
  assert.ok(ny[tepe]! > 0.5, String(ny[tepe]));
});
