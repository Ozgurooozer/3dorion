// world/level/cekirdek/isiklar.test.ts — Işık aktörleri (spec 42): tanım doğrulaması, levelKur ile kurulum/güncelleme/kaldırma, eski level'ın aynı kalması.
//
// Ekransız Babylon (NullEngine). Çizim maliyeti ve görüntü bu testte YOK (canlı ölçüm: spec 42 Y3 ön kaydı).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { levelKur } from "./levelKur.ts";
import { levelTanimiDogrula, ISIK_TAVANI, type IsikAktoru, type LevelTanimi } from "./levelTanimi.ts";
import { ornekTanim } from "./ornekTanim.ts";
import { malzemeKur, MALZEME_ISIK_TAVANI } from "./malzeme.ts";

const nokta = (ek: Partial<IsikAktoru> = {}): IsikAktoru => ({ tur: "nokta", konum: [1, 2, 3], renk: "mavi", siddet: 1.5, menzil: 8, ...ek });
const tanimYap = (isiklar?: IsikAktoru[]): LevelTanimi => { const t = ornekTanim(); t.katmanlar = []; if (isiklar) t.isiklar = isiklar; return t; };
const hata = (t: unknown) => { const d = levelTanimiDogrula(t); return d.ok ? null : d.hata; };
const kur = (isiklar?: IsikAktoru[]) => { const sahne = new Scene(new NullEngine()); const level = levelKur(sahne, tanimYap(isiklar), new Map()); return { sahne, level }; };
const aktorler = (s: Scene) => s.lights.filter((l): l is PointLight => l instanceof PointLight);

// ── doğrulama ──
test("ışık alanı yoksa tanım geçerli (eski level'lar)", () => { assert.equal(hata(tanimYap()), null); });
test("geçerli nokta ışık: palet adı ya da #rrggbb renk, kimlik isteğe bağlı", () => {
  assert.equal(hata(tanimYap([nokta(), nokta({ renk: "#ff8800", id: "i9", ad: "lamba", gizli: true, kilitli: false })])), null);
});
test("bozuk ışık alanları yolu ve nedeniyle reddedilir", () => {
  const dene = (ek: Record<string, unknown>) => hata(tanimYap([{ ...nokta(), ...ek } as IsikAktoru]));
  assert.match(dene({ tur: "spot" }) ?? "", /isiklar\[0\]\.tur/);
  assert.match(dene({ konum: [1, 2] }) ?? "", /isiklar\[0\]\.konum/);
  assert.match(dene({ konum: [1, 2, NaN] }) ?? "", /isiklar\[0\]\.konum/);
  assert.match(dene({ renk: "yokrenk" }) ?? "", /isiklar\[0\]\.renk/);
  assert.match(dene({ renk: "#12" }) ?? "", /isiklar\[0\]\.renk/);
  assert.match(dene({ siddet: -1 }) ?? "", /isiklar\[0\]\.siddet/);
  assert.match(dene({ menzil: 0 }) ?? "", /isiklar\[0\]\.menzil/);
  assert.match(dene({ gizli: "evet" }) ?? "", /isiklar\[0\]\.gizli/);
  assert.match(dene({ grup: "yok" }) ?? "", /isiklar\[0\]\.grup/);
  assert.match(hata({ ...tanimYap(), isiklar: "x" }) ?? "", /isiklar: dizi değil/);
});
test("tavan değeri sabit 8 (ölçüm ön kaydıyla değişir; sessizce oynamasın)", () => { assert.equal(ISIK_TAVANI, 8); });
test("ışık sayısı tavanı: tavan geçer, bir fazlası reddedilir", () => {
  assert.equal(hata(tanimYap(Array.from({ length: ISIK_TAVANI }, (_, i) => nokta({ konum: [i, 0, 0] })))), null);
  assert.match(hata(tanimYap(Array.from({ length: ISIK_TAVANI + 1 }, () => nokta()))) ?? "", /en çok/);
});
test("kimlik benzersiz: ışık-ışık ve ışık-nesne çakışması reddedilir", () => {
  assert.match(hata(tanimYap([nokta({ id: "i1" }), nokta({ id: "i1" })])) ?? "", /yinelenen kimlik/);
  const t = tanimYap([nokta({ id: "x1" })]);
  t.nesneler = [{ id: "x1", varlik: "a", konum: [0, 0, 0], donus: 0, olcek: 1 }];
  assert.match(hata(t) ?? "", /yinelenen kimlik/);
});

