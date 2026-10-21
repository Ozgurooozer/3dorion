// world/surfaces/duvar/semaTuvali.test.ts — şema tanımı ve mesh'siz şema (spec 33 dilim 4). Çizim, yazılan metinleri kaydeden sahte
// 2B bağlamla okunur: canvas yok, piksel değil METİN sınanır (başlık, düğüm etiketleri, toplamlar).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { cizSema } from "./semaCizim.ts";
import { ORION_SEMASI, semaDurumuKur, type SemaTanimi } from "./semaCekirdek.ts";
import { semaTuvaliKur } from "./semaTuvali.ts";

/** Her `fillText`i kaydeden, ölçümü harf sayısından veren, gerisini yutan sahte bağlam. */
function kaydedici(): { bag: CanvasRenderingContext2D; yazilan: string[] } {
  const yazilan: string[] = [];
  const degerler = new Map<PropertyKey, unknown>();
  const bos = () => ({ addColorStop() {} });
  const bag = new Proxy({}, {
    get(_h, ad) {
      if (ad === "fillText") return (m: string) => { yazilan.push(m); };
      if (ad === "measureText") return (m: string) => ({ width: m.length * 8 });
      if (degerler.has(ad)) return degerler.get(ad);
      return bos;
    },
    set(_h, ad, v) { degerler.set(ad, v); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { bag, yazilan };
}

const OLCU = { genislik: 1024, yukseklik: 512 };
const KUCUK: SemaTanimi = {
  baslik: "DENEME AKIŞI",
  dugumler: [
    { ad: "a", etiket: "GİRİŞ-A", lob: "yerel", sutun: 0, satir: 0, aciklama: "a" },
    { ad: "b", etiket: "ÇIKIŞ-B", lob: "ortak", sutun: 1, satir: 0, aciklama: "b" },
  ],
  oklar: [["a", "b"]],
  sutunAdlari: ["BİR", "İKİ"],
  toplamlar: [["a", "a"]],
};

function ciz(tanim?: SemaTanimi): string[] {
  const { bag, yazilan } = kaydedici();
  cizSema(bag, OLCU, { durum: semaDurumuKur(), altDurum: "", simdi: 0, ...(tanim ? { tanim } : {}) });
  return yazilan;
}

test("tanım verilmezse duvarın eski başlığı çizilir (Orion'un şeması aynen)", () => {
  assert.ok(ciz().includes("ZİHİN AKIŞI"));
});

test("tanım verilmezse alt şeridin toplamları eski biçimde", () => {
  assert.ok(ciz().includes("algı 0 · düşünce 0 · niyet 0"));
});

test("Orion tanımı açıkça verilince de aynı metinler çizilir", () => {
  assert.deepEqual(ciz(ORION_SEMASI), ciz());
});

test("başka bir tanım kendi başlığını ve düğüm etiketlerini çizer", () => {
  const y = ciz(KUCUK);
  assert.deepEqual(["DENEME AKIŞI", "GİRİŞ-A", "ÇIKIŞ-B"].map((m) => y.includes(m)), [true, true, true]);
});

test("başka bir tanımda Orion'un DÜŞÜNCE düğümü çizilmez", () => {
  assert.equal(ciz(KUCUK).includes("DÜŞÜNCE"), false);
});

test("mesh'siz şema: vuruş sayacı artar", () => {
  const s = semaTuvaliKur({ tanim: KUCUK, olcu: OLCU });
  s.vur("a"); s.vur("a");
  assert.equal(s.oku("a").sayac, 2);
});

test("mesh'siz şema: tıklama hiçbir şey seçmez (detay görünümü yok)", () => {
  const s = semaTuvaliKur({ tanim: KUCUK, olcu: OLCU });
  assert.deepEqual([s.tikla(0.1, 0.5), s.hedef(0.1, 0.5), s.secili()], [false, null, null]);
});

test("mesh'siz şema kendi tanımıyla çizer", () => {
  const { bag, yazilan } = kaydedici();
  semaTuvaliKur({ tanim: KUCUK, olcu: OLCU }).ciz(bag);
  assert.ok(yazilan.includes("DENEME AKIŞI"));
});
