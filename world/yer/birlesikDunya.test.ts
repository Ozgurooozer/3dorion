// world/yer/birlesikDunya.test.ts — Görünüm geçişinin SAF kısmı (spec 27): kameranın "ofis içi" derecesi ve iki görünümün karışımı.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { icFaktoru, gorunumKaristir, GECIS_UZAKLIGI, isikAyriminiYaz, ovaIsiklari, type Gorunum } from "./birlesikDunya.ts";
import { ofisIcindeMi } from "./birlesikYer.ts";
import { KAPI_MERKEZI } from "../level/odaKapisi.ts";
import { ODA } from "../level/olculer.ts";
import { PLATO } from "../level/ofisYeri.ts";
import { ufukKur } from "../level/ufuk/ufuk.ts";
import { SOKAK_LAMBALARI } from "../level/ufuk/ufukSehri.ts";

const OFIS: Gorunum = { sisYogunluk: 0.035, sisRenk: [0.05, 0.025, 0.09], arkaPlan: [0.012, 0.008, 0.025, 1], pozlama: 1, kontrast: 1 };
const OVA: Gorunum = { sisYogunluk: 0.0042, sisRenk: [0.8, 0.6, 0.7], arkaPlan: [0.8, 0.58, 0.63, 1], pozlama: 1.2, kontrast: 1.1 };

test("icFaktoru: ofisin içi 1, duvar yanı/arkası 0", () => {
  assert.equal(icFaktoru(0, 0), 1);
  assert.equal(icFaktoru(ODA.genislik / 2 - 0.5, ODA.derinlik / 2 - 0.5), 1);
  assert.equal(icFaktoru(-8, 0), 0, "sol duvarın dışı");
  assert.equal(icFaktoru(0, -ODA.derinlik / 2 - 2), 0, "arka (cam) duvarın dışı");
  assert.equal(icFaktoru(-4, KAPI_MERKEZI.z + 0.5), 0, "ön duvarın yanı, kapıdan uzakta");
  assert.equal(icFaktoru(ODA.genislik / 2 + ODA.duvarKalinlik + 0.05, KAPI_MERKEZI.z - 0.1), 0, "ofisin dış duvarının yanı (kapı hizası): ofis havası dışarı sızmaz");
});

test("icFaktoru: kapının hemen önünde (0,6 m içinde) tam ofis havası", () => {
  assert.equal(icFaktoru(KAPI_MERKEZI.x, KAPI_MERKEZI.z + 0.5), 1);
  assert.equal(icFaktoru(KAPI_MERKEZI.x + 0.3, KAPI_MERKEZI.z + 0.4), 1);
});

test("icFaktoru: kapının önünde ofisten uzaklaştıkça 1 → 0, tek yönlü", () => {
  const z0 = KAPI_MERKEZI.z, x = KAPI_MERKEZI.x;
  assert.ok(icFaktoru(x, z0 + 0.1) > 0.99, "eşiğin hemen dışı hâlâ ofis havası");
  let onceki = 1;
  for (let d = 0.2; d <= GECIS_UZAKLIGI + 1; d += 0.2) {
    const v = icFaktoru(x, z0 + d);
    assert.ok(v <= onceki + 1e-12, `d=${d}: ${v} > ${onceki}`);
    onceki = v;
  }
  assert.equal(icFaktoru(x, z0 + GECIS_UZAKLIGI), 0);
  const orta = icFaktoru(x, z0 + GECIS_UZAKLIGI / 2);
  assert.ok(orta > 0.1 && orta < 0.9, `orta nokta ${orta}`);
});

test("icFaktoru: eşikte süreksiz atlama yok (içeriden dışarıya adım küçük)", () => {
  const x = KAPI_MERKEZI.x, z0 = KAPI_MERKEZI.z;
  assert.ok(Math.abs(icFaktoru(x, z0 - 0.01) - icFaktoru(x, z0 + 0.01)) < 0.05);
});

