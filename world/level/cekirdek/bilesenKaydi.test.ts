// world/level/cekirdek/bilesenKaydi.test.ts — bileşen kaydı, hiyerarşi kuralları ve level doğrulamasına bağlanışı (spec 45 B1).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { alanDegeriHatasi as sema1 } from "./alanSemasi.ts";
import { alanDegeriHatasi as sema2, ISIK_BILESENI } from "./bilesen.ts";
import {
  BEDEN_ONEKI, BILESEN_TAVANI, BILESEN_TURLERI, HIYERARSI_DERINLIGI, ISIK_ALANLARI,
  bilesenAyari, bilesenAlani, bilesenTuru, bilesenlerHatasi, hiyerarsiHatasi, ustHatasi,
} from "./bilesenKaydi.ts";
import { levelTanimiDogrula, type LevelTanimi } from "./levelTanimi.ts";
import { ornekTanim } from "./ornekTanim.ts";

const nesne = (id: string, ek: Record<string, unknown> = {}) => ({ id, varlik: "kit/kutu.glb", konum: [0, 0, 0], donus: 0, olcek: 1, ...ek });
const tanim = (nesneler: unknown[], isiklar?: unknown[]): unknown => ({ ...ornekTanim(), nesneler, ...(isiklar ? { isiklar } : {}) });

test("şema tutarlılığı: her türün varsayılan değeri kendi şemasından geçer, rezerve türün alanı yok", () => {
  for (const t of BILESEN_TURLERI) {
    for (const a of t.alanlar) assert.equal(sema1(a, a.varsayilan), null, `${t.tur}.${a.ad} varsayılanı`);
    if (t.rezerve) assert.equal(t.alanlar.length, 0, `${t.tur} rezerve ama alanı var`);
  }
  assert.equal(new Set(BILESEN_TURLERI.map((t) => t.tur)).size, BILESEN_TURLERI.length, "tür adları benzersiz");
});

test("bilesen.ts yeniden dışa vermesi aynı fonksiyondur (iki kopya olmaz)", () => {
  assert.equal(sema1, sema2);
});

test("ışık alanları TEK kaynak: ışık aktörünün Details şeması ile 'isik' bileşeni aynı diziyi paylaşır", () => {
  assert.equal(ISIK_BILESENI.alanlar, ISIK_ALANLARI, "aynı dizi nesnesi (kopya değil)");
  assert.equal(bilesenTuru("isik")!.alanlar, ISIK_ALANLARI);
});

test("seçenekli metin alanı: izinli değer geçer, dışı nedenle reddedilir", () => {
  const s = bilesenAlani("tetik", "sekil")!;
  assert.equal(sema1(s, "kure"), null);
  assert.match(sema1(s, "koni")!, /şunlardan biri olmalı: kure, kutu/);
  assert.match(sema1(s, "")!, /boş olmayan metin/);
});

test("bilesenAyari: yazılan + eksik alanın varsayılanı; vec3 kopya döner (şemayı bozmaz)", () => {
  const a = bilesenAyari({ tur: "tetik", ayar: { yaricap: 5 } });
  assert.equal(a["yaricap"], 5);
  assert.equal(a["sekil"], "kure");
  (a["boyut"] as number[])[0] = 99;
  assert.deepEqual(bilesenAlani("tetik", "boyut")!.varsayilan, [1, 1, 1], "varsayılan değişmedi");
  assert.deepEqual(bilesenAyari({ tur: "yok" }), {});
});

