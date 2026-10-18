// uygulama/zemin.test.ts — oyun içi zemin şekli: okuma/yazma, oturan nesneler, geri al yığını, kayıt biçimi.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { ornekTanim } from "../world/level/cekirdek/ornekTanim.ts";
import type { LevelTanimi, NesneYeri } from "../world/level/cekirdek/levelTanimi.ts";
import { anahtar } from "../world/level/cekirdek/arazi.ts";
import { zeminYuksekligi } from "../world/level/moduller/zemin.ts";
import { zeminOku, zeminYaz, zeminEsit, zeminAyari, oturanlar, zeminGecmisiKur, kaydiYaz, kaydiOku, type ZeminKaydi, type ZeminAdimi } from "./zemin.ts";

const zeminli = (duzenleme: number[] = [], hucre = 2): LevelTanimi => ({
  ...ornekTanim(),
  katmanlar: [{ tur: "zemin", ad: "zemin", acik: true, ayar: { duzenleme, duzenlemeHucre: hucre } }],
  nesneler: [],
});
const nesne = (id: string, x: number, y: number, z: number): NesneYeri => ({ id, varlik: "A", konum: [x, y, z], donus: 0, olcek: 1 });
/** (0,0) hücresine +3 m yükseklik farkı. */
const TEPE: ZeminKaydi = { duzenleme: [anahtar(0, 0), 3], hucre: 2 };
const DUZ: ZeminKaydi = { duzenleme: [], hucre: 2 };

test("zeminOku: katmandaki şekli kopya olarak verir; zemin katmanı yoksa null", () => {
  const t = zeminli([anahtar(1, 1), 0.5], 4);
  const k = zeminOku(t)!;
  assert.deepEqual(k, { duzenleme: [anahtar(1, 1), 0.5], hucre: 4 });
  k.duzenleme.push(1, 1);
  assert.equal((t.katmanlar[0]!.ayar["duzenleme"] as number[]).length, 2);
  assert.equal(zeminOku({ ...ornekTanim(), katmanlar: [] }), null);
});

test("zeminOku: duzenleme alanı yoksa boş şekil ve varsayılan hücre", () => {
  const t: LevelTanimi = { ...ornekTanim(), katmanlar: [{ tur: "zemin", ad: "zemin", acik: true, ayar: {} }] };
  assert.deepEqual(zeminOku(t), { duzenleme: [], hucre: 2 });
});

test("zeminYaz: şekli yazar, girdi tanım değişmez, öteki katmanlara dokunmaz", () => {
  const t: LevelTanimi = { ...zeminli(), katmanlar: [{ tur: "su", ad: "su", acik: true, ayar: {} }, ...zeminli().katmanlar] };
  const y = zeminYaz(t, TEPE);
  assert.deepEqual(zeminOku(y), TEPE);
  assert.deepEqual(zeminOku(t), DUZ);
  assert.equal(y.katmanlar[0], t.katmanlar[0]);
});

test("zeminYaz: zemin katmanı yoksa tanım aynen döner", () => {
  const t: LevelTanimi = { ...ornekTanim(), katmanlar: [] };
  assert.equal(zeminYaz(t, TEPE), t);
});

test("zeminEsit: içerik karşılaştırır; null yalnız null'a eşit", () => {
  assert.equal(zeminEsit(TEPE, { duzenleme: [...TEPE.duzenleme], hucre: 2 }), true);
  assert.equal(zeminEsit(TEPE, DUZ), false);
  assert.equal(zeminEsit(TEPE, { ...TEPE, hucre: 4 }), false);
  assert.equal(zeminEsit(null, null), true);
  assert.equal(zeminEsit(null, DUZ), false);
});

test("zeminAyari: verilen şekille tam ayar üretir (yükseklik hesabı için)", () => {
  const a = zeminAyari(zeminli(), TEPE)!;
  assert.deepEqual(a.duzenleme, TEPE.duzenleme);
});

