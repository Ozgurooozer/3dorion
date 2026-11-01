// uygulama/graf/aktorOlayDugumleri.test.ts — aktör olay düğümleri ve ⚡ aktör olayı dinlemesi (spec 45 B3).
//
// İki katman: (1) düğüm KURALLARI sahte yetenekle (yayın yönü, özel ad daraltması, üst/alt arama, yetenek yokluğu → nedenli hata);
// (2) GERÇEK aktör olay yolu + `aktorOlayKaynagiKur` + `grafDinleyiciKur` ile uçtan uca: olay → ⚡ graf → yeni olay zinciri, hiyerarşi yayını, bırakınca abonelik gider.
// Güvenlik: aktör olayı da yalnız dinlemeye alınmış grafiği yürütür (dinlemeye alınmamışta hiçbir şey olmaz); `@bu` dinlemede reddedilir.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import { aktorHiyerarsisi, aktorOlayYoluKur, type AktorOlayYolu } from "../../world/level/cekirdek/aktorOlayYolu.ts";
import { grafYetenegiKur, type AktorYetenegi, type GrafYetenegi } from "./grafYetenegi.ts";
import type { CalismaTetigi, DugumCalismasi } from "./dugumKaydi.ts";
import { grafKutuphanesi } from "./kutuphane.ts";
import { grafCalistir } from "./yorumlayici.ts";
import { grafTurDenetle } from "./grafTurDenetimi.ts";
import { GrafDurumDeposu } from "./grafDurumu.ts";
import { grafCalistiriciKur } from "./grafCalistirici.ts";
import { grafDinleyiciKur, olayYoluKur, type OlayKaynagi } from "./grafDinleyici.ts";
import { AKTOR_ADRES_ONEKI, AKTOR_DUGUMU, AKTOR_OLAYI_TIPI, aktorDugumleri } from "./aktorDugumleri.ts";
import { olayTetikleri } from "./olayDugumleri.ts";
import { aktorOlayKaynagiKur } from "./aktorOlayKaynagi.ts";

const ZAMAN = { timeout: 3000 };
type Deger = string | number | boolean;
type Veri = Readonly<Record<string, Deger>>;

