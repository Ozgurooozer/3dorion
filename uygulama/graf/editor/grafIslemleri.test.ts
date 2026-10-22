// uygulama/graf/editor/grafIslemleri.test.ts — editörün grafik işlemleri (değiştirilemez, biçim ve tavan korunur, benzersiz kimlik) ve PİN DEĞİŞİNCE
// BAĞ BUDAMA (budanan bağ nedeniyle döner). Kütüphane gerçek kütüphanedir (grafKutuphanesi): Git'in hedef ayarı, Sıra'nın çıkış sayısı, değişkenin türü.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { GRAF_SINIRLARI, grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../../protocol/graf.ts";
import type { PinOrtami } from "../dugumKaydi.ts";
import { grafKutuphanesi } from "../kutuphane.ts";
import { bagEkle, bagKaldir, dugumEkle, dugumleriSil, dugumleriTasi, ayarDegistir, grafBilgisiDegistir, secimiKopyala, yapistir, yeniKimlik } from "./grafIslemleri.ts";
import { ayarDegistirVeBuda, baglariBuda, grafBilgisiVeBuda } from "./pinBudama.ts";

const KAYIT = grafKutuphanesi();
const ORTAM: PinOrtami = { desen: () => null, buGraf: null, ajanlar: () => ["orion", "flash"] };
const bag = (a: string, b: string, c: string, d: string): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] });
const graf = (dugumler: GrafDugumu[], baglar: GrafBagi[] = [], ek: Partial<Graf> = {}): Graf => {
  const r = grafDogrula({ surum: 1, ad: "deneme", tur: "olay", girisler: [], cikislar: [], dugumler, baglar, ...ek });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const ok = <T>(r: { ok: true; deger: T } | { ok: false; hata: string }): T => { if (!r.ok) throw new Error(r.hata); return r.deger; };

// ── kimlik ve ekleme ──
test("yeni kimlik türün son parçasıdır; alınmışsa _2, _3", () => {
  const g = graf([{ id: "git", tip: "ajan.git" }, { id: "git_2", tip: "ajan.git" }]);
  assert.equal(yeniKimlik(g, "ajan.git"), "git_3");
});

test("düğüm ekle: yeni grafik döner, GİRDİ DEĞİŞMEZ", () => {
  const g = graf([{ id: "basla", tip: "olay.basla" }]);
  const once = JSON.stringify(g);
  const r = ok(dugumEkle(g, { tip: "akis.bekle", konum: { x: 10.4, y: 20.6 } }));
  assert.equal(JSON.stringify(g), once);
  assert.deepEqual(r.graf.dugumler.at(-1), { id: "bekle", tip: "akis.bekle", konum: [10, 21] });
});

test("düğüm tavanı: 200. düğümden sonra ekleme NEDENLE reddedilir", () => {
  const g = graf(Array.from({ length: GRAF_SINIRLARI.dugum }, (_, i) => ({ id: `n${i}`, tip: "veri.sayi" })));
  const r = dugumEkle(g, { tip: "veri.sayi" });
  assert.equal(r.ok ? "eklendi" : r.hata, `en çok ${GRAF_SINIRLARI.dugum} düğüm (grafik dolu)`);
});

test("biçimi bozan ayar (500 karakterden uzun metin) reddedilir, grafik değişmez", () => {
  const g = graf([{ id: "m", tip: "veri.metin" }]);
  const r = ayarDegistir(g, "m", "deger", "x".repeat(GRAF_SINIRLARI.metin + 1));
  assert.match(r.ok ? "" : r.hata, /çok uzun/);
});

// ── silme ve taşıma ──
test("silinen düğümün BÜTÜN bağları da gider (gelen ve giden); başka bağ kalır", () => {
  const g = graf([{ id: "b", tip: "olay.basla" }, { id: "x", tip: "akis.bekle" }, { id: "y", tip: "akis.bekle" }],
    [bag("b", "sonra", "x", "giris"), bag("x", "sonra", "y", "giris")]);
  const r = dugumleriSil(g, new Set(["x"]));
  assert.deepEqual([r.graf.baglar, r.silinenBag], [[], 2]);
});

test("taşı: seçili düğümler kayar, ötekiler yerinde", () => {
  const g = graf([{ id: "a", tip: "veri.sayi", konum: [0, 0] }, { id: "b", tip: "veri.sayi", konum: [5, 5] }]);
  const t = dugumleriTasi(g, new Set(["a"]), 40, -20);
  assert.deepEqual(t.dugumler.map((d) => d.konum), [[40, -20], [5, 5]]);
});

// ── ayar ──
test("ayarı boşaltmak (undefined) ayarı siler; ayar kalmazsa alan da kalkar", () => {
  const g = graf([{ id: "s", tip: "veri.sayi", ayar: { deger: 3 } }]);
  assert.equal(ok(ayarDegistir(g, "s", "deger", undefined)).graf.dugumler[0]!.ayar, undefined);
});

// ── bağ ──
test("bağ ekle: tek-bağ kuralının attığı eski bağ çıkar, yenisi girer", () => {
  const g = graf([{ id: "a", tip: "veri.sayi" }, { id: "b", tip: "veri.sayi" }, { id: "t", tip: "akis.tekrar" }], [bag("a", "deger", "t", "sayi")]);
  const r = ok(bagEkle(g, bag("b", "deger", "t", "sayi"), [bag("a", "deger", "t", "sayi")]));
  assert.deepEqual(r.graf.baglar, [bag("b", "deger", "t", "sayi")]);
});

test("bağ tavanı: 400 bağ doluyken yeni bağ reddedilir", () => {
  const dugumler: GrafDugumu[] = [{ id: "kaynak", tip: "veri.sayi" }, ...Array.from({ length: GRAF_SINIRLARI.bag }, (_, i) => ({ id: `t${i}`, tip: "akis.tekrar" }))];
  const g = graf(dugumler.slice(0, 200), []);
  const dolu: Graf = { ...g, baglar: Array.from({ length: GRAF_SINIRLARI.bag }, (_, i) => bag("kaynak", "deger", `t${(i % 199) + 1}`, i < 199 ? "sayi" : `x${i}`)) };
  const r = bagEkle(dolu, bag("kaynak", "deger", "t1", "giris"));
  assert.match(r.ok ? "" : r.hata, /en çok 400 bağ/);
});

test("bağ kaldır yalnız o bağı siler", () => {
  const g = graf([{ id: "b", tip: "olay.basla" }, { id: "x", tip: "akis.bekle" }, { id: "s", tip: "veri.sayi" }], [bag("b", "sonra", "x", "giris"), bag("s", "deger", "x", "ms")]);
  assert.deepEqual(bagKaldir(g, bag("s", "deger", "x", "ms")).baglar, [bag("b", "sonra", "x", "giris")]);
});

// ── kopyala / yapıştır ──
test("yapıştır: YENİ kimlikler (çakışma yok), iç bağlar yeni kimliklere çevrilir, dışarı giden bağ alınmaz, parça hedefe taşınır", () => {
  const g = graf([{ id: "b", tip: "olay.basla", konum: [0, 0] }, { id: "x", tip: "akis.bekle", konum: [100, 0] }, { id: "s", tip: "veri.sayi", konum: [100, 80] }],
    [bag("b", "sonra", "x", "giris"), bag("s", "deger", "x", "ms")]);
  const pano = secimiKopyala(g, new Set(["x", "s"]));
  const r = ok(yapistir(g, pano, { x: 500, y: 500 }));
  assert.deepEqual(r.idler, ["bekle", "sayi"]);
  assert.deepEqual(r.graf.baglar.slice(2), [bag("sayi", "deger", "bekle", "ms")]);
  assert.deepEqual(r.graf.dugumler.slice(3).map((d) => d.konum), [[500, 500], [500, 580]]);
});

test("aynı panoyu iki kez yapıştırmak da çakışmasız kimlik verir", () => {
  const g = graf([{ id: "s", tip: "veri.sayi" }]);
  const pano = secimiKopyala(g, new Set(["s"]));
  const bir = ok(yapistir(g, pano, { x: 0, y: 0 })).graf;
  const iki = ok(yapistir(bir, pano, { x: 0, y: 0 })).graf;
  assert.deepEqual(iki.dugumler.map((d) => d.id), ["s", "sayi", "sayi_2"]);
});

test("boş pano yapıştırılmaz (nedenli)", () => {
  assert.match(((r) => (r.ok ? "" : r.hata))(yapistir(graf([]), { dugumler: [], baglar: [] }, { x: 0, y: 0 })), /pano boş/);
});

// ── grafik bilgisi ──
test("olay grafiğine giriş pini verilemez (biçim reddeder, nedenle)", () => {
  const r = grafBilgisiDegistir(graf([]), { girisler: [{ ad: "kim", tip: "ajan" }] });
  assert.match(r.ok ? "" : r.hata, /olay grafiğinin giriş\/çıkış pini olmaz/);
});

// ── PİN DEĞİŞİNCE BAĞ BUDAMA ──
const gitKonumlu = () => graf([
  { id: "git", tip: "ajan.git", ayar: { hedef: "konum", kim: "flash" } }, { id: "k", tip: "veri.konum" }, { id: "b", tip: "olay.basla" },
], [bag("k", "konum", "git", "konum"), bag("b", "sonra", "git", "giris")]);

test("Git hedefi 'konum' → 'ozyn': konum pini kalkar, ona giden bağ BUDANIR ve nedeni söylenir", () => {
  const r = ok(ayarDegistirVeBuda(gitKonumlu(), "git", "hedef", "ozyn", KAYIT, ORTAM));
  assert.deepEqual(r.budanan.map((x) => x.neden), ["k.konum → git.konum: 'git' düğümünde 'konum' girişi artık yok"]);
});

test("budamada pini duran bağ (akış girişi) kalır", () => {
  const r = ok(ayarDegistirVeBuda(gitKonumlu(), "git", "hedef", "ozyn", KAYIT, ORTAM));
  assert.deepEqual(r.graf.baglar, [bag("b", "sonra", "git", "giris")]);
});

test("Sıra 3 → 2: '2' çıkışından giden bağ budanır", () => {
  const g = graf([{ id: "s", tip: "akis.sira", ayar: { cikis: 3 } }, { id: "x", tip: "akis.bekle" }], [bag("s", "2", "x", "giris")]);
  assert.equal(ok(ayarDegistirVeBuda(g, "s", "cikis", 2, KAYIT, ORTAM)).budanan.length, 1);
});

test("değişken türü sayı → metin: Eğer'in koşuluna (bool) giden bağ 'türler artık uyuşmuyor' ile budanır", () => {
  const g = graf([{ id: "o", tip: "degisken.oku", ayar: { ad: "x", tip: "bool" } }, { id: "e", tip: "akis.eger" }], [bag("o", "deger", "e", "kosul")]);
  const r = ok(ayarDegistirVeBuda(g, "o", "tip", "metin", KAYIT, ORTAM));
  assert.match(r.budanan[0]?.neden ?? "", /türler artık uyuşmuyor \(metin → doğru\/yanlış\)/);
});

test("ucu ÇÖZÜLEMEYEN düğümün bağına dokunulmaz (desen adı yazılırken bağ kaybolmaz)", () => {
  const g = graf([{ id: "c", tip: "desen.cagir", ayar: { desen: "yok" } }, { id: "b", tip: "olay.basla" }], [bag("b", "sonra", "c", "giris")]);
  assert.equal(baglariBuda(g, KAYIT, ORTAM).budanan.length, 0);
});

test("budanacak bağ yoksa aynı grafik nesnesi döner (geçmişe boş adım girmez)", () => {
  const g = gitKonumlu();
  assert.equal(baglariBuda(g, KAYIT, ORTAM).graf, g);
});

test("desenin girişi kaldırılınca Fonksiyon girişinden o pine çıkan bağ budanır", () => {
  const d = graf([{ id: "g", tip: "fonksiyon.giris" }, { id: "s", tip: "ajan.soyle", ayar: { metin: "x" } }],
    [bag("g", "sonra", "s", "giris"), bag("g", "kim", "s", "kim")], { ad: "selamla", tur: "fonksiyon", girisler: [{ ad: "kim", tip: "ajan" }] });
  const r = ok(grafBilgisiVeBuda(d, { girisler: [] }, KAYIT, ORTAM));
  assert.deepEqual(r.graf.baglar, [bag("g", "sonra", "s", "giris")]);
});
