// world/yer/birlesikYer.test.ts — Tek yer (ofis ova'nın içinde): duvarlar, kapı boşluğu, yol bulma, yükseklik (spec 27).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { birlesikYerKur, ofisIcindeMi, OFIS_DUVARLARI } from "./birlesikYer.ts";
import { ODA_YERI } from "./odaYeri.ts";
import type { Yer } from "./yer.ts";
import { carpisiyorMu, KAPI, MASA, ODA, OYUNCU_YARICAP } from "../level/olculer.ts";
import { yolBul } from "../avatar/yolBulma.ts";
import { BANK, BANK_KUTUSU } from "../level/bank.ts";
import { bakilanCapa } from "../player/isinTarama.ts";

/** Sahte ova yeri: geniş sınır, bir kaya engeli, bir çapa, düz zemin −0,05. */
const OVA: Yer = {
  ad: "ova", sinir: { minX: -60, maxX: 60, minZ: -60, maxZ: 60 },
  engeller: [{ x: 20, y: 1, z: 20, g: 4, yuk: 2, d: 4 }],
  katiYuzeyler: [{ kutu: { x: 20, y: 1, z: 20, g: 4, yuk: 2, d: 4 }, capa: null }],
  capalar: [{ ad: "kule" as never, konum: { x: 30, y: 1, z: 30 }, durak: { x: 28, y: 0, z: 28 }, yon: { x: 1, y: 0, z: 1 }, yaklasmaYaricapi: 2, eylemler: ["bak"], etiket: "kule" }],
  nesneler: [], yukseklik: () => -0.05,
};
const B = birlesikYerKur(OVA);
const serbest = (x: number, z: number, r = OYUNCU_YARICAP) => !carpisiyorMu(x, z, r, B);

test("ofis içi ve dışı serbest; duvar içi ve ova engeli dolu", () => {
  assert.ok(serbest(0, 0), "ofis ortası");
  assert.ok(serbest(2.6, 8), "kapının önü (dışarısı)");
  assert.ok(serbest(-30, -30), "ova");
  assert.ok(!serbest(-ODA.genislik / 2 - 0.1, 0), "sol duvar");
  assert.ok(!serbest(0, -ODA.derinlik / 2 - 0.1), "arka (cam) duvar");
  assert.ok(!serbest(-1, ODA.derinlik / 2 + 0.1), "ön duvar (kapı boşluğunun dışı)");
  assert.ok(!serbest(20, 20), "ova engeli");
  assert.ok(!serbest(MASA.x, MASA.z), "ofis mobilyası (masa) hâlâ engel");
});

test("kapı boşluğu YÜRÜNÜR (kanat çarpışmada yok): eşik her an geçilebilir, boşluğun hemen yanı duvar", () => {
  for (const z of [ODA.derinlik / 2 - 0.5, ODA.derinlik / 2, ODA.derinlik / 2 + 0.1, ODA.derinlik / 2 + 0.2, ODA.derinlik / 2 + 0.6]) {
    assert.ok(serbest(KAPI.x, z), `eşik z=${z}`);
  }
  assert.ok(!serbest(KAPI.x + KAPI.genislik / 2 + 0.05, ODA.derinlik / 2 + 0.1), "boşluğun sağ yanı duvar");
  assert.ok(!serbest(KAPI.x - KAPI.genislik / 2 - 0.05, ODA.derinlik / 2 + 0.1), "boşluğun sol yanı duvar");
});

test("Orion'un yol bulması (kapsül 0,34): ofisten dışarı ve geri KAPIDAN geçer; arka duvarın ardına dolanır", () => {
  const dis = yolBul({ x: 0, z: -1 }, { x: 2.6, z: 9 }, 0.34, B);
  assert.ok(dis, "dışarı çıkış yolu var");
  assert.ok(dis!.some((p) => Math.abs(p.x - KAPI.x) < 0.7 && p.z > ODA.derinlik / 2 - 1.2 && p.z < ODA.derinlik / 2 + 1.2) || dis!.length === 1, `yol kapıdan geçmeli: ${JSON.stringify(dis)}`);
  const ic = yolBul({ x: 6, z: 12 }, { x: -2, z: 0 }, 0.34, B);
  assert.ok(ic, "içeri dönüş yolu var");
  const arka = yolBul({ x: 0, z: 0 }, { x: 0, z: -9 }, 0.34, B);
  assert.ok(arka, "arka duvarın ardına dolanır");
  const uzunluk = (yol: { x: number; z: number }[], bas: { x: number; z: number }) => yol.reduce((t, p, i) => t + Math.hypot(p.x - (i ? yol[i - 1]!.x : bas.x), p.z - (i ? yol[i - 1]!.z : bas.z)), 0);
  assert.ok(uzunluk(arka!, { x: 0, z: 0 }) > 15, "doğrudan 9 m değil, kapıdan dolaşır (>15 m)");
});