test("gorunumKaristir: uçlar birebir, orta nokta ortalama, alfa 1, girdi değişmez", () => {
  assert.deepEqual(gorunumKaristir(OFIS, OVA, 1), { ...OFIS, arkaPlan: [...OFIS.arkaPlan] });
  assert.deepEqual(gorunumKaristir(OFIS, OVA, 0), { ...OVA, arkaPlan: [...OVA.arkaPlan] });
  const o = gorunumKaristir(OFIS, OVA, 0.5);
  assert.ok(Math.abs(o.sisYogunluk - (0.035 + 0.0042) / 2) < 1e-12);
  assert.ok(Math.abs(o.pozlama - 1.1) < 1e-12 && Math.abs(o.kontrast - 1.05) < 1e-12);
  assert.ok(Math.abs(o.sisRenk[0] - 0.425) < 1e-12);
  assert.equal(o.arkaPlan[3], 1);
  const once = JSON.stringify([OFIS, OVA]);
  gorunumKaristir(OFIS, OVA, 0.3);
  assert.equal(JSON.stringify([OFIS, OVA]), once);
});

test("gorunumKaristir: ic sınırın dışındaysa sıkışır", () => {
  assert.deepEqual(gorunumKaristir(OFIS, OVA, 7), gorunumKaristir(OFIS, OVA, 1));
  assert.deepEqual(gorunumKaristir(OFIS, OVA, -3), gorunumKaristir(OFIS, OVA, 0));
});

// ── Işık ayrımı + gece ufuk katmanı (ışık dili adım 2, ön kayıt docs/olcum/on-kayit-isik-dili-2.md K1-d) ──
// Sokak lambaları ofisin hemen önünde: ışıkları OVA grubunda olmalı, yoksa cam duvardan/kapıdan ofisin içini (zemin, masa, içerideki
// Orion) sarıya boyardı. Gerçek ufuk katmanı (NullEngine) + gerçek ayrım fonksiyonları.

function ayrimSahnesi() {
  const sahne = new Scene(new NullEngine());
  const gunes = new DirectionalLight("g", new Vector3(0, -1, 0), sahne);
  const dolgu = new HemisphericLight("d", new Vector3(0, 1, 0), sahne);
  const ofisIsigi = new HemisphericLight("ofis", new Vector3(0, 1, 0), sahne);
  const ofisMesh = new Mesh("ofis_zemin", sahne), ovaMesh = new Mesh("ova_zemin", sahne), iceride = new Mesh("orion_govde", sahne);
  const ufuk = ufukKur({ sahne });
  isikAyriminiYaz([ofisIsigi], ovaIsiklari({ isik: { gunes, dolgu } }, ufuk), [ofisMesh], [iceride]);
  return { ufuk, ofisIsigi, ofisMesh, ovaMesh, iceride, gunes };
}

test("ışık ayrımı: sokak lambaları ofisi ve içerideki aktörü AYDINLATMAZ", () => {
  const { ufuk, ofisMesh, iceride } = ayrimSahnesi();
  assert.ok(ufuk.isiklar.length > 0);
  for (const l of ufuk.isiklar) {
    assert.equal(l.canAffectMesh(ofisMesh), false, `${l.name} ofis`);
    assert.equal(l.canAffectMesh(iceride), false, `${l.name} içerideki`);
  }
});

test("ışık ayrımı: sokak lambaları ova'yı aydınlatır", () => {
  const { ufuk, ovaMesh } = ayrimSahnesi();
  for (const l of ufuk.isiklar) assert.equal(l.canAffectMesh(ovaMesh), true, l.name);
});

test("ışık ayrımı: ofis ışığı yalnız ofis (+ içerideki), güneş ofisi değil ova'yı", () => {
  const { ofisIsigi, ofisMesh, ovaMesh, iceride, gunes } = ayrimSahnesi();
  assert.deepEqual([ofisIsigi.canAffectMesh(ofisMesh), ofisIsigi.canAffectMesh(iceride), ofisIsigi.canAffectMesh(ovaMesh)], [true, true, false]);
  assert.deepEqual([gunes.canAffectMesh(ofisMesh), gunes.canAffectMesh(ovaMesh)], [false, true]);
});

test("sokak lambaları ofisin DIŞINDA ve düz terasta (plato)", () => {
  for (const l of SOKAK_LAMBALARI) {
    assert.equal(ofisIcindeMi(l.x, l.z, 1), false, `${l.x},${l.z}`);
    assert.ok(Math.hypot(l.x, l.z) < PLATO.yaricap, `${l.x},${l.z}`);
  }
});
