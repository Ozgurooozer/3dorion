// world/level/cekirdek/arazi.test.ts — Arazi düzenleme ızgarası (seyrek veri, fırça) ve bölgesel güncelleme (spec 22 Faz 7).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { anahtar, coz, seyrekOku, seyrekYaz, ornekle, farkBolgesi, araziDamgasi, maskeDamgasi, agirlik, rampaUygula, type Seyrek } from "./arazi.ts";
import { levelKur } from "./levelKur.ts";
import { ornekTanim } from "./ornekTanim.ts";
import type { Bolge, LevelModulu } from "./modul.ts";
import { ZEMIN_VARSAYILAN, zeminYuksekligi, zeminTabanYuksekligi, zeminModulu } from "../moduller/zemin.ts";
import { CIM_VARSAYILAN, cimOrnekleri, cimAdayHucreleri } from "../moduller/cim.ts";
import { rastgele, rastgeleAtla } from "./rastgele.ts";

test("anahtar geri çözülür (eksi hücreler dahil)", () => { assert.deepEqual(coz(anahtar(-7, 12)), [-7, 12]); });
test("seyrek veri yazılıp okununca aynı", () => {
  const m: Seyrek = new Map([[anahtar(1, 2), 0.5], [anahtar(-3, 0), -1.25]]);
  assert.deepEqual([...seyrekOku(seyrekYaz(m))].sort(), [...m].sort());
});
test("yazarken sıfıra yuvarlanan hücre atılır", () => { assert.deepEqual(seyrekYaz(new Map([[anahtar(0, 0), 0.001]])), []); });
test("tek sayılı dizi hata", () => { assert.throws(() => seyrekOku([1, 2, 3]), /çift/); });
test("hücre köşesinde değer aynen, aradaki yarı yolda yarısı", () => {
  const m: Seyrek = new Map([[anahtar(1, 0), 2]]);
  assert.deepEqual([ornekle(m, 2, 2, 0), ornekle(m, 2, 1, 0)], [2, 1]);
});
test("fark yoksa bölge yok", () => { assert.equal(farkBolgesi(new Map([[5, 1]]), new Map([[5, 1]]), 2), null); });
test("fark bölgesi değişen hücreyi bir hücre payla kapsar", () => {
  assert.deepEqual(farkBolgesi(new Map(), new Map([[anahtar(3, -2), 1]]), 2), { x0: 4, z0: -6, x1: 8, z1: -2 });
});
test("ağırlık merkezde 1, kenarda 0", () => { assert.deepEqual([agirlik(0, 5, 0.3), agirlik(5, 5, 0.3)], [1, 0]); });
const F = { x: 0, z: 0, yaricap: 4, guc: 1, sertlik: 0.5 };
test("yükselt merkezi güç kadar kaldırır", () => {
  const m: Seyrek = new Map(); araziDamgasi(m, 2, F, "yukselt", () => 0);
  assert.equal(m.get(anahtar(0, 0)), 1);
});
test("düzle hedef yüksekliğe çeker (tam güçte merkez tam hedef)", () => {
  const m: Seyrek = new Map(); araziDamgasi(m, 2, F, "duzle", () => 3, { hedef: 1 });
  assert.equal(3 + m.get(anahtar(0, 0))!, 1);
});
test("sıfırla düzenlemeyi kaldırır", () => {
  const m: Seyrek = new Map([[anahtar(0, 0), 2]]); araziDamgasi(m, 2, F, "sifirla", () => 0);
  assert.equal(m.has(anahtar(0, 0)), false);
});
test("yumuşat tepeyi komşularına doğru indirir", () => {
  const m: Seyrek = new Map([[anahtar(0, 0), 4]]); araziDamgasi(m, 2, { ...F, guc: 0.5 }, "yumusat", () => 0);
  assert.ok(m.get(anahtar(0, 0))! < 4);
});
test("maske sil 1'e, boya geri 0'a götürür", () => {
  const m: Seyrek = new Map(); maskeDamgasi(m, 2, F, "sil"); const silindi = m.get(anahtar(0, 0));
  maskeDamgasi(m, 2, F, "boya");
  assert.deepEqual([silindi, m.has(anahtar(0, 0))], [1, false]);
});

