// bridge/eylemSirasi.test.ts — Eylem sırası tek başına (spec 14 R2). Köprü üzerinden sınaması
// bridge/kopruEylem.test.ts'te; burası sınıfın kendi sözleşmesi.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { EylemSirasi, type SiraAdimi } from "./eylemSirasi.ts";
import type { Niyet } from "../protocol/niyet.ts";

const adim = (id: string, n: Niyet): SiraAdimi => ({ id, niyet: n });
const GIT = adim("a", { tur: "git", hedef: { tip: "capa", ad: "tahta" } });
const YAZ = adim("b", { tur: "yaz", metin: "x" });
const OTUR = adim("c", { tur: "otur" });

function kur(zamanAsimiMs = 1000) {
  const giden: string[] = [];
  const s = new EylemSirasi({ gonder: (_n, id) => giden.push(id), zamanAsimiMs: () => zamanAsimiMs });
  return { s, giden };
}

test("tek adım hemen gider, sıra sürmez", () => {
  const { s, giden } = kur();
  s.baslat([GIT]);
  assert.deepEqual({ giden, suruyor: s.suruyor }, { giden: ["a"], suruyor: false });
});

test("birden çok adım: yalnız ilki gider, bitti gelince sıradaki", () => {
  const { s, giden } = kur();
  s.baslat([GIT, YAZ, OTUR]);
  const once = [...giden];
  s.sonuc({ niyet_id: "a", durum: "bitti" });
  assert.deepEqual([once, giden], [["a"], ["a", "b"]]);
});

test("son adım bitince sıra kapanır", () => {
  const { s } = kur();
  s.baslat([GIT, YAZ]);
  s.sonuc({ niyet_id: "a", durum: "bitti" });
  s.sonuc({ niyet_id: "b", durum: "bitti" });
  assert.equal(s.suruyor, false);
});

test("hata sırayı keser, kalan gitmez", () => {
  const { s, giden } = kur();
  s.baslat([GIT, YAZ]);
  s.sonuc({ niyet_id: "a", durum: "hata", not: "yol yok" });
  assert.deepEqual({ giden, suruyor: s.suruyor }, { giden: ["a"], suruyor: false });
});

test("'basladi' ve başka niyetin sonucu sırayı ilerletmez", () => {
  const { s, giden } = kur();
  s.baslat([GIT, YAZ]);
  s.sonuc({ niyet_id: "a", durum: "basladi" });
  s.sonuc({ niyet_id: "z", durum: "bitti" });
  assert.deepEqual(giden, ["a"]);
});

test("yeni başlatma süren sırayı keser", () => {
  const { s, giden } = kur();
  s.baslat([GIT, YAZ]);
  s.baslat([OTUR]);
  s.sonuc({ niyet_id: "a", durum: "bitti" });
  assert.deepEqual(giden, ["a", "c"]);
});

test("zaman aşımında kalan adımlar düşer", async () => {
  const { s, giden } = kur(30);
  s.baslat([GIT, YAZ]);
  await new Promise((r) => setTimeout(r, 60));
  s.sonuc({ niyet_id: "a", durum: "bitti" });
  assert.deepEqual({ giden, suruyor: s.suruyor }, { giden: ["a"], suruyor: false });
});

test("sonuç gönderim sırasında SENKRON gelse de yakalanır", () => {
  let s: EylemSirasi;
  const giden: string[] = [];
  s = new EylemSirasi({
    gonder: (_n, id) => { giden.push(id); s.sonuc({ niyet_id: id, durum: "bitti" }); },
    zamanAsimiMs: () => 1000,
  });
  s.baslat([GIT, YAZ, OTUR]);
  assert.deepEqual(giden, ["a", "b", "c"]);
});
