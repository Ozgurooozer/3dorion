// world/avatar/koltuk.test.ts — OTURMA İZNİ: aynı sandalye iki bedene verilmez (spec 33 dilim 3). Babylon yüklenmez.
// Başsız deneme (2026-10-21) iki avatarın aynı sandalyeye AYNI noktaya oturduğunu gösterdi; kural yürütücüde, izin dışarıdan sorulur.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Yurutucu } from "./yurutucu.ts";
import type { NiyetSonucu } from "../../protocol/niyet.ts";

const DT = 1 / 20;

/** Niyet gönder, `tik` adım ilerlet, sonuçları topla. */
function kos(y: Yurutucu, n: Parameters<Yurutucu["niyet"]>[0], id: string, tik = 400): NiyetSonucu[] {
  y.niyet(n, id);
  const c: NiyetSonucu[] = [];
  for (let i = 0; i < tik; i++) c.push(...y.ilerle(DT));
  return c;
}

test("koltuk başkasındaysa otur hata döner ve sahibini söyler", () => {
  const y = new Yurutucu({ spawn: { x: 0.9, y: 0, z: -1.2 }, koltukDolu: () => "Orion" });
  const s = kos(y, { tur: "otur" }, "f1", 1);
  assert.match(s.find((x) => x.durum === "hata")?.not ?? "", /dolu: Orion orada/);
});

test("koltuk doluyken beden yürümeye başlamaz (konum değişmez)", () => {
  const y = new Yurutucu({ spawn: { x: 0.9, y: 0, z: -1.2 }, koltukDolu: () => "Orion" });
  kos(y, { tur: "otur" }, "f1", 60);
  assert.deepEqual(y.durum().konum, { x: 0.9, y: 0, z: -1.2 });
});

test("izin sorusu çapanın kanonik adıyla gelir (çapasız otur → sandalye)", () => {
  const sorulan: string[] = [];
  const y = new Yurutucu({ spawn: { x: 0.9, y: 0, z: -1.2 }, koltukDolu: (c) => { sorulan.push(c); return null; } });
  kos(y, { tur: "otur" }, "f1", 1);
  assert.deepEqual(sorulan, ["sandalye"]);
});

test("oturmaya GİDERKEN koltuk tutulur (öbür beden aynı sandalyeye yürümesin)", () => {
  const y = new Yurutucu({ spawn: { x: 0.9, y: 0, z: -1.2 } });
  kos(y, { tur: "otur" }, "f1", 1);
  assert.equal(y.koltugu(), "sandalye");
});

test("oturunca koltuk tutulmaya devam eder", () => {
  const y = new Yurutucu({ spawn: { x: 0.9, y: 0, z: -1.2 } });
  const s = kos(y, { tur: "otur" }, "f1");
  assert.deepEqual([s.some((x) => x.niyet_id === "f1" && x.durum === "bitti"), y.koltugu()], [true, "sandalye"]);
});

test("kalkınca koltuk bırakılır", () => {
  const y = new Yurutucu({ spawn: { x: 0.9, y: 0, z: -1.2 } });
  kos(y, { tur: "otur" }, "f1");
  kos(y, { tur: "kalk" }, "f2");
  assert.equal(y.koltugu(), null);
});

test("oturma işi iptal edilince (dur) koltuk bırakılır", () => {
  const y = new Yurutucu({ spawn: { x: 0.9, y: 0, z: -1.2 } });
  kos(y, { tur: "otur" }, "f1", 2);
  kos(y, { tur: "dur" }, "f2", 1);
  assert.equal(y.koltugu(), null);
});

test("izin verilmezse (tek beden) eski davranış: oturur", () => {
  const y = new Yurutucu({ spawn: { x: 0.9, y: 0, z: -1.2 } });
  kos(y, { tur: "otur" }, "f1");
  assert.equal(y.durum().oturuyor_mu, true);
});
