// world/level/cekirdek/aktorOlayYolu.test.ts — aktör olay yolu: dağıtım, süzme, üst/alt yayın, derinlik ve kare tavanı, hata yalıtımı (spec 45 B2).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { BILESEN_TURLERI } from "./bilesenKaydi.ts";
import {
  KARE_OLAY_TAVANI, OLAY_DERINLIK_TAVANI, OLAY_VERI_SINIRI,
  aktorHiyerarsisi, olayAdiHatasi, olayVerisiHatasi, aktorOlayYoluKur, type AktorOlayi, type AktorOlayYolu,
} from "./aktorOlayYolu.ts";

/** Hiyerarşi: kutu → lamba → (kilic: beden:orion). */
const agac = aktorHiyerarsisi([{ id: "a", ust: "b" }, { id: "b", ust: "c" }, { id: "c" }, { id: "x", ust: "beden:orion" }, { id: "p1", ust: "p" }, { id: "p2", ust: "p" }, { id: "g1", ust: "p1" }]);
const yol = (ek: Partial<Parameters<typeof aktorOlayYoluKur>[0]> = {}): AktorOlayYolu => aktorOlayYoluKur({ ...agac, hata: () => {}, ...ek });
const topla = (y: AktorOlayYolu, aktor = "*", ad = "*"): AktorOlayi[] => { const l: AktorOlayi[] = []; y.dinle(aktor, ad, (o) => l.push(o)); return l; };

test("yayinla: tam adres + olay adı eşleşenlere gider; veri ve alanlar doğru", () => {
  const y = yol();
  const tam = topla(y, "kutu", "tetik.girdi"), baskaAktor = topla(y, "lamba", "tetik.girdi"), baskaOlay = topla(y, "kutu", "tetik.cikti");
  const r = y.yayinla("kutu", "tetik.girdi", { kim: "orion", mesafe: 1.5, icerde: true });
  assert.deepEqual(r, { ok: true, iletilen: 1 });
  assert.equal(tam.length, 1);
  assert.deepEqual(tam[0], { aktor: "kutu", kaynak: "kutu", ad: "tetik.girdi", veri: { kim: "orion", mesafe: 1.5, icerde: true }, derinlik: 0 });
  assert.equal(baskaAktor.length + baskaOlay.length, 0);
});

test("joker: aktör '*' her aktörün olayını, ad '*' her olayı alır; veri verilmezse boş nesne", () => {
  const y = yol();
  const hepsi = topla(y), herAktor = topla(y, "*", "ac"), herOlay = topla(y, "kutu", "*");
  y.yayinla("kutu", "ac");
  y.yayinla("lamba", "ac");
  y.yayinla("kutu", "kapat");
  assert.deepEqual([hepsi.length, herAktor.length, herOlay.length], [3, 2, 2]);
  assert.deepEqual(hepsi[0]!.veri, {});
});

test("dinle: dönen fonksiyon aboneliği kaldırır; abone sayısı doğru; ikinci kaldırma zararsız", () => {
  const y = yol();
  const l: AktorOlayi[] = [];
  const kaldir = y.dinle("kutu", "ac", (o) => l.push(o));
  assert.equal(y.abone(), 1);
  y.yayinla("kutu", "ac");
  kaldir(); kaldir();
  assert.equal(y.abone(), 0);
  assert.deepEqual(y.yayinla("kutu", "ac"), { ok: true, iletilen: 0 });
  assert.equal(l.length, 1);
});

test("dağıtım sırasında: kaldırılan abone o olayı almaz, eklenen abone o olayı almaz", () => {
  const y = yol();
  const alinan: string[] = [];
  let kaldirB: () => void = () => {};
  y.dinle("k", "o", () => { alinan.push("a"); kaldirB(); y.dinle("k", "o", () => alinan.push("yeni")); });
  kaldirB = y.dinle("k", "o", () => alinan.push("b"));
  y.yayinla("k", "o");
  assert.deepEqual(alinan, ["a"], "b kaldırıldı, yeni bu olayı görmedi");
  y.yayinla("k", "o");
  assert.deepEqual(alinan, ["a", "a", "yeni"], "ikinci olayda yeni abone alır");
});

test("geçersiz girdi: adres, olay adı ve veri nedenle reddedilir, dağıtılmaz, sayıma girmez", () => {
  const y = yol();
  const l = topla(y);
  for (const [aktor, ad, veri, neden] of [
    ["", "ac", undefined, /adres/],
    ["k".repeat(65), "ac", undefined, /adres/],
    ["k", "", undefined, /olay adı/],
    ["k", "a b", undefined, /harf, rakam/],
    ["k", "*", undefined, /harf, rakam/],
    ["k", "o".repeat(65), undefined, /en çok 64/],
    ["k", "ac", [] as unknown as Record<string, never>, /nesne olmalı/],
    ["k", "ac", { x: Number.NaN }, /sayı/],
  ] as const) {
    const r = y.yayinla(aktor, ad, veri as never);
    assert.equal(r.ok, false, `${aktor}/${ad}`);
    if (!r.ok) assert.match(r.neden, neden);
  }
  assert.equal(l.length, 0);
  assert.equal(y.sayim().yayinlanan, 0);
});