// ── modüller ──
test("zemin yüksekliği taban + düzenleme farkı", () => {
  const a = { ...ZEMIN_VARSAYILAN, duzenleme: seyrekYaz(new Map([[anahtar(5, 5), 3]])) };
  assert.ok(Math.abs(zeminYuksekligi(a)(10, 10) - zeminTabanYuksekligi(a)(10, 10) - 3) < 1e-9);
});
test("çim maskesiyle silinen hücrede tutam kalmaz", () => {
  const maske: Seyrek = new Map();
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) maske.set(anahtar(i, j), 1);
  const o = cimOrnekleri({ ...CIM_VARSAYILAN, sayi: 20000, maske: seyrekYaz(maske) }, () => 0, () => null, () => [0, 1, 0]);
  let iceride = 0;
  for (let i = 0; i < o.adet; i++) if (Math.abs(o.matris[i * 16 + 12]!) < 5 && Math.abs(o.matris[i * 16 + 14]!) < 5) iceride++;
  assert.equal(iceride, 0);
});
test("aday indeksleriyle üretilen çim, bütünün o hücrelerdeki tutamlarıyla aynı (tohum sırası bozulmaz)", () => {
  const a = { ...CIM_VARSAYILAN, sayi: 20000 };
  const hepsi = cimOrnekleri(a, () => 0, () => null, () => [0, 1, 0]);
  const indeksler = [...(cimAdayHucreleri(a).get("0,0") ?? []), ...(cimAdayHucreleri(a).get("1,0") ?? [])].sort((x, y) => x - y);
  const parca = cimOrnekleri(a, () => 0, () => null, () => [0, 1, 0], indeksler);
  const h = a.hucre, icinde: number[] = [];
  for (let i = 0; i < hepsi.adet; i++) {
    const x = hepsi.matris[i * 16 + 12]!, z = hepsi.matris[i * 16 + 14]!;
    if (Math.floor(z / h) === 0 && (Math.floor(x / h) === 0 || Math.floor(x / h) === 1)) icinde.push(i);
  }
  assert.deepEqual(Array.from(parca.matris), icinde.flatMap((i) => Array.from(hepsi.matris.subarray(i * 16, i * 16 + 16))));
});
test("sıçrayan üreteç sıradakiyle aynı değeri verir", () => {
  const r = rastgele(99); for (let i = 0; i < 37; i++) r();
  assert.equal(rastgeleAtla(99, 37)(), r());
});

