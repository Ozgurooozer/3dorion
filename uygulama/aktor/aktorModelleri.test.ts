// uygulama/aktor/aktorModelleri.test.ts — saf modeller: tetik geometrisi + durum, hareket adımı, hiyerarşi ezmesi (spec 45 B4).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { CIKIS_PAYI_M, tetikDurumuKur, tetikIcinde, tetikKimMi, type Gozlenen, type TetikAyari } from "./tetikModeli.ts";
import { DURMA_ESIGI, hareketAdimi, hareketKomutuHatasi, type HareketAyari, type HareketDurumu } from "./hareketModeli.ts";
import { etkinHiyerarsi, ustAtamaHatasi } from "./hiyerarsiEzmesi.ts";

const kure = (o: Partial<TetikAyari> = {}): TetikAyari => ({ sekil: "kure", yaricap: 2, boyut: [1, 1, 1], konum: [0, 0, 0], kim: "herkes", ...o });
const kutu = (o: Partial<TetikAyari> = {}): TetikAyari => ({ ...kure(), sekil: "kutu", boyut: [4, 2, 6], ...o });
const M0 = { x: 0, y: 0, z: 0 };
const kisi = (id: string, tur: Gozlenen["tur"], x: number, y = 0, z = 0): Gozlenen => ({ id, tur, konum: { x, y, z } });

// ── tetik ──
test("küre: sınır DAHİL, hemen dışı değil; merkez ofseti uygulanır", () => {
  assert.equal(tetikIcinde(kure(), M0, { x: 2, y: 0, z: 0 }), true);
  assert.equal(tetikIcinde(kure(), M0, { x: 2.01, y: 0, z: 0 }), false);
  assert.equal(tetikIcinde(kure(), M0, { x: 1.5, y: 1.5, z: 0 }), false, "3 boyutlu mesafe (√4.5 > 2)");
  assert.equal(tetikIcinde(kure({ konum: [5, 0, 0] }), M0, { x: 5, y: 0, z: 0 }), true);
  assert.equal(tetikIcinde(kure({ konum: [5, 0, 0] }), M0, { x: 0, y: 0, z: 0 }), false);
  assert.equal(tetikIcinde(kure(), { x: 10, y: 0, z: 0 }, { x: 11, y: 0, z: 0 }), true, "aktörün dünya konumu merkez");
});

test("kutu: yarı boyutlar eksen eksen (yarıçap yok sayılır), pay sınırı genişletir", () => {
  assert.equal(tetikIcinde(kutu(), M0, { x: 2, y: 1, z: 3 }), true);
  assert.equal(tetikIcinde(kutu(), M0, { x: 2.01, y: 0, z: 0 }), false);
  assert.equal(tetikIcinde(kutu(), M0, { x: 0, y: 1.01, z: 0 }), false);
  assert.equal(tetikIcinde(kutu(), M0, { x: 0, y: 0, z: 3.01 }), false);
  assert.equal(tetikIcinde(kutu({ yaricap: 100 }), M0, { x: 2.01, y: 0, z: 0 }), false);
  assert.equal(tetikIcinde(kutu(), M0, { x: 2.1, y: 0, z: 0 }, 0.15), true, "pay ile içeride");
});

test("kim süzgeci: herkes/ozyn/orion/aktor; bilinmeyen değer kimseyi saymaz", () => {
  const l = [kisi("o", "ozyn", 0), kisi("or", "orion", 0), kisi("f", "ajan", 0), kisi("araba", "aktor", 0)];
  const sec = (k: string) => l.filter((g) => tetikKimMi(k, g)).map((g) => g.id);
  assert.deepEqual(sec("herkes"), ["o", "or", "f", "araba"]);
  assert.deepEqual(sec("ozyn"), ["o"]);
  assert.deepEqual(sec("orion"), ["or"]);
  assert.deepEqual(sec("aktor"), ["araba"]);
  assert.deepEqual(sec("hayalet"), []);
});

