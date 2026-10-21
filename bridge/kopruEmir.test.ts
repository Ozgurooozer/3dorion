// bridge/kopruEmir.test.ts — Orion → Flash emri (spec 33): `dunya_emret` aracı YALNIZ emir verilecek bir ajan varken sunulur; model çağırırsa niyet olarak yürür.
//
// Neden koşullu: araç her turun sabit maliyetine ~88 token ekler ve yerel modelin araç seçimini kalabalıklaştırır. Flash yokken (`?flashsiz`, senaryo koşuları)
// Orion'un araç yüzeyi Flash'tan ÖNCEKİYLE birebir aynı kalmalı: ölçüm koşuları (`eylem-olc`, `*dene`) bozulmasın.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import { OZERK_ARACLAR, araclariUret } from "./araclar.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { KARAR_ONEKI, KararKaydi } from "../mind/kararKaydi.ts";

class YakalayanBeyin implements Beyin {
  readonly ad = "yakalayan";
  gordugu: BeyinGirdisi[] = [];
  private readonly cevap: BeyinCikti;
  constructor(cevap: BeyinCikti = { metin: "", cagrilar: [] }) { this.cevap = cevap; }
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> { this.gordugu.push(structuredClone(g)); return structuredClone(this.cevap); }
}
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

function kur(beyin: Beyin, ek: Record<string, unknown> = {}) {
  const gonderilen: Niyet[] = [];
  const k = new Kopru({
    beyin, toplamaMs: 5, dunyaDurumu: () => "oda",
    niyetGonder: (n) => { gonderilen.push(n); },
    kararKaydi: new KararKaydi({ yaz: (s) => { void s.slice(KARAR_ONEKI.length); } }),
    ...ek,
  });
  return { k, gonderilen };
}
const adlar = (g: BeyinGirdisi) => g.araclar.map((a) => a.ad);
const ozynSozu = { tur: "duydum" as const, metin: "Flash'a otur de", kesin: true };

test("Flash YOKKEN (emirHedefleri verilmedi) Ozyn turunda dunya_emret sunulmaz: araç yüzeyi Flash'tan öncekiyle aynı", async () => {
  const b = new YakalayanBeyin();
  const { k } = kur(b);
  k.algi(ozynSozu);
  await bekle(60);
  assert.deepEqual([adlar(b.gordugu[0]!).includes("dunya_emret"), b.gordugu[0]!.araclar.length], [false, araclariUret().length - 1]);
});

test("emir hedefi listesi BOŞSA da sunulmaz (Flash kapandı ya da henüz yüklenmedi)", async () => {
  const b = new YakalayanBeyin();
  const { k } = kur(b, { emirHedefleri: () => [] });
  k.algi(ozynSozu);
  await bekle(60);
  assert.equal(adlar(b.gordugu[0]!).includes("dunya_emret"), false);
});

test("Flash VARKEN Ozyn turunda dunya_emret sunulur (tüm araçlar)", async () => {
  const b = new YakalayanBeyin();
  const { k } = kur(b, { emirHedefleri: () => ["flash"] });
  k.algi(ozynSozu);
  await bekle(60);
  assert.deepEqual([adlar(b.gordugu[0]!).includes("dunya_emret"), b.gordugu[0]!.araclar.length], [true, araclariUret().length]);
});

test("emir hedefi çağrı ANINDA okunur: Flash sonradan yüklenince sonraki tur aracı görür", async () => {
  const b = new YakalayanBeyin();
  let hedefler: string[] = [];
  const { k } = kur(b, { emirHedefleri: () => hedefler });
  k.algi(ozynSozu);
  await bekle(60);
  hedefler = ["flash"];
  k.algi({ ...ozynSozu, metin: "şimdi dene" });
  await bekle(60);
  assert.deepEqual(b.gordugu.map((g) => adlar(g).includes("dunya_emret")), [false, true]);
});

test("ÖZERK turda (kendiliğinden uyanış) Flash varken bile dunya_emret sunulmaz: Ozyn yokken kimseye emir verilmez", async () => {
  const b = new YakalayanBeyin();
  const { k } = kur(b, { emirHedefleri: () => ["flash"] });
  k.algi({ tur: "olay", ad: "nobody has spoken for 15 minutes", ayrinti: { kaynak: "inisiyatif", neden: "sessizlik", derinlik: 0 } });
  await bekle(60);
  assert.deepEqual([...adlar(b.gordugu[0]!)].sort(), [...OZERK_ARACLAR].sort());
});

test("model dunya_emret çağırırsa niyet {emret, flash, otur} olarak yürür", async () => {
  const b = new YakalayanBeyin({ metin: "", cagrilar: [{ ad: "dunya_emret", girdi: { kime: "Flash", soz: "otur" } }] });
  const { k, gonderilen } = kur(b, { emirHedefleri: () => ["flash"] });
  k.algi(ozynSozu);
  await bekle(80);
  assert.deepEqual(gonderilen.filter((n) => n.tur === "emret"), [{ tur: "emret", kime: "flash", soz: "otur" }]);
});

test("Flash yokken model dunya_emret çağırsa bile niyet YÜRÜMEZ (araç sunulmadığı için reddedilir)", async () => {
  const b = new YakalayanBeyin({ metin: "", cagrilar: [{ ad: "dunya_emret", girdi: { kime: "flash", soz: "otur" } }] });
  const { k, gonderilen } = kur(b);
  k.algi(ozynSozu);
  await bekle(80);
  assert.deepEqual(gonderilen.filter((n) => n.tur === "emret"), []);
});
