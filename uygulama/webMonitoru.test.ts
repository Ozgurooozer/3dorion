// uygulama/webMonitoru.test.ts — 3. monitör bağlantısı: kabuk yokken dürüst "yok" (W4), kareler ve durumlar ekrana, fare normalleştirilip ana sürece (W3).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { WebDurumu, WebEkrani } from "../world/surfaces/web/webEkrani.ts";
import type { WebmonOlayi } from "../host/kopru.ts";
import { webMonitoruKur, type WebKopru } from "./webMonitoru.ts";

function sahteEkran() {
  const kareler: number[] = [];
  const durumlar: WebDurumu[] = [];
  const ekran: WebEkrani = {
    kareGeldi: async (j) => { kareler.push(j.length); return true; },
    durum: (d) => { durumlar.push(d); },
    kareSayisi: () => kareler.length,
    doluluk: () => 1,
    yokEt: () => {},
  };
  return { ekran, kareler, durumlar };
}

function sahteKopru(acilir = true) {
  const komutlar: { komut: string; yuk?: unknown }[] = [];
  let dinleyici: ((o: WebmonOlayi) => void) | null = null;
  let aboneligiBirakti = false;
  const kopru: WebKopru = {
    webmonKomut: async (komut, yuk) => { komutlar.push({ komut, yuk }); return komut === "ac" ? acilir : true; },
    webmonDinle: (cb) => { dinleyici = cb; return () => { aboneligiBirakti = true; }; },
  };
  return { kopru, komutlar, yolla: (o: WebmonOlayi) => dinleyici?.(o), birakti: () => aboneligiBirakti };
}

const MESH = {} as AbstractMesh, SAHNE = {} as Scene;

test("kabuk yoksa (dev/tarayıcı): baslat false ve ekran 'yok' der (sessiz siyah değil); fare iletilmez", async () => {
  const { ekran, durumlar } = sahteEkran();
  const w = webMonitoruKur({ sahne: SAHNE, ekranMesh: MESH, kopru: () => null, ekran });
  assert.equal(await w.baslat(), false);
  assert.equal(w.durum(), "yok");
  assert.deepEqual(durumlar, ["yok"]);
  assert.equal(w.tikla(0.5, 0.5), false);
});

test("baslat: pencere açılır, kareler ve durum olayları ekrana akar", async () => {
  const { ekran, kareler, durumlar } = sahteEkran();
  const k = sahteKopru();
  const w = webMonitoruKur({ sahne: SAHNE, ekranMesh: MESH, kopru: () => k.kopru, ekran });
  assert.equal(await w.baslat(), true);
  assert.deepEqual(k.komutlar[0], { komut: "ac", yuk: undefined });
  k.yolla({ olay: "durum", d: "acik" });
  k.yolla({ olay: "kare", jpeg: new Uint8Array([1, 2, 3]), g: 10, y: 6 });
  assert.equal(w.durum(), "acik");
  assert.deepEqual(kareler, [3]);
  k.yolla({ olay: "durum", d: "kapali" });
  assert.equal(w.durum(), "kapali");
  assert.deepEqual(durumlar.slice(-2), ["acik", "kapali"]);
});

test("W3 fare: doku UV'si normalleştirilmiş sayfa koordinatına çevrilip gönderilir (tıklama = bas + bırak)", async () => {
  const { ekran } = sahteEkran();
  const k = sahteKopru();
  const w = webMonitoruKur({ sahne: SAHNE, ekranMesh: MESH, kopru: () => k.kopru, ekran });
  await w.baslat();
  k.yolla({ olay: "durum", d: "acik" });
  k.komutlar.length = 0;
  assert.equal(w.tikla(0.25, 0.9), true);
  assert.deepEqual(k.komutlar.map((c) => c.komut), ["fare", "fare"]);
  const bas = k.komutlar[0]!.yuk as { tip: string; x: number; y: number; dugme: string };
  assert.deepEqual([bas.tip, bas.x, bas.dugme], ["bas", 0.25, "left"]);
  assert.ok(Math.abs(bas.y - 0.1) < 1e-9, `v=0.9 (yukarı) → sayfa y≈0.1 (yukarı), gelen ${bas.y}`);
  assert.deepEqual((k.komutlar[1]!.yuk as { tip: string }).tip, "birak");
  w.tekerlek(0.5, 0.5, 120, 0);
  assert.deepEqual(k.komutlar[2]!.yuk, { tip: "tekerlek", x: 0.5, y: 0.5, dy: 120, dx: 0 });
});

test("sayfa kapalıyken fare iletilmez (kapalı pencereye olay gönderilmez)", async () => {
  const { ekran } = sahteEkran();
  const k = sahteKopru();
  const w = webMonitoruKur({ sahne: SAHNE, ekranMesh: MESH, kopru: () => k.kopru, ekran });
  await w.baslat();
  k.yolla({ olay: "durum", d: "kapali" });
  k.komutlar.length = 0;
  assert.equal(w.tikla(0.5, 0.5), false);
  assert.equal(k.komutlar.length, 0);
});

test("ana süreç pencereyi açamazsa (ör. adres reddi) ekran 'kapali' der", async () => {
  const { ekran, durumlar } = sahteEkran();
  const k = sahteKopru(false);
  const w = webMonitoruKur({ sahne: SAHNE, ekranMesh: MESH, kopru: () => k.kopru, ekran });
  assert.equal(await w.baslat(), false);
  assert.equal(durumlar.at(-1), "kapali");
});

test("kapat(): aboneliği bırakır ve ana süreçteki pencereyi yıkar", async () => {
  const { ekran } = sahteEkran();
  const k = sahteKopru();
  const w = webMonitoruKur({ sahne: SAHNE, ekranMesh: MESH, kopru: () => k.kopru, ekran });
  await w.baslat();
  w.kapat();
  assert.equal(k.birakti(), true);
  assert.equal(k.komutlar.at(-1)?.komut, "kapat");
});
