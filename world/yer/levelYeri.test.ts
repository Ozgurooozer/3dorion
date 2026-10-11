// world/yer/levelYeri.test.ts — Level → Yer (spec 24 C2): geçidin kapısı, engeller, sınır, nesneler; ve GERÇEK
// ova'nın bekçisi (ofis kapısının önü yürünebilir, Orion kapıdan ovaya ve geri yol bulur).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { levelYeri, gecitYonu, gecitCapasi, gecitVarisi, kapiKutusu, levelSiniri, KAPI_DURAGI, VARIS_UZAKLIGI, type KutuMinMax } from "./levelYeri.ts";
import { ornekTanim } from "../level/cekirdek/ornekTanim.ts";
import { levelTanimiDogrula, type Gecit, type LevelTanimi, type NesneYeri } from "../level/cekirdek/levelTanimi.ts";
import { etkinAnlam, anlamSozluguOku } from "../level/cekirdek/anlam.ts";
import { carpisiyorMu, OYUNCU_YARICAP } from "../level/olculer.ts";
import { AVATAR_YARICAP, yolBul } from "../avatar/yolBulma.ts";
import { capaBul } from "../level/capalar.ts";
import { katalogOku } from "../level/cekirdek/katalog.ts";

const duz = () => 0;
const yakin = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const GUNEYE: Gecit = { ad: "ofis", konum: [2, 10], yon: 180, hedef: "oda", etiket: "ofis kapısı" };
const anlam = (n: NesneYeri) => etkinAnlam(n, undefined, null, (a) => a.toLowerCase());
const kutu = (min: number[], max: number[]): KutuMinMax => ({ min, max });

// ── geçidin geometrisi ──
test("yön 180° kapıdan dışarı -Z", () => { const d = gecitYonu(GUNEYE); assert.ok(yakin(d.x, 0) && yakin(d.z, -1), JSON.stringify(d)); });
test("yön 90° kapıdan dışarı +X", () => { const d = gecitYonu({ ...GUNEYE, yon: 90 }); assert.ok(yakin(d.x, 1) && yakin(d.z, 0), JSON.stringify(d)); });
test("çapanın durağı kapının DIŞINDA, 1,1 m önünde", () => {
  const c = gecitCapasi(GUNEYE, duz);
  assert.deepEqual([c.durak.x, +c.durak.z.toFixed(9)], [2, 10 - KAPI_DURAGI]);
});
test("çapanın yüzü kapıya dönük (dışarının tersi)", () => { const c = gecitCapasi(GUNEYE, duz); assert.ok(yakin(c.yon.z, 1), JSON.stringify(c.yon)); });
test("çapanın adı protokoldeki kapi, etiketi geçidin etiketi", () => {
  const c = gecitCapasi(GUNEYE, duz);
  assert.deepEqual([c.ad, c.etiket], ["kapi", "ofis kapısı"]);
});
test("çapanın durağı zemine oturur", () => { assert.equal(gecitCapasi(GUNEYE, () => 1.5).durak.y, 1.5); });
test("varış kapının dışında, durağın ötesinde", () => { assert.ok(yakin(gecitVarisi(GUNEYE, duz).konum.z, 10 - VARIS_UZAKLIGI)); });
test("varışta yüz dışarı dönük (yaw = geçidin yönü)", () => { assert.ok(yakin(gecitVarisi(GUNEYE, duz).yaw, Math.PI)); });
test("kapı kutusu -Z'ye bakan kapıda X boyunca geniş, Z boyunca ince", () => {
  const k = kapiKutusu(GUNEYE, duz);
  assert.deepEqual([+k.g.toFixed(6), +k.d.toFixed(6)], [1, 0.06]);
});
test("kapı kutusu +X'e bakan kapıda Z boyunca geniş", () => {
  const k = kapiKutusu({ ...GUNEYE, yon: 90 }, duz);
  assert.deepEqual([+k.g.toFixed(6), +k.d.toFixed(6)], [0.06, 1]);
});

