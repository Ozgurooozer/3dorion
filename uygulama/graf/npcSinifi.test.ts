// uygulama/graf/npcSinifi.test.ts — spec 35 dilim 3 "NPC SINIFI": ajan kapsamlı değişken, @ben, NPC parametresi, NPC dinleme, iki NPC ayrı sayaç.
//
// Dünya sahte (npcDavranisi.test.ts'in düzeni): ajan kapıları niyeti diziye yazar, sonucu kendisi verir; söz `sozler`e düşer. Olay yolu, dinleyici,
// çalıştırıcı, diyalog denetimcisi, durum deposu GERÇEK. Asılı kalabilecek her test zaman aşımlı.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import type { Npc } from "../../protocol/npc.ts";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";
import { grafYetenegiKur, type AjanKapisi } from "./grafYetenegi.ts";
import { grafKutuphanesi, nobetciSablonu } from "./kutuphane.ts";
import { nobetciNpcSablonu, NOBETCI_CEVAPLARI } from "./npcSablonu.ts";
import { grafCalistiriciKur, type GrafCalistirici } from "./grafCalistirici.ts";
import { grafDinleyiciKur, olayYoluKur, dinlemeAnahtari, DINLEME_AZAMI, type GrafDinleyici, type OlayYolu } from "./grafDinleyici.ts";
import { AJAN_DURUMU_AZAMI, DEGISKEN_AZAMI, GrafDurumDeposu } from "./grafDurumu.ts";
import { diyalogDenetimiKur, type DiyalogDenetimi } from "./diyalogDenetimi.ts";
import { grafCalistir } from "./yorumlayici.ts";
import { BEN, ajanCoz } from "./benAjani.ts";

const ZAMAN = { timeout: 3000 };

// ── sahte dünya ──
function sahteKapi(id: string, ad: string) {
  const dinleyiciler = new Set<(s: NiyetSonucu) => void>();
  const gelen: Niyet[] = [];
  const sozler: string[] = [];
  const kapi: AjanKapisi = {
    id, ad,
    niyet(n, nid) { gelen.push(n); queueMicrotask(() => { for (const d of [...dinleyiciler]) d({ niyet_id: nid, durum: "bitti" }); }); },
    sonucDinle(cb) { dinleyiciler.add(cb); return () => { dinleyiciler.delete(cb); }; },
    async soyle(m) { sozler.push(m); },
  };
  return { kapi, gelen, sozler };
}

function dunya(o: { kapilar: AjanKapisi[]; grafikler?: Graf[]; olaylar?: string[]; simdi?: () => number; dd?: DiyalogDenetimi; kaynak?: OlayYolu }) {
  const yol: OlayYolu = o.kaynak ?? olayYoluKur();
  for (const a of o.olaylar ?? o.kapilar.map((k) => k.id)) yol.ajanEkle(a);
  const dd = o.dd ?? diyalogDenetimiKur({ zamanla: () => () => {} });
  const grafikler = o.grafikler ?? [];
  const yetenek = grafYetenegiKur({
    ajanlar: () => o.kapilar.map((k) => ({ id: k.id, ad: k.ad })), kapi: (id) => o.kapilar.find((k) => k.id === id) ?? null,
    nesneler: () => [], capalar: () => [], diyalog: (i) => dd.ac(i),
  });
  const durum = new GrafDurumDeposu();
  const taban = {
    kayit: grafKutuphanesi(), yetenek, durum, uyu: async () => {},
    depo: { al: (ad: string) => grafikler.find((g) => g.ad === ad) ?? null, desen: () => null },
    ajanlar: () => o.kapilar.map((k) => k.id), saat: () => 10, ...(o.simdi ? { simdi: o.simdi } : {}),
  };
  const calistirici: GrafCalistirici = grafCalistiriciKur({ ...taban, mesgul: (ad) => (dinleyici.calisiyorMu(ad) ? "olayla çalışıyor" : null) });
  const dinleyici: GrafDinleyici = grafDinleyiciKur({ ...taban, kaynak: yol, disMesgul: (ad) => calistirici.durum().calisiyor?.graf === ad });
  return { yol, dd, durum, calistirici, dinleyici, grafikler, taban };
}

