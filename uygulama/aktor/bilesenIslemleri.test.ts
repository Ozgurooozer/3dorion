// uygulama/aktor/bilesenIslemleri.test.ts — Details bileşen düzenleme işlemleri (spec 45 B7). Saf.
// Sorulan: ekle/sil/yaz kaynak tanımı bozmadan doğru yeni tanım veriyor mu; reddedilen işlem eski hâli koruyor mu; hata kodu NEREDE olduğunu söylüyor mu?
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { bilesenAdiYaz, bilesenAyarYaz, bilesenEkle, bilesenleriEkle, bilesenSil, ustAta } from "./bilesenIslemleri.ts";
import { ornekTanim } from "../../world/level/cekirdek/ornekTanim.ts";
import { kodOku } from "../../world/level/cekirdek/aktorHatalari.ts";
import { BILESEN_TAVANI, type BilesenKaydi } from "../../world/level/cekirdek/bilesenKaydi.ts";
import type { LevelTanimi } from "../../world/level/cekirdek/levelTanimi.ts";

const taban = (): LevelTanimi => {
  const t = ornekTanim(); t.katmanlar = [];
  t.nesneler = [
    { id: "n1", varlik: "kutu", konum: [0, 0, 0], donus: 0, olcek: 1 },
    { id: "n2", varlik: "kilic", konum: [0, 0, 0], donus: 0, olcek: 1 },
  ];
  t.isiklar = [{ id: "i1", tur: "nokta", konum: [0, 2, 0], renk: "#ffd9a0", siddet: 1.5, menzil: 8 }];
  return t;
};
const kodu = (r: { ok: boolean; neden?: string }): string | null => (r.ok ? null : kodOku(r.neden));
const bilesenler = (t: LevelTanimi, id: string) => (t.nesneler ?? []).find((n) => n.id === id)?.bilesenler ?? (t.isiklar ?? []).find((n) => n.id === id)?.bilesenler;

test("ekle: şema varsayılanıyla yeni bileşen, kimlik b1; kaynak tanım DEĞİŞMEZ", () => {
  const t = taban(), once = JSON.stringify(t);
  const r = bilesenEkle(t, "n1", "tetik");
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.deger.bilesenId, "b1");
  assert.deepEqual(bilesenler(r.deger.tanim, "n1"), [{ id: "b1", tur: "tetik" }]);
  assert.equal(JSON.stringify(t), once);
});

test("ekle: ikinci bileşen yeni kimlik alır (b2); silinen kimlik aynı aktörde yeniden kullanılabilir ama çakışmaz", () => {
  let t = taban();
  for (const tur of ["tetik", "hareket"]) { const r = bilesenEkle(t, "n1", tur); assert.ok(r.ok); if (r.ok) t = r.deger.tanim; }
  assert.deepEqual(bilesenler(t, "n1")!.map((b) => b.id), ["b1", "b2"]);
  const s = bilesenSil(t, "n1", "b1"); assert.ok(s.ok); if (!s.ok) return;
  const e = bilesenEkle(s.deger, "n1", "isik"); assert.ok(e.ok); if (!e.ok) return;
  assert.equal(new Set(bilesenler(e.deger.tanim, "n1")!.map((b) => b.id)).size, 2, "kimlikler benzersiz");
});

test("ekle: soket benzersiz ad alır (soket1, soket2…), çünkü soket adı varsayılan olamaz", () => {
  let t = taban();
  for (let i = 0; i < 3; i++) { const r = bilesenEkle(t, "n1", "soket"); assert.ok(r.ok); if (r.ok) t = r.deger.tanim; }
  assert.deepEqual(bilesenler(t, "n1")!.map((b) => b.ayar!["ad"]), ["soket1", "soket2", "soket3"]);
});

test("ekle: ışık aktörüne de eklenir (nesne ve ışık aynı yol)", () => {
  const r = bilesenEkle(taban(), "i1", "tetik");
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(bilesenler(r.deger.tanim, "i1")!.length, 1);
});