test("olayAdiHatasi / olayVerisiHatasi tabloları (sınırlar dahil)", () => {
  for (const iyi of ["ac", "tetik.girdi", "soket.takildi", "_x", "a-b_c.d9", "o".repeat(64)]) assert.equal(olayAdiHatasi(iyi), null, iyi);
  for (const kotu of ["", ".x", "-x", "a b", "a/b", "o".repeat(65), 5, null]) assert.notEqual(olayAdiHatasi(kotu), null, String(kotu));
  assert.equal(olayVerisiHatasi(undefined), null);
  assert.equal(olayVerisiHatasi({}), null);
  const sekiz = Object.fromEntries(Array.from({ length: OLAY_VERI_SINIRI.anahtar }, (_, i) => [`k${i}`, i]));
  assert.equal(olayVerisiHatasi(sekiz), null, "tam tavan geçer");
  assert.match(olayVerisiHatasi({ ...sekiz, fazla: 1 })!, /en çok 8 alan/);
  assert.equal(olayVerisiHatasi({ m: "x".repeat(OLAY_VERI_SINIRI.metin) }), null);
  assert.match(olayVerisiHatasi({ m: "x".repeat(OLAY_VERI_SINIRI.metin + 1) })!, /'m'/);
  for (const kotu of [{ n: { ic: 1 } }, { n: [1] }, { n: null }, { n: Number.POSITIVE_INFINITY }, { n: undefined }]) assert.notEqual(olayVerisiHatasi(kotu), null, JSON.stringify(kotu));
  assert.match(olayVerisiHatasi("metin")!, /nesne olmalı/);
  assert.match(olayVerisiHatasi(null)!, /nesne olmalı/);
});

test("dinleyici hatası yalıtılır: ötekiler çalışır, sayılır, hata kancasına gider, iletilen yalnız başarılıları sayar", () => {
  const hatalar: unknown[] = [];
  const y = yol({ hata: (e) => hatalar.push(e) });
  const l: AktorOlayi[] = [];
  y.dinle("k", "o", () => { throw new Error("patladı"); });
  y.dinle("k", "o", (o) => l.push(o));
  const r = y.yayinla("k", "o");
  assert.deepEqual(r, { ok: true, iletilen: 1 });
  assert.equal(l.length, 1);
  assert.equal(hatalar.length, 1);
  assert.equal(y.sayim().dinleyiciHatasi, 1);
  assert.equal(y.sayim().iletilen, 1);
});

test("derinlik tavanı: kendini tetikleyen dinleyici tavanda durur, atlanan sayılır, sonuç nedenli", () => {
  const y = yol();
  // İç içe çağrılar dışarı doğru döner: `sonuclar[0]` EN İÇTEKİ (tavanı aşan) çağrının sonucudur.
  const sonuclar: ReturnType<AktorOlayYolu["yayinla"]>[] = [];
  let n = 0;
  y.dinle("k", "dongu", () => { n++; sonuclar.push(y.yayinla("k", "dongu")); });
  const ilk = y.yayinla("k", "dongu");
  assert.equal(n, OLAY_DERINLIK_TAVANI, "tam tavan kadar iç içe dağıtım");
  assert.equal(ilk.ok, true);
  assert.equal(sonuclar.length, OLAY_DERINLIK_TAVANI);
  const en_ic = sonuclar[0]!;
  assert.equal(en_ic.ok, false);
  if (!en_ic.ok) { assert.equal(en_ic.atlandi, "derinlik"); assert.match(en_ic.neden, /en çok 8 derinlik/); }
  assert.ok(sonuclar.slice(1).every((r) => r.ok), "tavanın altındakiler başarılı");
  assert.equal(y.sayim().atlananDerinlik, 1);
  const derinlikler: number[] = [];
  const y2 = yol({ derinlikTavani: 3 });
  y2.dinle("k", "d", (o) => { derinlikler.push(o.derinlik); y2.yayinla("k", "d"); });
  y2.yayinla("k", "d");
  assert.deepEqual(derinlikler, [0, 1, 2], "derinlik alanı 0'dan başlar");
});

test("derinlik sayacı dağıtım bitince (hata olsa da) sıfırlanır", () => {
  const y = yol({ derinlikTavani: 2 });
  y.dinle("k", "o", () => { throw new Error("x"); });
  for (let i = 0; i < 5; i++) assert.equal(y.yayinla("k", "o").ok, true, `${i}. yayın`);
  assert.equal(y.sayim().atlananDerinlik, 0);
});

