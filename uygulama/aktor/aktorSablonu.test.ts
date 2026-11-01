// uygulama/aktor/aktorSablonu.test.ts — aktör şablonu: çıkar / yerleştir / doğrula / glb'den aktör (spec 45 §8, B6). Saf.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { glbdenSablon, sablonCikar, sablonHatasi, sablonYerlestir, SABLON_AKTOR_TAVANI, type AktorKumesi, type AktorSablonu } from "./aktorSablonu.ts";
import type { IsikAktoru, NesneYeri } from "../../world/level/cekirdek/levelTanimi.ts";
import { kodOku } from "../../world/level/cekirdek/aktorHatalari.ts";

const nesne = (id: string, o: Partial<NesneYeri> = {}): NesneYeri => ({ id, varlik: "kutu", konum: [1, 0, 2], donus: 0, olcek: 1, ...o });
const isik = (id: string, o: Partial<IsikAktoru> = {}): IsikAktoru => ({ id, tur: "nokta", konum: [0, 2, 0], renk: "#fff", siddet: 1, menzil: 5, ...o });
const soketli: NesneYeri["bilesenler"] = [{ id: "s", tur: "soket", ayar: { ad: "uc", konum: [0, 1, 0] } }];
const bos3 = (): [number, number, number] => [0, 0, 0];

/** araba (n1) → tekerlek (n2, ust n1) → jant (n3, ust n2); lamba (i1, ust n1); alakasız n9 ve i2; kök dışarıdaki n0'a bağlı. */
const level = (): AktorKumesi => ({
  nesneler: [
    nesne("n1", { ad: "araba", konum: [10, 0, 5], donus: 90, ust: "n0", soket: "x", grup: "g1", graf: "surus", degiskenler: { hiz: 3 } }),
    nesne("n2", { ust: "n1", konum: [1, 0, 0], bilesenler: soketli }),
    nesne("n3", { ust: "n2" }),
    nesne("n9"),
    nesne("n0"),
  ],
  isiklar: [isik("i1", { ust: "n1", grup: "g1" }), isik("i2")],
});
const cikar = (k = level(), kok = "n1"): AktorSablonu => { const r = sablonCikar("araba", k, kok); assert.ok(r.ok, r.ok ? "" : r.neden); return r.ok ? r.deger : (undefined as never); };

test("çıkar: alt ağaç (kök + torunlar + ışık), alakasız aktör YOK; kimlikler yerel; kök üstsüz ve konumsuz; grup düşer", () => {
  const s = cikar();
  assert.deepEqual(s.aktorler.map((a) => a.id), ["s1", "s2", "s3", "s4"]);   // n9, n0, i2 yok
  const kok = s.aktorler[0]!.nesne!;
  assert.equal(kok.ust, undefined); assert.equal(kok.soket, undefined); assert.deepEqual(kok.konum, [0, 0, 0]);
  assert.equal(kok.donus, 90); assert.equal(kok.graf, "surus"); assert.deepEqual(kok.degiskenler, { hiz: 3 });
  assert.equal("grup" in kok, false); assert.equal("id" in kok, false);
  assert.equal(s.aktorler[1]!.nesne!.ust, "s1"); assert.deepEqual(s.aktorler[1]!.nesne!.konum, [1, 0, 0], "çocuğun yerel konumu aynen kalır");
  assert.equal(s.aktorler[3]!.nesne!.ust, "s2");                              // genişlik sırası: n1, n2, i1, n3
  assert.ok(s.aktorler[2]!.isik); assert.equal(s.aktorler[2]!.isik!.ust, "s1"); assert.equal("grup" in s.aktorler[2]!.isik!, false);
});

test("çıkar: level'ı DEĞİŞTİRMEZ (derin kopya)", () => {
  const k = level(), once = JSON.stringify(k);
  const s = cikar(k); (s.aktorler[0]!.nesne!.degiskenler as Record<string, number>)["hiz"] = 99;
  assert.equal(JSON.stringify(k), once);
});