test("ekle: bilinmeyen tür, rezerve fizik, olmayan aktör, tavan → nedenli ve kodlu ret", () => {
  const t = taban();
  assert.equal(kodu(bilesenEkle(t, "n1", "uydurma")), "AKT-BIL-002");
  const f = bilesenEkle(t, "n1", "fizik");
  assert.equal(kodu(f), "AKT-BIL-002"); assert.match(f.ok ? "" : f.neden, /Havok/);
  assert.equal(kodu(bilesenEkle(t, "yok", "tetik")), "AKT-BIL-001");
  let d = t;
  for (let i = 0; i < BILESEN_TAVANI; i++) { const r = bilesenEkle(d, "n1", "tetik"); assert.ok(r.ok); if (r.ok) d = r.deger.tanim; }
  assert.equal(kodu(bilesenEkle(d, "n1", "tetik")), "AKT-BIL-004", "9. bileşen");
});

test("sil: kalkar; son bileşen silinince `bilesenler` alanı da kalkar (eski biçim); olmayan kimlik AKT-BIL-003", () => {
  const e = bilesenEkle(taban(), "n1", "tetik"); assert.ok(e.ok); if (!e.ok) return;
  const s = bilesenSil(e.deger.tanim, "n1", "b1"); assert.ok(s.ok); if (!s.ok) return;
  assert.equal("bilesenler" in s.deger.nesneler![0]!, false);
  assert.equal(kodu(bilesenSil(e.deger.tanim, "n1", "b9")), "AKT-BIL-003");
  assert.equal(kodu(bilesenSil(e.deger.tanim, "yok", "b1")), "AKT-BIL-001");
});

test("ayarYaz: şemaya uygun değer yazılır; aralık dışı/yanlış tür/bilinmeyen alan reddedilir, eski hâl korunur", () => {
  const e = bilesenEkle(taban(), "n1", "tetik"); assert.ok(e.ok); if (!e.ok) return;
  const t = e.deger.tanim;
  const y = bilesenAyarYaz(t, "n1", "b1", "yaricap", 5); assert.ok(y.ok); if (!y.ok) return;
  assert.deepEqual(bilesenler(y.deger, "n1")![0]!.ayar, { yaricap: 5 });
  const v = bilesenAyarYaz(y.deger, "n1", "b1", "boyut", [2, 3, 4]); assert.ok(v.ok); if (!v.ok) return;
  assert.deepEqual(bilesenler(v.deger, "n1")![0]!.ayar, { yaricap: 5, boyut: [2, 3, 4] });
  assert.equal(kodu(bilesenAyarYaz(t, "n1", "b1", "yaricap", -1)), "AKT-BIL-004", "en az 0.1");
  assert.equal(kodu(bilesenAyarYaz(t, "n1", "b1", "yaricap", "kocaman")), "AKT-BIL-004");
  assert.equal(kodu(bilesenAyarYaz(t, "n1", "b1", "kim", "kral")), "AKT-BIL-004", "seçenek dışı");
  assert.equal(kodu(bilesenAyarYaz(t, "n1", "b1", "yok", 1)), "AKT-BIL-004");
  assert.equal(kodu(bilesenAyarYaz(t, "n1", "b9", "yaricap", 1)), "AKT-BIL-003");
  assert.deepEqual(bilesenler(t, "n1"), [{ id: "b1", tur: "tetik" }], "reddedilenler kaynağı bozmadı");
});

test("ayarYaz: iki soket aynı adı alamaz (level doğrulaması yakalar, AKT-BIL-004)", () => {
  let t = taban();
  for (let i = 0; i < 2; i++) { const r = bilesenEkle(t, "n1", "soket"); assert.ok(r.ok); if (r.ok) t = r.deger.tanim; }
  const r = bilesenAyarYaz(t, "n1", "b2", "ad", "soket1");
  assert.equal(kodu(r), "AKT-BIL-004"); assert.match(r.ok ? "" : r.neden, /yinelenen soket/);
});

test("adYaz: bileşen adı yazılır, boş ad alanı kaldırır", () => {
  const e = bilesenEkle(taban(), "n1", "tetik"); assert.ok(e.ok); if (!e.ok) return;
  const a = bilesenAdiYaz(e.deger.tanim, "n1", "b1", "  Binme alanı "); assert.ok(a.ok); if (!a.ok) return;
  assert.equal(bilesenler(a.deger, "n1")![0]!.ad, "Binme alanı");
  const b = bilesenAdiYaz(a.deger, "n1", "b1", "  "); assert.ok(b.ok); if (!b.ok) return;
  assert.equal("ad" in bilesenler(b.deger, "n1")![0]!, false);
});

