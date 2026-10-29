// world/level/sablon/sablon.test.ts — Yeni level şablonlarının İÇERİK sözü (spec 42 Y1): "düz zemin" gerçekten düz, "tamamen boş" gerçekten boş.
//
// `leveller.test.ts` şablonun GEÇERLİ olduğunu söyler; burada kullanıcıya verilen söz sınanır (düz zemin adını taşıyıp arazi dalgası içermesin).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { levelTanimiDogrula, type LevelTanimi } from "../cekirdek/levelTanimi.ts";
import { ayarBirlestir } from "../cekirdek/modul.ts";
import { MODULLER } from "../moduller/index.ts";
import { ZEMIN_VARSAYILAN, zeminYuksekligi, zeminRenkAdi, type ZeminAyari } from "../moduller/zemin.ts";

const KOK = path.dirname(fileURLToPath(import.meta.url));
const oku = (ad: string): LevelTanimi => {
  const d = levelTanimiDogrula(JSON.parse(fs.readFileSync(path.join(KOK, `${ad}.level.json`), "utf8")) as unknown);
  if (!d.ok) throw new Error(d.hata);
  return d.deger;
};
const zeminAyari = (t: LevelTanimi): ZeminAyari => {
  const k = t.katmanlar.find((x) => x.tur === "zemin");
  assert.ok(k, "zemin katmanı yok");
  return ayarBirlestir("zemin", MODULLER.get("zemin")!.varsayilan, k.ayar) as ZeminAyari;
};

test("düz zemin: her yerde yükseklik 0 (arazi dalgası yok) ve tek renk", () => {
  const a = zeminAyari(oku("duz-zemin"));
  const y = zeminYuksekligi(a);
  for (const [x, z] of [[0, 0], [10, -7], [55, 80], [-120, 33], [250, 250], [-30, -32]] as const) assert.ok(Math.abs(y(x, z)) < 1e-9, `(${x}, ${z}) → ${y(x, z)}`);
  const renkler = new Set([[0, 0], [60, 10], [-90, 40], [200, -200]].map(([x, z]) => zeminRenkAdi(a, x!, z!)));
  assert.equal(renkler.size, 1, [...renkler].join(","));
});

test("düz zemin: çim, bulut, kaya, parçacık yok; gök ve güneş var", () => {
  const t = oku("duz-zemin").katmanlar.map((k) => k.tur);
  for (const yok of ["cim", "bulut", "kaya", "su", "parcacik", "dekor", "uzakArazi"]) assert.ok(!t.includes(yok), yok);
  assert.ok(t.includes("gok") && t.includes("gunesDiski"), t.join(","));
});

test("düz zemin ile boş ova ayrı: boş ovanın zemini dalgalı", () => {
  const dalgali = zeminYuksekligi({ ...ZEMIN_VARSAYILAN, ...zeminAyari(oku("bos")) });
  let enAz = Infinity, enCok = -Infinity;
  for (let x = -300; x <= 300; x += 15) for (let z = -300; z <= 300; z += 15) { const v = dalgali(x, z); enAz = Math.min(enAz, v); enCok = Math.max(enCok, v); }
  assert.ok(enCok - enAz > 0.5, `${enAz}..${enCok}`);
});

test("tamamen boş: katman yok, geçerli tanım, ışık ve ortam var", () => {
  const t = oku("tamamen-bos");
  assert.deepEqual(t.katmanlar, []);
  assert.ok((t.nesneler ?? []).length === 0);
  assert.ok(t.isik.gunes.siddet > 0 && t.isik.dolgu.siddet > 0);
});

test("üç şablonun görünen adları ayrı ve Türkçe", () => {
  assert.deepEqual(["bos", "duz-zemin", "tamamen-bos"].map((a) => oku(a).ad), ["boş ova", "düz zemin", "tamamen boş"]);
});