test("çıkar: kök level'da yoksa AKT-SBL-004; alt ağaç tavanı aşarsa AKT-SBL-001", () => {
  const r = sablonCikar("x", level(), "yok");
  assert.equal(r.ok, false); if (!r.ok) assert.equal(kodOku(r.neden), "AKT-SBL-004");
  const cok: AktorKumesi = { nesneler: [nesne("n1"), ...Array.from({ length: SABLON_AKTOR_TAVANI }, (_, i) => nesne(`c${i}`, { ust: "n1" }))] };
  const t = sablonCikar("x", cok, "n1"); assert.equal(t.ok, false); if (!t.ok) assert.equal(kodOku(t.neden), "AKT-SBL-001");
});

test("yerleştir: yeni kimlikler (level'ınkiyle çakışmaz), kök verilen konumda, ust bağları yeni kimliğe eşlenir", () => {
  const r = sablonYerlestir(cikar(), level(), [3, 0, 4]);
  assert.ok(r.ok); if (!r.ok) return;
  const { nesneler, isiklar, kok } = r.deger;
  assert.deepEqual(nesneler.map((n) => n.id), ["n10", "n11", "n12"]);    // en büyük n9 → n10…
  assert.deepEqual(isiklar.map((i) => i.id), ["i3"]);
  assert.equal(kok, "n10"); assert.deepEqual(nesneler[0]!.konum, [3, 0, 4]);
  assert.equal(nesneler[1]!.ust, "n10"); assert.equal(nesneler[2]!.ust, "n11"); assert.equal(isiklar[0]!.ust, "n10");
  assert.equal(nesneler[0]!.graf, "surus");
});

test("yerleştir: iki kez yerleştirince kimlikler çakışmaz (ikinci çağrı ilkinin eklendiği level ile)", () => {
  const s = cikar(), k = level();
  const a = sablonYerlestir(s, k, bos3()); assert.ok(a.ok); if (!a.ok) return;
  const k2: AktorKumesi = { nesneler: [...k.nesneler!, ...a.deger.nesneler], isiklar: [...k.isiklar!, ...a.deger.isiklar] };
  const b = sablonYerlestir(s, k2, [5, 0, 0]); assert.ok(b.ok); if (!b.ok) return;
  const hepsi = [...k2.nesneler!, ...k2.isiklar!, ...b.deger.nesneler, ...b.deger.isiklar].map((x) => x.id);
  assert.equal(new Set(hepsi).size, hepsi.length);
});

test("yerleştir: şablonu DEĞİŞTİRMEZ; yerleştirilen kopyaya yazmak şablonu bozmaz", () => {
  const s = cikar(), once = JSON.stringify(s);
  const r = sablonYerlestir(s, level(), bos3()); assert.ok(r.ok); if (!r.ok) return;
  (r.deger.nesneler[0]!.degiskenler as Record<string, number>)["hiz"] = 7; r.deger.nesneler[0]!.konum[0] = 50;
  assert.equal(JSON.stringify(s), once);
});

test("yerleştir: ışık tavanı aşılırsa AKT-SBL-005 (level'da 8 ışık varken ışıklı şablon); 7 + 1 sınırda geçer", () => {
  const s = cikar();
  const isiklar = (n: number) => Array.from({ length: n }, (_, i) => isik(`i${i + 1}`));
  const r = sablonYerlestir(s, { ...level(), isiklar: isiklar(8) }, bos3()); assert.equal(r.ok, false); if (!r.ok) assert.equal(kodOku(r.neden), "AKT-SBL-005");
  assert.equal(sablonYerlestir(s, { ...level(), isiklar: isiklar(7) }, bos3()).ok, true);
});

test("yerleştir: geçersiz şablon ve geçersiz konum nedenle reddedilir; beden üstü aynen kalır", () => {
  assert.equal(sablonYerlestir({ surum: 9 }, level(), bos3()).ok, false);
  assert.equal(sablonYerlestir(cikar(), level(), [0, 0, Number.NaN]).ok, false);
  const s = cikar(); s.aktorler[1]!.nesne!.ust = "beden:orion";
  const r = sablonYerlestir(s, level(), bos3()); assert.ok(r.ok); if (r.ok) assert.equal(r.deger.nesneler[1]!.ust, "beden:orion");
});

