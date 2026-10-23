// uygulama/rig/anahtarla.test.ts — rig düzenlemesi → sekans anahtarı (spec 38 §5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sekansDogrula, type Sekans } from "../../protocol/sekans.ts";
import type { AnimasyonKlibi } from "../../protocol/animasyon.ts";
import type { KlipBulucu } from "../../world/avatar/index.ts";
import { KOMSU_KARE, baglamaDegerleri, rigDuzenle, uzuvEuleri } from "./anahtarla.ts";

const bos: KlipBulucu = { bul: () => null, adlar: () => [] };
const sekans = (izler: unknown[] = [], ek: Record<string, unknown> = {}): Sekans => {
  const r = sekansDogrula({ surum: 1, ad: "t", fps: 30, sure_kare: 90, baglamalar: [{ id: "b1", ajan: "orion" }], izler, ...ek });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const iz = (id: string, uzuv: string, kanal: string, anahtarlar: { kare: number; deger: number }[], ek: object = {}) => ({ id, baglama: "b1", tur: "uzuv", uzuv, kanal, anahtarlar, ...ek });
const ok = <T>(r: { ok: boolean; deger?: T; hata?: string }): T => { assert.ok(r.ok, r.hata ?? ""); return r.deger as T; };

test("rigDuzenle: izsiz uzva dönme verince kanal başına iz açılır ve o karede hedef değer okunur", () => {
  const s = sekans();
  const r = ok(rigDuzenle(s, "b1", "sol_kol", 30, { x: 0, y: 0, z: -40 }, bos));
  assert.equal(r.yazilan, 1, "yalnız değişen kanal (z) yazılır");
  assert.deepEqual(r.yeniIzler.length, 1);
  assert.equal(uzuvEuleri(r.sekans, "b1", "sol_kol", 30, bos).z, -40);
});

test("rigDuzenle: yeni iz yalnız o kareyi değiştirir (komşu karelerde 0, uzakta 0)", () => {
  const r = ok(rigDuzenle(sekans(), "b1", "bas", 45, { x: 20, y: 0, z: 0 }, bos));
  assert.equal(uzuvEuleri(r.sekans, "b1", "bas", 45 - KOMSU_KARE, bos).x, 0);
  assert.equal(uzuvEuleri(r.sekans, "b1", "bas", 45 + KOMSU_KARE, bos).x, 0);
  assert.equal(uzuvEuleri(r.sekans, "b1", "bas", 0, bos).x, 0);
  assert.equal(uzuvEuleri(r.sekans, "b1", "bas", 89, bos).x, 0);
  assert.equal(uzuvEuleri(r.sekans, "b1", "bas", 45, bos).x, 20);
});

test("rigDuzenle: var olan izde yalnız o karenin anahtarı güncellenir, öteki anahtarlar yerinde", () => {
  const s = sekans([iz("d", "sag_el", "donme_x", [{ kare: 0, deger: 0 }, { kare: 30, deger: 10 }, { kare: 60, deger: 0 }])]);
  const r = ok(rigDuzenle(s, "b1", "sag_el", 30, { x: 35, y: 0, z: 0 }, bos));
  const d = r.sekans.izler.find((z) => z.id === "d");
  assert.ok(d && d.tur === "uzuv");
  assert.deepEqual(d.anahtarlar.map((a) => [a.kare, a.deger]), [[0, 0], [30, 35], [60, 0]]);
  assert.equal(r.yeniIzler.length, 0);
});

test("rigDuzenle: değişmeyen hedef hiçbir şey yazmaz (iz açılmaz)", () => {
  const r = ok(rigDuzenle(sekans(), "b1", "bas", 10, { x: 0, y: 0, z: 0 }, bos));
  assert.equal(r.yazilan, 0);
  assert.equal(r.sekans.izler.length, 0);
});

test("rigDuzenle: klip altta oynarken yazılan değer klibin katkısını ÇIKARIR (toplam hedefe eşit)", () => {
  const klip: AnimasyonKlibi = { surum: 1, ad: "el", jest: "el_salliyor", sure: 3, dongu: false, izler: [{ uzuv: "sag_kol", kanal: "donme_z", anahtarlar: [{ t: 0, deger: 50, yumusatma: "dogrusal" }, { t: 3, deger: 50, yumusatma: "dogrusal" }] }] };
  const kl: KlipBulucu = { bul: (a) => (a === "el" ? klip : null), adlar: () => ["el"] };
  const s = sekans([{ id: "k", baglama: "b1", tur: "klip", bolumler: [{ klip: "el", baslangic_kare: 0, uzunluk_kare: 90, ofset_kare: 0 }] }]);
  assert.equal(uzuvEuleri(s, "b1", "sag_kol", 20, kl).z, 50);
  const r = ok(rigDuzenle(s, "b1", "sag_kol", 20, { x: 0, y: 0, z: 80 }, kl));
  assert.equal(uzuvEuleri(r.sekans, "b1", "sag_kol", 20, kl).z, 80, "toplam hedef");
  const yeni = r.sekans.izler.find((z) => z.tur === "uzuv" && z.uzuv === "sag_kol" && z.kanal === "donme_z");
  assert.ok(yeni && yeni.tur === "uzuv");
  assert.equal(yeni.anahtarlar.find((a) => a.kare === 20)?.deger, 30, "iz değeri = hedef − klip");
  assert.equal(uzuvEuleri(r.sekans, "b1", "sag_kol", 80, kl).z, 50, "uzak karede klip aynen");
});

test("rigDuzenle: kilitli iz nedenle reddedilir, sekans değişmez", () => {
  const s = sekans([iz("d", "bas", "donme_x", [{ kare: 0, deger: 0 }], { kilitli: true })]);
  const r = rigDuzenle(s, "b1", "bas", 10, { x: 15, y: 0, z: 0 }, bos);
  assert.equal(r.ok, false);
  assert.match((r as { hata: string }).hata, /kilitli/);
});

test("rigDuzenle: iz tavanı (64) dolu ve uzva yeni iz gerekirse neden söylenir, sekans değişmez", () => {
  const dolu = Array.from({ length: 64 }, (_, i) => ({ id: `k${i}`, baglama: "b1", tur: "klip", bolumler: [] }));
  const s = sekans(dolu);
  const r = rigDuzenle(s, "b1", "sol_ayak", 10, { x: 5, y: 0, z: 0 }, bos);
  assert.equal(r.ok, false);
  assert.match((r as { hata: string }).hata, /en çok 64 iz/);
  assert.equal(s.izler.length, 64);
});

test("rigDuzenle: bilinmeyen bağlama ve aralık dışı kare reddedilir", () => {
  assert.equal(rigDuzenle(sekans(), "yok", "bas", 10, { x: 5, y: 0, z: 0 }, bos).ok, false);
  assert.equal(rigDuzenle(sekans(), "b1", "bas", 91, { x: 5, y: 0, z: 0 }, bos).ok, false);
  assert.equal(rigDuzenle(sekans(), "b1", "bas", -1, { x: 5, y: 0, z: 0 }, bos).ok, false);
});

test("rigDuzenle: hedef ±180° kısılır", () => {
  const r = ok(rigDuzenle(sekans(), "b1", "bas", 10, { x: 400, y: 0, z: 0 }, bos));
  assert.equal(uzuvEuleri(r.sekans, "b1", "bas", 10, bos).x, 180);
});

test("baglamaDegerleri: yalnız o bağlamanın değerleri, avatar biçiminde", () => {
  const s = sekans([iz("d", "bas", "donme_y", [{ kare: 0, deger: 12 }])]);
  assert.deepEqual(baglamaDegerleri(s, "b1", 5, bos), [{ uzuv: "bas", kanal: "donme_y", deger: 12 }]);
  assert.deepEqual(baglamaDegerleri(s, "yok", 5, bos), []);
});