const graf = (dugumler: GrafDugumu[], baglar: [string, string, string, string][], ek: Partial<Graf> = {}): Graf => {
  const r = grafDogrula({ surum: 1, ad: "sinif", tur: "olay", dugumler, ...ek, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const npc = (ad: string, ajan: string, graflar: string[], parametreler: Npc["parametreler"] = {}): Npc => ({ surum: 1, ad, ajan, graflar, parametreler });
const YAKLASTI = { ad: "ozyn_yaklasti", ayrinti: { mesafe: 1.2 } };

/** ⚡ @ben'e yaklaşınca: ziyaret (AJAN kapsamlı) +1 → "<önek><ziyaret>" söyler. Kim olayın kendi `ajan` çıkışından (çözülmüş @ben). */
const sayanSinif = (ad = "sinif", onek = "ziyaret ", kapsam: "ajan" | "grafik" = "ajan") => graf([
  { id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: BEN } },
  { id: "a", tip: "degisken.artir", ayar: { ad: "ziyaret", ...(kapsam === "ajan" ? { kapsam } : {}) } },
  { id: "m", tip: "metin.birlestir", ayar: { a: onek } }, { id: "s", tip: "ajan.soyle" },
], [["y", "sonra", "a", "giris"], ["a", "sonra", "s", "giris"], ["a", "deger", "m", "b"], ["m", "metin", "s", "metin"], ["y", "ajan", "s", "kim"],
  ...(kapsam === "ajan" ? [["y", "ajan", "a", "kim"] as [string, string, string, string]] : [])], { ad });

async function bekleKosul(f: () => boolean, tur = 300): Promise<void> {
  for (let i = 0; i < tur && !f(); i++) await new Promise((r) => setTimeout(r, 1));
  assert.ok(f(), "koşul gerçekleşmedi");
}

// ── 1. ajan kapsamlı değişken deposu ──
test("depo: ajan alanı AJAN BAŞINA (flash ile gardiyan ayrı), grafik alanından ayrı; ozet/sıfırla/durumlu ajanlar", () => {
  const d = new GrafDurumDeposu();
  d.ajanAlani("flash").yaz("ziyaret", 2);
  d.ajanAlani("gardiyan").yaz("ziyaret", 1);
  d.alan("nobetci").yaz("ziyaret", 9);
  assert.deepEqual([d.ajanOzet("flash"), d.ajanOzet("gardiyan"), d.ozet("nobetci"), d.durumluAjanlar()], [{ ziyaret: 2 }, { ziyaret: 1 }, { ziyaret: 9 }, ["flash", "gardiyan"]]);
  assert.equal(d.ajanSifirla("flash"), true);
  assert.deepEqual([d.ajanOzet("flash"), d.ozet("nobetci"), d.ajanSifirla("flash")], [{}, { ziyaret: 9 }, false]);
});

test("depo tavanları: ajan başına DEGISKEN_AZAMI, en çok AJAN_DURUMU_AZAMI ajan, metin uzunluğu; çözülmemiş '@ben' alan AÇAMAZ", () => {
  const d = new GrafDurumDeposu();
  for (let i = 0; i < DEGISKEN_AZAMI; i++) d.ajanAlani("flash").yaz(`d${i}`, i);
  assert.throws(() => d.ajanAlani("flash").yaz("fazla", 1), /en çok 32 değişken/);
  for (let i = 1; i < AJAN_DURUMU_AZAMI; i++) d.ajanAlani(`a${i}`).yaz("x", 1);
  assert.throws(() => d.ajanAlani("bir_fazla").yaz("x", 1), new RegExp(`en çok ${AJAN_DURUMU_AZAMI} ajanın durumu`));
  const e = new GrafDurumDeposu();
  assert.throws(() => e.ajanAlani("flash").yaz("m", "x".repeat(201)), /en çok 200 karakter/);
  assert.throws(() => e.ajanAlani(BEN).yaz("x", 1), /ajan kimliği geçersiz/);
  assert.deepEqual(e.durumluAjanlar(), []);
});

test("depo dinleyicisi kapsamı söyler: grafik mi ajan mı, kimin", () => {
  const d = new GrafDurumDeposu();
  const g: string[] = [];
  d.dinle((x) => g.push(`${x.kapsam}:${x.ad}`));
  d.alan("nobetci").yaz("a", 1); d.ajanAlani("flash").yaz("a", 1); d.ajanSifirla("flash");
  assert.deepEqual(g, ["grafik:nobetci", "ajan:flash", "ajan:flash"]);
});

// ── 2. değişken düğümlerinin kapsamı ──
test("GERİYE UYUM: kapsam ayarı olmayan (eski) grafik GRAFİK alanını kullanır, ajan alanına dokunmaz; kim pini çıkmaz", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const d = dunya({ kapilar: [f.kapi], grafikler: [nobetciSablonu("eski")] });
  assert.deepEqual(d.calistirici.kontrol(nobetciSablonu("eski")), []);
  d.calistirici.calistir("eski");
  await bekleKosul(() => d.dd.acik() !== null);
  d.dd.sec(0);
  await d.calistirici.bitti();
  assert.deepEqual([d.durum.ozet("eski"), d.durum.durumluAjanlar(), f.sozler[0]], [{ ziyaret: 1 }, [], "Hoş geldin yolcu. Ziyaret: 1"]);
  const g = graf([{ id: "b", tip: "olay.basla" }, { id: "a", tip: "degisken.artir", ayar: { ad: "x" } }, { id: "z", tip: "ajan.sec", ayar: { ajan: "flash" } }],
    [["b", "sonra", "a", "giris"], ["z", "ajan", "a", "kim"]]);
  assert.match(d.calistirici.kontrol(g).join(), /'a' düğümünün 'kim' adlı GİRİŞ pini yok/);
});

test("kapsam=ajan: ▶ ile sabit ajana (kim ayarı) yazılır; iki ajanın sayacı ayrı; yanlış ajan kimliği NEDENLİ hata", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash"), g = sahteKapi("gardiyan", "Gardiyan");
  const yaz = (ad: string, kim: string) => graf([{ id: "b", tip: "olay.basla" }, { id: "a", tip: "degisken.artir", ayar: { ad: "ziyaret", kapsam: "ajan", kim } }],
    [["b", "sonra", "a", "giris"]], { ad });
  const d = dunya({ kapilar: [f.kapi, g.kapi], grafikler: [yaz("f", "flash"), yaz("g", "gardiyan")] });
  for (const ad of ["f", "f", "g"]) { d.calistirici.calistir(ad); await d.calistirici.bitti(); }
  assert.deepEqual([d.durum.ajanOzet("flash"), d.durum.ajanOzet("gardiyan"), d.durum.ozet("f")], [{ ziyaret: 2 }, { ziyaret: 1 }, {}]);
  assert.match(d.calistirici.kontrol(yaz("h", "flsh")).join(), /a\.kim: 'flsh' geçersiz/);
  // Ajan alanı verilmeyen çalışma: ajan kapsamlı düğüm NEDENLE düşer (grafik alanına sessizce yazmaz).
  const s = await grafCalistir(yaz("k", "flash"), { kayit: grafKutuphanesi(), desen: () => null, yetenek: d.taban.yetenek, ajanlar: () => ["flash"], degiskenler: d.durum.alan("k") }).sonuc;
  assert.match(s.hata ?? "", /ajan değişken alanı yok/);
});

