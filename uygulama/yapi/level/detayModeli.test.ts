// uygulama/yapi/level/detayModeli.test.ts — Details satırları (spec 43 A2): şemadan satırlar, graf eksik uyarısı, değişkenler, metinden değer çözümü.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEGISKEN_ILK_DEGERI, degiskenDegeriCoz, degiskenTipi, detaySatirlari } from "./detayModeli.ts";
import { ornekTanim } from "../../../world/level/cekirdek/ornekTanim.ts";
import type { LevelTanimi } from "../../../world/level/cekirdek/levelTanimi.ts";

const taban = (): LevelTanimi => {
  const t = ornekTanim(); t.katmanlar = [];
  t.nesneler = [{ id: "n1", varlik: "kutu", konum: [1, 0, 2], donus: 90, olcek: 2 }];
  t.isiklar = [{ id: "i1", tur: "nokta", ad: "Lamba", konum: [0, 2, 0], renk: "#ffd9a0", siddet: 1.5, menzil: 8, graf: "titrek", degiskenler: { hiz: 2, mod: "gece", acik: true } }];
  return t;
};

test("ışık: şemadaki her alan sırayla, değerlerle; sonra graf, sonra değişkenler (eklenme sırası)", () => {
  const r = detaySatirlari(taban(), "i1", ["titrek", "baska"]);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.deger.baslik, "Nokta ışık: Lamba");
  assert.deepEqual(r.deger.satirlar.map((s) => (s.tur === "alan" || s.tur === "degisken" ? s.ad : s.tur)), ["konum", "renk", "siddet", "menzil", "gizli", "graf", "hiz", "mod", "acik"]);
  const siddet = r.deger.satirlar.find((s) => s.tur === "alan" && s.ad === "siddet");
  assert.deepEqual(siddet && siddet.tur === "alan" ? [siddet.deger, siddet.en, siddet.cok] : null, [1.5, 0, 100]);
  const gizli = r.deger.satirlar.find((s) => s.tur === "alan" && s.ad === "gizli");
  assert.equal(gizli && gizli.tur === "alan" ? gizli.deger : null, false, "olmayan alan şemanın varsayılanı");
});

test("graf satırı: seçili varsa listede mi (eksik değilse), yoksa uyarı; seçilmemişse null", () => {
  const t = taban();
  const var_ = detaySatirlari(t, "i1", ["titrek"]);
  const yok = detaySatirlari(t, "i1", ["baska"]);
  assert.ok(var_.ok && yok.ok);
  const g = (r: typeof var_) => (r.ok ? r.deger.satirlar.find((s) => s.tur === "graf") : undefined);
  assert.deepEqual(g(var_) && g(var_)!.tur === "graf" ? { s: (g(var_) as { secili: string | null }).secili, e: (g(var_) as { eksik: boolean }).eksik } : null, { s: "titrek", e: false });
  assert.equal((g(yok) as { eksik: boolean }).eksik, true, "depoda olmayan graf eksik sayılır");
  delete t.isiklar![0]!.graf;
  const bos = detaySatirlari(t, "i1", []);
  assert.ok(bos.ok);
  if (bos.ok) { const s = bos.deger.satirlar.find((x) => x.tur === "graf") as { secili: string | null; eksik: boolean }; assert.deepEqual([s.secili, s.eksik], [null, false]); }
});

test("nesne: dönüş/ölçek vec3'e açılır, değişken türü değerden çıkar, baslık varlık adından", () => {
  const r = detaySatirlari(taban(), "n1", []);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.deger.baslik, "Nesne: kutu");
  const donus = r.deger.satirlar.find((s) => s.tur === "alan" && s.ad === "donus");
  assert.deepEqual(donus && donus.tur === "alan" ? donus.deger : null, [0, 90, 0]);
  assert.equal(r.deger.aktorTuru, "nesne");
  const d = detaySatirlari(taban(), "i1", ["titrek"]);
  if (d.ok) assert.deepEqual(d.deger.satirlar.filter((s) => s.tur === "degisken").map((s) => (s.tur === "degisken" ? s.tip : "")), ["sayi", "metin", "bool"]);
});

test("olmayan aktör nedenli hata", () => assert.deepEqual(detaySatirlari(taban(), "yok", []), { ok: false, neden: "aktör yok: yok" }));

test("değer çözümü: sayı (boşluk/NaN/boş reddedilir), bool yalnız true/false, metin olduğu gibi", () => {
  assert.deepEqual(degiskenDegeriCoz("sayi", " 2.5 "), { ok: true, deger: 2.5 });
  assert.deepEqual(degiskenDegeriCoz("sayi", "0"), { ok: true, deger: 0 });
  assert.equal(degiskenDegeriCoz("sayi", "").ok, false);
  assert.equal(degiskenDegeriCoz("sayi", "  ").ok, false);
  assert.equal(degiskenDegeriCoz("sayi", "abc").ok, false);
  assert.equal(degiskenDegeriCoz("sayi", "Infinity").ok, false);
  assert.deepEqual(degiskenDegeriCoz("bool", "true"), { ok: true, deger: true });
  assert.deepEqual(degiskenDegeriCoz("bool", "false"), { ok: true, deger: false });
  assert.equal(degiskenDegeriCoz("bool", "evet").ok, false);
  assert.deepEqual(degiskenDegeriCoz("metin", " a b "), { ok: true, deger: " a b " });
  assert.deepEqual(degiskenDegeriCoz("metin", ""), { ok: true, deger: "" });
});

test("tür çıkarımı ve ilk değerler: türün sıfırı", () => {
  assert.deepEqual([degiskenTipi(1), degiskenTipi("a"), degiskenTipi(false)], ["sayi", "metin", "bool"]);
  assert.deepEqual(DEGISKEN_ILK_DEGERI, { sayi: 0, metin: "", bool: false });
});