test("ofisin içindeki hedefe ova dışından yol bulunur; duvarın içine hedef verilirse null (sessiz değil)", () => {
  assert.ok(yolBul({ x: 10, z: 15 }, { x: 0, z: 0 }, 0.34, B));
  assert.equal(yolBul({ x: 0, z: 0 }, { x: -5.1, z: 0 }, 0.34, B), null);
});

test("yükseklik: ofisin içi 0 (döşeme), dışı ova zemini; yer izi sınırı pay ile", () => {
  assert.equal(B.yukseklik(0, 0), 0);
  assert.equal(B.yukseklik(ODA.genislik / 2 + 0.1, 0), 0, "duvar kalınlığı hâlâ ofis");
  assert.equal(B.yukseklik(12, 0), -0.05);
  assert.ok(ofisIcindeMi(0, 0) && !ofisIcindeMi(6, 0) && ofisIcindeMi(5.5, 0, 0.5));
});

test("çapalar: ofisin çapaları + ova'nın adlı yerleri; nesneler ve yüzeyler birleşik; girdi değişmez", () => {
  assert.ok(B.capalar.some((c) => c.ad === "tahta") && B.capalar.some((c) => c.ad === "kapi") && B.capalar.some((c) => (c.ad as string) === "kule"));
  // + 1: ofisin dışındaki bank (world/level/bank.ts) birleşik yerde çapa, katı yüzey ve engel olarak var.
  assert.equal(B.capalar.length, ODA_YERI.capalar.length + OVA.capalar.length + 1);
  assert.equal(B.katiYuzeyler.length, ODA_YERI.katiYuzeyler.length + OVA.katiYuzeyler.length + 1);
  assert.equal(B.engeller.length, ODA_YERI.engeller.length + OVA.engeller.length + OFIS_DUVARLARI.length + 1);
  assert.equal(OVA.engeller.length, 1);
  assert.equal(B.ad, "ova");
});

test("ofis duvarları: iç yüz SINIR'da, ön duvar iki parça ve boşluk ortada", () => {
  assert.equal(OFIS_DUVARLARI.length, 5);
  const on = OFIS_DUVARLARI.filter((k) => Math.abs(k.z - (ODA.derinlik / 2 + ODA.duvarKalinlik / 2)) < 1e-9);
  assert.equal(on.length, 2);
  const bosluk = [Math.max(...on.map((k) => (k.x < 0 ? k.x + k.g / 2 : -Infinity))), Math.min(...on.map((k) => (k.x > 0 ? k.x - k.g / 2 : Infinity)))];
  assert.ok(Math.abs(bosluk[0]! - (KAPI.x - KAPI.genislik / 2)) < 1e-9 && Math.abs(bosluk[1]! - (KAPI.x + KAPI.genislik / 2)) < 1e-9, `boşluk ${bosluk}`);
});

test("bank: birleşik yerde çapa, engel, katı yüzey ve nesne olarak var; ofisin tek başına yerinde yok", () => {
  assert.ok(B.capalar.some((c) => c.ad === "bank"));
  assert.ok(B.engeller.includes(BANK_KUTUSU));
  assert.ok(B.katiYuzeyler.some((k) => k.capa === "bank"));
  assert.ok(B.nesneler.some((n) => n.id === "bank" && n.capa === "bank"));
  assert.ok(!ODA_YERI.capalar.some((c) => c.ad === "bank"));
});

test("bank: bankın içi dolu, ama kalkış noktası (bankın önü) ve kapıdan düz çıkış serbest", () => {
  assert.ok(!serbest(BANK.x, BANK.z), "bankın içi");
  assert.ok(serbest(BANK.x, BANK.z + BANK.derinlik / 2 + 0.7), "bankın önü (kalkış noktası)");
  assert.ok(serbest(KAPI.x, ODA.derinlik / 2 + 1.5), "kapıdan düz çıkış");
});

test("bank: bankın önünden ona bakan göz çapayı 'bank' diye tanır (etkileşim ipucunun gerçek yolu)", () => {
  const goz = { x: BANK.x, y: BANK.zemin + 1.6, z: BANK.z + 2 };
  const d = { x: 0, y: BANK.zemin + BANK.oturma - goz.y, z: BANK.z - goz.z };
  const boy = Math.hypot(d.x, d.y, d.z);
  assert.equal(bakilanCapa(goz, { x: d.x / boy, y: d.y / boy, z: d.z / boy }, 2.5, B.katiYuzeyler), "bank");
});
