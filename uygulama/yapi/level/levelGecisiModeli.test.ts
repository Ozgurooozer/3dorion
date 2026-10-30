// uygulama/yapi/level/levelGecisiModeli.test.ts — açılış level'ı olabilir mi (spec 42 2. aşama): zeminsiz ve bozuk level reddedilir, şablonlar gerçek ofis yerleştirmesinden geçer.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ofisiOvayaKur } from "../../../world/level/ofisYeri.ts";
import { levelTanimiDogrula } from "../../../world/level/cekirdek/levelTanimi.ts";
import { ornekTanim } from "../../../world/level/cekirdek/ornekTanim.ts";
import { gecisiDegerlendir } from "./levelGecisiModeli.ts";

const sablon = (ad: string): unknown => JSON.parse(fs.readFileSync(new URL(`../../../world/level/sablon/${ad}.level.json`, import.meta.url), "utf8")) as unknown;

/** `ornekTanim` tek katmanlı ve zeminsiz: geçişi sınamak için zemin katmanı eklenir. */
const zeminli = (): ReturnType<typeof ornekTanim> => {
  const t = ornekTanim();
  t.katmanlar = [...t.katmanlar.filter((k) => k.tur !== "zemin"), { tur: "zemin", ad: "zemin", acik: true, ayar: {} }];
  return t;
};

test("zeminli level geçer; özet ışık/nesne/katman sayısını verir", () => {
  const t = zeminli();
  t.nesneler = [{ id: "n1", varlik: "kit/agac.glb", konum: [0, 0, 0], donus: 0, olcek: 1 }, { id: "n2", varlik: "kit/agac.glb", konum: [1, 0, 0], donus: 0, olcek: 1 }];
  t.isiklar = [{ id: "i1", ad: "Lamba", tur: "nokta", konum: [0, 2, 0], renk: "#ffffff", siddet: 1, menzil: 10 }];
  const r = gecisiDegerlendir(t);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual([r.ad, r.isik, r.nesne, r.katman], [t.ad, 1, 2, t.katmanlar.length]);
});

test("zemin katmanı yok → reddedilir ve NEDEN söylenir (ofis zemine gömülür)", () => {
  const t = zeminli();
  t.katmanlar = t.katmanlar.filter((k) => k.tur !== "zemin");
  const r = gecisiDegerlendir(t);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.neden, /zemin katmanı yok/);
});

test("bozuk tanım (nesne olmayan, eksik alan) reddedilir; neden 'bozuk' der", () => {
  for (const ham of [null, 5, "x", [], {}, { ad: "x" }]) {
    const r = gecisiDegerlendir(ham);
    assert.equal(r.ok, false, JSON.stringify(ham));
    if (!r.ok) assert.match(r.neden, /bozuk/);
  }
});

test("TUTARLILIK: model 'geçer' diyorsa ofis yerleştirmesi fırlatmaz; 'zemin yok' diyorsa fırlatır (iki kural ayrışırsa kırılır)", () => {
  const zeminsiz = zeminli(); zeminsiz.katmanlar = zeminsiz.katmanlar.filter((k) => k.tur !== "zemin");
  const adaylar: [string, unknown][] = [["zeminli örnek", zeminli()], ["bos", sablon("bos")], ["duz-zemin", sablon("duz-zemin")], ["tamamen-bos", sablon("tamamen-bos")], ["zeminsiz örnek", zeminsiz]];
  for (const [ad, ham] of adaylar) {
    const g = gecisiDegerlendir(ham);
    const d = levelTanimiDogrula(ham);
    assert.equal(d.ok, true, `${ad}: şablon geçerli level`);
    let fırlattı = false;
    if (d.ok) { try { ofisiOvayaKur(d.deger); } catch { fırlattı = true; } }
    assert.equal(g.ok, !fırlattı, `${ad}: model=${g.ok} ofisYerleştirme fırlattı=${fırlattı}`);
  }
});

test("şablonlar: Boş ova ve Düz zemin geçer, Tamamen boş reddedilir (Ozyn'in kararı)", () => {
  assert.equal(gecisiDegerlendir(sablon("bos")).ok, true);
  assert.equal(gecisiDegerlendir(sablon("duz-zemin")).ok, true);
  const t = gecisiDegerlendir(sablon("tamamen-bos"));
  assert.equal(t.ok, false);
});