// ── tanım → yer ──
function tanim(ek: Partial<LevelTanimi> = {}): LevelTanimi {
  return { ...ornekTanim(), gecitler: [GUNEYE], ...ek };
}
const N = (id: string, ek: Partial<NesneYeri> = {}): NesneYeri => ({ id, varlik: "BINA", konum: [0, 0, 0], donus: 0, olcek: 1, ...ek });
const BINA = kutu([-2, 0, -2], [2, 4, 2]);
const yer = (t: LevelTanimi, k: Record<string, KutuMinMax>) =>
  levelYeri({ ad: "deneme", tanim: t, kutular: new Map(Object.entries(k)), anlamOf: anlam, yukseklik: duz });

test("görünür yerleşimin kutusu yürüme engeli", () => {
  assert.equal(yer(tanim({ nesneler: [N("b")] }), { b: BINA }).engeller.length, 1);
});
test("gizli yerleşim engel değil", () => {
  assert.equal(yer(tanim({ nesneler: [N("b", { gizli: true })] }), { b: BINA }).engeller.length, 0);
});
test("gizli gruptaki yerleşim engel değil", () => {
  const t = tanim({ nesneler: [N("b", { grup: "g" })], gruplar: [{ id: "g", ad: "grup", gizli: true }] });
  assert.equal(yer(t, { b: BINA }).engeller.length, 0);
});
test("alçak yerleşim (kaldırım) yürünür: engel değil", () => {
  assert.equal(yer(tanim({ nesneler: [N("y")] }), { y: kutu([-2, 0, -2], [2, 0.1, 2]) }).engeller.length, 0);
});
test("alçak yerleşim yine de bakış ışınını durdurur", () => {
  assert.equal(yer(tanim({ nesneler: [N("y")] }), { y: kutu([-2, 0, -2], [2, 0.1, 2]) }).katiYuzeyler.filter((k) => k.capa === null).length, 1);
});
test("kutusu ölçülmemiş yerleşim yok sayılır", () => { assert.equal(yer(tanim({ nesneler: [N("b")] }), {}).engeller.length, 0); });
test("geçidin kapısı çapalı katı yüzey", () => {
  assert.deepEqual(yer(tanim(), {}).katiYuzeyler.map((k) => k.capa), ["kapi"]);
});
test("yerin tek çapası geçidin kapısı", () => { assert.deepEqual(yer(tanim(), {}).capalar.map((c) => c.ad), ["kapi"]); });
test("nesneler: önce kapı, sonra level nesneleri", () => {
  assert.deepEqual(yer(tanim({ nesneler: [N("b")] }), { b: BINA }).nesneler.map((n) => n.id), ["kapi", "b"]);
});
test("geçitsiz level'da çapa yok", () => { assert.equal(yer(tanim({ gecitler: [] }), {}).capalar.length, 0); });
test("zeminsiz level'ın sınırı ±50 m", () => { assert.equal(levelSiniri(tanim()).maxX, 50); });
test("zemin dairesinin sınırı içine çizilen kare (kenar payıyla)", () => {
  const t = tanim({ katmanlar: [{ tur: "zemin", ad: "zemin", acik: true, ayar: { yaricap: 100 } }] });
  assert.equal(+levelSiniri(t).maxX.toFixed(3), +(100 / Math.SQRT2 - 4).toFixed(3));
});
test("göllü zeminde göl çanağı yürüme engeli", () => {
  const t = tanim({ katmanlar: [{ tur: "zemin", ad: "zemin", acik: true, ayar: { golX: -30, golZ: -32, golYaricap: 16, golDerinlik: 1 } }] });
  const gol = yer(t, {}).engeller[0]!;
  assert.deepEqual([gol.x, gol.z], [-30, -32]);
});

// ── doğrulama ──
test("geçit konumu [x, z] olmalı", () => {
  const d = levelTanimiDogrula({ ...ornekTanim(), gecitler: [{ ...GUNEYE, konum: [1, 2, 3] }] });
  assert.match(d.ok ? "" : d.hata, /gecitler\[0\]\.konum/);
});
test("bilinmeyen geçit hedefi reddedilir", () => {
  const d = levelTanimiDogrula({ ...ornekTanim(), gecitler: [{ ...GUNEYE, hedef: "mars" }] });
  assert.match(d.ok ? "" : d.hata, /gecitler\[0\]\.hedef/);
});
test("aynı hedefe iki geçit reddedilir (ikisi de kapi olurdu)", () => {
  const d = levelTanimiDogrula({ ...ornekTanim(), gecitler: [GUNEYE, { ...GUNEYE, ad: "ikinci" }] });
  assert.match(d.ok ? "" : d.hata, /aynı hedefe/);
});