test("kapsam=ajan, kim çalışma anında defterde değilse NEDENLE düşer (yazım hatası sessizce yeni alan açmaz)", ZAMAN, async () => {
  const d = new GrafDurumDeposu();
  const g = graf([{ id: "b", tip: "olay.basla" }, { id: "a", tip: "degisken.artir", ayar: { ad: "x", kapsam: "ajan", kim: "eski" } }], [["b", "sonra", "a", "giris"]]);
  const c = grafCalistir(g, { kayit: grafKutuphanesi(), desen: () => null, yetenek: grafYetenegiKur({ ajanlar: () => [], kapi: () => null, nesneler: () => [], capalar: () => [] }),
    ajanlar: () => ["eski"], ajanDegiskenleri: (x) => d.ajanAlani(x) });
  assert.equal((await c.sonuc).durum, "bitti");
  // Denetim kök çerçevede (defter dolu) geçer; düğüm çalışırken defter boşalmışsa (ajan kapandı) düğüm düşer, alan açılmaz/yazılmaz.
  const c2 = grafCalistir(g, { kayit: grafKutuphanesi(), desen: () => null, yetenek: grafYetenegiKur({ ajanlar: () => [], kapi: () => null, nesneler: () => [], capalar: () => [] }),
    ajanlar: (() => { let n = 0; return () => (n++ === 0 ? ["eski"] : []); })(), ajanDegiskenleri: (x) => d.ajanAlani(x) });
  assert.match((await c2.sonuc).hata ?? "", /kim: bilinmeyen ajan 'eski'/);
  assert.deepEqual(d.durumluAjanlar(), ["eski"]);
});

