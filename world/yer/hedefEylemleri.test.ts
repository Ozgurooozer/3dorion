// world/yer/hedefEylemleri.test.ts — zemin ve Orion menüleri: ne sunulur, yürünemez nokta nedenli gri.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { zeminEylemleri, orionEylemleri, orionOzellikleri } from "./hedefEylemleri.ts";
import type { YurumeAlani } from "./yer.ts";

const alan: YurumeAlani = {
  sinir: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
  engeller: [{ x: 5, y: 0, z: 5, g: 2, yuk: 1, d: 2 }],
};
const orion = { oturuyor: false, poz: "ayakta", mesgul: false, elinde: null, konum: { x: 1, z: 2 } };

test("zemin: açık noktada 'Buraya git' ve 'Buraya bak' uygun; git niyeti o noktayı hedefler", () => {
  const [git, bak] = zeminEylemleri({ x: 1, y: 0, z: 2 }, alan);
  assert.deepEqual([git!.ad, git!.uygun, bak!.ad, bak!.uygun], ["Buraya git", true, "Buraya bak", true]);
  assert.deepEqual(git!.niyet, { tur: "git", hedef: { tip: "nokta", x: 1, y: 0, z: 2 } });
});

test("zemin: engelin içindeki nokta 'git' için gri ve NEDENLİ; 'bak' yine uygun", () => {
  const [git, bak] = zeminEylemleri({ x: 5, y: 0, z: 5 }, alan);
  assert.equal(git!.uygun, false);
  assert.match(git!.neden!, /engel/);
  assert.equal(typeof git!.soz, "string");
  assert.equal(bak!.uygun, true);
});

test("zemin: sınır dışı nokta gri ve nedeni 'alanın dışında'", () => {
  const [git] = zeminEylemleri({ x: 50, y: 0, z: 0 }, alan);
  assert.equal(git!.uygun, false);
  assert.match(git!.neden!, /dışında/);
});

test("Orion: ayakta 'Kalk' sunulmaz, oturuyorsa sunulur", () => {
  assert.equal(orionEylemleri(orion).some((e) => e.kimlik === "orion.kalk"), false);
  assert.equal(orionEylemleri({ ...orion, oturuyor: true }).some((e) => e.kimlik === "orion.kalk"), true);
});

test("Orion: yanıma gel = oyuncuya git, bana bak = oyuncuya bak, dur = dur", () => {
  const e = Object.fromEntries(orionEylemleri(orion).map((x) => [x.kimlik, x.niyet]));
  assert.deepEqual(e["orion.gel"], { tur: "git", hedef: { tip: "oyuncu" } });
  assert.deepEqual(e["orion.banabak"], { tur: "bak", hedef: { tip: "oyuncu" } });
  assert.deepEqual(e["orion.dur"], { tur: "dur" });
});

test("Orion: bütün eylemlerin kimliği benzersiz ve hepsi Orion eylemi", () => {
  const l = orionEylemleri({ ...orion, oturuyor: true });
  assert.equal(new Set(l.map((e) => e.kimlik)).size, l.length);
  assert.ok(l.every((e) => e.kim === "orion" && e.uygun));
});

test("Orion özellikleri: oturuyorsa poz 'oturuyor' yazar", () => {
  assert.deepEqual(orionOzellikleri({ ...orion, oturuyor: true })[0], ["Poz", "oturuyor"]);
});
