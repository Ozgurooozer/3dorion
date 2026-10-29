// uygulama/graf/hataAyiklama.test.ts — hata ayıklama (spec 43 A4): çalışma günlüğü, kesme noktası, Devam/Adım, ■ ile duraklamayı kesme, saf düğümde durmama.
//
// Birimler (günlük tamponu, ayıklayıcı) + GERÇEK yorumlayıcıyla bütünleşik koşular (aktör çalıştırıcısı ve Graf ▶ çalıştırıcısı). Asılı kalabilecek her test zaman aşımlıdır:
// bozulan duraklama/■ kırmızı yanmak yerine sonsuza dek beklerdi (dilim 0 dersi).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import { NESNELER } from "../../world/level/nesneKaydi.ts";
import { tumCapalar } from "../../world/level/capalar.ts";
import { calismaGunluguKur, gunlukMetni, onizle, ONIZLEME_AZAMI, GUNLUK_SATIR_AZAMI } from "./calismaGunlugu.ts";
import { hataAyiklayiciKur } from "./hataAyiklayici.ts";
import { grafYetenegiKur, type AktorYetenegi } from "./grafYetenegi.ts";
import { grafKutuphanesi } from "./kutuphane.ts";
import { aktorCalistiriciKur } from "./aktorCalistirici.ts";
import { grafCalistiriciKur } from "./grafCalistirici.ts";
import { AKTOR_DUGUMU } from "./aktorDugumleri.ts";

const ZAMAN = { timeout: 3000 };
const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── günlük tamponu ──
test("önizleme: metin tırnaklı, yok → 'yok', uzun değer 120 karaktere kısalır, döngüsel nesne fırlatmaz", () => {
  assert.deepEqual([onizle("a b"), onizle(1.5), onizle(false), onizle(null), onizle(undefined), onizle({ x: 1 })], ['"a b"', "1.5", "false", "null", "yok", '{"x":1}']);
  const uzun = onizle("x".repeat(500));
  assert.equal(uzun.length, ONIZLEME_AZAMI);
  // Sınır: tırnaklarıyla tam 120 karakter kısalmaz; 121 kısalır (sınır kayması yakalansın).
  assert.equal(onizle("z".repeat(ONIZLEME_AZAMI - 2)).length, ONIZLEME_AZAMI);
  assert.ok(!onizle("z".repeat(ONIZLEME_AZAMI - 2)).endsWith("…"));
  assert.equal(onizle("y".repeat(ONIZLEME_AZAMI - 1)).length, ONIZLEME_AZAMI);
  assert.ok(onizle("y".repeat(ONIZLEME_AZAMI - 1)).endsWith("…"));
  assert.ok(uzun.endsWith("…"));
  const dongu: Record<string, unknown> = {}; dongu["kendi"] = dongu;
  assert.equal(typeof onizle(dongu), "string");
  assert.equal(GUNLUK_SATIR_AZAMI, 200, "günlük tavanı sabit 200");
});

test("günlük: halka tampon son N satırı tutar, sıra artar ve temizlenince sıfırlanmaz, dinleyici her değişimde çağrılır", () => {
  const g = calismaGunluguKur(3);
  let n = 0;
  const birak = g.dinle(() => { n++; });
  const satir = (id: string) => ({ kaynak: "k", graf: "g", id, tip: "t", ad: "T", derinlik: 0, girdi: {}, cikti: {}, sonra: null, ms: 1 });
  for (const id of ["a", "b", "c", "d", "e"]) g.ekle(satir(id));
  assert.deepEqual(g.satirlar().map((s) => [s.id, s.sira]), [["c", 3], ["d", 4], ["e", 5]]);
  g.temizle();
  assert.equal(g.satirlar().length, 0);
  g.ekle(satir("f"));
  assert.equal(g.satirlar()[0]!.sira, 6, "temizlik sırayı sıfırlamaz");
  birak();
  const once = n;
  g.ekle(satir("g"));
  assert.equal(n, once, "abonelik bırakılınca susar");
  assert.ok(once >= 7);
});

