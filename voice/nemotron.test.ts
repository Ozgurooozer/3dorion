// voice/nemotron.test.ts — Orion'un kulağı (bas-konuş), gerçek mikrofon ve model olmadan.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NemotronGirdi, type KulakKopru, type KulakOlayi, type KulakDurumu } from "./nemotron.ts";
import type { Tanima } from "./tip.ts";

/** Sahte köprü: gönderilen komutları toplar, olayı elle üretir. */
function kur() {
  const komutlar: string[] = [];
  let cb: ((o: KulakOlayi) => void) | null = null;
  const kopru: KulakKopru = {
    dinleKomut: async (k) => { komutlar.push(k); return true; },
    dinleDinle: (c) => { cb = c; return () => { cb = null; }; },
  };
  const g = new NemotronGirdi(kopru);
  const duyulan: Tanima[] = [];
  const hatalar: string[] = [];
  const durumlar: KulakDurumu[] = [];
  g.dinle((t) => duyulan.push(t));
  g.hataDinle((h) => hatalar.push(h));
  g.durumDinle((d) => durumlar.push(d));
  return { g, komutlar, duyulan, hatalar, durumlar, olay: (o: KulakOlayi) => cb?.(o) };
}
const HAZIR: KulakOlayi = { olay: "hazir", mikrofon: "Mikrofon" };

test("köprü yoksa kaynak kullanılamaz", () => {
  assert.equal(new NemotronGirdi(null).kullanilabilir(), false);
});

test("baslat() süreci açma komutunu gönderir", async () => {
  const { g, komutlar } = kur();
  await g.baslat();
  assert.deepEqual(komutlar, ["baslat"]);
});

test("model hazır olmadan kayıt başlamaz", async () => {
  const { g, komutlar } = kur();
  await g.baslat();
  g.kayitBasla();
  assert.deepEqual(komutlar, ["baslat"]);
});

test("hazır olunca kayitBasla `kayit` gönderir", async () => {
  const { g, komutlar, olay } = kur();
  await g.baslat(); olay(HAZIR);
  g.kayitBasla();
  assert.deepEqual(komutlar, ["baslat", "kayit"]);
});

test("tuş basılı tutulurken tekrarlayan kayitBasla ikinci komut göndermez", async () => {
  const { g, komutlar, olay } = kur();
  await g.baslat(); olay(HAZIR);
  g.kayitBasla(); g.kayitBasla(); g.kayitBasla();
  assert.equal(komutlar.filter((k) => k === "kayit").length, 1);
});

test("kayıt yokken kayitBitir `dur` göndermez", async () => {
  const { g, komutlar, olay } = kur();
  await g.baslat(); olay(HAZIR);
  g.kayitBitir();
  assert.equal(komutlar.includes("dur"), false);
});

test("bırakılınca `dur` gider", async () => {
  const { g, komutlar, olay } = kur();
  await g.baslat(); olay(HAZIR);
  g.kayitBasla(); g.kayitBitir();
  assert.deepEqual(komutlar.slice(-2), ["kayit", "dur"]);
});

test("tanıma kesin Tanima olarak dinleyiciye gider", async () => {
  const { g, duyulan, olay } = kur();
  await g.baslat(); olay(HAZIR);
  olay({ olay: "tanima", metin: "  sit down ", ms: 300, sure: 1, tepe: 0.5 });
  assert.deepEqual(duyulan, [{ metin: "sit down", kesin: true }]);
});

test("boş metin Orion'a söz olarak gitmez", async () => {
  const { g, duyulan, olay } = kur();
  await g.baslat(); olay(HAZIR);
  olay({ olay: "tanima", metin: "   ", ms: 1, sure: 1, tepe: 0.5 });
  assert.equal(duyulan.length, 0);
});

test("`bos` olayı söz üretmez, nedenini duruma yazar", async () => {
  const { g, duyulan, durumlar, olay } = kur();
  await g.baslat(); olay(HAZIR);
  olay({ olay: "bos", neden: "sessiz" });
  assert.deepEqual([duyulan.length, durumlar.at(-1)], [0, { d: "bos", neden: "sessiz" }]);
});

test("süreç hata verirse hataDinle'ye gider, sessiz kalmaz", async () => {
  const { g, hatalar, olay } = kur();
  await g.baslat();
  olay({ olay: "hata", hata: "paket eksik" });
  assert.deepEqual(hatalar, ["paket eksik"]);
});

test("süreç kapanırsa hazır düşer ve hata bildirilir", async () => {
  const { g, hatalar, olay } = kur();
  await g.baslat(); olay(HAZIR);
  olay({ olay: "kapandi", kod: 1 });
  assert.deepEqual([g.hazir, hatalar.length], [false, 1]);
});

test("durdur() `kapat` gönderir ve aboneliği bırakır", async () => {
  const { g, komutlar, olay, duyulan } = kur();
  await g.baslat(); olay(HAZIR);
  g.durdur();
  olay({ olay: "tanima", metin: "x", ms: 1, sure: 1, tepe: 1 });
  assert.deepEqual([komutlar.at(-1), duyulan.length], ["kapat", 0]);
});

test("durum sırası: yükleniyor → hazır → dinliyor → çözüyor", async () => {
  const { g, durumlar, olay } = kur();
  await g.baslat(); olay(HAZIR);
  g.kayitBasla(); g.kayitBitir();
  assert.deepEqual(durumlar.map((d) => d.d), ["yukleniyor", "hazir", "dinliyor", "cozuyor"]);
});
