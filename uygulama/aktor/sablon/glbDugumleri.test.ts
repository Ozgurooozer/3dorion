// uygulama/aktor/sablon/glbDugumleri.test.ts — glb'deki `soket_<ad>` düğümlerinin okunması (spec 45 B7). Ekransız Babylon (NullEngine): düğümler elle kurulur, gerçek glb değil
// (glb yükleme canlı senaryoda: bpdene, B9). Sorulan: konum/dönüş NESNE KÖKÜNE göre mi, nesne ölçeği/konumu sızıyor mu, soketsiz düğüm atlanıyor mu?
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { glbDugumleriniOku } from "./glbDugumleri.ts";
import { glbdenSablon } from "./aktorSablonu.ts";

const kur = () => { const s = new Scene(new NullEngine()); return { s, kok: new TransformNode("n1", s) }; };

test("soket_ önekli düğümler okunur; öteki düğümler atlanır", () => {
  const { s, kok } = kur();
  const gov = new TransformNode("govde", s); gov.parent = kok;
  const a = new TransformNode("soket_namlu", s); a.parent = gov; a.position = new Vector3(0, 0.5, 1);
  const b = new TransformNode("baska", s); b.parent = kok;
  const r = glbDugumleriniOku(kok);
  assert.ok(r.ok);
  assert.deepEqual(r.dugumler.map((d) => d.ad), ["soket_namlu"]);
  assert.deepEqual(r.dugumler[0]!.konum, [0, 0.5, 1]);
  assert.ok(b);
});

test("konum nesne köküne göre yerel: nesnenin dünya konumu ve ölçeği sızmaz", () => {
  const { s, kok } = kur();
  kok.position = new Vector3(10, 0, -4); kok.scaling = new Vector3(2, 2, 2);
  const d = new TransformNode("soket_el", s); d.parent = kok; d.position = new Vector3(0.25, 1, 0);
  const r = glbDugumleriniOku(kok);
  assert.ok(r.ok);
  assert.deepEqual(r.dugumler[0]!.konum, [0.25, 1, 0], "yerel konum aynen; ölçek x2 ve dünya ofseti çıkarıldı");
});

test("dönüş derece olarak okunur (yerel Euler)", () => {
  const { s, kok } = kur();
  const d = new TransformNode("soket_yan", s); d.parent = kok; d.rotation = new Vector3(0, Math.PI / 2, 0);
  const r = glbDugumleriniOku(kok);
  assert.ok(r.ok);
  assert.deepEqual(r.dugumler[0]!.donus, [0, 90, 0]);
});

test("düğüm yoksa nedenli hata (AKT-SBL-008), fırlatmaz", () => {
  const r = glbDugumleriniOku(null);
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.neden, /^\[AKT-SBL-008\]/);
});

test("glbdenSablon ile uçtan uca: okunan düğümler soket bileşeni olur", () => {
  const { s, kok } = kur();
  const d = new TransformNode("soket_tutus", s); d.parent = kok; d.position = new Vector3(0, 0.1, 0.3);
  const o = glbDugumleriniOku(kok);
  assert.ok(o.ok);
  const sb = glbdenSablon("kilic", "kilic/kilic.glb", o.dugumler);
  assert.ok(sb.ok);
  const b = sb.deger.sablon.aktorler[0]!.nesne!.bilesenler![0]!;
  assert.equal(b.tur, "soket");
  assert.equal(b.ayar!["ad"], "tutus");
  assert.deepEqual(b.ayar!["konum"], [0, 0.1, 0.3]);
});