test("günlük metni: girdi/çıktı/sonra/süre; hata satırı ✗ ve düğümsüz hata", () => {
  const taban = { sira: 1, kaynak: "k", graf: "g", id: "w1", tip: "aktor.yaz", ad: "Aktör alanı yaz", derinlik: 0, girdi: { deger: "0.2" }, cikti: {}, sonra: "sonra", ms: 3 };
  assert.equal(gunlukMetni(taban), "w1 (Aktör alanı yaz)  deger=0.2  ▸ sonra · 3 ms");
  assert.equal(gunlukMetni({ ...taban, cikti: { deger: "7" }, sonra: null }), "w1 (Aktör alanı yaz)  deger=0.2  → deger=7 · 3 ms");
  assert.equal(gunlukMetni({ ...taban, girdi: {}, cikti: {}, sonra: null, hata: "olmadı" }), "✗ w1 (Aktör alanı yaz): olmadı");
  assert.equal(gunlukMetni({ ...taban, id: "-", hata: "çalıştırılamaz" }), "✗ çalıştırılamaz");
});

// ── ayıklayıcı birimi ──
test("ayıklayıcı: kesme noktası koy/kaldır, grafa göre süz (ön ek karışmaz), kesme yoksa duraklama yok", () => {
  const a = hataAyiklayiciKur();
  assert.equal(a.kesmeDegistir("graf", "w1"), true);
  assert.equal(a.kesmeDegistir("graf2", "w9"), true);
  assert.deepEqual([a.kesmeler("graf"), a.kesmeler("graf2"), a.kesmeVar("graf", "w1"), a.kesmeVar("graf", "w9")], [["w1"], ["w9"], true, false]);
  assert.equal(a.kesmeDegistir("graf", "w1"), false);
  assert.deepEqual(a.kesmeler("graf"), []);
  const c = a.calisma("k");
  assert.equal(c.duraklat("graf", "w1", 0), null, "kesme kalktı: durmaz");
  c.bitir();
});

test("ayıklayıcı: Devam bırakır ve adım modunu kapatır; Adım yalnız ilkini bırakır ve adım modunu açık tutar; bitir temizler", ZAMAN, async () => {
  const a = hataAyiklayiciKur();
  a.kesmeDegistir("g", "x");
  const c1 = a.calisma("bir"), c2 = a.calisma("iki");
  const s1 = c1.duraklat("g", "x", 0)!, s2 = c2.duraklat("g", "x", 0)!;
  assert.deepEqual(a.duraklamalar().map((y) => y.kaynak), ["bir", "iki"]);
  assert.equal(a.adim(), true);
  await s1;
  assert.deepEqual(a.duraklamalar().map((y) => y.kaynak), ["iki"], "Adım yalnız ilkini bıraktı");
  assert.equal(a.adimModu(), true);
  assert.ok(c1.duraklat("g", "baska", 0), "adım modunda kesme noktası olmayan düğümde de durur");
  assert.equal(a.devam(), true);
  await s2;
  assert.deepEqual([a.duraklamalar().length, a.adimModu()], [0, false], "Devam hepsini bıraktı ve adım modunu kapattı");
  const s3 = c1.duraklat("g", "x", 0)!;
  c1.bitir();
  await s3;   // bitir bekleyeni çözer (asılı kalmaz)
  assert.deepEqual(a.duraklamalar().length, 0);
  assert.equal(a.adim(), false, "duran yokken Adım false");
  assert.equal(a.devam(), false, "duran yokken Devam false");
  a.adim(); c2.bitir();
});

test("ayıklayıcı: son çalışma bitince adım modu kapanır", ZAMAN, async () => {
  const a = hataAyiklayiciKur();
  a.kesmeDegistir("g", "x");
  const c = a.calisma("k");
  const s = c.duraklat("g", "x", 0)!;
  a.adim(); await s;
  assert.equal(a.adimModu(), true);
  c.bitir();
  assert.equal(a.adimModu(), false);
});

