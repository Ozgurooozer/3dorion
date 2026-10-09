// world/level/cekirdek/nesne.test.ts — Yerleştirilen nesneler: tanım doğrulaması, katalog okuma, tarayıcı yardımcıları.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { levelTanimiDogrula } from "./levelTanimi.ts";
import { ornekTanim } from "./ornekTanim.ts";
import { katalogOku, yasla, kisaAd } from "./katalog.ts";
import { levelKur } from "./levelKur.ts";
import { renkDizisi, parcaRengi } from "./nesneSistemi.ts";
import { Color3 } from "@babylonjs/core/Maths/math.color";

const NESNE = { varlik: "PROP_TrafficCone_SM", konum: [1, 0, 2] as [number, number, number], donus: 90, olcek: 1 };

test("nesneler olmayan tanım geçerli (eski dosyalar)", () => {
  assert.ok(levelTanimiDogrula(ornekTanim()).ok);
});
test("geçerli nesne listesi kabul edilir", () => {
  assert.ok(levelTanimiDogrula({ ...ornekTanim(), nesneler: [NESNE] }).ok);
});
test("nesnenin konumu 3 sayı değilse hata", () => {
  const d = levelTanimiDogrula({ ...ornekTanim(), nesneler: [{ ...NESNE, konum: [1, 2] }] });
  assert.match(d.ok ? "" : d.hata, /nesneler\[0\]/);
});
test("ölçek sıfır ya da negatifse hata", () => {
  const d = levelTanimiDogrula({ ...ornekTanim(), nesneler: [{ ...NESNE, olcek: 0 }] });
  assert.equal(d.ok, false);
});
test("level kurulunca tanım boş nesne listesiyle tamamlanır (panel gösterebilsin)", () => {
  const level = levelKur(new Scene(new NullEngine()), { ...ornekTanim(), katmanlar: [] }, new Map());
  assert.deepEqual(level.tanim().nesneler, []);
});

const KATALOG = { surum: 1, kaynak: "x", varliklar: [{ ad: "A", kategori: "yol", dosya: "sehir/A.glb", onizleme: "sehir/onizleme/A.png", boyut: [1, 2, 3], ucgen: 10, bayt: 100 }] };
test("katalog okunur", () => {
  assert.equal(katalogOku(KATALOG).varliklar[0]!.ad, "A");
});
test("katalogda yinelenen ad hata", () => {
  assert.throws(() => katalogOku({ ...KATALOG, varliklar: [KATALOG.varliklar[0], KATALOG.varliklar[0]] }), /yinelenen/);
});
test("katalogda boyutu bozuk varlık hata", () => {
  assert.throws(() => katalogOku({ ...KATALOG, varliklar: [{ ...KATALOG.varliklar[0], boyut: [1] }] }), /bozuk/);
});

test("ızgaraya yaslama: 4 m adımda 5,9 → 4", () => {
  assert.equal(yasla(5.9, 4), 4);
});
test("ızgara 0 iken serbest", () => {
  assert.equal(yasla(5.9, 0), 5.9);
});
test("kısa ad: kategori öneki atılır", () => {
  assert.equal(kisaAd("PROP_TrafficCone_SM"), "TrafficCone SM");
});

// ── birleştirme (çizim çağrısı) ──
test("renk dizisi köşe başına rgba", () => {
  assert.deepEqual(Array.from(renkDizisi(2, [0.5, 0.25, 1])), [0.5, 0.25, 1, 1, 0.5, 0.25, 1, 1]);
});
test("emissive'li parça ışıyan sayılır", () => {
  assert.equal(parcaRengi({ name: "MN_Neon_Pink", albedoColor: new Color3(1, 0, 1), emissiveColor: new Color3(1, 0, 1) }).isiyan, true);
});
test("uyarı boyası emissive'li olsa da ışımaz (gündüz yol çizgisi parlamasın)", () => {
  assert.equal(parcaRengi({ name: "MH_Warning_Yell", albedoColor: new Color3(1, 1, 0), emissiveColor: new Color3(1, 1, 0) }).isiyan, false);
});
test("ışımayan parçanın rengi albedo'nun gamma karşılığı", () => {
  assert.deepEqual(parcaRengi({ name: "x", albedoColor: new Color3(1, 1, 1), emissiveColor: new Color3(0, 0, 0) }).renk, [1, 1, 1]);
});