// ── 3. @ben ──
test("@ben: Kontrol et'te GEÇERLİ (grafik bir NPC sınıfı); ▶ ile ÇÖZÜLEMEZ → nedenli hata, beden kıpırdamaz", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const g = graf([{ id: "b", tip: "olay.basla" }, { id: "ben", tip: "ajan.sec", ayar: { ajan: BEN } }, { id: "s", tip: "ajan.soyle", ayar: { metin: "x" } }],
    [["b", "sonra", "s", "giris"], ["ben", "ajan", "s", "kim"]]);
  const d = dunya({ kapilar: [f.kapi], grafikler: [g, nobetciNpcSablonu("nobetci")] });
  assert.deepEqual([d.calistirici.kontrol(g), d.calistirici.kontrol(nobetciNpcSablonu("nobetci"))], [[], []]);
  d.calistirici.calistir("sinif");
  await d.calistirici.bitti();
  assert.match(d.calistirici.durum().son?.hata ?? "", /'@ben' çözülemez — grafik bir NPC sınıfı/);
  assert.deepEqual(f.sozler, []);
});

test("@ben: NPC'siz (grafik tek başına) ⚡ dinlemeye alınamaz — nedenle; NPC ile alınınca @ben o NPC'nin ajanı", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const d = dunya({ kapilar: [f.kapi], grafikler: [sayanSinif()] });
  const r = d.dinleyici.dinlemeyeAl("sinif");
  assert.match(r.ok ? "KURULDU" : r.neden, /ajan: '@ben' çözülemez/);
  assert.deepEqual(d.dinleyici.dinlemeyeAl(npc("n1", "flash", ["sinif"])), { ok: true });
  const s = d.dinleyici.liste()[0]!;
  assert.deepEqual([s.anahtar, s.npc, s.tetikler.map((t) => t.ajan)], [dinlemeAnahtari("sinif", "flash"), { ad: "n1", ajan: "flash" }, ["flash"]]);
  d.yol.yay("flash", YAKLASTI);
  await d.dinleyici.bitti();
  assert.deepEqual([f.sozler, d.durum.ajanOzet("flash")], [["ziyaret 1"], { ziyaret: 1 }]);
});

test("@ben İKİNCİ SAVUNMA: denetim atlanırsa (düğüm doğrudan çağrılır) çalışma anında da NPC'siz '@ben' NEDENLE düşer; NPC varsa onun ajanı", () => {
  // Yorumlayıcı denetimi önce yaptığı için (bkz. ▶ testi) bu yola ancak doğrudan çağrıyla ulaşılır: çözücünün kendisi sessizce '@ben'i geçirmemeli.
  assert.throws(() => ajanCoz(BEN, null), /'@ben' çözülemez/);
  assert.deepEqual([ajanCoz(BEN, { ad: "n", ajan: "gardiyan", parametreler: {} }), ajanCoz("flash", null)], ["gardiyan", "flash"]);
  const t = grafKutuphanesi().al("ajan.sec")!;
  const c = (ben: unknown) => ({ ayar: { ajan: BEN }, ben, yetenek: { ajanlar: () => [{ id: "flash", ad: "Flash" }] } }) as unknown as Parameters<typeof t.calistir>[0];
  assert.throws(() => t.calistir(c(null)), /'@ben' çözülemez/);
  assert.deepEqual(t.calistir(c({ ad: "n", ajan: "flash", parametreler: {} })), { cikti: { ajan: "flash" } });
});

