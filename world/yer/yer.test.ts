// world/yer/yer.test.ts — "Yer" soyutlaması (spec 24 C1): oda yeri eski sabitlerle aynı, başka bir yer
// verilince yol bulma, çarpışma, çapalar ve Orion'un yürüyüşü GERÇEKTEN o yeri kullanır.
//
// C1'in sözü "odada hiçbir şey değişmez": ilk blok bunu sınar (oda yeri = sabitler; yer verilmeyen çağrı = oda
// yeriyle çağrı). İkinci blok soyutlamanın boş olmadığını: odanın dışındaki bir alanda yürünür.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Yer } from "./yer.ts";
import { ODA_YERI } from "./odaYeri.ts";
import { ENGELLER, KATI_YUZEYLER, SINIR, carpisiyorMu, OYUNCU_YARICAP, type Kutu } from "../level/olculer.ts";
import { tumCapalar, capaBul, type Capa } from "../level/capalar.ts";
import { NESNELER } from "../level/nesneKaydi.ts";
import { AVATAR_YARICAP, yolBul, yolUzunlugu } from "../avatar/yolBulma.ts";
import { Yurutucu } from "../avatar/yurutucu.ts";
import { isinTara } from "../player/isinTarama.ts";
import type { NiyetSonucu } from "../../protocol/niyet.ts";

// ── 1. Oda yeri = odanın tek kaynağı ──────────────────────────────────────
test("oda yerinin engelleri odanın ENGELLER listesi", () => { assert.equal(ODA_YERI.engeller, ENGELLER); });
test("oda yerinin sınırı odanın SINIR'ı", () => { assert.equal(ODA_YERI.sinir, SINIR); });
test("oda yerinin katı yüzeyleri odanın KATI_YUZEYLER listesi", () => { assert.equal(ODA_YERI.katiYuzeyler, KATI_YUZEYLER); });
test("oda yerinin çapaları çapa defteri", () => { assert.equal(ODA_YERI.capalar, tumCapalar()); });
test("oda yerinin nesneleri nesne kaydı", () => { assert.equal(ODA_YERI.nesneler, NESNELER); });
test("oda zemini düz: her yerde yükseklik 0", () => { assert.equal(ODA_YERI.yukseklik(3, -2), 0); });

// 0,5 m ızgara, odanın biraz dışına taşar (duvar hücreleri de sınansın).
const IZGARA: { x: number; z: number }[] = [];
for (let x = -5.5; x <= 5.5; x += 0.5) for (let z = -4.5; z <= 4.5; z += 0.5) IZGARA.push({ x, z });

test("yer verilmeyen çarpışma testi oda yeriyle aynı karar (ızgaranın her noktası)", () => {
  const farkli = IZGARA.filter((p) => carpisiyorMu(p.x, p.z) !== carpisiyorMu(p.x, p.z, OYUNCU_YARICAP, ODA_YERI));
  assert.deepEqual(farkli, []);
});
test("yer verilmeyen yol bulma oda yeriyle aynı yol (masanın öbür yanı)", () => {
  const bas = { x: 0, z: -1.5 }, son = { x: 0, z: -3.9 + AVATAR_YARICAP + 0.05 };
  assert.deepEqual(yolBul(bas, son), yolBul(bas, son, AVATAR_YARICAP, ODA_YERI));
});

// ── 2. Başka bir yer: 40×40 m açık alan, ortada 4×4 m bir bina, kuzeyde bir kapı ──
const BINA: Kutu = { x: 0, y: 2, z: 0, g: 4, yuk: 4, d: 4 };
const KAPI: Capa = {
  ad: "kapi", konum: { x: 0, y: 1, z: 15 }, durak: { x: 0, y: 0, z: 14 }, yon: { x: 0, y: 0, z: 1 },
  yaklasmaYaricapi: 1.4, eylemler: ["bak"], etiket: "ofis kapısı",
};
const ALAN: Yer = {
  ad: "deneme-alani",
  sinir: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
  engeller: [BINA],
  katiYuzeyler: [{ kutu: BINA, capa: null }],
  capalar: [KAPI],
  nesneler: [],
  yukseklik: () => 0,
};

test("açık alanda odanın dışındaki nokta serbest", () => { assert.equal(carpisiyorMu(12, 0, OYUNCU_YARICAP, ALAN), false); });
test("aynı nokta oda yeriyle duvarın dışında (çarpışır)", () => { assert.equal(carpisiyorMu(12, 0), true); });
test("açık alanda binanın içi çarpışır", () => { assert.equal(carpisiyorMu(0.5, 0.5, OYUNCU_YARICAP, ALAN), true); });
test("açık alanda odanın masasının yeri engel değil", () => { assert.equal(carpisiyorMu(0, -3.25, OYUNCU_YARICAP, ALAN), false); });