const graf = (dugumler: GrafDugumu[], baglar: [string, string, string, string][], ad = "olay-deneme", tur: "olay" | "desen" = "olay"): Graf => {
  const r = grafDogrula({ surum: 1, ad, tur, dugumler, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const basla: GrafDugumu = { id: "b", tip: "olay.basla" };

// ── (1) düğüm kuralları: sahte yetenek ──
interface Yayin { id: string; ad: string; veri: Veri; yon: string }
function sahte(o: { olayYok?: boolean; hiyerarsiYok?: boolean } = {}) {
  const yayinlar: Yayin[] = [];
  const ust: Record<string, string> = { c1: "p1", c2: "p1", p1: "beden:orion" };
  const alt: Record<string, string[]> = { p1: ["c1", "c2"] };
  const y: AktorYetenegi = {
    var: (id) => ["p1", "c1", "c2", "x"].includes(id),
    alanOku: () => 0, alanYaz: () => {}, degiskenOku: () => undefined, degiskenYaz: () => {},
    ...(o.olayYok ? {} : { olayYayinla: (id: string, ad: string, veri: Veri, yon: "aktor" | "ust" | "alt") => { yayinlar.push({ id, ad, veri, yon }); } }),
    ...(o.hiyerarsiYok ? {} : { ustBul: (id: string) => ust[id] ?? null, altlar: (id: string) => alt[id] ?? [] }),
  };
  return { y, yayinlar };
}
const dunya = (aktor: AktorYetenegi): GrafYetenegi => grafYetenegiKur({ ajanlar: () => [], kapi: () => null, nesneler: () => [], capalar: () => [], aktor });
async function kos(g: Graf, y: AktorYetenegi, bu: string | null = null) {
  return grafCalistir(g, { kayit: grafKutuphanesi(), desen: () => null, yetenek: dunya(y), uyu: async () => {}, ...(bu !== null ? { aktor: bu } : {}) }).sonuc;
}
const yayinGrafi = (ayar: Record<string, Deger>, bagliDeger?: Deger) => graf([
  basla, { id: "y", tip: AKTOR_DUGUMU.olayYayinla, ayar },
  ...(bagliDeger !== undefined ? [{ id: "s", tip: "veri.sayi", ayar: { deger: bagliDeger } } as GrafDugumu] : []),
], [["b", "sonra", "y", "giris"], ...(bagliDeger !== undefined ? [["s", "deger", "y", "deger"] as [string, string, string, string]] : [])]);

test("olay yayınla: @bu aktörün adına, varsayılan yön 'aktor', değer yoksa veri boş", async () => {
  const { y, yayinlar } = sahte();
  const s = await kos(yayinGrafi({ olay: "ac" }), y, "p1");
  assert.equal(s.durum, "bitti", s.hata ?? "");
  assert.deepEqual(yayinlar, [{ id: "p1", ad: "ac", veri: {}, yon: "aktor" }]);
});

test("olay yayınla: yön ust/alt ve açık aktör kimliği; bağlı sayı değeri {deger} olarak gider", async () => {
  const { y, yayinlar } = sahte();
  await kos(yayinGrafi({ olay: "ac", yon: "ust", aktor: "c1" }, 5), y);
  await kos(yayinGrafi({ olay: "kapat", yon: "alt", aktor: "p1" }), y);
  assert.deepEqual(yayinlar, [{ id: "c1", ad: "ac", veri: { deger: 5 }, yon: "ust" }, { id: "p1", ad: "kapat", veri: {}, yon: "alt" }]);
});

test("olay yayınla: noktalı (yerleşik) ad, bozuk yön, olmayan aktör, @bu'suz çalışma ve yetenek yokluğu NEDENLE düşer", async () => {
  const { y, yayinlar } = sahte();
  const k = grafKutuphanesi();
  const denetim = (a: Record<string, Deger>) => JSON.stringify(grafTurDenetle(yayinGrafi(a), k, { desen: () => null, buGraf: null }));
  assert.match(denetim({ olay: "tetik.girdi" }), /olay adı geçersiz/, "bileşen olayı graftan taklit edilemez");
  assert.match(denetim({}), /olay adı verilmedi/);
  const bozukYon = await kos(yayinGrafi({ olay: "ac", yon: "yan" }), y, "p1");
  assert.equal(bozukYon.durum, "hata"); assert.match(bozukYon.hata ?? "", /'yan' geçersiz \(seçenekler: aktor, ust, alt\)/);
  const yok = await kos(yayinGrafi({ olay: "ac", aktor: "hayalet" }), y);
  assert.equal(yok.durum, "hata"); assert.match(yok.hata ?? "", /'hayalet' level'da yok/);
  const aktorsuz = await kos(yayinGrafi({ olay: "ac" }), y, null);
  assert.equal(aktorsuz.durum, "hata"); assert.match(aktorsuz.hata ?? "", /@bu.*çözülemez/);
  const olaysiz = await kos(yayinGrafi({ olay: "ac" }), sahte({ olayYok: true }).y, "p1");
  assert.equal(olaysiz.durum, "hata"); assert.match(olaysiz.hata ?? "", /olay yolu yok/);
  assert.deepEqual(yayinlar, [], "hatalı çalışma hiçbir şey yayınlamaz");
});

test("üst/alt bul: id, var ve sayı; üst yoksa var=false; sıra aralık dışıysa var=false; beden üstü olduğu gibi", async () => {
  const { y, yayinlar } = sahte();
  // üst → yayınla(deger=üstün id'si): çıkış değeri pin üzerinden akar
  const g = graf([basla, { id: "u", tip: AKTOR_DUGUMU.ustBul, ayar: { aktor: "p1" } }, { id: "y", tip: AKTOR_DUGUMU.olayYayinla, ayar: { olay: "ust", aktor: "x" } }],
    [["b", "sonra", "y", "giris"], ["u", "id", "y", "deger"]]);
  assert.equal((await kos(g, y)).durum, "bitti");
  assert.deepEqual(yayinlar.at(-1)?.veri, { deger: "beden:orion" });
  const ikinci = graf([basla, { id: "a", tip: AKTOR_DUGUMU.altBul, ayar: { aktor: "p1", sira: 1 } }, { id: "y", tip: AKTOR_DUGUMU.olayYayinla, ayar: { olay: "alt", aktor: "x" } }],
    [["b", "sonra", "y", "giris"], ["a", "id", "y", "deger"]]);
  await kos(ikinci, y);
  assert.deepEqual(yayinlar.at(-1)?.veri, { deger: "c2" });
  const disi = graf([basla, { id: "a", tip: AKTOR_DUGUMU.altBul, ayar: { aktor: "p1", sira: 2 } }, { id: "y", tip: AKTOR_DUGUMU.olayYayinla, ayar: { olay: "var", aktor: "x" } }],
    [["b", "sonra", "y", "giris"], ["a", "var", "y", "deger"]]);
  await kos(disi, y);
  assert.deepEqual(yayinlar.at(-1)?.veri, { deger: false });
  const sayi = graf([basla, { id: "a", tip: AKTOR_DUGUMU.altBul, ayar: { aktor: "p1" } }, { id: "y", tip: AKTOR_DUGUMU.olayYayinla, ayar: { olay: "say", aktor: "x" } }],
    [["b", "sonra", "y", "giris"], ["a", "sayi", "y", "deger"]]);
  await kos(sayi, y);
  assert.deepEqual(yayinlar.at(-1)?.veri, { deger: 2 });
  const ustsuz = graf([basla, { id: "u", tip: AKTOR_DUGUMU.ustBul, ayar: { aktor: "x" } }, { id: "y", tip: AKTOR_DUGUMU.olayYayinla, ayar: { olay: "var", aktor: "x" } }],
    [["b", "sonra", "y", "giris"], ["u", "var", "y", "deger"]]);
  await kos(ustsuz, y);
  assert.deepEqual(yayinlar.at(-1)?.veri, { deger: false });
  // üstü yok: 'id' BOŞ metin (boş değer = veri yok → olay verisiz gider); başka bir yer tutucu id'ye benzemesin
  const bosId = graf([basla, { id: "u", tip: AKTOR_DUGUMU.ustBul, ayar: { aktor: "x" } }, { id: "y", tip: AKTOR_DUGUMU.olayYayinla, ayar: { olay: "bos", aktor: "x" } }],
    [["b", "sonra", "y", "giris"], ["u", "id", "y", "deger"]]);
  await kos(bosId, y);
  assert.deepEqual(yayinlar.at(-1), { id: "x", ad: "bos", veri: {}, yon: "aktor" });
  const bozuk = await kos(graf([basla, { id: "a", tip: AKTOR_DUGUMU.altBul, ayar: { aktor: "p1", sira: -1 } }, { id: "y", tip: AKTOR_DUGUMU.olayYayinla, ayar: { olay: "x", aktor: "x" } }], [["b", "sonra", "y", "giris"], ["a", "id", "y", "deger"]]), y);
  assert.equal(bozuk.durum, "hata"); assert.match(bozuk.hata ?? "", /sira: 0 ya da daha büyük/);
  const hiyerarsisiz = await kos(graf([basla, { id: "u", tip: AKTOR_DUGUMU.ustBul, ayar: { aktor: "x" } }, { id: "y", tip: AKTOR_DUGUMU.olayYayinla, ayar: { olay: "x", aktor: "x" } }], [["b", "sonra", "y", "giris"], ["u", "id", "y", "deger"]]),
    sahte({ hiyerarsiYok: true }).y);
  assert.equal(hiyerarsisiz.durum, "hata"); assert.match(hiyerarsisiz.hata ?? "", /hiyerarşisi yok/);
});

test("⚡ aktör olayı düğümü: denetim @bu'yu, boş aktörü ve geçersiz olay adını reddeder; yerleşik (noktalı) ad DİNLENEBİLİR", () => {
  const k = grafKutuphanesi();
  const d = (a: Record<string, Deger>) => JSON.stringify(grafTurDenetle(graf([{ id: "e", tip: AKTOR_OLAYI_TIPI, ayar: a }], [], "dinle"), k, { desen: () => null, buGraf: null }));
  assert.match(d({ aktor: "@bu", olay: "ac" }), /@bu.*çözülemez/);
  assert.match(d({ olay: "ac" }), /dinlenecek aktör seçilmedi/);
  assert.match(d({ aktor: "k1", olay: "bo şluk" }), /olay:/);
  assert.equal(d({ aktor: "k1", olay: "tetik.girdi" }), "[]", "bileşen olayı dinlenebilir");
  assert.equal(d({ aktor: "k1", olay: "ac" }), "[]");
});

test("⚡ aktör olayı düğümü kendi olayı dışında başlamaz (tetiksiz ya da başka düğümün tetiğiyle çalıştırılırsa nedenle düşer)", () => {
  const d = aktorDugumleri<GrafYetenegi>().find((x) => x.tip === AKTOR_OLAYI_TIPI)!;
  const c = (tetik: CalismaTetigi | null): DugumCalismasi<GrafYetenegi> => ({
    dugumId: "e", tetik, degiskenler: null, ajanDegiskenleri: null, ben: null, aktor: null, ajanlar: () => [], saat: () => 10, ayar: { aktor: "k1", olay: "ac" },
    giris: async () => undefined, girisAdlari: () => [], durduruldu: () => false, bekle: async () => {}, bekleVeyaDur: (is) => is, durdurulunca: () => () => {},
    desenCagir: async () => ({}), yetenek: dunya(sahte().y),
  });
  assert.throws(() => d.calistir(c(null)), /yalnız kendi olayıyla başlar/);
  assert.throws(() => d.calistir(c({ dugum: "baska", veri: {} })), /yalnız kendi olayıyla başlar/);
});

test("olayTetikleri: aktör olayı düğümü `aktor:<id>` adresiyle ve olay adıyla çıkar; ayarı eksik düğüm atlanır; ajan olayları değişmez", () => {
  const g = graf([
    { id: "a", tip: AKTOR_OLAYI_TIPI, ayar: { aktor: "k1", olay: "ac" } },
    { id: "e", tip: AKTOR_OLAYI_TIPI, ayar: { aktor: "k2" } },
    { id: "f", tip: "olay.ozyn_yaklasti", ayar: { ajan: "flash" } },
  ], [], "karisik");
  assert.deepEqual(olayTetikleri(g), [
    { dugum: "a", ajan: `${AKTOR_ADRES_ONEKI}k1`, olay: "ac" },
    { dugum: "f", ajan: "flash", olay: "ozyn_yaklasti" },
  ]);
});

// ── (2) uçtan uca: gerçek olay yolu + dinleyici ──
interface Aktor { id: string; ust?: string }
function dunyaKur(aktorler: Aktor[], grafikler: Graf[]) {
  const yol: AktorOlayYolu = aktorOlayYoluKur({ ...aktorHiyerarsisi(aktorler), hata: () => {} });
  const kimlikler = aktorler.map((a) => a.id);
  const hiy = aktorHiyerarsisi(aktorler);
  const y: AktorYetenegi = {
    var: (id) => kimlikler.includes(id),
    alanOku: () => 0, alanYaz: () => {}, degiskenOku: () => undefined, degiskenYaz: () => {},
    olayYayinla: (id, ad, veri, yon) => {
      const r = yon === "ust" ? yol.ustuneYayinla(id, ad, veri) : yon === "alt" ? yol.altlaraYayinla(id, ad, veri) : yol.yayinla(id, ad, veri);
      if (!r.ok) throw new Error(r.neden);
    },
    ustBul: (id) => hiy.ustu(id) ?? null, altlar: (id) => hiy.altlari(id),
  };
  const ajanYolu = olayYoluKur();
  ajanYolu.ajanEkle("flash");
  const kaynak: OlayKaynagi = aktorOlayKaynagiKur({ ajan: ajanYolu, olay: yol, aktorVar: (id) => kimlikler.includes(id) });
  const yetenek = grafYetenegiKur({ ajanlar: () => [{ id: "flash", ad: "Flash" }], kapi: () => null, nesneler: () => [], capalar: () => [], aktor: y });
  const taban = {
    kayit: grafKutuphanesi(), yetenek, durum: new GrafDurumDeposu(), uyu: async () => {},
    depo: { al: (ad: string) => grafikler.find((g) => g.ad === ad) ?? null, desen: () => null },
    ajanlar: () => ["flash"], saat: () => 10,
  };
  const calistirici = grafCalistiriciKur({ ...taban, mesgul: () => null });
  const dinleyici = grafDinleyiciKur({ ...taban, kaynak, disMesgul: () => false, sogumaMs: 0 });
  const kayit: { aktor: string; kaynak: string; ad: string; veri: Veri }[] = [];
  yol.dinle("*", "*", (o) => kayit.push({ aktor: o.aktor, kaynak: o.kaynak, ad: o.ad, veri: o.veri }));
  return { yol, y, dinleyici, calistirici, kayit, ajanYolu };
}
const bekle = async (f: () => boolean, tur = 300): Promise<void> => { for (let i = 0; i < tur && !f(); i++) await new Promise((r) => setTimeout(r, 1)); assert.ok(f(), "koşul gerçekleşmedi"); };

/** ⚡ k1.ac → k2'ye "acildi" yayınla (değer = olayın kaynağı). */
const zincir = (ad = "zincir") => graf([
  { id: "e", tip: AKTOR_OLAYI_TIPI, ayar: { aktor: "k1", olay: "ac" } },
  { id: "y", tip: AKTOR_DUGUMU.olayYayinla, ayar: { aktor: "k2", olay: "acildi" } },
], [["e", "sonra", "y", "giris"], ["e", "kaynak", "y", "deger"]], ad);

test("uçtan uca: dinlemeye ALINMAMIŞ grafik aktör olayında hiçbir şey yürütmez", ZAMAN, async () => {
  const d = dunyaKur([{ id: "k1" }, { id: "k2" }], [zincir()]);
  d.yol.yayinla("k1", "ac", {});
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(d.kayit.map((k) => k.ad), ["ac"], "yalnız ilk olay; zincir yürümedi");
  assert.equal(d.dinleyici.liste().length, 0);
});

test("uçtan uca: dinlemeye alınınca olay graf'ı yürütür, graf yeni olay yayınlar (kaynak değer olarak taşınır)", ZAMAN, async () => {
  const d = dunyaKur([{ id: "k1" }, { id: "k2" }], [zincir()]);
  assert.deepEqual(d.dinleyici.dinlemeyeAl("zincir"), { ok: true });
  d.yol.yayinla("k1", "ac", {});
  await bekle(() => d.kayit.some((k) => k.ad === "acildi"));
  const son = d.kayit.find((k) => k.ad === "acildi")!;
  assert.deepEqual([son.aktor, son.kaynak, son.veri], ["k2", "k2", { deger: "k1" }]);
  assert.equal(d.dinleyici.liste()[0]!.tetik, 1);
});

test("uçtan uca: başka aktörün ya da başka olay adının olayı dinleyen grafı tetiklemez", ZAMAN, async () => {
  const d = dunyaKur([{ id: "k1" }, { id: "k2" }], [zincir()]);
  d.dinleyici.dinlemeyeAl("zincir");
  d.yol.yayinla("k2", "ac", {});
  d.yol.yayinla("k1", "kapat", {});
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(d.dinleyici.liste()[0]!.tetik, 0);
  assert.equal(d.kayit.some((k) => k.ad === "acildi"), false);
});

test("uçtan uca: hiyerarşi — alt aktörün 'ust' yayını, üstü dinleyen grafı tetikler; kaynak alttır", ZAMAN, async () => {
  const g = graf([
    { id: "e", tip: AKTOR_OLAYI_TIPI, ayar: { aktor: "kapi", olay: "carpti" } },
    { id: "y", tip: AKTOR_DUGUMU.olayYayinla, ayar: { aktor: "oda", olay: "haber" } },
  ], [["e", "sonra", "y", "giris"], ["e", "kaynak", "y", "deger"]], "ustu-dinle");
  const yayin = graf([basla, { id: "y", tip: AKTOR_DUGUMU.olayYayinla, ayar: { aktor: "sandik", olay: "carpti", yon: "ust" } }], [["b", "sonra", "y", "giris"]], "yayinci");
  const d = dunyaKur([{ id: "oda" }, { id: "kapi", ust: "oda" }, { id: "sandik", ust: "kapi" }], [g, yayin]);
  assert.deepEqual(d.dinleyici.dinlemeyeAl("ustu-dinle"), { ok: true });
  const r = d.calistirici.calistir("yayinci");
  assert.ok(r.ok, r.ok ? "" : r.neden);
  await bekle(() => d.kayit.some((k) => k.ad === "haber"));
  const carpti = d.kayit.filter((k) => k.ad === "carpti");
  assert.deepEqual(carpti.map((k) => [k.aktor, k.kaynak]), [["kapi", "sandik"], ["oda", "sandik"]], "yakından uzağa");
  assert.deepEqual(d.kayit.find((k) => k.ad === "haber")!.veri, { deger: "sandik" });
});

test("uçtan uca: aktör olayı bırakınca abonelik gider; sonraki olay grafı yürütmez", ZAMAN, async () => {
  const d = dunyaKur([{ id: "k1" }, { id: "k2" }], [zincir()]);
  const once = d.yol.abone();
  d.dinleyici.dinlemeyeAl("zincir");
  assert.equal(d.yol.abone(), once + 1);
  assert.equal(d.dinleyici.birak("zincir"), true);
  assert.equal(d.yol.abone(), once, "abonelik kalktı");
  d.yol.yayinla("k1", "ac", {});
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(d.kayit.some((k) => k.ad === "acildi"), false);
});

test("dinleme reddi: level'da olmayan aktör ve aktör olayı bilmeyen kaynak nedenle reddedilir (kurulmaz)", ZAMAN, () => {
  // k1 var, k2 yok: dinlenen aktör k1 (var); yayın hedefi k2 çalışma anında denetlenir → dinleme KURULUR
  const d = dunyaKur([{ id: "k1" }], [zincir()]);
  assert.deepEqual(d.dinleyici.dinlemeyeAl("zincir"), { ok: true });
  const d2 = dunyaKur([{ id: "k2" }], [zincir()]);   // k1 yok
  const r2 = d2.dinleyici.dinlemeyeAl("zincir");
  assert.equal(r2.ok, false);
  assert.match(r2.ok ? "" : r2.neden, /'k1' aktörü level'da yok/);
  assert.equal(d2.yol.abone(), 1, "yalnız test dinleyicisi (kayıt) var; graf aboneliği kurulmadı");
  // aktör olayını bilmeyen kaynak (yalnız ajan yolu)
  const ajanYolu = olayYoluKur();
  const taban = { kayit: grafKutuphanesi(), yetenek: grafYetenegiKur({ ajanlar: () => [], kapi: () => null, nesneler: () => [], capalar: () => [] }), durum: new GrafDurumDeposu(), uyu: async () => {}, depo: { al: () => zincir(), desen: () => null }, ajanlar: () => [], saat: () => 10 };
  const bos = grafDinleyiciKur({ ...taban, kaynak: ajanYolu });
  const r3 = bos.dinlemeyeAl("zincir");
  assert.equal(r3.ok, false);
  assert.match(r3.ok ? "" : r3.neden, /aktör olay yolu yok/);
});

// ── kaynak sarmalayıcı ──
test("aktorOlayKaynagi: ajan adresi ajan yoluna gider; aktör adresi aktör yoluna; ayrıntıda yayıncı verisi 'kaynak'/'aktor'u EZEMEZ", () => {
  const ajanYolu = olayYoluKur();
  const yol = aktorOlayYoluKur({ ustu: () => undefined, altlari: () => [], hata: () => {} });
  const k = aktorOlayKaynagiKur({ ajan: ajanYolu, olay: yol, aktorVar: (id) => id === "k1" });
  const ajanGelen: string[] = [], aktorGelen: unknown[] = [];
  const b1 = k.dinle("flash", (o) => ajanGelen.push(o.ad));
  const b2 = k.dinle(`${AKTOR_ADRES_ONEKI}k1`, (o) => aktorGelen.push(o.ayrinti));
  ajanYolu.yay("flash", { ad: "ozyn_yaklasti" });
  yol.yayinla("k1", "ac", { kaynak: "sahte", aktor: "sahte2", deger: 3 });
  yol.yayinla("k9", "ac", {});
  assert.deepEqual(ajanGelen, ["ozyn_yaklasti"]);
  assert.deepEqual(aktorGelen, [{ kaynak: "k1", aktor: "k1", deger: 3 }], "gerçek kaynak/aktor yayıncının verisini ezer");
  assert.equal(k.aktorVar?.("k1"), true); assert.equal(k.aktorVar?.("k2"), false);
  b1(); b2();
  ajanYolu.yay("flash", { ad: "ozyn_yaklasti" }); yol.yayinla("k1", "ac", {});
  assert.equal(ajanGelen.length, 1); assert.equal(aktorGelen.length, 1, "abonelikler kalktı");
});
