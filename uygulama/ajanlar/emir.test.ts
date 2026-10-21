// uygulama/ajanlar/emir.test.ts — Orion → başka ajan emri: teslim, kendine emir yok, olmayan ajan nedenli ret, hitap, hata yalıtımı.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import type { Algi } from "../../protocol/algi.ts";
import { AjanDefteri, type AjanKaydi } from "./ajanKaydi.ts";
import { emirHedefleri, emirTeslim } from "./emir.ts";

function ajan(id: string, ek: Partial<AjanKaydi> = {}): AjanKaydi & { gelen: Algi[] } {
  const gelen: Algi[] = [];
  return { id, ad: id[0]!.toUpperCase() + id.slice(1), renk: "#ffffff", kume: null, algi: (a) => { gelen.push(a); }, gelen, ...ek };
}
function defter(...ajanlar: AjanKaydi[]) {
  const d = new AjanDefteri();
  for (const a of ajanlar) d.kaydet(a);
  return d;
}

test("emir hedefleri: Orion HARİÇ kayıtlı ajanlar (araç bunlar varken sunulur)", () => {
  assert.deepEqual(emirHedefleri(defter(ajan("orion"), ajan("flash"))), ["flash"]);
  assert.deepEqual(emirHedefleri(defter(ajan("orion"))), []);
});

test("teslim: komut ajanın girdisine Ozyn'in yazdığı gibi (kesin, klavye) gider ve 'Delivered' döner", () => {
  const f = ajan("flash");
  const r = emirTeslim(defter(ajan("orion"), f), "flash", "otur");
  assert.deepEqual([r, f.gelen], [{ ok: true, not: "Delivered to Flash." }, [{ tur: "duydum", metin: "otur", kesin: true, kaynak: "klavye" }]]);
});

test("Orion KENDİNE emredemez: ret nedenli, kimse bir şey almaz", () => {
  const o = ajan("orion"), f = ajan("flash");
  const r = emirTeslim(defter(o, f), "orion", "otur");
  assert.deepEqual([r.ok, r.not, o.gelen.length + f.gelen.length], [false, "you cannot command yourself", 0]);
});

test("olmayan ajan: ret, kimlerin olduğunu söyler (model kendini düzeltebilsin)", () => {
  const r = emirTeslim(defter(ajan("orion"), ajan("flash")), "bob", "otur");
  assert.deepEqual([r.ok, r.not], [false, 'no character named "bob" (available: flash)']);
});

test("hiç başka ajan yokken: ret 'none available' der", () => {
  assert.match(emirTeslim(defter(ajan("orion")), "flash", "otur").not, /none available/);
});

test("hitap ayıklayan ajanda ('Flash otur') emir de aynı kapıdan geçer: ajana 'otur' gider; ayıklamayana AYNEN", () => {
  const f = ajan("flash", { hitapAyiklar: true }), g = ajan("gizem");
  const d = defter(ajan("orion"), f, g);
  emirTeslim(d, "flash", "Flash, otur");
  emirTeslim(d, "gizem", "Gizem, otur");
  assert.deepEqual([f.gelen[0]?.tur === "duydum" ? f.gelen[0].metin : "", g.gelen[0]?.tur === "duydum" ? g.gelen[0].metin : ""], ["otur", "Gizem, otur"]);
});

test("ajanın girdisi FIRLATIRSA emir reddedilir ve nedeni söylenir (Orion'un turu çökmez)", () => {
  const bozuk = ajan("flash", { algi: () => { throw new Error("köprü kapalı"); } });
  const r = emirTeslim(defter(ajan("orion"), bozuk), "flash", "otur");
  assert.deepEqual([r.ok, r.not], [false, "Flash could not take the command: köprü kapalı"]);
});