test("@ben grafiğin METNİNİ değiştirmez: dinlemedeki kopya '@ben' kalır (iki NPC aynı kopyayı çalıştırır), depodaki grafik de", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const g = sayanSinif();
  const d = dunya({ kapilar: [f.kapi], grafikler: [g] });
  d.dinleyici.dinlemeyeAl(npc("n1", "flash", ["sinif"]));
  d.yol.yay("flash", YAKLASTI);
  await d.dinleyici.bitti();
  assert.deepEqual(g.dugumler[0]!.ayar, { ajan: BEN });
});

// ── 4. NPC parametresi ──
const parametreli = (tip: "metin" | "sayi" = "metin", varsayilan: string | number = "yok") => graf([
  { id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: BEN } },
  { id: "p", tip: "npc.parametre", ayar: { ad: "parola", tip, varsayilan } },
  { id: "k", tip: "metin.birlestir" }, { id: "s", tip: "ajan.soyle" },
], [["y", "sonra", "s", "giris"], ["y", "ajan", "s", "kim"], ["p", "deger", "k", "a"], ["p", "kayitta", "k", "b"], ["k", "metin", "s", "metin"]], { ad: "par" });

test("NPC parametresi: kayıttan okur (kayitta=true); kayıtta yoksa varsayılan (kayitta=false); aynı grafik iki NPC'de iki değer", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash"), g = sahteKapi("gardiyan", "Gardiyan");
  const d = dunya({ kapilar: [f.kapi, g.kapi], grafikler: [parametreli()] });
  assert.deepEqual(d.dinleyici.dinlemeyeAl(npc("a", "flash", ["par"], { parola: "Ay ışığı" })), { ok: true });
  assert.deepEqual(d.dinleyici.dinlemeyeAl(npc("b", "gardiyan", ["par"])), { ok: true });
  d.yol.yay("flash", YAKLASTI); d.yol.yay("gardiyan", YAKLASTI);
  await d.dinleyici.bitti();
  assert.deepEqual([f.sozler, g.sozler], [["Ay ışığıtrue"], ["yokfalse"]]);
});

test("NPC parametresi TÜR denetimi: kayıtta sayı, düğüm metin bekliyor → dinlemeye ALINMAZ (nedenle); ▶'de NPC yok → nedenli hata", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const d = dunya({ kapilar: [f.kapi], grafikler: [parametreli("metin")] });
  const r = d.dinleyici.dinlemeyeAl(npc("a", "flash", ["par"], { parola: 21 }));
  assert.match(r.ok ? "KURULDU" : r.neden, /'a' · par: Kontrol et: p: 'parola': NPC 'a' kaydında sayı \(21\) ama düğüm metin bekliyor/);
  assert.deepEqual(d.dinleyici.liste(), []);
  // Çalışma anı (ikinci savunma): yorumlayıcı denetimi önce yaptığı için buraya ancak düğüm DOĞRUDAN çağrılınca ulaşılır — tür yine reddedilir.
  const t = grafKutuphanesi().al("npc.parametre")!;
  const calisma = { ayar: { ad: "parola", tip: "metin" }, ben: { ad: "a", ajan: "flash", parametreler: { parola: 21 } }, giris: async () => "v" } as unknown as Parameters<typeof t.calistir>[0];
  await assert.rejects(async () => t.calistir(calisma), /NPC 'a' kaydında sayı \(21\) ama düğüm metin bekliyor/);
  const varsayilanYanlis = graf([{ id: "b", tip: "olay.basla" }, { id: "p", tip: "npc.parametre", ayar: { ad: "x", tip: "sayi", varsayilan: "metin" } }], []);
  assert.match(d.calistirici.kontrol(varsayilanYanlis).join(), /varsayilan: sayı olmalı/);
  const parametreBasla = graf([{ id: "b", tip: "olay.basla" }, { id: "p", tip: "npc.parametre", ayar: { ad: "x", varsayilan: "v" } }, { id: "s", tip: "ajan.soyle" }, { id: "z", tip: "ajan.sec", ayar: { ajan: "flash" } }],
    [["b", "sonra", "s", "giris"], ["p", "deger", "s", "metin"], ["z", "ajan", "s", "kim"]], { ad: "pb" });
  d.grafikler.push(parametreBasla);
  d.calistirici.calistir("pb");
  await d.calistirici.bitti();
  assert.match(d.calistirici.durum().son?.hata ?? "", /NPC parametresi 'x' yalnız bir NPC'nin çalışmasında okunur/);
});

