// uygulama/yapi/level/bilesenDetayModeli.test.ts — Details "Bileşenler + Hiyerarşi" satırları (spec 45 B7). Saf.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { bilesenBolumu, soketAdlari, soyKimlikleri } from "./bilesenDetayModeli.ts";
import { ornekTanim } from "../../../world/level/cekirdek/ornekTanim.ts";
import { BILESEN_TAVANI, BILESEN_TURLERI } from "../../../world/level/cekirdek/bilesenKaydi.ts";
import { BEDEN_SOKETLERI } from "../../aktor/sablon/bedenSoketleri.ts";
import type { LevelTanimi } from "../../../world/level/cekirdek/levelTanimi.ts";

const taban = (): LevelTanimi => {
  const t = ornekTanim(); t.katmanlar = [];
  t.nesneler = [
    { id: "n1", varlik: "araba/araba.glb", ad: "Araba", konum: [0, 0, 0], donus: 0, olcek: 1, bilesenler: [
      { id: "b1", tur: "tetik", ad: "Binme alanı", ayar: { yaricap: 3, kim: "orion" } },
      { id: "b2", tur: "soket", ayar: { ad: "surucu", konum: [0.4, 0.8, 0.2] } },
    ] },
    { id: "n2", varlik: "kilic.glb", konum: [0, 0, 0], donus: 0, olcek: 1, ust: "n1", soket: "surucu" },
    { id: "n3", varlik: "kutu.glb", konum: [0, 0, 0], donus: 0, olcek: 1, ust: "n2" },
    { id: "n4", varlik: "agac.glb", konum: [0, 0, 0], donus: 0, olcek: 1 },
  ];
  t.isiklar = [{ id: "i1", tur: "nokta", ad: "Lamba", konum: [0, 2, 0], renk: "#ffd9a0", siddet: 1.5, menzil: 8 }];
  return t;
};
const sec = (t: LevelTanimi, id: string) => { const r = bilesenBolumu(t, id); assert.ok(r.ok, r.ok ? "" : r.neden); return r.ok ? r.deger : (undefined as never); };

test("bileşen satırları: başlık ad ya da tür etiketi; alanlar şema sırasıyla, yazılmayan alan şema varsayılanıyla", () => {
  const b = sec(taban(), "n1");
  assert.deepEqual(b.bilesenler.map((x) => [x.id, x.tur, x.baslik]), [["b1", "tetik", "Binme alanı"], ["b2", "soket", "Soket"]]);
  const tetik = b.bilesenler[0]!;
  assert.deepEqual(tetik.alanlar.map((a) => a.ad), ["sekil", "yaricap", "boyut", "konum", "kim"]);
  assert.deepEqual(tetik.alanlar.map((a) => a.deger), ["kure", 3, [1, 1, 1], [0, 0, 0], "orion"]);
  assert.deepEqual(tetik.olaylar, ["tetik.girdi", "tetik.cikti"]);
});

test("seçenekli alan (tetik şekli, kim) seçenekleri taşır: panel select çizer", () => {
  const kim = sec(taban(), "n1").bilesenler[0]!.alanlar.find((a) => a.ad === "kim")!;
  assert.deepEqual(kim.secenekler, ["herkes", "orion", "ozyn", "aktor"]);
  const yaricap = sec(taban(), "n1").bilesenler[0]!.alanlar.find((a) => a.ad === "yaricap")!;
  assert.equal("secenekler" in yaricap, false);
  assert.deepEqual([yaricap.en, yaricap.cok, yaricap.birim], [0.1, 100, "m"]);
});

test("bileşensiz aktör: boş liste, dolu değil; ışık da aynı yoldan", () => {
  const t = taban();
  assert.deepEqual(sec(t, "n4").bilesenler, []);
  assert.equal(sec(t, "n4").dolu, false);
  assert.deepEqual(sec(t, "i1").bilesenler, []);
});

test("ekleyebilir: rezerve fizik YOK, kalan türler kayıt sırasıyla; dolu = tavan", () => {
  const b = sec(taban(), "n4");
  assert.deepEqual(b.ekleyebilir.map((x) => x.tur), BILESEN_TURLERI.filter((x) => !x.rezerve).map((x) => x.tur));
  assert.equal(b.ekleyebilir.some((x) => x.tur === "fizik"), false);
  const t = taban();
  t.nesneler![3]!.bilesenler = Array.from({ length: BILESEN_TAVANI }, (_, i) => ({ id: `b${i + 1}`, tur: "tetik" }));
  assert.equal(sec(t, "n4").dolu, true);
});

test("üst seçenekleri: kendisi ve SOYU çıkar (döngü önerilmez), ışıklar ve beden üstü var", () => {
  const b = sec(taban(), "n1");   // n1'in soyu: n2, n3
  assert.deepEqual(b.hiyerarsi.ustSecenekleri.map((s) => s.deger), ["n4", "i1", "beden:orion"]);
  const n3 = sec(taban(), "n3");
  assert.deepEqual(n3.hiyerarsi.ustSecenekleri.map((s) => s.deger), ["n1", "n2", "n4", "i1", "beden:orion"]);
  assert.equal(n3.hiyerarsi.ustSecenekleri[0]!.etiket, "Araba (n1)");
});

test("soy: çocuk, torun; döngülü ham veride de biter ve kökü içermez", () => {
  assert.deepEqual([...soyKimlikleri(taban(), "n1")].sort(), ["n2", "n3"]);
  const d = taban(); d.nesneler![0]!.ust = "n3";   // n1 → n3 → n2 → n1 döngüsü (ham veri)
  assert.deepEqual([...soyKimlikleri(d, "n1")].sort(), ["n2", "n3"]);
});

test("soket seçenekleri: üstün soket bileşenleri; bedende bilinen kemik soketleri; soketsiz üst boş", () => {
  const t = taban();
  assert.deepEqual(soketAdlari(t, "n1"), ["surucu"]);
  assert.deepEqual(soketAdlari(t, "n4"), []);
  assert.deepEqual(soketAdlari(t, "beden:orion"), Object.keys(BEDEN_SOKETLERI));
  assert.deepEqual(soketAdlari(t, "yok"), []);
  const h = sec(t, "n2").hiyerarsi;
  assert.deepEqual([h.ust, h.soket, h.soketSecenekleri, h.eksik], ["n1", "surucu", ["surucu"], false]);
  assert.deepEqual(sec(t, "n4").hiyerarsi.soketSecenekleri, [], "üstü yoksa soket listesi boş");
});

test("eksik üst: level'da olmayan düz kimlik eksik sayılır; beden üstü sayılmaz", () => {
  const t = taban();
  t.nesneler![3]!.ust = "silinmis";
  assert.equal(sec(t, "n4").hiyerarsi.eksik, true);
  t.nesneler![3]!.ust = "beden:flash1";
  assert.equal(sec(t, "n4").hiyerarsi.eksik, false);
  assert.equal(sec(taban(), "n4").hiyerarsi.eksik, false, "üstü yoksa eksik değil");
});

test("olmayan aktör nedenli hata", () => {
  const r = bilesenBolumu(taban(), "yok");
  assert.equal(r.ok, false); assert.match(r.ok ? "" : r.neden, /aktör yok/);
});
