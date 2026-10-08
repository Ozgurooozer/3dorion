// world/level/cekirdek/cekirdek.test.ts — Level çekirdeğinin saf parçaları: renk, rastgele, tanım, ayar, geometri.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { hex, hexYaz, renkCoz, karistir } from "./renk.ts";
import { rastgele, gurultu } from "./rastgele.ts";
import { levelTanimiDogrula, type LevelTanimi } from "./levelTanimi.ts";
import { ornekTanim } from "./ornekTanim.ts";
import { ayarBirlestir } from "./modul.ts";
import { flatGeometri } from "./geometri.ts";


// ── renk ──
test("hex ↔ [0..1] gidiş-dönüş", () => { assert.equal(hexYaz(hex("#12abef")), "#12abef"); });
test("geçersiz hex hata verir", () => { assert.throws(() => hex("#12ab"), /rrggbb/); });
test("renk başvurusu: palet adı ya da doğrudan hex", () => {
  assert.deepEqual([renkCoz("mavi", { mavi: "#000000" }), renkCoz("#ffffff", {})], [[0, 0, 0], [1, 1, 1]]);
});
test("palette olmayan ad hata verir", () => { assert.throws(() => renkCoz("mor", {}), /paletde yok/); });
test("karışım sınırlanır", () => { assert.deepEqual(karistir([0, 0, 0], [1, 1, 1], 5), [1, 1, 1]); });

// ── rastgele ──
test("aynı tohum aynı dizi", () => { const a = rastgele(3), b = rastgele(3); assert.deepEqual([a(), a()], [b(), b()]); });
test("gürültü [0,1) ve sürekli", () => {
  for (let i = 0; i < 100; i++) { const v = gurultu(i * 0.37, -i * 0.11, 5); assert.ok(v >= 0 && v < 1); }
  assert.ok(Math.abs(gurultu(2.5, 1.5, 5) - gurultu(2.501, 1.5, 5)) < 0.01);
});

// ── tanım ──
test("örnek tanım geçerli", () => { assert.equal(levelTanimiDogrula(ornekTanim()).ok, true); });
const bozuk = (yol: string, bozan: (t: LevelTanimi) => void, beklenen: RegExp) => test(`geçersiz tanım yakalanır: ${yol}`, () => {
  const t = ornekTanim(); bozan(t);
  const d = levelTanimiDogrula(t);
  assert.ok(!d.ok && beklenen.test(d.hata), d.ok ? "geçti" : d.hata);
});
bozuk("sürüm", (t) => { t.surum = 2; }, /surum/);
bozuk("palet hex", (t) => { t.palet["mavi"] = "mavi"; }, /palet\.mavi/);
bozuk("palette olmayan renk adı", (t) => { t.isik.dolgu.ust = "mor"; }, /isik\.dolgu/);
bozuk("kademe aralığı", (t) => { t.isik.gunes.golge.kademe = 7; }, /kademe/);
bozuk("yinelenen katman adı", (t) => { t.katmanlar.push({ tur: "a", ad: "a1", acik: true, ayar: {} }); }, /yinelenen/);
bozuk("güneş yönü", (t) => { t.isik.gunes.yon = [0, 1] as unknown as [number, number, number]; }, /yon/);

// ── ayar ──
const VARSAYILAN = { sayi: 3, renk: "mavi", acik: true, yon: [0, 1, 0] as readonly number[] };
test("eksik ayar varsayılandan gelir", () => { assert.deepEqual(ayarBirlestir("m", VARSAYILAN, { sayi: 5 }), { ...VARSAYILAN, sayi: 5 }); });
test("bilinmeyen ayar hata verir (yazım hatası görünür)", () => { assert.throws(() => ayarBirlestir("m", VARSAYILAN, { sayii: 5 }), /bilinmeyen/); });
test("yanlış türdeki ayar hata verir", () => { assert.throws(() => ayarBirlestir("m", VARSAYILAN, { sayi: "5" }), /tür/); });
test("dizi ayarında eleman türü denetlenir", () => { assert.throws(() => ayarBirlestir("m", VARSAYILAN, { yon: ["a"] }), /tür/); });

// ── geometri ──
test("flat geometri: normal istenen yöne bakar", () => {
  const g = flatGeometri([{ a: [0, 0, 0], b: [1, 0, 0], c: [0, 0, 1], renk: [1, 0, 0], yon: [0, -1, 0] }]);
  assert.ok(g.normal[1]! < 0);
});
test("flat geometri: üçgen başına üç ayrı köşe", () => {
  const g = flatGeometri([{ a: [0, 0, 0], b: [1, 0, 0], c: [0, 0, 1], renk: [1, 0, 0] }, { a: [0, 0, 0], b: [1, 0, 0], c: [0, 0, 1], renk: [0, 1, 0] }]);
  assert.equal(g.konum.length / 3, 6);
});
test("flat geometri: yukarı normalli üçgenin yazılan köşe sırası Babylon'un ön yüzü (ekranla doğrulandı)", () => {
  const g = flatGeometri([{ a: [0, 0, 0], b: [1, 0, 0], c: [0, 0, 1], renk: [1, 1, 1], yon: [0, 1, 0] }]);
  // xz düzleminde yazılan sıranın 2B çapraz çarpımı pozitif: bu sırada zemin üstten görünüyor
  // (ova L0'da ters sıra zemini üstten görünmez yaptı — ekran görüntüsü). Sıra değişirse bu test kırılır.
  const k = (i: number) => [g.konum[i * 3]!, g.konum[i * 3 + 2]!];
  const [a, b, c] = [k(0), k(1), k(2)];
  const capraz = (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
  assert.ok(capraz > 0);
});