// ── 5. NPC dinleme kuralları ──
test("NPC dinleme NEDENLE reddedilir: ajan defterde yok, bozuk kayıt, grafik yok, zaten dinlemede; ATOMİK (biri kurulamazsa hiçbiri)", () => {
  const f = sahteKapi("flash", "Flash");
  const d = dunya({ kapilar: [f.kapi], grafikler: [sayanSinif("a"), sayanSinif("b")] });
  const neden = (n: Npc) => { const r = d.dinleyici.dinlemeyeAl(n); return r.ok ? "KURULDU" : r.neden; };
  assert.match(neden(npc("x", "hayalet", ["a"])), /ajan 'hayalet' ajan defterinde yok \(var: flash\)/);
  assert.match(neden({ ...npc("x", "flash", ["a"]), graflar: [] }), /NPC kaydı bozuk: graflar boş/);
  assert.match(neden(npc("x", "flash", ["a", "yok"])), /'x' · yok: 'yok' yüklenemedi/);
  assert.deepEqual(d.dinleyici.liste(), [], "atomik: 'a' da kurulmamalıydı");
  assert.equal(neden(npc("x", "flash", ["a", "b"])), "KURULDU");
  assert.match(neden(npc("x", "flash", ["a"])), /'x' NPC'si zaten dinlemede/);
  assert.deepEqual(d.dinleyici.liste().map((x) => x.anahtar), ["a@flash", "b@flash"]);
});

test("AYNI grafik AYNI ajan için iki kez dinlenmez (tek başına + NPC, ya da iki NPC); ayrı ajanlar için iki kayıt serbest", () => {
  const f = sahteKapi("flash", "Flash"), g = sahteKapi("gardiyan", "Gardiyan");
  const sabit = graf([{ id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: "flash" } }], [], { ad: "sabit" });
  const d = dunya({ kapilar: [f.kapi, g.kapi], grafikler: [sayanSinif(), sabit] });
  const neden = (h: string | Npc) => { const r = d.dinleyici.dinlemeyeAl(h); return r.ok ? "KURULDU" : r.neden; };
  assert.equal(neden(npc("n1", "flash", ["sinif"])), "KURULDU");
  assert.match(neden(npc("n2", "flash", ["sinif"])), /'sinif@flash' zaten dinlemede/);
  assert.equal(neden(npc("n3", "gardiyan", ["sinif"])), "KURULDU");
  assert.equal(neden("sabit"), "KURULDU");
  assert.match(neden(npc("n4", "flash", ["sabit"])), /'sabit' zaten flash için dinlemede \('sabit'/);
  assert.deepEqual(d.dinleyici.liste().map((x) => x.anahtar), ["sinif@flash", "sinif@gardiyan", "sabit"]);
});

test(`TOPLAM tavan: NPC grafikleri dahil en çok ${DINLEME_AZAMI} kayıt (yarım NPC kurulmaz)`, () => {
  const f = sahteKapi("flash", "Flash");
  const l = Array.from({ length: DINLEME_AZAMI }, (_, i) => graf([{ id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: "flash" } }], [], { ad: `g${i}` }));
  const d = dunya({ kapilar: [f.kapi], grafikler: [...l, sayanSinif("a"), sayanSinif("b")], olaylar: ["flash", "gardiyan"] });
  for (let i = 0; i < DINLEME_AZAMI - 1; i++) assert.deepEqual(d.dinleyici.dinlemeyeAl(`g${i}`), { ok: true });
  const r = d.dinleyici.dinlemeyeAl(npc("iki", "flash", ["a", "b"]));
  assert.match(r.ok ? "" : r.neden, /en çok 8 dinleme kaydı \(şu an 7; 'iki' 2 grafik ister/);
  assert.equal(d.dinleyici.liste().length, DINLEME_AZAMI - 1);
});

test("npcBirak NPC'nin BÜTÜN kayıtlarını bırakır, abonelikler kapanır; öteki NPC dinlemede kalır", () => {
  const f = sahteKapi("flash", "Flash");
  let acik = 0;
  const kaynak: OlayYolu = { ...olayYoluKur(), ajanlar: () => ["flash", "gardiyan"], dinle: () => { acik++; return () => { acik--; }; }, ajanEkle: () => {} };
  const d = dunya({ kapilar: [f.kapi, sahteKapi("gardiyan", "Gardiyan").kapi], grafikler: [sayanSinif("a"), sayanSinif("b")], kaynak });
  d.dinleyici.dinlemeyeAl(npc("n1", "flash", ["a", "b"]));
  d.dinleyici.dinlemeyeAl(npc("n2", "gardiyan", ["a"]));
  assert.equal(acik, 3);
  assert.equal(d.dinleyici.npcBirak("n1"), 2);
  assert.deepEqual([acik, d.dinleyici.npcDinlemede("n1"), d.dinleyici.npcDinlemede("n2")], [1, false, true]);
});

test("NPC'nin parametreleri dinleme ANININ kopyası: kayıt sonradan değişse de dinlenen NPC değişmez", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const d = dunya({ kapilar: [f.kapi], grafikler: [parametreli()] });
  const kayit = npc("a", "flash", ["par"], { parola: "eski" });
  d.dinleyici.dinlemeyeAl(kayit);
  kayit.parametreler["parola"] = "YENİ (onaylanmadı)";
  d.yol.yay("flash", YAKLASTI);
  await d.dinleyici.bitti();
  assert.deepEqual(f.sozler, ["eskitrue"]);
});