test("oturanlar: tabanı eski arazide olan nesne yeni araziye çıkar; havadaki ve bölge dışı dokunulmaz", () => {
  // Zemin gürültü tabanıdır (y=0 değil): "yerde" nesnesi gerçekten (0,0)'daki yüksekliğe konur.
  const yuk = zeminYuksekligi(zeminAyari(zeminli(), DUZ)!);
  const t: LevelTanimi = { ...zeminli(), nesneler: [nesne("yerde", 0, yuk(0, 0), 0), nesne("havada", 0, yuk(0, 0) + 5, 0), nesne("uzakta", 40, yuk(40, 40), 40)] };
  const bolge = { x0: -6, z0: -6, x1: 6, z1: 6 };
  const o = oturanlar(t, DUZ, TEPE, bolge);
  assert.deepEqual(o.map((x) => x.id), ["yerde"]);
  assert.equal(o[0]!.once[1], yuk(0, 0));
  assert.ok(o[0]!.sonra[1] > yuk(0, 0) + 2, `tepeye çıkmalı, y=${o[0]!.sonra[1]}`);
});

test("oturanlar: kimliksiz nesne atlanır; zemin katmanı yoksa boş", () => {
  const kimliksiz: NesneYeri = { varlik: "A", konum: [0, 0, 0], donus: 0, olcek: 1 };
  assert.deepEqual(oturanlar({ ...zeminli(), nesneler: [kimliksiz] }, DUZ, TEPE, { x0: -6, z0: -6, x1: 6, z1: 6 }), []);
  assert.deepEqual(oturanlar({ ...ornekTanim(), katmanlar: [], nesneler: [nesne("a", 0, 0, 0)] }, DUZ, TEPE, { x0: -6, z0: -6, x1: 6, z1: 6 }), []);
});

const adim = (ad: string): ZeminAdimi => ({ ad, once: DUZ, sonra: TEPE, oturan: [] });

test("geçmiş: geri al / ileri al sırayla; boşken null", () => {
  const g = zeminGecmisiKur();
  assert.equal(g.geriAl(), null);
  g.ekle(adim("bir")); g.ekle(adim("iki"));
  assert.equal(g.geriAl()!.ad, "iki");
  assert.equal(g.geriAl()!.ad, "bir");
  assert.equal(g.geriAl(), null);
  assert.equal(g.ileriAl()!.ad, "bir");
  assert.deepEqual(g.sayilar(), { geri: 1, ileri: 1 });
});

test("geçmiş: yeni vuruş ileri alınacakları siler", () => {
  const g = zeminGecmisiKur();
  g.ekle(adim("bir")); g.geriAl();
  g.ekle(adim("iki"));
  assert.deepEqual(g.sayilar(), { geri: 1, ileri: 0 });
  assert.equal(g.ileriAl(), null);
});

test("geçmiş: sınır aşılınca en eski adım düşer", () => {
  const g = zeminGecmisiKur(2);
  g.ekle(adim("bir")); g.ekle(adim("iki")); g.ekle(adim("üç"));
  assert.equal(g.sayilar().geri, 2);
  g.geriAl();
  assert.equal(g.geriAl()!.ad, "iki");
  assert.equal(g.geriAl(), null);
});

test("kayıt: yaz → oku gidiş-dönüş; null şekil de saklanır; boş metin null", () => {
  assert.deepEqual(kaydiOku(kaydiYaz(TEPE)), TEPE);
  assert.equal(kaydiOku(kaydiYaz(null)), null);
  assert.equal(kaydiOku(null), null);
});

test("kayıt: bozuk kayıtlar HATA (sessiz bozulma yok)", () => {
  assert.throws(() => kaydiOku("{"), SyntaxError);
  assert.throws(() => kaydiOku("3"), /nesne değil/);
  assert.throws(() => kaydiOku(JSON.stringify({ surum: 2, zemin: null })), /sürümü/);
  assert.throws(() => kaydiOku(JSON.stringify({ surum: 1, zemin: { duzenleme: "x", hucre: 2 } })), /bozuk/);
  assert.throws(() => kaydiOku(JSON.stringify({ surum: 1, zemin: { duzenleme: [], hucre: 0 } })), /bozuk/);
  assert.throws(() => kaydiOku(JSON.stringify({ surum: 1, zemin: { duzenleme: [1], hucre: 2 } })), /çift sayıda/);
  assert.throws(() => kaydiOku(JSON.stringify({ surum: 1, zemin: { duzenleme: [1.5, 1], hucre: 2 } })), /bozuk çift/);
});
