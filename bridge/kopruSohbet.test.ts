// bridge/kopruSohbet.test.ts — Sohbet kipleri köprüde (spec 16 F5b, içgüdü `kopru.sohbet`).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import { KARAR_ONEKI, KararKaydi, type AlgiSatiri, type KararSatiri, type UyanisSatiri } from "../mind/kararKaydi.ts";
import { SOHBET_ONAYI } from "../mind/sohbetKipi.ts";

class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> { this.gordugu.push(structuredClone(g)); return { metin: "", cagrilar: [] }; }
}
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

function kur(ek: Record<string, unknown> = {}) {
  const satirlar: KararSatiri[] = [];
  const b = new SahteBeyin();
  const k = new Kopru({ komutYetkisi: false, beyin: b, niyetGonder: () => {}, dunyaDurumu: () => "oda", toplamaMs: 5,
    kararKaydi: new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))) }), ...ek });
  const soylenen: string[] = [];
  k.konusmaDinle((m) => soylenen.push(m));
  const soyle = async (metin: string) => { k.algi({ tur: "duydum", metin, kesin: true }); await bekle(25); };
  const algilar = () => satirlar.filter((s): s is AlgiSatiri => s.tur === "algi");
  const uyanislar = () => satirlar.filter((s): s is UyanisSatiri => s.tur === "uyanis");
  return { k, b, soyle, soylenen, algilar, uyanislar };
}

test("sohbet eylemi LLM'i uyandırmaz", async () => {
  const { b, soyle } = kur();
  await soyle("yeni sohbet");
  assert.equal(b.gordugu.length, 0);
});

test("sohbet eylemi kayda kopru.sohbet kuralıyla yazılır", async () => {
  const { soyle, algilar } = kur();
  await soyle("Yeni sohbet!");
  assert.equal(algilar().at(-1)?.kapi.kural, "kopru.sohbet");
});

test("Orion eylemi sabit cümleyle onaylar", async () => {
  const { soyle, soylenen } = kur();
  await soyle("temiz sohbet");
  assert.deepEqual(soylenen, [SOHBET_ONAYI.temiz]);
});

test("yeni sohbet: önceki konuşma modele gitmez", async () => {
  const { b, soyle } = kur();
  await soyle("eski konu");
  await soyle("yeni sohbet");
  await soyle("merhaba");
  assert.deepEqual(b.gordugu.at(-1)?.gecmis.map((g) => g.metin), ["merhaba"]);
});

test("yeni sohbet: uzun hafıza kalır", async () => {
  const { k, soyle } = kur();
  await soyle("terminal süzgeci üzerinde çalışıyorum");
  await soyle("yeni sohbet");
  assert.equal(k.hafiza.sayi, 1);
});

test("temiz sohbet: ilgili anı bile bağlama girmez (otomatik kipte de)", async () => {
  const { k, b, soyle } = kur({ hafizaGetirme: 3 });
  k.hafiza.ekle("terminal süzgeci hakkında konuştuk", "konusma", 8);
  await soyle("temiz sohbet");
  await soyle("terminal süzgeci ne oldu");
  assert.deepEqual(b.gordugu.at(-1)?.anilar, []);
});

test("temiz sohbet: söz hafızaya yazılmaz", async () => {
  const { k, soyle } = kur();
  await soyle("temiz sohbet");
  await soyle("gizli bir şey söylüyorum");
  assert.equal(k.hafiza.sayi, 0);
});

test("temiz sohbet: durum defterinin söz satırları değişmez", async () => {
  const { k, soyle } = kur();
  await soyle("ilk söz");
  await soyle("temiz sohbet");
  await soyle("gizli söz");
  assert.equal(k.durum.oku("son_ozyn")?.deger, "ilk söz");
});

test("temiz sohbet: kendi sözleri pencerede kalır (sohbet içinde süreklilik)", async () => {
  const { b, soyle } = kur();
  await soyle("temiz sohbet");
  await soyle("bir"); await soyle("iki");
  assert.deepEqual(b.gordugu.at(-1)?.gecmis.map((g) => g.metin), ["bir", "iki"]);
});

test("temiz sohbetten çıkınca o sohbet pencereye sızmaz", async () => {
  const { b, soyle } = kur();
  await soyle("temiz sohbet");
  await soyle("gizli");
  await soyle("normal sohbet");
  await soyle("açık söz");
  assert.deepEqual(b.gordugu.at(-1)?.gecmis.map((g) => g.metin), ["açık söz"]);
});

test("temiz sohbetteki uyanış kayıtta işaretlidir", async () => {
  const { soyle, uyanislar } = kur();
  await soyle("temiz sohbet");
  await soyle("selam");
  assert.equal(uyanislar().at(-1)?.sohbetKipi, "temiz");
});

test("normal sohbet standarda döner ve hafızaya yazım sürer", async () => {
  const { k, soyle } = kur();
  await soyle("temiz sohbet"); await soyle("normal sohbet");
  await soyle("açık söz");
  assert.deepEqual([k.sohbetKipi, k.hafiza.sayi], ["standart", 1]);
});

test("kip dinleyicisi kipi ve eylemi alır", async () => {
  const { k, soyle } = kur();
  const gelen: string[] = [];
  k.sohbetKipiDinle((kip, e) => gelen.push(`${e}:${kip}`));
  await soyle("temiz sohbet"); await soyle("yeni sohbet");
  assert.deepEqual(gelen, ["temiz:temiz", "yeni:standart"]);
});

test("soru biçimi kip değiştirmez: LLM'e gider", async () => {
  const { b, soyle } = kur();
  await soyle("yeni sohbet nasıl açılır");
  assert.equal(b.gordugu.length, 1);
});