test("YANLIŞ ajanın olayı başka NPC'nin kaydını tetiklemez (gardiyana yaklaşmak Flash'ın nöbetini yürütmez)", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash"), g = sahteKapi("gardiyan", "Gardiyan");
  const d = dunya({ kapilar: [f.kapi, g.kapi], grafikler: [sayanSinif()] });
  d.dinleyici.dinlemeyeAl(npc("n1", "flash", ["sinif"]));
  d.yol.yay("gardiyan", YAKLASTI);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual([f.sozler, g.sozler, d.dinleyici.liste()[0]!.tetik], [[], [], 0]);
});

// ── 6. iki NPC, tek grafik: ayrı sayaç, ayrı parola (kuzey yıldızı) ──
test("İKİ NPC aynı Nöbetçi (NPC'li) grafiği: AYRI sayaç, AYRI parola, ayrı beden; grafiğin kendi alanı boş kalır", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash"), g = sahteKapi("gardiyan", "Gardiyan");
  const dd = diyalogDenetimiKur({ zamanla: () => () => {} });
  let t = 0;
  const d = dunya({ kapilar: [f.kapi, g.kapi], grafikler: [nobetciNpcSablonu("nobetci")], dd, simdi: () => t });
  assert.deepEqual(d.dinleyici.dinlemeyeAl(npc("kapi_flash", "flash", ["nobetci"], { parola: NOBETCI_CEVAPLARI[0] })), { ok: true });
  assert.deepEqual(d.dinleyici.dinlemeyeAl(npc("kapi_gardiyan", "gardiyan", ["nobetci"], { parola: NOBETCI_CEVAPLARI[1] })), { ok: true });
  const ziyaret = async (kim: string, cevap: number) => {
    d.yol.yay(kim, YAKLASTI);
    await bekleKosul(() => dd.acik() !== null);
    assert.equal(dd.acik()?.ajan.id, kim, "diyaloğu açan NPC");
    dd.sec(cevap);
    await d.dinleyici.bitti();
  };
  await ziyaret("flash", 1);       // "Kırmızı": Flash'ın parolası değil
  await ziyaret("gardiyan", 1);    // "Kırmızı": gardiyanın parolası
  t = 10_000;
  await ziyaret("flash", 0);       // "Ay ışığı": Flash'ın parolası
  assert.deepEqual(f.sozler, ["Hoş geldin yolcu. Ziyaret: 1", "Geçemezsin.", "Hoş geldin yolcu. Ziyaret: 2", "Geç."]);
  assert.deepEqual(g.sozler, ["Hoş geldin yolcu. Ziyaret: 1", "Geç."]);
  assert.deepEqual([d.durum.ajanOzet("flash"), d.durum.ajanOzet("gardiyan"), d.durum.ozet("nobetci")], [{ ziyaret: 2 }, { ziyaret: 1 }, {}]);
  assert.deepEqual([f.gelen.map((n) => n.tur), g.gelen.map((n) => n.tur)], [["bak", "bak"], ["bak"]]);
});

