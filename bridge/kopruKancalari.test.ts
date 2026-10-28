// bridge/kopruKancalari.test.ts — kancaların Orion'u SUSTURAMAYACAĞI ve talimatı BOZAMAYACAĞI yerler.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { kancaDogrula, kancaTalimati, type KopruKancasi } from "./kopruKancalari.ts";

const b = { koken: "dis" as const, simdi: 0 };
const bak = { tur: "kalk" as const };
const sessiz = (f: () => void): void => { const w = console.warn; console.warn = () => {}; try { f(); } finally { console.warn = w; } };

test("talimat eki: boş/boşluk atılır, sıra korunur, satırla birleşir; kancasız boş metin", () => {
  const k = (ad: string, e: string | null): KopruKancasi => ({ ad, talimatEki: () => e });
  assert.equal(kancaTalimati([], b), "");
  assert.equal(kancaTalimati([k("a", "  BİR  "), k("b", null), k("c", "   "), k("d", "İKİ")], b), "BİR\nİKİ");
  assert.equal(kancaTalimati([{ ad: "yok" }], b), "");
});

test("talimat eki üretirken FIRLATAN kanca atlanır, ötekiler çalışır", () => {
  sessiz(() => {
    const kotu: KopruKancasi = { ad: "kotu", talimatEki: () => { throw new Error("x"); } };
    assert.equal(kancaTalimati([kotu, { ad: "iyi", talimatEki: () => "TAMAM" }], b), "TAMAM");
  });
});

test("doğrulama: ilk reddeden kazanır ve KİMLİĞİ bildirir; hiçbiri reddetmezse geçer", () => {
  const red = (ad: string, neden: string): KopruKancasi => ({ ad, niyetDogrula: () => ({ ok: false, neden }) });
  const gec: KopruKancasi = { ad: "gec", niyetDogrula: () => ({ ok: true }) };
  assert.deepEqual(kancaDogrula([gec, red("a", "n1"), red("b", "n2")], bak, b), { ok: false, neden: "n1", kanca: "a" });
  assert.deepEqual(kancaDogrula([gec, { ad: "yok" }], bak, b), { ok: true });
  assert.deepEqual(kancaDogrula([], bak, b), { ok: true });
});

test("doğrulama: FIRLATAN kanca niyeti GEÇİRİR (güvenli taraf), reddeden sonraki kanca yine reddeder", () => {
  sessiz(() => {
    const kotu: KopruKancasi = { ad: "kotu", niyetDogrula: () => { throw new Error("patladı"); } };
    assert.deepEqual(kancaDogrula([kotu], bak, b), { ok: true });
    assert.deepEqual(kancaDogrula([kotu, { ad: "r", niyetDogrula: () => ({ ok: false, neden: "n" }) }], bak, b), { ok: false, neden: "n", kanca: "r" });
  });
});

test("bağlam kancaya olduğu gibi geçer (koken + simdi)", () => {
  let gelen: unknown = null;
  kancaDogrula([{ ad: "g", niyetDogrula: (_n, bag) => { gelen = bag; return { ok: true }; } }], bak, { koken: "inisiyatif", simdi: 42 });
  assert.deepEqual(gelen, { koken: "inisiyatif", simdi: 42 });
});