test("bilesenleriEkle: yeni kimlikler verir; aynı adlı soket ATLANIR ve söylenir (idempotent); karışık ek kaybolmaz", () => {
  const yeni: BilesenKaydi[] = [{ id: "x", tur: "soket", ayar: { ad: "uc", konum: [0, 1, 0] } }, { id: "y", tur: "soket", ayar: { ad: "sap" } }];
  const r = bilesenleriEkle(taban(), "n2", yeni); assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.deger.eklenen, 2);
  assert.deepEqual(bilesenler(r.deger.tanim, "n2")!.map((b) => b.id), ["b1", "b2"], "kaynak kimliği (x,y) değil, aktöre özgü yeni kimlik");
  const ikinci = bilesenleriEkle(r.deger.tanim, "n2", yeni); assert.ok(ikinci.ok); if (!ikinci.ok) return;
  assert.deepEqual([ikinci.deger.eklenen, ikinci.deger.atlanan], [0, ["uc", "sap"]]);
  assert.equal(bilesenler(ikinci.deger.tanim, "n2")!.length, 2);
});

test("bilesenleriEkle: tavan aşımı hepsini reddeder (yarım ekleme yok)", () => {
  let t = taban();
  for (let i = 0; i < BILESEN_TAVANI - 1; i++) { const r = bilesenEkle(t, "n1", "tetik"); assert.ok(r.ok); if (r.ok) t = r.deger.tanim; }
  const yeni = [{ id: "x", tur: "soket", ayar: { ad: "a" } }, { id: "y", tur: "soket", ayar: { ad: "b" } }];
  assert.equal(kodu(bilesenleriEkle(t, "n1", yeni)), "AKT-BIL-004");
  assert.equal(bilesenler(t, "n1")!.length, BILESEN_TAVANI - 1);
});

test("ustAta: üst + soket yazılır; null bağı çözer (soket de gider); kendi üstü/döngü/olmayan üst reddedilir", () => {
  const e = bilesenEkle(taban(), "n2", "soket"); assert.ok(e.ok); if (!e.ok) return;
  const u = ustAta(e.deger.tanim, "n1", "n2", "soket1"); assert.ok(u.ok); if (!u.ok) return;
  assert.deepEqual([u.deger.nesneler![0]!.ust, u.deger.nesneler![0]!.soket], ["n2", "soket1"]);
  const c = ustAta(u.deger, "n1", null); assert.ok(c.ok); if (!c.ok) return;
  assert.deepEqual(["ust" in c.deger.nesneler![0]!, "soket" in c.deger.nesneler![0]!], [false, false]);
  assert.equal(kodu(ustAta(u.deger, "n1", "n1")), "AKT-BIL-004", "kendi üstü");
  assert.equal(kodu(ustAta(u.deger, "n2", "n1")), "AKT-BIL-004", "döngü (n1 zaten n2'nin çocuğu)");
  assert.equal(kodu(ustAta(taban(), "n1", "yok")), "AKT-BIL-004", "olmayan üst");
  assert.equal(kodu(ustAta(taban(), "n1", "n2", "kötü ad")), "AKT-BIL-004");
  assert.equal(kodu(ustAta(taban(), "yok", "n2")), "AKT-BIL-001");
});

test("ustAta: soketli bağdan SOKETSİZ yeni üste geçince eski soket kalmaz (Details üst değiştirince soketi null yollar)", () => {
  const e = bilesenEkle(taban(), "n2", "soket"); assert.ok(e.ok); if (!e.ok) return;
  const u = ustAta(e.deger.tanim, "n1", "n2", "soket1"); assert.ok(u.ok); if (!u.ok) return;
  const v = ustAta(u.deger, "n1", "i1", null); assert.ok(v.ok); if (!v.ok) return;
  assert.deepEqual([v.deger.nesneler![0]!.ust, "soket" in v.deger.nesneler![0]!], ["i1", false]);
});

test("ustAta: beden üstü ve ışığa bağlama kabul edilir (ışık çocuğu olabilir, ışık da üst olabilir)", () => {
  const b = ustAta(taban(), "n1", "beden:orion", "el_sag"); assert.ok(b.ok);
  const i = ustAta(taban(), "i1", "n1"); assert.ok(i.ok);
  const l = ustAta(taban(), "n1", "i1"); assert.ok(l.ok);
});