test("durum: giriş ve çıkış geçişleri bir kez; içerideyken tekrar girdi yok; histerezis payı içinde çıkmadı sayılır", () => {
  const d = tetikDurumuKur();
  const a = kure();
  assert.deepEqual(d.guncelle(a, M0, [kisi("o", "ozyn", 3)]), { girenler: [], cikanlar: [] });
  assert.deepEqual(d.guncelle(a, M0, [kisi("o", "ozyn", 1.9)]), { girenler: ["o"], cikanlar: [] });
  assert.deepEqual(d.guncelle(a, M0, [kisi("o", "ozyn", 1.5)]), { girenler: [], cikanlar: [] }, "içeride kalınca yeni girdi yok");
  assert.deepEqual(d.guncelle(a, M0, [kisi("o", "ozyn", 2 + CIKIS_PAYI_M - 0.01)]), { girenler: [], cikanlar: [] }, "pay içinde çıkmadı");
  assert.deepEqual(d.icerdekiler(), ["o"]);
  assert.deepEqual(d.guncelle(a, M0, [kisi("o", "ozyn", 2 + CIKIS_PAYI_M + 0.01)]), { girenler: [], cikanlar: ["o"] });
  assert.deepEqual(d.guncelle(a, M0, [kisi("o", "ozyn", 2.1)]), { girenler: [], cikanlar: [] }, "dışarıdayken pay yok: 2.1 içeri girmez");
});

test("durum: gözlenen kaybolunca çıkmış sayılır; çoklu gözlenen ayrı izlenir; aynı kimlik iki kez girdi üretmez; sıfırla çıkış ÜRETMEZ", () => {
  const d = tetikDurumuKur();
  const a = kure();
  const g = d.guncelle(a, M0, [kisi("o", "ozyn", 0), kisi("f", "ajan", 1), kisi("o", "ozyn", 0.5)]);
  assert.deepEqual(g.girenler, ["o", "f"]);
  assert.deepEqual(d.guncelle(a, M0, [kisi("o", "ozyn", 0)]), { girenler: [], cikanlar: ["f"] });
  assert.deepEqual(d.guncelle(a, M0, []), { girenler: [], cikanlar: ["o"] });
  d.guncelle(a, M0, [kisi("o", "ozyn", 0)]);
  d.sifirla();
  assert.deepEqual(d.icerdekiler(), []);
  assert.deepEqual(d.guncelle(a, M0, []), { girenler: [], cikanlar: [] });
});

test("durum: kim süzgecine uymayan içeride olsa da girmez", () => {
  const d = tetikDurumuKur();
  assert.deepEqual(d.guncelle(kure({ kim: "orion" }), M0, [kisi("o", "ozyn", 0), kisi("or", "orion", 0)]), { girenler: ["or"], cikanlar: [] });
});

// ── hareket ──
const AYAR: HareketAyari = { azamiHiz: 10, ivme: 5, donmeHizi: 90 };
const D0: HareketDurumu = { x: 0, z: 0, yaw: 0, hiz: 0 };

test("hareket: ivmeyle hızlanır (adım ivme·dt), hedefi aşmaz, ileri = +Z (yaw 0)", () => {
  let r = hareketAdimi(D0, { hiz: 10, donus: 0 }, AYAR, 1);
  assert.equal(r.durum.hiz, 5);
  assert.equal(r.hareketli, true);
  assert.ok(Math.abs(r.durum.z - 2.5) < 1e-9, "ortalama hızla yamuk adım");
  assert.equal(r.durum.x, 0);
  r = hareketAdimi(r.durum, { hiz: 10, donus: 0 }, AYAR, 10);
  assert.equal(r.durum.hiz, 10, "hedefi aşmaz");
  r = hareketAdimi({ ...D0, hiz: 4 }, { hiz: 5, donus: 0 }, AYAR, 1);
  assert.equal(r.durum.hiz, 5, "kalan fark ivme adımından küçükse hedef");
});

test("hareket: komut azami hızla sınırlanır, geri gitmek eksi hız, yön yaw'a göre (yaw 90° → +X)", () => {
  const r = hareketAdimi(D0, { hiz: 99, donus: 0 }, { ...AYAR, ivme: 1000 }, 1);
  assert.equal(r.durum.hiz, 10);
  const geri = hareketAdimi(D0, { hiz: -4, donus: 0 }, { ...AYAR, ivme: 1000 }, 1);
  assert.equal(geri.durum.hiz, -4);
  assert.ok(geri.durum.z < 0);
  const yan = hareketAdimi({ ...D0, yaw: Math.PI / 2, hiz: 2 }, { hiz: 2, donus: 0 }, AYAR, 1);
  assert.ok(Math.abs(yan.durum.x - 2) < 1e-9 && Math.abs(yan.durum.z) < 1e-9);
});

