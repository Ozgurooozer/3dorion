// world/level/gi/isikHacmi.test.ts — Işık Hacmi'nin Babylon tarafı (GI spike 1, ön kayıt K1): `?gi=hacim` bayrağı, GLSL'in
// CPU referansıyla AYNI sabitleri taşıması (kopya kural değil bekçi), malzeme eklentisinin kancaları.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import { giAcikMi, giSorguAyari } from "./isikHacmi.ts";
import { HACIM } from "./isikHacmiCekirdek.ts";
import { ENJEKSIYON_GLSL, MIP_GLSL, TOPLAMA_GLSL, MALZEME_GLSL, ORTAK_GLSL, f } from "./isikHacmiGlsl.ts";
import { GiHacmiEklentisi, giDurumuYap, STANDARD_EK, PBR_EK } from "./giEklentisi.ts";

test("giAcikMi: yalnız `?gi=hacim` açar; yokken ve başka değerde KAPALI (varsayılan davranış birebir)", () => {
  assert.equal(giAcikMi("?gi=hacim"), true);
  assert.equal(giAcikMi("?kapidene=1&gi=hacim&sessiz=1"), true);
  assert.equal(giAcikMi(""), false);
  assert.equal(giAcikMi("?gi=0"), false);
  assert.equal(giAcikMi("?gi=Hacim"), false);
  assert.equal(giAcikMi("?ufuk=0"), false);
});

test("giSorguAyari: varsayılan kip 0 / güç 1 / sekme 1; gikip=1, sayılar; geçersiz/negatif → varsayılan", () => {
  assert.deepEqual(giSorguAyari(""), { kip: 0, guc: 1, sekme: 1 });
  assert.deepEqual(giSorguAyari("?gikip=1&giguc=2.5&gisekme=0"), { kip: 1, guc: 2.5, sekme: 0 });
  assert.deepEqual(giSorguAyari("?gikip=evet&giguc=abc&gisekme=-1"), { kip: 0, guc: 1, sekme: 1 });
});

test("GLSL tek kaynak: gölge ışını sabitleri enjeksiyon şablonunda (CPU referansıyla aynı)", () => {
  assert.ok(ENJEKSIYON_GLSL.includes(`s < ${HACIM.golgeMaks}`));
  assert.ok(ENJEKSIYON_GLSL.includes(`float(s) * ${f(HACIM.golgeAdimi)}`));
  assert.ok(ENJEKSIYON_GLSL.includes(`dl - ${f(HACIM.armaturPayi)}`));
  assert.ok(ENJEKSIYON_GLSL.includes(`o * ${f(HACIM.golgeOfset)}`));
  assert.ok(ENJEKSIYON_GLSL.includes(`isikA[${HACIM.isikSiniri}]`));
});

test("GLSL tek kaynak: koni sabitleri ve doluluk düzeltmesi toplama şablonunda", () => {
  for (const s of [`2.0 * t * ${f(HACIM.koniTan)}`, `cap * ${f(HACIM.koniAdimOrani)}`, `t >= ${f(HACIM.koniMaks)}`,
    `a >= ${f(HACIM.koniDoyma)}`, `< ${f(HACIM.arkaEsik)}`, `dolu ? ${f(HACIM.koniDoluBaslangic)} : ${f(HACIM.koniBaslangic)}`,
    "pow(1.0 - min(o.a, 0.999), exp2(lvl))", `mipN[${HACIM.mipSayisi}]`]) {
    assert.ok(TOPLAMA_GLSL.includes(s), s);
  }
  assert.ok(MALZEME_GLSL.includes(`${f(HACIM.ornekOfset)} * giKoken.w`));
});

test("GLSL: hiçbir şablonda ters eğik çizgi yok (proje kuralı)", () => {
  for (const s of [ENJEKSIYON_GLSL, MIP_GLSL, TOPLAMA_GLSL, MALZEME_GLSL, ORTAK_GLSL]) assert.equal(s.includes(String.fromCharCode(92)), false);
});

test("f: tam sayı GLSL float'ına (1 → 1.0), kesirli olduğu gibi", () => {
  assert.equal(f(1), "1.0");
  assert.equal(f(-0.5), "-0.5");
  assert.equal(f(128), "128.0");
});

test("eklenti: Standard'da diffuseBase'e (finalDiffuse'dan önce), PBR'da finalDiffuse'a albedoyla; doku yokken tanım kapalı", () => {
  const sahne = new Scene(new NullEngine());
  const std = new StandardMaterial("s", sahne), pbr = new PBRMaterial("p", sahne);
  const d = giDurumuYap();
  const es = new GiHacmiEklentisi(std, d), ep = new GiHacmiEklentisi(pbr, d);
  const ks = es.getCustomCode("fragment")!, kp = ep.getCustomCode("fragment")!;
  assert.ok(ks["!vec3 finalDiffuse="]!.includes(STANDARD_EK));
  assert.ok(ks["!vec3 finalDiffuse="]!.endsWith("vec3 finalDiffuse="), "satır geri yazılır");
  assert.equal(ks["CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION"], undefined);
  assert.ok(kp["CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION"]!.includes(PBR_EK));
  assert.equal(kp["!vec3 finalDiffuse="], undefined);
  assert.ok(ks["CUSTOM_FRAGMENT_DEFINITIONS"]!.includes("uniform sampler2D giIrr;"));
  assert.ok(kp["CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR"]!.includes("finalColor ="), "PBR hata ayıklama görünümü");
  assert.ok(ks["CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR"]!.includes("color ="));
  assert.equal(es.getCustomCode("vertex"), null);
  const tanim = new MaterialDefines();
  es.prepareDefines(tanim);
  assert.equal(tanim["GIHACIM"], false, "doku yok → GI derlenmez");
  const s: string[] = [];
  es.getSamplers(s);
  assert.deepEqual(s, ["giIrr"]);
  sahne.dispose();
});