test("binanın arkasına giden yol binanın etrafından dolaşır (düz çizgiden uzun)", () => {
  const bas = { x: 0, z: -6 }, son = { x: 0, z: 6 };
  const yol = yolBul(bas, son, AVATAR_YARICAP, ALAN)!;
  assert.ok(yolUzunlugu(bas, yol) > 12.5, `yol ${yolUzunlugu(bas, yol).toFixed(2)} m`);
});
test("binanın arkasındaki noktaya yol bulunur", () => { assert.notEqual(yolBul({ x: 0, z: -6 }, { x: 0, z: 6 }, AVATAR_YARICAP, ALAN), null); });

test("çapa yerin listesinden bulunur", () => { assert.equal(capaBul("kapi", ALAN.capalar)?.etiket, "ofis kapısı"); });
test("başka yerin çapası bu yerde yok (tahta ofiste kaldı)", () => { assert.equal(capaBul("tahta", ALAN.capalar), null); });

test("bakış ışını yerin katı yüzeyinde durur", () => {
  const isabet = isinTara({ x: 0, y: 1.6, z: -8 }, { x: 0, y: 0, z: 1 }, 20, ALAN.katiYuzeyler);
  assert.equal(isabet?.mesafe, 6);
});

// ── 3. Orion'un yürüyüşü yerini izler ──────────────────────────────────────
function bitis(y: Yurutucu, id: string): NiyetSonucu | undefined {
  for (let i = 0; i < 1200; i++) {
    const s = y.ilerle(1 / 20).find((r) => r.niyet_id === id && (r.durum === "bitti" || r.durum === "hata"));
    if (s) return s;
  }
  return undefined;
}

test("açık alanda Orion binanın arkasındaki kapıya yürüyüp varır", () => {
  const y = new Yurutucu({ spawn: { x: 0, y: 0, z: -6 }, yer: () => ALAN });
  y.niyet({ tur: "git", hedef: { tip: "capa", ad: "kapi" } }, "g1");
  assert.equal(bitis(y, "g1")?.durum, "bitti");
});
test("varış noktası alanın kapı durağının yakınında", () => {
  const y = new Yurutucu({ spawn: { x: 0, y: 0, z: -6 }, yer: () => ALAN });
  y.niyet({ tur: "git", hedef: { tip: "capa", ad: "kapi" } }, "g1");
  bitis(y, "g1");
  const k = y.durum().konum;
  assert.ok(Math.hypot(k.x - 0, k.z - 14) <= KAPI.yaklasmaYaricapi, `konum (${k.x.toFixed(2)}, ${k.z.toFixed(2)})`);
});
test("açık alanda ofisteki tahtaya gitmek hata (o yerde böyle bir çapa yok)", () => {
  const y = new Yurutucu({ spawn: { x: 0, y: 0, z: -6 }, yer: () => ALAN });
  y.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "g1");
  assert.equal(bitis(y, "g1")?.durum, "hata");
});
test("yer değişince sonraki niyet yeni yeri kullanır (geri çağrı her seferinde okunur)", () => {
  let yer: Yer = ODA_YERI;
  const y = new Yurutucu({ spawn: { x: 0, y: 0, z: -6 }, yer: () => yer });
  yer = ALAN;
  y.niyet({ tur: "git", hedef: { tip: "capa", ad: "kapi" } }, "g1");
  assert.equal(bitis(y, "g1")?.durum, "bitti");
});

// ── 4. Zemin yüksekliği ve ışınlama (spec 24 C2) ──────────────────────────
const EGIMLI: Yer = { ...ALAN, ad: "egimli", yukseklik: (x) => 0.1 * x };

test("eğimli yerde Orion yürüyünce ayağı zeminde", () => {
  const y = new Yurutucu({ spawn: { x: 5, y: 0.5, z: -6 }, yer: () => EGIMLI });
  y.niyet({ tur: "git", hedef: { tip: "nokta", x: 12, y: 0, z: -6 } }, "g1");
  bitis(y, "g1");
  const k = y.durum().konum;
  assert.ok(Math.abs(k.y - 0.1 * k.x) < 1e-9, `x ${k.x.toFixed(2)} y ${k.y.toFixed(3)}`);
});
test("ışınlanınca süren iş iptal (beyin beklemede kalmaz)", () => {
  const y = new Yurutucu({ spawn: { x: 0, y: 0, z: -6 }, yer: () => ALAN });
  y.niyet({ tur: "git", hedef: { tip: "capa", ad: "kapi" } }, "g1");
  y.ilerle(1 / 20);
  assert.deepEqual(y.isinla(10, 10, 0).map((s) => [s.niyet_id, s.durum]), [["g1", "iptal"]]);
});
test("ışınlanınca yeni noktada ve o noktanın zemininde", () => {
  const y = new Yurutucu({ spawn: { x: 0, y: 0, z: -6 }, yer: () => EGIMLI });
  y.isinla(8, 3, 0);
  const k = y.durum().konum;
  assert.deepEqual([k.x, +k.y.toFixed(9), k.z], [8, 0.8, 3]);
});