test("hareket: dönme hızı komuttur ve donmeHizi ile sınırlanır; yön her adımda ilerler", () => {
  const r = hareketAdimi(D0, { hiz: 0, donus: 45 }, AYAR, 2);
  assert.ok(Math.abs(r.durum.yaw - Math.PI / 2) < 1e-9, "45°/s × 2 sn = 90°");
  const fazla = hareketAdimi(D0, { hiz: 0, donus: 9999 }, AYAR, 1);
  assert.ok(Math.abs(fazla.durum.yaw - Math.PI / 2) < 1e-9, "azami 90°/s");
  assert.equal(r.hareketli, false, "yalnız dönmek 'hareketli' değil");
});

test("hareket: duruş yumuşak biter; eşik altı sıfırlanır; dt ≤ 0 durumu değiştirmez", () => {
  let d: HareketDurumu = { ...D0, hiz: 3 };
  let adim = 0;
  while (d.hiz !== 0 && adim++ < 100) d = hareketAdimi(d, { hiz: 0, donus: 0 }, AYAR, 0.1).durum;
  assert.equal(d.hiz, 0);
  assert.ok(adim < 100);
  const ayni = hareketAdimi({ ...D0, hiz: 3 }, { hiz: 10, donus: 0 }, AYAR, 0);
  assert.equal(ayni.durum.hiz, 3);
  assert.equal(ayni.hareketli, true);
  assert.equal(hareketAdimi({ ...D0, hiz: DURMA_ESIGI / 2 }, { hiz: 0, donus: 0 }, AYAR, -1).hareketli, false);
});

test("komut hatası: sonsuz/NaN, azami hız ve dönme hızı aşımı", () => {
  assert.equal(hareketKomutuHatasi({ hiz: 3, donus: 10 }, AYAR), null);
  assert.equal(hareketKomutuHatasi({ hiz: 10, donus: 90 }, AYAR), null, "sınır dahil");
  assert.match(hareketKomutuHatasi({ hiz: NaN, donus: 0 }, AYAR) ?? "", /sonlu/);
  assert.match(hareketKomutuHatasi({ hiz: 0, donus: Infinity }, AYAR) ?? "", /sonlu/);
  assert.match(hareketKomutuHatasi({ hiz: -11, donus: 0 }, AYAR) ?? "", /azami hızı aşıyor/);
  assert.match(hareketKomutuHatasi({ hiz: 0, donus: 91 }, AYAR) ?? "", /dönme hızını aşıyor/);
});

// ── hiyerarşi ezmesi ──
const L = [{ id: "a" }, { id: "b", ust: "a" }, { id: "c", ust: "b" }, { id: "d" }];

test("etkin hiyerarşi: ezme üstü değiştirir, null tanımdaki üstten ayırır, ezmesiz aktör aynen", () => {
  const h = etkinHiyerarsi(L, new Map([["c", { ust: "d" }], ["b", { ust: null }]]));
  assert.equal(h.ustu("c"), "d");
  assert.equal(h.ustu("b"), undefined);
  assert.deepEqual([...h.altlari("d")], ["c"]);
  assert.deepEqual([...h.altlari("a")], []);
  const ham = etkinHiyerarsi(L, new Map());
  assert.equal(ham.ustu("c"), "b");
  assert.equal(etkinHiyerarsi(L, new Map([["d", { ust: "beden:orion" }]])).ustu("d"), "beden:orion");
});

test("üst atama hatası: kendi üstü, olmayan üst, döngü, derinlik; beden üstü serbest, boş beden adı reddedilir", () => {
  const h = etkinHiyerarsi([{ id: "a" }, { id: "b", ust: "a" }, { id: "c", ust: "b" }, { id: "d", ust: "c" }, { id: "e" }, { id: "x" }], new Map());
  const bil = (id: string) => ["a", "b", "c", "d", "e", "x"].includes(id);
  const hata = (id: string, ust: string) => ustAtamaHatasi(id, ust, bil, h.ustu);
  assert.match(hata("x", "x") ?? "", /kendi üstü/);
  assert.match(hata("x", "yok") ?? "", /level'da yok/);
  assert.match(hata("a", "c") ?? "", /döngü/);
  assert.match(hata("x", "d") ?? "", /en çok 4 kat/, "d zaten 4. kat: altına koymak 5. kat");
  assert.equal(hata("x", "c"), null, "c 3. kat: x 4. kat");
  assert.equal(hata("x", "beden:orion"), null);
  assert.match(hata("x", "beden:") ?? "", /beden adı boş/);
  assert.equal(hata("e", "a"), null);
});
