// bridge/kopruMd.test.ts — Köprü + md dosyaları (spec 32): aktif notlar talimatın SONUNA eklenir; boşsa hiçbir şey değişmez; okuma hatası turu düşürmez.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";

class KayitBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> { this.gordugu.push(structuredClone(g)); return { metin: "", cagrilar: [] }; }
}
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

function kur(ek: Record<string, unknown> = {}) {
  const beyin = new KayitBeyin();
  const k = new Kopru({ beyin, dunyaDurumu: () => "Oda.", toplamaMs: 20, simdi: () => 1_000, hafizaGetirme: 0, niyetGonder: () => {}, ...ek });
  return { k, beyin };
}
const sor = async (k: Kopru) => { k.algi({ tur: "duydum", metin: "merhaba", kesin: true }); await bekle(120); };

test("mdBaglami verilmezse talimat DEĞİŞMEZ (yeni seçenek eski davranışı bozmaz)", async () => {
  const bos = kur();
  await sor(bos.k);
  const notlu = kur({ mdBaglami: () => "" });
  await sor(notlu.k);
  assert.equal(notlu.beyin.gordugu[0]!.talimat, bos.beyin.gordugu[0]!.talimat);
});

test("mdBaglami metni talimatın SONUNA eklenir (kimlik ve kurallar önce, notlar onları geçersiz kılamaz)", async () => {
  const bos = kur();
  await sor(bos.k);
  const temel = bos.beyin.gordugu[0]!.talimat ?? "";
  const { k, beyin } = kur({ mdBaglami: () => "NOTES — deneme\n\n## persona.md\nKısa konuş." });
  await sor(k);
  const t = beyin.gordugu[0]!.talimat ?? "";
  assert.ok(t.startsWith(temel), "temel talimat başta ve aynen");
  assert.ok(t.endsWith("## persona.md\nKısa konuş."));
  assert.equal(t, `${temel}\n\nNOTES — deneme\n\n## persona.md\nKısa konuş.`);
});

test("mdBaglami her turda ANINDA okunur: dosya değişince sonraki tur yeni notu görür", async () => {
  let not = "NOTES — bir";
  const { k, beyin } = kur({ mdBaglami: () => not });
  await sor(k);
  not = "NOTES — iki";
  await sor(k);
  assert.ok(beyin.gordugu[0]!.talimat?.endsWith("NOTES — bir"));
  assert.ok(beyin.gordugu[1]!.talimat?.endsWith("NOTES — iki"));
});

test("mdBaglami fırlatırsa tur düşmez: notsuz devam edilir ve uyarı basılır", async () => {
  const uyarilar: unknown[][] = [];
  const eski = console.warn; console.warn = (...a: unknown[]) => { uyarilar.push(a); };
  try {
    const bos = kur();
    await sor(bos.k);
    const { k, beyin } = kur({ mdBaglami: () => { throw new Error("disk okunamadı"); } });
    await sor(k);
    assert.equal(beyin.gordugu.length, 1);
    assert.equal(beyin.gordugu[0]!.talimat, bos.beyin.gordugu[0]!.talimat);
    assert.ok(uyarilar.some((u) => String(u[0]).includes("[MD]")));
  } finally { console.warn = eski; }
});
