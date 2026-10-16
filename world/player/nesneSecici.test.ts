// world/player/nesneSecici.test.ts — ışın → nesne: en yakın, eşitlikte küçük hacim, içeriden atlama, menzil, pay.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { nesneSec, SECIM_MENZILI, SECIM_PAYI } from "./nesneSecici.ts";
import type { Nesne } from "../level/nesneKaydi.ts";

const kutu = (x: number, y: number, z: number, g = 1, yuk = 1, d = 1) => ({ x, y, z, g, yuk, d });
const nesne = (id: string, k: ReturnType<typeof kutu>): Nesne => ({ id, ad: id, tur: "mobilya", capa: null, kutu: k });
const ILERI = { x: 0, y: 0, z: 1 };   // +Z'ye bakan birim yön
const ORIJIN = { x: 0, y: 0, z: 0 };

test("ışının ilk vurduğu nesne seçilir: ardışık ikisinden YAKINI", () => {
  const yakin = nesne("yakin", kutu(0, 0, 3)), uzak = nesne("uzak", kutu(0, 0, 8));
  assert.equal(nesneSec(ORIJIN, ILERI, [uzak, yakin])?.nesne.id, "yakin");
});

test("hiçbir şeye bakılmıyorsa null", () => {
  assert.equal(nesneSec(ORIJIN, ILERI, [nesne("yan", kutu(10, 0, 3))]), null);
});

test("ışının ARKASINDAKİ nesne seçilmez", () => {
  assert.equal(nesneSec(ORIJIN, ILERI, [nesne("arka", kutu(0, 0, -3))]), null);
});

test("menzil dışındaki nesne seçilmez; varsayılan menzil ova için geniş", () => {
  assert.equal(nesneSec(ORIJIN, ILERI, [nesne("uzak", kutu(0, 0, 100))], 20), null);
  assert.ok(SECIM_MENZILI >= 40);
});

test("mesafe kutunun ön yüzüne kadardır (merkeze değil)", () => {
  const s = nesneSec(ORIJIN, ILERI, [nesne("kutu", kutu(0, 0, 5, 2, 2, 2))]);
  assert.ok(s && Math.abs(s.mesafe - (4 - SECIM_PAYI)) < 1e-9, `mesafe ${s?.mesafe}`);
});

test("EŞİT mesafede HACMİ KÜÇÜK kazanır (masa üstündeki monitör masayı gölgeler), sıradan bağımsız", () => {
  // İkisinin ön yüzü de z = 2: büyük kutu 2 birim (merkez 3), küçük kutu 1 birim (merkez 2.5).
  const buyuk = nesne("masa", kutu(0, 0, 3, 2, 2, 2)), kucuk = nesne("monitor", kutu(0, 0, 2.5, 1, 1, 1));
  assert.equal(nesneSec(ORIJIN, ILERI, [buyuk, kucuk])?.nesne.id, "monitor");
  assert.equal(nesneSec(ORIJIN, ILERI, [kucuk, buyuk])?.nesne.id, "monitor");
});

test("kaynak kutunun İÇİNDEYSE o nesne atlanır (kamera büyük nesnenin içinde: her şeyi seçmesin)", () => {
  const icerde = nesne("buyuk", kutu(0, 0, 0, 10, 10, 10)), onde = nesne("onde", kutu(0, 0, 4));
  assert.equal(nesneSec(ORIJIN, ILERI, [icerde, onde])?.nesne.id, "onde");
});

test("pay: kutuya payın yarısı kadar yan kaçan ışın ince nesneyi yine seçer", () => {
  const direk = nesne("direk", kutu(1, 0, 3, 0.1, 2, 0.1));   // x ∈ [0.95, 1.05]
  assert.equal(nesneSec({ x: 0.95 - SECIM_PAYI / 2, y: 0, z: 0 }, ILERI, [direk])?.nesne.id, "direk");
});

test("pay'ın ötesinde kaçan ışın seçmez", () => {
  const direk = nesne("direk", kutu(1, 0, 3, 0.1, 2, 0.1));
  assert.equal(nesneSec({ x: 0.95 - 2 * SECIM_PAYI, y: 0, z: 0 }, ILERI, [direk]), null);
});