test("bilesenlerHatasi: yok/geçerli → null; dizi olmayan, tavan, nesne olmayan, bilinmeyen anahtar", () => {
  assert.equal(bilesenlerHatasi(undefined), null);
  assert.equal(bilesenlerHatasi([]), null);
  assert.equal(bilesenlerHatasi([{ id: "b1", tur: "hareket" }]), null);
  assert.match(bilesenlerHatasi("x")!.neden, /dizi/);
  const dokuz = Array.from({ length: BILESEN_TAVANI + 1 }, (_, i) => ({ id: `b${i}`, tur: "hareket" }));
  assert.match(bilesenlerHatasi(dokuz)!.neden, new RegExp(`en çok ${BILESEN_TAVANI}`));
  assert.equal(bilesenlerHatasi(dokuz.slice(0, BILESEN_TAVANI)), null, "tam tavan geçer");
  assert.equal(bilesenlerHatasi([5])!.alan, "bilesenler[0]");
  assert.equal(bilesenlerHatasi([{ id: "b1", tur: "hareket", fazla: 1 }])!.alan, "bilesenler[0].fazla");
});

test("bilesenlerHatasi: kimlik ve tür kuralları", () => {
  assert.equal(bilesenlerHatasi([{ tur: "hareket" }])!.alan, "bilesenler[0].id");
  assert.equal(bilesenlerHatasi([{ id: "boşluk var", tur: "hareket" }])!.alan, "bilesenler[0].id");
  assert.match(bilesenlerHatasi([{ id: "b1", tur: "hareket" }, { id: "b1", tur: "isik" }])!.neden, /yinelenen bileşen kimliği/);
  const bilinmeyen = bilesenlerHatasi([{ id: "b1", tur: "ucan_halı" }])!;
  assert.equal(bilinmeyen.alan, "bilesenler[0].tur");
  assert.match(bilinmeyen.neden, /bilinenler: isik, tetik, soket, hareket\)$/, "bilinenler listesi rezerve türü içermez");
  assert.match(bilesenlerHatasi([{ id: "b1", tur: "fizik" }])!.neden, /Havok/);
  assert.equal(bilesenlerHatasi([{ id: "b1", tur: 5 }])!.alan, "bilesenler[0].tur");
  assert.equal(bilesenlerHatasi([{ id: "b1", tur: "hareket", ad: "  " }])!.alan, "bilesenler[0].ad");
});