// ── gerçek yorumlayıcıyla ──
const graf = (ad: string, dugumler: GrafDugumu[], baglar: [string, string, string, string][]): Graf => {
  const r = grafDogrula({ surum: 1, ad, tur: "olay", dugumler, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
/** Başla → w1 (şiddet 0.2) → w2 (menzil 3) → w3 (gizli true); o = saf okuma (şiddet), w1'in değerini w4'e taşır. */
const uclu = (aktor?: string): Graf => graf("uclu", [
  { id: "b", tip: "olay.basla" },
  { id: "w1", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "siddet", deger: 0.2, ...(aktor ? { aktor } : {}) } },
  { id: "w2", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "menzil", deger: 3, ...(aktor ? { aktor } : {}) } },
  { id: "w3", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "gizli", deger: true, ...(aktor ? { aktor } : {}) } },
  { id: "o", tip: AKTOR_DUGUMU.oku, ayar: { alan: "siddet" } },
], [["b", "sonra", "w1", "giris"], ["w1", "sonra", "w2", "giris"], ["w2", "sonra", "w3", "giris"]]);

function dunya(graflar: Graf[]) {
  const durum: Record<string, number | boolean> = { siddet: 1.5, menzil: 8, gizli: false };
  const yetenek: AktorYetenegi = {
    var: (id) => id === "i1",
    alanOku: (_id, alan) => durum[alan]!,
    alanYaz: (_id, alan, d) => { durum[alan] = d as number | boolean; },
    degiskenOku: () => undefined, degiskenYaz: () => {},
  };
  const tabani = {
    kayit: grafKutuphanesi(), depo: { al: (ad: string) => graflar.find((g) => g.ad === ad) ?? null, desen: () => null },
    yetenek: grafYetenegiKur({ ajanlar: () => [], kapi: () => null, nesneler: () => NESNELER, capalar: () => tumCapalar(), aktor: yetenek }), ajanlar: () => [],
  };
  const ayiklayici = hataAyiklayiciKur();
  const gunlukDefteri = calismaGunluguKur();
  const c = aktorCalistiriciKur({ tabani, geriAl: () => {}, var: (id) => id === "i1", ayiklayici, gunlukDefteri });
  return { c, durum, ayiklayici, gunlukDefteri, tabani };
}

test("kesme noktası: çalışma w2'ye gelince BAŞLAMADAN durur (w1 yazıldı, w2 yazılmadı); Devam sürdürür", ZAMAN, async () => {
  const { c, durum, ayiklayici } = dunya([uclu()]);
  ayiklayici.kesmeDegistir("uclu", "w2");
  assert.deepEqual(c.calistir("i1", "uclu"), { ok: true });
  await bekle(60);
  assert.deepEqual(ayiklayici.duraklamalar().map((y) => [y.kaynak, y.graf, y.id]), [["aktör i1", "uclu", "w2"]]);
  assert.deepEqual([durum["siddet"], durum["menzil"]], [0.2, 8], "w1 koştu, w2 durdu");
  assert.equal(c.calisiyor("i1")?.suan?.id, "w2", "canlı satır duran düğümü gösterir");
  ayiklayici.devam();
  await c.bitti();
  assert.deepEqual([durum["menzil"], durum["gizli"], c.son("i1")?.durum], [3, true, "bitti"]);
  assert.equal(ayiklayici.duraklamalar().length, 0);
});

test("■ duraklamayı keser: çalışma 'durdu', bekleyen temizlenir, sonraki düğüm yürümez", ZAMAN, async () => {
  const { c, durum, ayiklayici } = dunya([uclu()]);
  ayiklayici.kesmeDegistir("uclu", "w2");
  c.calistir("i1", "uclu");
  await bekle(60);
  assert.equal(ayiklayici.duraklamalar().length, 1);
  assert.equal(c.durdur("i1"), true);
  await c.bitti();
  assert.equal(c.son("i1")?.durum, "durdu");
  assert.equal(ayiklayici.duraklamalar().length, 0, "bitir bekleyeni temizledi");
  assert.equal(durum["menzil"], 8, "w2 hiç yürümedi");
});

