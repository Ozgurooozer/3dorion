// uygulama/gozPozlari.test.ts — V1 (spec 25 §7) V0'ın KARELERİNE bakıyor mu: pozlar tek kaynaktan, V0 kaydıyla aynı.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { odaPozlari, ovaPozlari } from "./gozPozlari.ts";
import { tumCapalar } from "../world/level/capalar.ts";

const V0 = path.resolve(import.meta.dirname, "..", "docs", "olcum", "goz-v0.jsonl");

test("oda pozları V0 kaydındakilerle birebir aynı (ad, konum, yön, sıra)", () => {
  const kayit = fs.readFileSync(V0, "utf8").trim().split("\n").map((s) => JSON.parse(s) as { model: string; poz: { yer: string } })
    .filter((s) => s.model === "gemma4:e2b" && s.poz.yer === "oda").map((s) => s.poz);
  assert.deepEqual(odaPozlari(tumCapalar()), kayit);
});

test("ova pozları: çıkış noktası dört yöne, merkez dört yöne, (15,-5) iki yöne", () => {
  const p = ovaPozlari({ x: 3, z: 7 });
  assert.deepEqual(p.map((x) => `${x.x},${x.z}`), [
    "3,7", "3,7", "3,7", "3,7", "0,0", "0,0", "0,0", "0,0", "15,-5", "15,-5",
  ]);
});

test("odada çapa eksikse poz sessizce düşmez", () => {
  assert.throws(() => odaPozlari(tumCapalar().filter((c) => c.ad !== "tahta")), /çapa yok: tahta/);
});
