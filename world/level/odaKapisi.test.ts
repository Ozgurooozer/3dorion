// world/level/odaKapisi.test.ts — Ofis kapısı: saf eğri, histerezis, menteşe geometrisi (spec 27).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import {
  odaKapisiKur, kapiAcisi, kapiYakinMi, KAPI_ACIK_ACI, KAPI_SURESI, KAPI_ACMA_MESAFESI, KAPI_KAPAMA_MESAFESI, KAPI_MERKEZI,
} from "./odaKapisi.ts";
import { KAPI, ODA } from "./olculer.ts";

test("kapiAcisi: sabit hızla hedefe gider, aşmaz; tam açıklık KAPI_SURESI'nde", () => {
  assert.equal(kapiAcisi(0, KAPI_ACIK_ACI, KAPI_SURESI), KAPI_ACIK_ACI);
  assert.ok(Math.abs(kapiAcisi(0, KAPI_ACIK_ACI, KAPI_SURESI / 2) - KAPI_ACIK_ACI / 2) < 1e-12);
  assert.equal(kapiAcisi(KAPI_ACIK_ACI - 0.01, KAPI_ACIK_ACI, 5), KAPI_ACIK_ACI, "aşmaz");
  assert.equal(kapiAcisi(0.01, 0, 5), 0, "kapanırken eksiye geçmez");
  assert.equal(kapiAcisi(0.3, 0.3, 1), 0.3);
  assert.equal(kapiAcisi(0, KAPI_ACIK_ACI, -1), 0, "negatif dt ilerletmez");
});

test("kapiYakinMi: histerezis (aç < kapa uzaklığı), kimse yoksa kapalı, en yakın sayılır", () => {
  assert.ok(KAPI_ACMA_MESAFESI < KAPI_KAPAMA_MESAFESI);
  assert.equal(kapiYakinMi(false, [KAPI_ACMA_MESAFESI - 0.1]), true);
  assert.equal(kapiYakinMi(false, [KAPI_ACMA_MESAFESI + 0.1]), false, "kapalıyken açma eşiğinin ötesinde açılmaz");
  assert.equal(kapiYakinMi(true, [KAPI_ACMA_MESAFESI + 0.5]), true, "açıkken açma eşiğini aşsa da kapanmaz (titreşme yok)");
  assert.equal(kapiYakinMi(true, [KAPI_KAPAMA_MESAFESI + 0.1]), false);
  assert.equal(kapiYakinMi(true, []), false);
  assert.equal(kapiYakinMi(false, [50, 1.0, 20]), true, "en yakın kişi belirler");
});

function kur() {
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const k = odaKapisiKur(sahne, { kanat: null, panel: null, tokmak: null });
  return { sahne, motor, k };
}

test("kapı kapalıyken kanat ön duvar düzleminde, kapı boşluğunu örter", () => {
  const { k } = kur();
  const kanat = k.meshler.find((m) => m.name === "kapi_kanat")!;
  kanat.parent!.getWorldMatrix();
  kanat.computeWorldMatrix(true);
  const c = kanat.getAbsolutePosition();
  assert.ok(Math.abs(c.x - KAPI.x) < 1e-6, `x=${c.x}`);
  assert.ok(Math.abs(c.z - (ODA.derinlik / 2 - 0.03)) < 1e-6, `z=${c.z}`);
  assert.ok(Math.abs(c.y - KAPI.y) < 1e-6);
});

test("tam açıkken kanat DIŞARI (+Z) bakar ve ucu menteşede kalır; odaya (−Z) girmez", () => {
  const { sahne, k } = kur();
  k.hedef(true);
  for (let i = 0; i < 40; i++) k.guncelle(0.05);
  assert.equal(k.aci(), KAPI_ACIK_ACI);
  assert.equal(k.acikMi(), true);
  const kanat = k.meshler.find((m) => m.name === "kapi_kanat")!;
  (kanat.parent as { computeWorldMatrix(f: boolean): unknown }).computeWorldMatrix(true);
  kanat.computeWorldMatrix(true);
  const c = kanat.getAbsolutePosition();
  const mentese = { x: KAPI.x + KAPI.genislik / 2, z: ODA.derinlik / 2 - 0.03 };
  assert.ok(c.z > mentese.z + KAPI.genislik / 2 - 1e-6, `kanat merkezi dışarıda olmalı: z=${c.z}`);
  assert.ok(Math.abs(c.x - mentese.x) < 1e-6, `menteşenin hizasında: x=${c.x}`);
  for (const m of k.meshler) {
    m.computeWorldMatrix(true);
    const alt = m.getBoundingInfo().boundingBox.minimumWorld, ust = m.getBoundingInfo().boundingBox.maximumWorld;
    assert.ok(alt.z > ODA.derinlik / 2 - 0.2, `${m.name} odaya sarkıyor: minZ=${alt.z}`);
    void ust;
  }
  void sahne;
});

test("kapanırken kanat duvar düzlemine döner; aralıkta ara açı", () => {
  const { k } = kur();
  k.hedef(true);
  k.guncelle(KAPI_SURESI / 2);
  assert.ok(k.aci() > 0.1 && k.aci() < KAPI_ACIK_ACI);
  k.hedef(false);
  for (let i = 0; i < 40; i++) k.guncelle(0.05);
  assert.equal(k.aci(), 0);
  assert.equal(k.acikMi(), false);
});

test("kapı merkezi ön duvarda ve kapının x'inde", () => {
  assert.deepEqual(KAPI_MERKEZI, { x: KAPI.x, z: ODA.derinlik / 2 });
});

test("kapı meshleri 'kapi' çapasını taşır (ışın/etkileşim) ve ayrı ayrı yok edilir", () => {
  const { k, sahne } = kur();
  assert.equal(k.meshler.length, 7, "1 kanat + 4 panel + 2 tokmak");
  for (const m of k.meshler) assert.equal((m.metadata as { capa?: string }).capa, "kapi");
  const once = sahne.meshes.length;
  k.yokEt();
  assert.ok(sahne.meshes.length <= once - k.meshler.length);
  void Vector3;
});