const hata = (f: (s: AktorSablonu) => void): string | null => { const s = cikar(); f(s); return kodOku(sablonHatasi(s)); };
const yaz = (o: object | undefined, k: string, v: unknown): void => { (o as Record<string, unknown>)[k] = v; };

test("doğrula: çıkarılan şablon geçerli; JSON turu sonrası da (diske yaz/oku)", () => {
  assert.equal(sablonHatasi(cikar()), null);
  assert.equal(sablonHatasi(JSON.parse(JSON.stringify(cikar()))), null);
});

test("doğrula: biçim hataları AKT-SBL-001", () => {
  assert.equal(kodOku(sablonHatasi(null)), "AKT-SBL-001");
  assert.equal(kodOku(sablonHatasi([])), "AKT-SBL-001");
  assert.equal(hata((s) => yaz(s, "x", 1)), "AKT-SBL-001");
  assert.equal(hata((s) => yaz(s, "surum", 2)), "AKT-SBL-001");
  assert.equal(hata((s) => { s.ad = "kötü ad"; }), "AKT-SBL-001");
  assert.equal(hata((s) => { s.aciklama = "a".repeat(301); }), "AKT-SBL-001");
  assert.equal(hata((s) => { s.aktorler = []; }), "AKT-SBL-001");
  assert.equal(hata((s) => { s.aktorler = Array.from({ length: SABLON_AKTOR_TAVANI + 1 }, (_, i) => ({ id: `s${i}`, nesne: { varlik: "k", konum: bos3(), donus: 0, olcek: 1 } })); }), "AKT-SBL-001");
});

test("doğrula: aktör hataları AKT-SBL-002 (kimlik, yinelenen, nesne/isik, alan, bileşen, graf, değişken)", () => {
  const e = (f: (s: AktorSablonu) => void) => assert.equal(hata(f), "AKT-SBL-002");
  e((s) => { s.aktorler[1]!.id = "s1"; });
  e((s) => { s.aktorler[1]!.id = "kötü id"; });
  e((s) => { s.aktorler[1]!.isik = s.aktorler[2]!.isik; });              // ikisi birden
  e((s) => { delete s.aktorler[1]!.nesne; });                              // ikisi de yok
  e((s) => yaz(s.aktorler[1]!.nesne, "id", "n5"));                         // şablonda id yasak
  e((s) => yaz(s.aktorler[1]!.nesne, "grup", "g"));
  e((s) => { s.aktorler[1]!.nesne!.varlik = ""; });
  e((s) => yaz(s.aktorler[1]!.nesne, "konum", [1, 2]));
  e((s) => { s.aktorler[1]!.nesne!.olcek = 0; });
  e((s) => { s.aktorler[1]!.nesne!.donus = [0, 0, Number.POSITIVE_INFINITY]; });
  e((s) => { s.aktorler[1]!.nesne!.bilesenler = [{ id: "a", tur: "uydurma" }]; });
  e((s) => { s.aktorler[1]!.nesne!.graf = "kötü graf"; });
  e((s) => yaz(s.aktorler[1]!.nesne, "degiskenler", { a: [] }));
  e((s) => { s.aktorler[2]!.isik!.siddet = -1; });
  e((s) => yaz(s.aktorler[2]!.isik, "tur", "spot"));
  e((s) => yaz(s.aktorler[2]!.isik, "varlik", "x"));
});

test("doğrula: hiyerarşi hataları AKT-SBL-003 (iki kök, yanlış kok, olmayan üst, döngü, derinlik)", () => {
  const e = (f: (s: AktorSablonu) => void) => assert.equal(hata(f), "AKT-SBL-003");
  e((s) => { delete s.aktorler[1]!.nesne!.ust; });                         // iki kök
  e((s) => { s.kok = "s2"; });
  e((s) => { s.aktorler[1]!.nesne!.ust = "yok"; });
  e((s) => { s.aktorler[0]!.nesne!.ust = "s3"; });                         // kök kalmaz (+ döngü)
  e((s) => {
    s.aktorler = ["s1", "s2", "s3", "s4", "s5", "s6"].map((id, i) => ({ id, nesne: { varlik: "k", konum: bos3(), donus: 0, olcek: 1, ...(i ? { ust: `s${i}` } : {}) } }));
  });                                                                       // 6 kat derin
});