test("ÜYE DEĞİŞKENİ: aynı ajanın İKİNCİ grafiği (barmen) aynı 'ziyaret'i görür; başka ajanınkini görmez", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash"), g = sahteKapi("gardiyan", "Gardiyan");
  const barmen = graf([{ id: "y", tip: "olay.ozyn_bakti", ayar: { ajan: BEN } }, { id: "o", tip: "degisken.oku", ayar: { ad: "ziyaret", tip: "sayi", kapsam: "ajan" } },
    { id: "m", tip: "metin.birlestir", ayar: { a: "bildiğim ziyaret: " } }, { id: "s", tip: "ajan.soyle" }],
  [["y", "sonra", "s", "giris"], ["y", "ajan", "s", "kim"], ["y", "ajan", "o", "kim"], ["o", "deger", "m", "b"], ["m", "metin", "s", "metin"]], { ad: "barmen" });
  const d = dunya({ kapilar: [f.kapi, g.kapi], grafikler: [sayanSinif(), barmen] });
  d.dinleyici.dinlemeyeAl(npc("n1", "flash", ["sinif", "barmen"]));
  d.dinleyici.dinlemeyeAl(npc("n2", "gardiyan", ["barmen"]));
  d.yol.yay("flash", YAKLASTI); await d.dinleyici.bitti();
  d.yol.yay("flash", { ad: "ozyn_sana_bakti" }); d.yol.yay("gardiyan", { ad: "ozyn_sana_bakti" });
  await d.dinleyici.bitti();
  assert.deepEqual([f.sozler, g.sozler], [["ziyaret 1", "bildiğim ziyaret: 1"], ["bildiğim ziyaret: 0"]]);
});

test("Nöbetçi (NPC'li) şablonu: biçim + Kontrol et temiz; eski Nöbetçi şablonu DEĞİŞMEDİ (▶ Başla'lı, sabit flash, grafik kapsamı)", () => {
  const d = dunya({ kapilar: [sahteKapi("flash", "Flash").kapi] });
  const yeni = nobetciNpcSablonu("n");
  assert.equal(grafDogrula(JSON.parse(JSON.stringify(yeni))).ok, true);
  assert.deepEqual(d.calistirici.kontrol(yeni), []);
  const eski = nobetciSablonu("e");
  assert.deepEqual([eski.dugumler.some((x) => x.tip === "olay.basla"), eski.dugumler.find((x) => x.id === "yaklasti")?.ayar, eski.dugumler.find((x) => x.id === "ziyaret")?.ayar],
    [true, { ajan: "flash" }, { ad: "ziyaret", miktar: 1 }]);
});
