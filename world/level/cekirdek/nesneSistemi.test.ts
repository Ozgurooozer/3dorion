// world/level/cekirdek/nesneSistemi.test.ts — Yerleşim kimliği, yerinde dönüşüm, gizlilik, geç yükleme (spec 22).
// Sahte yükleyici: glb yerine boş bir mesh kurar ve kaç kez yüklendiğini sayar.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { levelKur } from "./levelKur.ts";
import { ornekTanim } from "./ornekTanim.ts";
import type { LevelTanimi, NesneYeri } from "./levelTanimi.ts";
import type { NesneYukleyici } from "./nesneSistemi.ts";

const N = (id: string, x = 0): NesneYeri => ({ id, varlik: "A", konum: [x, 0, 0], donus: 0, olcek: 1 });
const tanim = (nesneler: NesneYeri[], ek: Partial<LevelTanimi> = {}): LevelTanimi => ({ ...ornekTanim(), katmanlar: [], nesneler, ...ek });

/** Anında yükleyen sahte: ust altına bir mesh. */
const aninda: NesneYukleyici = async (ad, ust) => { const m = new Mesh(`${ad}_m`, ust.getScene()); m.parent = ust; return [m]; };

async function kur(t: LevelTanimi, yukleyici: NesneYukleyici = aninda) {
  const sahne = new Scene(new NullEngine());
  const level = levelKur(sahne, t, new Map(), undefined, { nesneYukleyici: yukleyici });
  await level.nesneler.hazir();
  return { sahne, level };
}

test("kimliksiz eski yerleşim kurulunca kimlik alır", async () => {
  const { level } = await kur(tanim([{ varlik: "A", konum: [0, 0, 0], donus: 0, olcek: 1 }]));
  assert.equal(level.tanim().nesneler![0]!.id, "n1");
});

test("yalnız taşıma yeniden yüklemez", async () => {
  const { level } = await kur(tanim([N("n1"), N("n2")]));
  level.ayarla(tanim([N("n1", 5), N("n2")]));
  await level.nesneler.hazir();
  assert.equal(level.nesneler.yuklemeSayisi(), 2);
});

test("taşıma düğümü yerinde oynatır", async () => {
  const { level } = await kur(tanim([N("n1")]));
  const once = level.nesneler.dugum("n1");
  level.ayarla(tanim([N("n1", 5)]));
  assert.equal(level.nesneler.dugum("n1"), once);
});

test("taşınan düğümün konumu yeni konum", async () => {
  const { level } = await kur(tanim([N("n1")]));
  level.ayarla(tanim([N("n1", 5)]));
  assert.equal(level.nesneler.dugum("n1")!.position.x, 5);
});

test("üç eksen dönüş düğüme radyan olarak gider", async () => {
  const { level } = await kur(tanim([{ ...N("n1"), donus: [90, 0, 0] }]));
  assert.ok(Math.abs(level.nesneler.dugum("n1")!.rotation.x - Math.PI / 2) < 1e-9);
});

test("eksen başına ölçek düğüme gider", async () => {
  const { level } = await kur(tanim([{ ...N("n1"), olcek: [1, 2, 3] }]));
  assert.deepEqual(level.nesneler.dugum("n1")!.scaling.asArray(), [1, 2, 3]);
});

test("baştakini silmek sonrakini yeniden kurmaz", async () => {
  const { level } = await kur(tanim([N("n1"), N("n2")]));
  const ikinci = level.nesneler.dugum("n2");
  level.ayarla(tanim([N("n2")]));
  assert.equal(level.nesneler.dugum("n2"), ikinci);
});

test("varlığı değişen yerleşim yeniden yüklenir", async () => {
  const { level } = await kur(tanim([N("n1")]));
  level.ayarla(tanim([{ ...N("n1"), varlik: "B" }]));
  await level.nesneler.hazir();
  assert.equal(level.nesneler.yuklemeSayisi(), 2);
});

test("gizli nesnenin düğümü kapalı", async () => {
  const { level } = await kur(tanim([{ ...N("n1"), gizli: true }]));
  assert.equal(level.nesneler.dugum("n1")!.isEnabled(), false);
});

test("gizli grubun içindeki nesne de kapalı", async () => {
  const { level } = await kur(tanim([{ ...N("n1"), grup: "g1" }], { gruplar: [{ id: "g1", ad: "ev", gizli: true }] }));
  assert.equal(level.nesneler.dugum("n1")!.isEnabled(), false);
});

test("tıklanan mesh'ten yerleşim kimliği bulunur", async () => {
  const { level } = await kur(tanim([N("n7")]));
  assert.equal(level.nesneler.idsi(level.nesneler.meshleri("n7")[0]), "n7");
});

test("yükleme bitmeden silinen yerleşimin örneği sahnede kalmaz (sızıntı yok)", async () => {
  let birak!: () => void;
  const bekle = new Promise<void>((r) => { birak = r; });
  const gec: NesneYukleyici = async (ad, ust: TransformNode) => {
    await bekle;
    const m = new Mesh(`${ad}_gec`, ust.getScene()); m.parent = ust; return [m];
  };
  const sahne = new Scene(new NullEngine());
  const level = levelKur(sahne, tanim([N("n1")]), new Map(), undefined, { nesneYukleyici: gec });
  level.ayarla(tanim([]));
  birak();
  await level.nesneler.hazir();
  assert.equal(sahne.meshes.filter((m) => m.name === "A_gec" && !m.isDisposed()).length, 0);
});
