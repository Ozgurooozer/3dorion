// world/level/editor/cekirdek/kurtarma.test.ts — Çökme kurtarması kararları (spec 23 A).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ornekTanim } from "../../cekirdek/ornekTanim.ts";
import type { LevelTanimi } from "../../cekirdek/levelTanimi.ts";
import { kurtarmaKaydi, kurtarmaOnerisi, tanimImzasi } from "./kurtarma.ts";

const dosya = (): LevelTanimi => ({ ...ornekTanim(), nesneler: [] });
const degismis = (): LevelTanimi => ({ ...dosya(), nesneler: [{ id: "n1", varlik: "A", konum: [0, 0, 0], donus: 0, olcek: 1 }] });
const kayit = (tanim: LevelTanimi, temel = tanimImzasi(dosya())) => ({ surum: 1, zaman: 5, tanim, temel });

test("kopya dosyadan farklıysa öneri çıkar", () => { assert.ok(kurtarmaOnerisi(kayit(degismis()), dosya())); });
test("kopya dosyayla aynıysa öneri çıkmaz (kaydedilmiş)", () => { assert.equal(kurtarmaOnerisi(kayit(dosya()), dosya()), null); });
test("öneri nesne farkını söyler", () => { assert.equal(kurtarmaOnerisi(kayit(degismis()), dosya())?.nesneFarki, 1); });
test("dosya kopyadan sonra başka yerden kaydedildiyse uyarılır", () => {
  assert.equal(kurtarmaOnerisi(kayit(degismis(), "eski-imza"), dosya())?.dosyaDegisti, true);
});
test("dosya değişmediyse uyarı yok", () => { assert.equal(kurtarmaOnerisi(kayit(degismis()), dosya())?.dosyaDegisti, false); });
test("bozuk kayıt öneri üretmez (sessizce yok sayılır)", () => { assert.equal(kurtarmaOnerisi({ surum: 1, zaman: 1, temel: "x", tanim: { bozuk: true } }, dosya()), null); });
test("kayıt yoksa öneri yok", () => { assert.equal(kurtarmaOnerisi(null, dosya()), null); });
test("kirli değilken kopya yazılmaz (silinir)", () => { assert.equal(kurtarmaKaydi(dosya(), false, "t", 1), null); });
test("kirliyken kopya yazılır", () => { assert.equal(kurtarmaKaydi(degismis(), true, "t", 1)?.tanim.nesneler?.length, 1); });