// ── level: yerinde güncelleme ve bölge ──
function sahteLevel() {
  const s = { zeminKur: 0, ustKur: 0, bolgeler: [] as Bolge[], bagimsizKur: 0, kayaKur: 0 };
  const zemin: LevelModulu = {
    tur: "zemin", aciklama: "", varsayilan: { veri: [] as number[], h: 1 }, zemineBagli: false,
    kur(b, a) {
      s.zeminKur++;
      let veri = (a as { veri: number[] }).veri;
      return {
        meshler: [new Mesh("z", b.sahne)], yukseklik: () => veri.length,
        ayarGuncelle(y) { if ((y as { h: number }).h !== (a as { h: number }).h) return false; veri = (y as { veri: number[] }).veri; return { x0: 0, z0: 0, x1: 1, z1: 1 }; },
        yokEt() { /* */ },
      };
    },
  };
  const ust: LevelModulu = { tur: "ust", aciklama: "", varsayilan: { d: 1 }, kur(b) { s.ustKur++; return { meshler: [new Mesh("u", b.sahne)], bolgeYenile: (x) => { s.bolgeler.push(x); }, yokEt() { /* */ } }; } };
  const kaya: LevelModulu = { tur: "kaya", aciklama: "", varsayilan: { d: 1 }, kur(b) { s.kayaKur++; return { meshler: [new Mesh("k", b.sahne)], yokEt() { /* */ } }; } };
  const bagimsiz: LevelModulu = { tur: "su", aciklama: "", varsayilan: { d: 1 }, zemineBagli: false, kur(b) { s.bagimsizKur++; return { meshler: [new Mesh("s", b.sahne)], yokEt() { /* */ } }; } };
  const t = { ...ornekTanim(), katmanlar: [
    { tur: "zemin", ad: "zemin", acik: true, ayar: {} }, { tur: "kaya", ad: "kaya", acik: true, ayar: {} },
    { tur: "ust", ad: "ust", acik: true, ayar: {} }, { tur: "su", ad: "su", acik: true, ayar: {} },
  ] };
  const level = levelKur(new Scene(new NullEngine()), t, new Map([["zemin", zemin], ["ust", ust], ["kaya", kaya], ["su", bagimsiz]]));
  const zeminAyari = (ayar: Record<string, unknown>) => { const x = level.tanim(); x.katmanlar[0]!.ayar = { ...x.katmanlar[0]!.ayar, ...ayar }; level.ayarla(x); };
  return { s, level, zeminAyari };
}
test("yalnız arazi verisi değişince zemin yeniden KURULMAZ (yerinde güncellenir)", () => {
  const { s, zeminAyari } = sahteLevel(); zeminAyari({ veri: [1, 2] });
  assert.equal(s.zeminKur, 1);
});
test("zemin bölgesi değişince bağlı katman bölgeyi yeniler, yeniden kurulmaz", () => {
  const { s, zeminAyari } = sahteLevel(); zeminAyari({ veri: [1, 2] });
  assert.deepEqual([s.ustKur, s.bolgeler.length], [1, 1]);
});
test("bölge yenileyemeyen bağlı katman (kaya) yeniden kurulur", () => {
  const { s, zeminAyari } = sahteLevel(); zeminAyari({ veri: [1, 2] });
  assert.equal(s.kayaKur, 2);
});
test("zemine bağlı olmayan katman (su) zemin değişince kurulmaz", () => {
  const { s, zeminAyari } = sahteLevel(); zeminAyari({ h: 2 });
  assert.equal(s.bagimsizKur, 1);
});
test("kaya değişince sonraki çim gibi katman yeniden kurulmaz (zemin sağlamayan değişti)", () => {
  const { s, level } = sahteLevel();
  const x = level.tanim(); x.katmanlar[1]!.ayar = { d: 2 }; level.ayarla(x);
  assert.equal(s.ustKur, 1);
});
test("zemin başka ayarla değişince bağlılar yine yeniden kurulur", () => {
  const { s, zeminAyari } = sahteLevel(); zeminAyari({ h: 2 });
  assert.deepEqual([s.zeminKur, s.ustKur], [2, 2]);
});

test("gerçek zemin: arazi verisi değişince mesh köşesi yerinde yükselir, mesh aynı kalır", () => {
  const t0 = ornekTanim();
  const t = { ...t0, palet: { ...t0.palet, cimKoyu: "#204010", cimOrta: "#306020", cimAcik: "#408030", cimUc: "#50a040", toprak: "#604020" },
    katmanlar: [{ tur: "zemin", ad: "zemin", acik: true, ayar: { yaricap: 20, bolum: 10, golDerinlik: 0 } }] };
  const sahne = new Scene(new NullEngine());
  const level = levelKur(sahne, t, new Map([["zemin", zeminModulu as unknown as LevelModulu]]));
  const m = sahne.getMeshByName("zemin")!;
  const x = level.tanim();
  x.katmanlar[0]!.ayar = { ...x.katmanlar[0]!.ayar, duzenleme: seyrekYaz(new Map([[anahtar(0, 0), 5]])) };
  const once = level.yukseklik(0, 0);
  level.ayarla(x);
  const p = m.getVerticesData("position")!;
  let enYuksek = -Infinity;
  for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i]!) < 1e-6 && Math.abs(p[i + 2]!) < 1e-6) enYuksek = Math.max(enYuksek, p[i + 1]!);
  assert.deepEqual([sahne.getMeshByName("zemin") === m, Math.abs(enYuksek - (once + 5)) < 1e-4], [true, true]);
});