test("Adım: her akışlı düğümde bir kez durur (w1 → w2 → w3), Devam kalanı akıtır", ZAMAN, async () => {
  const { c, durum, ayiklayici } = dunya([uclu()]);
  ayiklayici.kesmeDegistir("uclu", "w1");
  c.calistir("i1", "uclu");
  await bekle(60);
  assert.equal(ayiklayici.duraklamalar()[0]?.id, "w1");
  assert.equal(durum["siddet"], 1.5, "w1 daha koşmadı");
  ayiklayici.adim();
  await bekle(60);
  assert.equal(ayiklayici.duraklamalar()[0]?.id, "w2", "bir adım: w1 koştu, w2'de durdu");
  assert.deepEqual([durum["siddet"], durum["menzil"]], [0.2, 8]);
  ayiklayici.adim();
  await bekle(60);
  assert.equal(ayiklayici.duraklamalar()[0]?.id, "w3");
  ayiklayici.devam();
  await c.bitti();
  assert.equal(durum["gizli"], true);
  assert.equal(ayiklayici.adimModu(), false);
});

test("saf düğümde (aktor.oku) kesme noktası DURDURMAZ", ZAMAN, async () => {
  const g = graf("saf", [{ id: "b", tip: "olay.basla" }, { id: "o", tip: AKTOR_DUGUMU.oku, ayar: { alan: "siddet" } }, { id: "w", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "menzil" } }],
    [["b", "sonra", "w", "giris"], ["o", "deger", "w", "deger"]]);
  const { c, durum, ayiklayici } = dunya([g]);
  ayiklayici.kesmeDegistir("saf", "o");
  c.calistir("i1", "saf");
  await c.bitti();
  assert.equal(durum["menzil"], 1.5, "okunan şiddet menzile yazıldı, hiç durulmadı");
  assert.equal(c.son("i1")?.durum, "bitti");
});

test("günlük: her düğüm girdi/çıktı/süre/kaynakla yazılır (saf düğüm dahil); hata satırı düğüm ve nedenle", ZAMAN, async () => {
  const g = graf("gun", [{ id: "b", tip: "olay.basla" }, { id: "o", tip: AKTOR_DUGUMU.oku, ayar: { alan: "siddet" } }, { id: "w", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "menzil" } }],
    [["b", "sonra", "w", "giris"], ["o", "deger", "w", "deger"]]);
  const { c, gunlukDefteri } = dunya([g]);
  c.calistir("i1", "gun");
  await c.bitti();
  const s = gunlukDefteri.satirlar();
  const w = s.find((x) => x.id === "w")!, o = s.find((x) => x.id === "o")!;
  assert.deepEqual([w.kaynak, w.tip, w.ad, w.girdi, w.sonra, w.derinlik], ["aktör i1", AKTOR_DUGUMU.yaz, "Aktör alanı yaz", { deger: "1.5" }, "sonra", 0]);
  assert.deepEqual([o.cikti, o.girdi], [{ deger: "1.5" }, {}], "saf düğümün çıkışı günlükte");
  assert.ok(w.ms >= 0 && Number.isFinite(w.ms));
  assert.deepEqual(s.map((x) => x.sira), s.map((_, i) => s[0]!.sira + i), "sıra ardışık");
  const bozuk = graf("bozuk", [{ id: "b", tip: "olay.basla" }, { id: "w", tip: AKTOR_DUGUMU.yaz, ayar: { aktor: "hayalet", alan: "siddet", deger: 1 } }], [["b", "sonra", "w", "giris"]]);
  const d2 = dunya([bozuk]);
  d2.c.calistir("i1", "bozuk");
  await d2.c.bitti();
  const h = d2.gunlukDefteri.satirlar().find((x) => x.hata !== undefined)!;
  assert.deepEqual([h.id, h.tip, h.kaynak], ["w", AKTOR_DUGUMU.yaz, "aktör i1"]);
  assert.match(h.hata ?? "", /'hayalet' level'da yok/);
});

