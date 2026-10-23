// protocol/sekansKamera.test.ts — sekansın isimli kameraları ve kamera kesmeleri: biçim kuralları (spec 38 §7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sekansDogrula, SEKANS_SINIRLARI } from "./sekans.ts";

const taban = (ek: Record<string, unknown> = {}) => ({ surum: 1, ad: "t", fps: 30, sure_kare: 120, baglamalar: [], izler: [], ...ek });
const kam = (id: string, ek: Record<string, unknown> = {}) => ({ id, ad: `K ${id}`, konum: [0, 1.6, 3], hedef: [0, 1.4, 0], fov: 50, ...ek });
const hata = (r: ReturnType<typeof sekansDogrula>): string => (r.ok ? "" : r.hata);

test("kamera: kamerasız eski sekans aynen geçerli ve alanlar temiz kopyada YOK", () => {
  const r = sekansDogrula(taban());
  assert.ok(r.ok);
  assert.ok(!("kameralar" in r.deger) && !("kesmeler" in r.deger));
});

test("kamera: geçerli kamera ve kesmeler temiz kopyada kalır (gecis varsayılan 'kesme', gecis_kare 0)", () => {
  const r = sekansDogrula(taban({ kameralar: [kam("a"), kam("b")], kesmeler: [{ kare: 0, kamera: "a" }, { kare: 60, kamera: "b", gecis: "yumusak", gecis_kare: 15 }] }));
  assert.ok(r.ok, hata(r));
  assert.deepEqual(r.deger.kesmeler, [{ kare: 0, kamera: "a", gecis: "kesme", gecis_kare: 0 }, { kare: 60, kamera: "b", gecis: "yumusak", gecis_kare: 15 }]);
  assert.equal(r.deger.kameralar?.length, 2);
});

test("kamera: tavanlar — 9. kamera ve 65. kesme reddedilir", () => {
  assert.match(hata(sekansDogrula(taban({ kameralar: Array.from({ length: SEKANS_SINIRLARI.kamera + 1 }, (_, i) => kam(`k${i}`)) }))), /en çok 8/);
  const l = Array.from({ length: SEKANS_SINIRLARI.kesme + 1 }, (_, i) => ({ kare: i, kamera: "a" }));
  assert.match(hata(sekansDogrula(taban({ kameralar: [kam("a")], kesmeler: l, sure_kare: 200 }))), /en çok 64/);
});

test("kamera: konum ile hedef aynı nokta, fov aralık dışı, koordinat sınır dışı, kimlik tekrarı → neden", () => {
  assert.match(hata(sekansDogrula(taban({ kameralar: [kam("a", { hedef: [0, 1.6, 3] })] }))), /aynı nokta/);
  assert.match(hata(sekansDogrula(taban({ kameralar: [kam("a", { fov: 5 })] }))), /fov/);
  assert.match(hata(sekansDogrula(taban({ kameralar: [kam("a", { fov: 130 })] }))), /fov/);
  assert.match(hata(sekansDogrula(taban({ kameralar: [kam("a", { konum: [5000, 0, 0] })] }))), /±1000/);
  assert.match(hata(sekansDogrula(taban({ kameralar: [kam("a"), kam("a")] }))), /iki kez/);
  assert.match(hata(sekansDogrula(taban({ kameralar: [kam("a", { konum: [0, 1] })] }))), /üç sayı/);
  assert.match(hata(sekansDogrula(taban({ kameralar: [kam("a", { ad: "  " })] }))), /ad/);
});

test("kesme: kare KESİN artar, kamera var olmalı, kare sekans içinde", () => {
  const k = { kameralar: [kam("a")] };
  assert.match(hata(sekansDogrula(taban({ ...k, kesmeler: [{ kare: 10, kamera: "a" }, { kare: 10, kamera: "a" }] }))), /KESİN/);
  assert.match(hata(sekansDogrula(taban({ ...k, kesmeler: [{ kare: 0, kamera: "yok" }] }))), /kameralarda yok/);
  assert.match(hata(sekansDogrula(taban({ ...k, kesmeler: [{ kare: 121, kamera: "a" }] }))), /0–120/);
  assert.match(hata(sekansDogrula(taban({ ...k, kesmeler: [{ kare: 1.5, kamera: "a" }] }))), /tamsayı/);
});

test("kesme: 'yumusak' geçişte gecis_kare ≥ 1 ve ≤ 90; 'kesme'de gecis_kare 0'a sıfırlanır; bilinmeyen geçiş reddedilir", () => {
  const k = { kameralar: [kam("a"), kam("b")] };
  assert.match(hata(sekansDogrula(taban({ ...k, kesmeler: [{ kare: 0, kamera: "a", gecis: "yumusak", gecis_kare: 0 }] }))), /en az 1/);
  assert.match(hata(sekansDogrula(taban({ ...k, kesmeler: [{ kare: 0, kamera: "a", gecis: "yumusak", gecis_kare: 91 }] }))), /0–90/);
  assert.match(hata(sekansDogrula(taban({ ...k, kesmeler: [{ kare: 0, kamera: "a", gecis: "daire" }] }))), /geçersiz/);
  const r = sekansDogrula(taban({ ...k, kesmeler: [{ kare: 0, kamera: "a", gecis: "kesme", gecis_kare: 40 }] }));
  assert.ok(r.ok); assert.equal(r.deger.kesmeler![0]!.gecis_kare, 0);
});

test("kamera: koordinat dizisi kopyalanır (giriş nesnesi değişince temiz kopya değişmez)", () => {
  const kameralar = [kam("a")];
  const r = sekansDogrula(taban({ kameralar }));
  assert.ok(r.ok);
  kameralar[0]!.konum[0] = 99;
  assert.equal(r.deger.kameralar![0]!.konum[0], 0);
});