// ── Unreal karşılıkları: düşüş, düzle kipleri, eğim, erozyon, pürüz, rampa ──
test("küre düşüşü yumuşaktan dolgun, uç düşüşü yumuşaktan zayıf (yarı yolda)", () => {
  const y = agirlik(2.5, 5, 0, "yumusak"), k = agirlik(2.5, 5, 0, "kure"), u = agirlik(2.5, 5, 0, "uc");
  assert.ok(k > y && u < y, `küre ${k} yumuşak ${y} uç ${u}`);
});
test("doğrusal düşüş yarı yolda 0,5", () => { assert.equal(agirlik(2.5, 5, 0, "dogrusal"), 0.5); });
test("düzle 'yalnız doldur' hedefin üstünü kesmez", () => {
  const m: Seyrek = new Map(); araziDamgasi(m, 2, F, "duzle", () => 3, { hedef: 1, duzleKip: "yukselt" });
  assert.equal(m.size, 0);
});
test("eğime göre düzle hedefi başlangıçtaki eğim düzlemi", () => {
  // Düzlem: x yönünde %50 eğim (normal ∝ (-0.5, 1, 0)), başlangıç (0, 0, 0); x=2'de hedef 1.
  const n = Math.hypot(0.5, 1);
  const m: Seyrek = new Map(); araziDamgasi(m, 2, { ...F, yaricap: 6, sertlik: 0.9 }, "duzle", () => 0, { egim: { x: 0, z: 0, y: 0, nx: -0.5 / n, ny: 1 / n, nz: 0 } });
  assert.ok(Math.abs(m.get(anahtar(1, 0))! - 1) < 1e-9, String(m.get(anahtar(1, 0))));
});
test("aşındır malzemeyi korur (toplam fark değişmez)", () => {
  const m: Seyrek = new Map([[anahtar(0, 0), 6]]);
  araziDamgasi(m, 2, { ...F, yaricap: 6 }, "asindir", () => 0, { talus: 30, yineleme: 6 });
  const toplam = [...m.values()].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(toplam - 6) < 0.05, String(toplam));
});
test("aşındır sivri tepeyi alçaltır", () => {
  const m: Seyrek = new Map([[anahtar(0, 0), 6]]);
  araziDamgasi(m, 2, { ...F, yaricap: 6 }, "asindir", () => 0, { talus: 30, yineleme: 6 });
  assert.ok(m.get(anahtar(0, 0))! < 6);
});
test("pürüz güçten büyük sapma üretmez", () => {
  const m: Seyrek = new Map(); araziDamgasi(m, 2, { ...F, yaricap: 8, guc: 0.4 }, "puruz", () => 0, { puruzOlcek: 3, tohum: 5 });
  assert.ok([...m.values()].every((v) => Math.abs(v) <= 0.4 + 1e-9));
});
test("rampa ortasında yükseklik iki ucun ortalaması", () => {
  const m: Seyrek = new Map(); rampaUygula(m, 2, { x: 0, z: 0, y: 0 }, { x: 20, z: 0, y: 4 }, 3, 0.5, "yumusak", () => 0);
  assert.ok(Math.abs(m.get(anahtar(5, 0))! - 2) < 1e-9);
});
test("rampa uçlardan öteye taşmaz", () => {
  const m: Seyrek = new Map(); rampaUygula(m, 2, { x: 0, z: 0, y: 0 }, { x: 20, z: 0, y: 4 }, 3, 0.5, "yumusak", () => 0);
  assert.equal(m.has(anahtar(12, 0)), false);
});