// ── kurulum ──
test("ışık aktörü yoksa yalnız güneş ve dolgu (eski level birebir aynı)", () => {
  const { sahne, level } = kur();
  assert.equal(sahne.lights.length, 2);
  assert.equal(level.isiklar.say(), 0);
  assert.equal(aktorler(sahne).length, 0);
});
test("her ışık kurulur, kimlik doldurulur (i1, i2), değerler Babylon ışığına geçer", () => {
  const { sahne, level } = kur([nokta(), nokta({ konum: [5, 6, 7], siddet: 3, menzil: 12, renk: "#ff0000" })]);
  assert.equal(sahne.lights.length, 4);
  assert.deepEqual(level.tanim().isiklar?.map((i) => i.id), ["i1", "i2"]);
  const b = level.isiklar.isik("i2")!;
  assert.deepEqual([b.position.x, b.position.y, b.position.z], [5, 6, 7]);
  assert.equal(b.intensity, 3);
  assert.equal(b.range, 12);
  assert.equal(b.diffuse.r, 1);
  assert.equal(b.diffuse.g, 0);
  assert.equal(level.isiklar.say(), 2);
});
test("kimlikler(): kurulu ışıkların kimliği, gizliler dahil; kalkan listeden düşer",() => {
  const { level } = kur([nokta(), nokta({ gizli: true })]);
  assert.deepEqual([...level.isiklar.kimlikler()], ["i1", "i2"]);
  level.ayarla({ ...level.tanim(), isiklar: level.tanim().isiklar!.slice(0, 1) });
  assert.deepEqual([...level.isiklar.kimlikler()], ["i1"]);
});
test("ayarla: aynı kimlik YERİNDE güncellenir (yeni ışık kurulmaz), kalkan yok edilir", () => {
  const { sahne, level } = kur([nokta(), nokta({ konum: [9, 9, 9] })]);
  const ilk = level.isiklar.isik("i1")!;
  const t = level.tanim();
  t.isiklar = [{ ...t.isiklar![0]!, konum: [4, 4, 4], siddet: 7 }];   // i2 kalktı
  level.ayarla(t);
  assert.equal(level.isiklar.isik("i1"), ilk, "aynı nesne");
  assert.deepEqual([ilk.position.x, ilk.intensity], [4, 7]);
  assert.equal(level.isiklar.isik("i2"), null);
  assert.equal(aktorler(sahne).length, 1);
});
test("ayarla: kimliksiz yeni ışık boş kimliği alır, var olanların kimliği kaymaz", () => {
  const { sahne, level } = kur([nokta(), nokta({ konum: [9, 9, 9] })]);
  const t = level.tanim();
  t.isiklar = [t.isiklar![0]!, t.isiklar![1]!, nokta({ konum: [0, 0, 1] })];   // üçüncü kimliksiz
  level.ayarla(t);
  assert.deepEqual(level.tanim().isiklar?.map((i) => i.id), ["i1", "i2", "i3"]);
  assert.equal(aktorler(sahne).length, 3);
  assert.deepEqual([level.isiklar.isik("i2")!.position.x], [9]);
});
test("gizli ışık sahnede kapalı ve sayılmaz; açılınca geri gelir", () => {
  const { level } = kur([nokta()]);
  const t = level.tanim(); t.isiklar![0]!.gizli = true; level.ayarla(t);
  assert.equal(level.isiklar.isik("i1")!.isEnabled(false), false);
  assert.equal(level.isiklar.say(), 0);
  const u = level.tanim(); u.isiklar![0]!.gizli = false; level.ayarla(u);
  assert.equal(level.isiklar.say(), 1);
});
test("ışıkları boşaltmak hepsini yok eder", () => {
  const { sahne, level } = kur([nokta(), nokta()]);
  const t = level.tanim(); t.isiklar = []; level.ayarla(t);
  assert.equal(aktorler(sahne).length, 0);
});
test("geçersiz ayarla (bozuk ışık) hata verir ve eski ışıklar kalır", () => {
  const { sahne, level } = kur([nokta()]);
  const t = level.tanim(); t.isiklar![0]!.menzil = -5;
  assert.throws(() => level.ayarla(t), /isiklar\[0\]\.menzil/);
  assert.equal(aktorler(sahne).length, 1);
  assert.equal(level.isiklar.isik("i1")!.range, 8);
});
test("yokEt ışık aktörlerini de temizler", () => {
  const { sahne, level } = kur([nokta(), nokta()]);
  level.yokEt();
  assert.equal(aktorler(sahne).length, 0);
});
test("tavan kadar ışık + güneş + dolgu birlikte kurulur", () => {
  const { sahne } = kur(Array.from({ length: ISIK_TAVANI }, (_, i) => nokta({ konum: [i, 1, 0] })));
  assert.equal(sahne.lights.length, 2 + ISIK_TAVANI);
});

// ── malzeme ──
test("ışıklı malzeme güneş + dolgu + ışık tavanı kadar ışığı aynı anda işler; pişmiş malzeme varsayılan kalır", () => {
  const sahne = new Scene(new NullEngine());
  assert.equal(malzemeKur(sahne, "a", "isikli").maxSimultaneousLights, MALZEME_ISIK_TAVANI);
  assert.equal(MALZEME_ISIK_TAVANI, 2 + ISIK_TAVANI);
  assert.equal(malzemeKur(sahne, "b", "pismis").maxSimultaneousLights, 4);
});
