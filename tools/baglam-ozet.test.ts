// tools/baglam-ozet.test.ts — Bağlam özetinin sayımı (spec 16 P1/P6).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ozetle } from "./baglam-ozet.ts";
import type { KararSatiri } from "../mind/kararKaydi.ts";

const olcu = (toplam: number) => ({ talimat: 1, sabit: 0, araclar: 1, ornekler: 0, gecmis: 0, gecmisKayit: 0, dunya: 0, anilar: 0, ozetler: 0, toplam });
const algi = (id: string, tur: string) => ({ tur: "algi", o: "o1", id, t: 1, algi: tur, ozet: "", kapi: { gecti: true, kural: "kopru.konusma" } });
const uyanis = (id: string, algilar: string[], toplam: number, ek: Record<string, unknown> = {}) =>
  ({ tur: "uyanis", o: "o1", id, t: 1, algilar, geriBesleme: 0, beyin: "x", sureMs: 1, koken: "dis", takip: false,
    anilar: 0, dunya: "You: duruyor.", cagrilar: [], niyetler: [], reddedilen: 0, kurtarilan: 0, konusulanMetin: false,
    yutulanSoz: 0, baglam: olcu(toplam), ...ek });

const SATIRLAR = [
  algi("a1", "duydum"), algi("a2", "olay"), algi("a3", "duydum"), algi("a4", "duydum"),
  uyanis("u1", ["a1"], 100), uyanis("u2", ["a2"], 999), uyanis("u3", ["a3"], 300), uyanis("u4", ["a4"], 200),
] as unknown as KararSatiri[];

test("yalnız konuşma uyanışları sayılır (olay uyanışı dışarıda)", () => {
  assert.equal(ozetle("x", SATIRLAR).konusmaUyanisi, 3);
});

test("medyan toplam konuşma uyanışlarından", () => {
  assert.equal(ozetle("x", SATIRLAR).medyanToplam, 200);
});

test("P6: istek boşken anı giren uyanış ihlaldir", () => {
  const s = [algi("a1", "duydum"), uyanis("u1", ["a1"], 1, { hafizaIstegi: [], anilar: 1 })] as unknown as KararSatiri[];
  assert.equal(ozetle("x", s).p6Ihlal, 1);
});

test("P6: istek boşken durum satırı giren uyanış ihlaldir", () => {
  const s = [algi("a1", "duydum"), uyanis("u1", ["a1"], 1, { hafizaIstegi: [], dunya: "You: duruyor.\nYou are at: pencere (arrived just now)." })] as unknown as KararSatiri[];
  assert.equal(ozetle("x", s).p6Ihlal, 1);
});

test("P6: istenen durum satırı ihlal değildir", () => {
  const s = [algi("a1", "duydum"), uyanis("u1", ["a1"], 1, { hafizaIstegi: ["konum.simdi"], dunya: "You are at: pencere (arrived just now)." })] as unknown as KararSatiri[];
  assert.equal(ozetle("x", s).p6Ihlal, 0);
});