// ── GERÇEK ova: kutular katalog boyutlarından (bütün yerleşimler dönüşsüz) ──
const KOK = path.resolve(import.meta.dirname, "..", "..");
const OVA: LevelTanimi = JSON.parse(fs.readFileSync(path.join(KOK, "world/level/ova/ova.level.json"), "utf8"));
const KATALOG = katalogOku(JSON.parse(fs.readFileSync(path.join(KOK, "assets/sehir/katalog.json"), "utf8")));
const SOZLUK = anlamSozluguOku(JSON.parse(fs.readFileSync(path.join(KOK, "assets/sehir/anlam.json"), "utf8")));
function ovaYeri() {
  const boyut = new Map(KATALOG.varliklar.map((v) => [v.ad, v]));
  const k = new Map<string, KutuMinMax>();
  for (const n of OVA.nesneler ?? []) {
    const v = boyut.get(n.varlik)!;
    // Ölçek: sayı = eşit, [x, y, z] = eksen başına (Ozyn editörde boru duvarını eksen başına büyüttü).
    const o = typeof n.olcek === "number" ? [n.olcek, n.olcek, n.olcek] : n.olcek;
    const [x, y, z] = n.konum, [g, h, d] = [v.boyut[0] * o[0]!, v.boyut[1] * o[1]!, v.boyut[2] * o[2]!];
    k.set(n.id!, kutu([x - g / 2, y, z - d / 2], [x + g / 2, y + h, z + d / 2]));
  }
  return levelYeri({
    ad: "ova", tanim: OVA, kutular: k, yukseklik: duz,
    anlamOf: (n) => etkinAnlam(n, boyut.get(n.varlik)?.kategori, SOZLUK, (a) => a),
  });
}

test("ova bütün yerleşimleri dönüşsüz (bu bekçinin varsayımı)", () => {
  assert.deepEqual((OVA.nesneler ?? []).filter((n) => n.donus !== 0).map((n) => n.id), []);
});
test("ova'da Orion'un ofisine açılan bir geçit var", () => { assert.equal(OVA.gecitler?.filter((g) => g.hedef === "oda").length, 1); });
test("ova'da ofis kapısının durağı yürünebilir", () => {
  const o = ovaYeri(), c = capaBul("kapi", o.capalar)!;
  assert.equal(carpisiyorMu(c.durak.x, c.durak.z, AVATAR_YARICAP, o), false);
});
test("ova'da ofisten çıkış noktası yürünebilir", () => {
  const o = ovaYeri(), v = gecitVarisi(OVA.gecitler![0]!, duz).konum;
  assert.equal(carpisiyorMu(v.x, v.z, OYUNCU_YARICAP, o), false);
});
test("ova'da çıkış noktasından ova merkezine yol var", () => {
  const o = ovaYeri(), v = gecitVarisi(OVA.gecitler![0]!, duz).konum;
  assert.notEqual(yolBul({ x: v.x, z: v.z }, { x: 0, z: 0 }, AVATAR_YARICAP, o), null);
});
test("ova'da uzak bir binanın arkasından ofis kapısına yol var", () => {
  const o = ovaYeri(), c = capaBul("kapi", o.capalar)!;
  assert.notEqual(yolBul({ x: 27.38, z: -6 }, { x: c.durak.x, z: c.durak.z }, AVATAR_YARICAP, o), null);
});
// Level'ın İÇERİĞİ (hangi bina nerede) Ozyn'in; bekçi yalnız yapıyı sınar. İlk sürüm "ofis binası var" diyordu —
// Ozyn binaları silince (2026-10-11) kırıldı; geçidin işlemesi binaya bağlı değil.
test("ova'da ofis kapısı Orion'un nesnelerinde, çapası kapi", () => {
  assert.equal(ovaYeri().nesneler.find((n) => n.id === "kapi")?.capa, "kapi");
});
