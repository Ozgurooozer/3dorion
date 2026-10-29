// uygulama/yapi/level/isikModeli.test.ts — Işık düzenleme işlemleri (spec 42 Y4): ekle/güncelle/sil, tavan, doğrulama nedenleri, diske YALNIZ ışık yazımı.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { diskeYaz, isikEkle, isikGuncelle, isikSil, yeniNoktaIsik, YENI_ISIK } from "./isikModeli.ts";
import { ISIK_TAVANI, levelTanimiDogrula, type IsikAktoru, type LevelTanimi } from "../../../world/level/cekirdek/levelTanimi.ts";
import { ornekTanim } from "../../../world/level/cekirdek/ornekTanim.ts";

const taban = (): LevelTanimi => { const t = ornekTanim(); t.katmanlar = []; return t; };
const ekle = (t: LevelTanimi, ek: Partial<IsikAktoru> = {}) => {
  const r = isikEkle(t, { ...yeniNoktaIsik([1, 2, 3], t.isiklar ?? []), ...ek });
  if (!r.ok) throw new Error(r.neden);
  return r.deger;
};

test("yeni nokta ışık: varsayılan değerler, konum kopyalanır, adlar çakışmaz", () => {
  const k: [number, number, number] = [1, 2, 3];
  const a = yeniNoktaIsik(k, []);
  assert.deepEqual([a.tur, a.renk, a.siddet, a.menzil, a.ad], ["nokta", YENI_ISIK.renk, YENI_ISIK.siddet, YENI_ISIK.menzil, "Nokta ışık 1"]);
  k[0] = 99; assert.equal(a.konum[0], 1);
  assert.equal(yeniNoktaIsik(k, [a, { ...a, ad: "Nokta ışık 3" }]).ad, "Nokta ışık 2");
});
test("ışık ekleme: kimlik i1, i2…; nesne kimlikleriyle çakışmaz; tanım doğrulanır", () => {
  let t = taban(); t.nesneler = [{ id: "i1", varlik: "a", konum: [0, 0, 0], donus: 0, olcek: 1 }];
  const a = ekle(t); assert.equal(a.id, "i2"); t = a.tanim;
  const b = ekle(t); assert.equal(b.id, "i3");
  assert.equal(levelTanimiDogrula(b.tanim).ok, true);
});
test("ışık ekleme: tavanda 'en çok N ışık' nedeniyle reddedilir, tanım değişmez", () => {
  let t = taban();
  for (let i = 0; i < ISIK_TAVANI; i++) t = ekle(t).tanim;
  const r = isikEkle(t, yeniNoktaIsik([0, 0, 0], t.isiklar ?? []));
  assert.deepEqual(r, { ok: false, neden: `en çok ${ISIK_TAVANI} ışık` });
  assert.equal(t.isiklar?.length, ISIK_TAVANI);
});
test("ışık güncelleme: yalnız verilen alanlar değişir; kaynak tanım bozulmaz; kötü değer nedenle reddedilir", () => {
  const { tanim, id } = ekle(taban());
  const g = isikGuncelle(tanim, id, { siddet: 3, konum: [5, 5, 5], gizli: true });
  assert.ok(g.ok);
  if (g.ok) {
    const i = g.deger.isiklar![0]!;
    assert.deepEqual([i.siddet, i.konum, i.gizli, i.menzil], [3, [5, 5, 5], true, YENI_ISIK.menzil]);
  }
  assert.equal(tanim.isiklar![0]!.siddet, YENI_ISIK.siddet, "kaynak aynı");
  const kotu = isikGuncelle(tanim, id, { menzil: -1 });
  assert.equal(kotu.ok, false);
  if (!kotu.ok) assert.match(kotu.neden, /menzil/);
  assert.equal(isikGuncelle(tanim, id, { renk: "yok-renk" }).ok, false);
});
test("olmayan kimlik: güncelleme ve silme 'ışık yok' der", () => {
  const t = taban();
  assert.deepEqual(isikGuncelle(t, "i9", { siddet: 1 }), { ok: false, neden: "ışık yok: i9" });
  assert.deepEqual(isikSil(t, "i9"), { ok: false, neden: "ışık yok: i9" });
});
test("ışık silme: yalnız o kalkar, ötekilerin kimliği kaymaz", () => {
  let t = taban(); t = ekle(t).tanim; t = ekle(t).tanim; t = ekle(t).tanim;
  const s = isikSil(t, "i2");
  assert.ok(s.ok);
  if (s.ok) assert.deepEqual(s.deger.isiklar?.map((i) => i.id), ["i1", "i3"]);
});
test("diske yazım: yalnız isiklar alanı değişir, öteki alanlar diskteki hâliyle kalır", () => {
  const disk = taban(); disk.ad = "diskteki ad"; disk.palet["mavi"] = "#111111";
  const r = diskeYaz(JSON.stringify(disk), [{ id: "i1", tur: "nokta", konum: [0, 1, 0], renk: "mavi", siddet: 2, menzil: 6 }]);
  assert.ok(r.ok);
  if (r.ok) {
    const y = JSON.parse(r.deger) as LevelTanimi;
    assert.equal(y.ad, "diskteki ad"); assert.equal(y.palet["mavi"], "#111111");
    assert.deepEqual(y.isiklar?.map((i) => i.id), ["i1"]);
    assert.ok(r.deger.endsWith("\n"));
  }
});
test("diske yazım: liste boşsa isiklar alanı kalkar; bozuk disk metni ve geçersiz ışık reddedilir", () => {
  const disk = taban(); disk.isiklar = [{ id: "i1", tur: "nokta", konum: [0, 0, 0], renk: "mavi", siddet: 1, menzil: 5 }];
  const bos = diskeYaz(JSON.stringify(disk), []);
  assert.ok(bos.ok);
  if (bos.ok) assert.equal("isiklar" in (JSON.parse(bos.deger) as object), false);
  assert.deepEqual(diskeYaz("{bozuk", []), { ok: false, neden: "level dosyası JSON değil" });
  assert.deepEqual(diskeYaz("[1]", []), { ok: false, neden: "level dosyası nesne değil" });
  assert.equal(diskeYaz(JSON.stringify(taban()), [{ tur: "nokta", konum: [0, 0, 0], renk: "mavi", siddet: -1, menzil: 5 }]).ok, false);
});