test("kare tavanı: aşılan atlanır; kareBasi sayacı sıfırlar; varsayılan tavan 256", () => {
  assert.equal(KARE_OLAY_TAVANI, 256);
  const y = yol({ kareTavani: 3 });
  const l = topla(y);
  for (let i = 0; i < 3; i++) assert.equal(y.yayinla("k", "o").ok, true);
  const r = y.yayinla("k", "o");
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.atlandi, "kare"); assert.match(r.neden, /kare başına en çok 3/); }
  assert.equal(l.length, 3);
  assert.equal(y.sayim().atlananKare, 1);
  y.kareBasi();
  assert.equal(y.yayinla("k", "o").ok, true);
  assert.equal(l.length, 4);
});

test("ustuneYayinla: yakından uzağa, beden üstü dahil; kaynak yayınlayan, aktör ulaşılan", () => {
  const y = yol();
  const l = topla(y);
  assert.deepEqual(y.ustuneYayinla("a", "x", { n: 1 }), { ok: true, iletilen: 2 });
  assert.deepEqual(l.map((o) => [o.aktor, o.kaynak]), [["b", "a"], ["c", "a"]]);
  assert.deepEqual(l[0]!.veri, { n: 1 });
  l.length = 0;
  y.ustuneYayinla("x", "kilic_cekildi");
  assert.deepEqual(l.map((o) => o.aktor), ["beden:orion"], "kılıç → bedene haber");
  assert.deepEqual(y.ustuneYayinla("c", "x"), { ok: true, iletilen: 0 }, "üstü olmayan: 0, hata değil");
  assert.equal(y.ustuneYayinla("", "x").ok, false);
  assert.equal(y.ustuneYayinla("a", "kötü ad").ok, false);
});

test("altlaraYayinla: genişlik sırası, torunlar dahil, kendisi dahil değil", () => {
  const y = yol();
  const l = topla(y);
  assert.deepEqual(y.altlaraYayinla("p", "ac"), { ok: true, iletilen: 3 });
  assert.deepEqual(l.map((o) => o.aktor), ["p1", "p2", "g1"]);
  assert.ok(l.every((o) => o.kaynak === "p"));
  assert.deepEqual(y.altlaraYayinla("g1", "ac"), { ok: true, iletilen: 0 });
  assert.equal(y.altlaraYayinla("p", "").ok, false);
});

test("hiyerarşi döngüsü (sağlayıcı bozuk olsa da) sonsuz döngüye girmez", () => {
  const dongulu = aktorHiyerarsisi([{ id: "a", ust: "b" }, { id: "b", ust: "a" }]);
  const y = yol({ ...dongulu });
  const l = topla(y);
  assert.deepEqual(y.ustuneYayinla("a", "x"), { ok: true, iletilen: 1 });
  assert.deepEqual(l.map((o) => o.aktor), ["b"]);
  l.length = 0;
  assert.deepEqual(y.altlaraYayinla("a", "x"), { ok: true, iletilen: 1 });
  assert.deepEqual(l.map((o) => o.aktor), ["b"]);
});

test("toplu yayın tavanda kalanı keser: ilk atlanan sonucu döner, öncekiler teslim edilmiş olur", () => {
  const y = yol({ kareTavani: 2 });
  const l = topla(y);
  const r = y.altlaraYayinla("p", "ac");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.atlandi, "kare");
  assert.deepEqual(l.map((o) => o.aktor), ["p1", "p2"]);
  assert.equal(y.sayim().atlananKare, 1, "kalan hedeflere boşuna denenmedi");
});

test("aktorHiyerarsisi: kimliksiz ve ust'u metin olmayan aktör girmez; alt sırası liste sırası", () => {
  const h = aktorHiyerarsisi([{ ust: "p" }, { id: 5, ust: "p" }, { id: "c1", ust: 7 }, { id: "c2", ust: "p" }, { id: "c3", ust: "p" }]);
  assert.deepEqual(h.altlari("p"), ["c2", "c3"]);
  assert.equal(h.ustu("c1"), undefined);
  assert.equal(h.ustu("c2"), "p");
  assert.deepEqual(h.altlari("yok"), []);
});

test("sayim() kopya döner (dışarıdan değiştirilemez) ve birikir", () => {
  const y = yol();
  topla(y);
  y.yayinla("k", "o"); y.yayinla("k", "o");
  const s = y.sayim();
  s.yayinlanan = 999;
  assert.deepEqual([y.sayim().yayinlanan, y.sayim().iletilen], [2, 2]);
});

test("bileşen türlerinin yerleşik olay adları geçerli olay adıdır (iki kayıt ayrışmasın)", () => {
  const adlar = BILESEN_TURLERI.flatMap((t) => t.olaylar);
  assert.ok(adlar.length >= 6);
  for (const ad of adlar) assert.equal(olayAdiHatasi(ad), null, ad);
  assert.equal(new Set(adlar).size, adlar.length, "yerleşik olay adları benzersiz");
});