test("bilesenlerHatasi: ayar — bilinmeyen alan, aralık, seçenek, tür, nesne olmayan", () => {
  assert.match(bilesenlerHatasi([{ id: "b1", tur: "hareket", ayar: { ucus: 1 } }])!.neden, /'ucus' Hareket \(kinematik\) bileşeninde yok \(alanlar: azamiHiz/);
  assert.match(bilesenlerHatasi([{ id: "b1", tur: "tetik", ayar: { yaricap: 0 } }])!.neden, /en az 0\.1/);
  assert.match(bilesenlerHatasi([{ id: "b1", tur: "tetik", ayar: { yaricap: 101 } }])!.neden, /en çok 100/);
  assert.match(bilesenlerHatasi([{ id: "b1", tur: "tetik", ayar: { sekil: "koni" } }])!.neden, /şunlardan biri/);
  assert.match(bilesenlerHatasi([{ id: "b1", tur: "hareket", ayar: { zemineYapis: "evet" } }])!.neden, /doğru\/yanlış/);
  assert.match(bilesenlerHatasi([{ id: "b1", tur: "isik", ayar: { konum: [1, 2] } }])!.neden, /3 sayı/);
  assert.equal(bilesenlerHatasi([{ id: "b1", tur: "hareket", ayar: [] }])!.alan, "bilesenler[0].ayar");
  assert.equal(bilesenlerHatasi([{ id: "b1", tur: "tetik", ayar: { yaricap: 0.1 } }]), null, "alt sınır dahil");
  assert.equal(bilesenlerHatasi([{ id: "b1", tur: "tetik", ayar: { yaricap: 100 } }]), null, "üst sınır dahil");
});

test("soket: ad zorunlu, geçerli ve aktör içinde benzersiz", () => {
  assert.equal(bilesenlerHatasi([{ id: "s1", tur: "soket" }])!.alan, "bilesenler[0].ayar.ad");
  assert.equal(bilesenlerHatasi([{ id: "s1", tur: "soket", ayar: {} }])!.alan, "bilesenler[0].ayar.ad");
  assert.match(bilesenlerHatasi([{ id: "s1", tur: "soket", ayar: { ad: "el sag" } }])!.neden, /soket adı geçerli/);
  assert.match(bilesenlerHatasi([{ id: "s1", tur: "soket", ayar: { ad: "el" } }, { id: "s2", tur: "soket", ayar: { ad: "el" } }])!.neden, /yinelenen soket adı "el"/);
  assert.equal(bilesenlerHatasi([{ id: "s1", tur: "soket", ayar: { ad: "el" } }, { id: "s2", tur: "soket", ayar: { ad: "sirt" } }]), null);
  assert.equal(bilesenTuru("soket")!.zorunlu![0], "ad");
});

test("ustHatasi: soket üstsüz olmaz; üst boş/yanlış tür olmaz; beden öneki biçimi", () => {
  assert.equal(ustHatasi({}), null);
  assert.equal(ustHatasi({ ust: "n1" }), null);
  assert.equal(ustHatasi({ ust: "n1", soket: "el" }), null);
  assert.equal(ustHatasi({ ust: `${BEDEN_ONEKI}orion`, soket: "el_sag" }), null);
  assert.match(ustHatasi({ soket: "el" })!.neden, /önce 'ust'/);
  assert.equal(ustHatasi({ ust: 5 })!.alan, "ust");
  assert.equal(ustHatasi({ ust: "  " })!.alan, "ust");
  assert.match(ustHatasi({ ust: `${BEDEN_ONEKI}` })!.neden, /beden:<ad>/);
  assert.match(ustHatasi({ ust: `${BEDEN_ONEKI}or ion` })!.neden, /beden:<ad>/);
  assert.equal(ustHatasi({ ust: "n1", soket: "a b" })!.alan, "soket");
});

test("hiyerarsiHatasi: kendi üstü, olmayan üst, döngü, derinlik sınırı; beden üstü ve kimliksiz atlanır", () => {
  assert.equal(hiyerarsiHatasi([{ id: "a" }, { id: "b", ust: "a" }]), null);
  assert.match(hiyerarsiHatasi([{ id: "a", ust: "a" }])!.neden, /kendi üstü/);
  assert.match(hiyerarsiHatasi([{ id: "a", ust: "yok" }])!.neden, /olmayan üst aktör "yok"/);
  assert.match(hiyerarsiHatasi([{ id: "a", ust: "b" }, { id: "b", ust: "a" }])!.neden, /döngü/);
  assert.match(hiyerarsiHatasi([{ id: "a", ust: "c" }, { id: "b", ust: "a" }, { id: "c", ust: "b" }])!.neden, /döngü/);
  const zincir = (n: number) => Array.from({ length: n + 1 }, (_, i) => (i === 0 ? { id: "z0" } : { id: `z${i}`, ust: `z${i - 1}` }));
  assert.equal(hiyerarsiHatasi(zincir(HIYERARSI_DERINLIGI)), null, "tam sınır geçer");
  assert.match(hiyerarsiHatasi(zincir(HIYERARSI_DERINLIGI + 1))!.neden, new RegExp(`en çok ${HIYERARSI_DERINLIGI} basamak`));
  assert.equal(hiyerarsiHatasi([{ id: "kilic", ust: "beden:orion" }]), null, "beden üstü level'da aranmaz");
  assert.equal(hiyerarsiHatasi([{ ust: "yok" }, { id: "x", ust: 5 }]), null, "kimliksiz/metin olmayan atlanır");
});

test("level doğrulaması: bileşenli ve hiyerarşili geçerli level; hatalar aktör yoluyla gelir", () => {
  const iyi = tanim(
    [nesne("n1", { bilesenler: [{ id: "b1", tur: "soket", ayar: { ad: "el" } }, { id: "b2", tur: "tetik" }] }), nesne("n2", { ust: "n1", soket: "el" })],
    [{ id: "i1", tur: "nokta", konum: [0, 1, 0], renk: "#ffffff", siddet: 1, menzil: 5, ust: "n1" }],
  );
  const d = levelTanimiDogrula(iyi);
  assert.equal(d.ok, true, d.ok ? "" : d.hata);

  const kotu = levelTanimiDogrula(tanim([nesne("n1", { bilesenler: [{ id: "b1", tur: "ucan" }] })]));
  assert.equal(kotu.ok, false);
  if (!kotu.ok) assert.match(kotu.hata, /^nesneler\[0\]\.bilesenler\[0\]\.tur: bilinmeyen bileşen türü/);

  const isikKotu = levelTanimiDogrula(tanim([], [{ id: "i1", tur: "nokta", konum: [0, 1, 0], renk: "#ffffff", siddet: 1, menzil: 5, bilesenler: [{ id: "b1", tur: "fizik" }] }]));
  assert.equal(isikKotu.ok, false);
  if (!isikKotu.ok) assert.match(isikKotu.hata, /^isiklar\[0\]\.bilesenler\[0\]\.tur: .*Havok/);

  const dongu = levelTanimiDogrula(tanim([nesne("n1", { ust: "n2" }), nesne("n2", { ust: "n1" })]));
  assert.equal(dongu.ok, false);
  if (!dongu.ok) assert.match(dongu.hata, /^aktör "n\d"\.ust: üst zinciri döngü/);

  const yok = levelTanimiDogrula(tanim([nesne("n1", { ust: "n9" })]));
  assert.equal(yok.ok, false);
  if (!yok.ok) assert.match(yok.hata, /olmayan üst aktör "n9"/);

  const isikUstNesne = levelTanimiDogrula(tanim([nesne("n1")], [{ id: "i1", tur: "nokta", konum: [0, 1, 0], renk: "#ffffff", siddet: 1, menzil: 5, ust: "i9" }]));
  assert.equal(isikUstNesne.ok, false, "ışığın üstü de level'da olmalı");
  const bedenUst = levelTanimiDogrula(tanim([nesne("kilic", { ust: "beden:orion", soket: "el_sag" })]));
  assert.equal(bedenUst.ok, true, bedenUst.ok ? "" : bedenUst.hata);
  const soketsuz = levelTanimiDogrula(tanim([nesne("n1", { soket: "el" })]));
  assert.equal(soketsuz.ok, false);
});

test("geriye uyum: ova level'ı ve şablonlar değişmeden geçerli, yeni alanları yok", () => {
  for (const yol of ["ova/ova.level.json", "sablon/bos.level.json", "sablon/duz-zemin.level.json", "sablon/tamamen-bos.level.json"]) {
    const ham = JSON.parse(fs.readFileSync(new URL(`../${yol}`, import.meta.url), "utf8")) as { nesneler?: Record<string, unknown>[]; isiklar?: Record<string, unknown>[] };
    const d = levelTanimiDogrula(ham);
    assert.equal(d.ok, true, `${yol}: ${d.ok ? "" : d.hata}`);
    // `isik.dolgu.ust` gibi başka alanlar aynı adı taşır: yalnız AKTÖRLERE (nesneler/isiklar) bakılır.
    for (const a of [...(ham.nesneler ?? []), ...(ham.isiklar ?? [])]) {
      for (const k of ["bilesenler", "ust", "soket"]) assert.equal(k in a, false, `${yol}: aktör ${String(a["id"])} spec 45 alanı '${k}' taşımamalı`);
    }
  }
});

test("level tanımı tipi: bilesenler/ust/soket alanları tipli (derleme + çalışma)", () => {
  const t: LevelTanimi = { ...ornekTanim(), nesneler: [{ id: "n1", varlik: "x.glb", konum: [0, 0, 0], donus: 0, olcek: 1, ust: "beden:orion", soket: "el_sag", bilesenler: [{ id: "b1", tur: "hareket", ayar: { azamiHiz: 3 } }] }] };
  assert.equal(levelTanimiDogrula(t).ok, true);
});