test("glb'den aktör: soket_<ad> düğümleri soket bileşeni olur; öteki düğümler yok sayılır; konum/dönüş taşınır", () => {
  const r = glbdenSablon("kilic", "kilic", [
    { ad: "soket_uc", konum: [0, 1, 0], donus: [0, 90, 0] }, { ad: "govde", konum: bos3(), donus: bos3() }, { ad: "soket_sap", konum: [0, -0.2, 0], donus: bos3() },
  ]);
  assert.ok(r.ok); if (!r.ok) return;
  assert.deepEqual(r.deger.uyarilar, []);
  const n = r.deger.sablon.aktorler[0]!.nesne!;
  assert.equal(n.varlik, "kilic"); assert.deepEqual(n.konum, [0, 0, 0]); assert.equal(n.graf, undefined);
  assert.deepEqual(n.bilesenler!.map((b) => [b.tur, b.ayar!["ad"]]), [["soket", "uc"], ["soket", "sap"]]);
  assert.deepEqual(n.bilesenler![0]!.ayar!["donus"], [0, 90, 0]);
  assert.equal(sablonHatasi(r.deger.sablon), null);
  assert.ok(sablonYerlestir(r.deger.sablon, level(), bos3()).ok);
});

test("glb'den aktör: geçersiz/yinelenen/fazla soket ATLANIR ve AKT-SBL-006 ile bildirilir; soketsiz glb de aktör olur", () => {
  const d = (ad: string) => ({ ad, konum: bos3(), donus: bos3() });
  const r = glbdenSablon("x", "v", [d("soket_a b"), d("soket_a"), d("soket_a"), ...Array.from({ length: 9 }, (_, i) => d(`soket_k${i}`))]);
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.deger.sablon.aktorler[0]!.nesne!.bilesenler!.length, 8);
  assert.ok(r.deger.uyarilar.length >= 3 && r.deger.uyarilar.every((u) => kodOku(u) === "AKT-SBL-006"));
  const bos = glbdenSablon("x", "v", []); assert.ok(bos.ok); if (bos.ok) assert.equal(bos.deger.sablon.aktorler[0]!.nesne!.bilesenler, undefined);
  assert.equal(glbdenSablon("kötü ad", "v", []).ok, false);
});

test("çıkar: kökün beden üstü koparılır; çocuğun beden üstü (kök alt ağacındaysa) korunur, şablon-yerel kimliğe çevrilmez", () => {
  const r = sablonCikar("kilic", { nesneler: [nesne("n1", { ust: "beden:orion", soket: "el_sag" }), nesne("n2", { ust: "n1" }), nesne("n3", { ust: "n2" })] }, "n1");
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.deger.aktorler[0]!.nesne!.ust, undefined); assert.equal(r.deger.aktorler[0]!.nesne!.soket, undefined);
  const s = r.deger; s.aktorler[2]!.nesne!.ust = "beden:flash1";            // elle: torun bir bedene bağlı şablon yine geçerli
  assert.equal(sablonHatasi(s), null);
  const y = sablonYerlestir(s, level(), bos3()); assert.ok(y.ok); if (y.ok) assert.equal(y.deger.nesneler[2]!.ust, "beden:flash1");
});

test("çıkar: döngülü (bozuk) level'da sonlanır, aktör ikilenmez (kökün üstü silinince döngü kırılır)", () => {
  const r = sablonCikar("x", { nesneler: [nesne("n1", { ust: "n2" }), nesne("n2", { ust: "n1" })] }, "n1");
  assert.ok(r.ok); if (r.ok) assert.deepEqual(r.deger.aktorler.map((a) => a.id), ["s1", "s2"]);
});