test("Graf ▶ çalıştırıcısı da aynı ayıklayıcı ve günlüğe bağlanır (kaynak '▶ <graf>'); ayıklayıcısız çalıştırıcı (⚡ yolu) kesme noktasından etkilenmez", ZAMAN, async () => {
  // Graf sekmesinden ▶ aktörsüzdür (`@bu` çözülmez): düğümler aktörü AÇIKÇA söyler.
  const g = uclu("i1");
  const d = dunya([g]);
  const calistirici = grafCalistiriciKur({ ...d.tabani, ayiklayici: d.ayiklayici, gunlukDefteri: d.gunlukDefteri });
  d.ayiklayici.kesmeDegistir("uclu", "w1");
  assert.ok(calistirici.calistir("uclu").ok === true);
  await bekle(60);
  assert.deepEqual(d.ayiklayici.duraklamalar().map((y) => y.kaynak), ["▶ uclu"]);
  d.ayiklayici.devam();
  await calistirici.bitti();
  assert.equal(calistirici.durum().son?.durum, "bitti");
  assert.ok(d.gunlukDefteri.satirlar().length > 0 && d.gunlukDefteri.satirlar().every((x) => x.kaynak === "▶ uclu"));
  // ⚡ yolu: ayıklayıcı VERİLMEZ → kesme noktası var ama durmaz.
  d.ayiklayici.kesmeDegistir("uclu", "w2");
  const dinleyiciGibi = grafCalistiriciKur({ ...d.tabani });
  assert.ok(dinleyiciGibi.calistir("uclu").ok === true);
  await dinleyiciGibi.bitti();
  assert.equal(dinleyiciGibi.durum().son?.durum, "bitti");
  assert.equal(d.ayiklayici.duraklamalar().length, 0);
});

test("tabanın `bitince` kancası HER yoldan sonra çağrılır (Graf ▶, ⚡ biçimi, aktör ▶, ■ ile durdurma): açık kimlikli aktör yazması sızmasın", ZAMAN, async () => {
  let n = 0;
  const d = dunya([uclu("i1")]);
  const tabani = { ...d.tabani, bitince: () => { n++; } };
  const graf = grafCalistiriciKur({ ...tabani });
  graf.calistir("uclu"); await graf.bitti();
  assert.equal(n, 1, "Graf ▶ / ⚡ yolu");
  const aktor = aktorCalistiriciKur({ tabani, geriAl: () => {}, var: (id) => id === "i1", ayiklayici: d.ayiklayici });
  aktor.calistir("i1", "uclu"); await aktor.bitti();
  assert.equal(n, 2, "aktör ▶ yolu");
  d.ayiklayici.kesmeDegistir("uclu", "w2");
  aktor.calistir("i1", "uclu"); await bekle(60);
  aktor.durdur("i1"); await aktor.bitti();
  assert.equal(n, 3, "■ ile durdurulan çalışma da süpürür");
});

test("Devam/Adım düğmeleri yalnız gerçek tıklamayla (isTrusted) çalışır: kaynakta iki kontrol de durur", async () => {
  const { readFileSync } = await import("node:fs");
  const kaynak = readFileSync(new URL("../yapi/graf/calistirmaDugmeleri.ts", import.meta.url), "utf8");
  for (const dugme of ["devam", "adim"]) {
    const satir = kaynak.split(/\r?\n/).find((s) => s.includes(`ayiklayici?.${dugme}()`));
    assert.ok(satir !== undefined, `${dugme} çağrısı bulunamadı`);
    assert.match(satir, /isTrusted/, `${dugme} satırında isTrusted kontrolü yok: ${satir}`);
  }
});
