// uygulama/graf/aktorDugumleri.test.ts — aktör düğümleri (spec 43 A3): `@bu` çözümü, alan/değişken okuma-yazma, tür ve şema kapıları, yetenek yokluğu.
//
// Dünya sahte: aktörler bellekte bir harita (alanlar + değişkenler); gerçek yetenek `levelBaglantisi.ts`te (canlı doğrulama: aktordene). Burada sınanan, düğümlerin
// KURALLARI: hangi alan grafta açık, tür uyuşmazlığı, aktörsüz `@bu`, olmayan aktör/değişken — hepsi nedenli hata, sessiz geçiş yok.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import { NESNELER } from "../../world/level/nesneKaydi.ts";
import { tumCapalar } from "../../world/level/capalar.ts";
import { BILESEN_SEMALARI } from "../../world/level/cekirdek/bilesen.ts";
import { grafYetenegiKur, type AktorYetenegi, type GrafYetenegi } from "./grafYetenegi.ts";
import { grafKutuphanesi } from "./kutuphane.ts";
import { grafCalistir } from "./yorumlayici.ts";
import { grafTurDenetle } from "./grafTurDenetimi.ts";
import { AKTOR_DUGUMU, GRAFTA_ALANLARI } from "./aktorDugumleri.ts";

type Deger = string | number | boolean;
interface SahteAktor { alanlar: Record<string, Deger>; degiskenler: Record<string, Deger> }

function sahteAktorler() {
  const aktorler: Record<string, SahteAktor> = {
    i1: { alanlar: { renk: "#ffd9a0", siddet: 1.5, menzil: 8, gizli: false }, degiskenler: { hiz: 2, mod: "gece" } },
    n1: { alanlar: { gizli: false }, degiskenler: {} },
  };
  const al = (id: string): SahteAktor => { const a = aktorler[id]; if (!a) throw new Error(`yok: ${id}`); return a; };
  const y: AktorYetenegi = {
    var: (id) => aktorler[id] !== undefined,
    alanOku: (id, alan) => { const v = al(id).alanlar[alan]; if (v === undefined) throw new Error(`'${id}' aktörünün '${alan}' alanı yok`); return v; },
    alanYaz: (id, alan, deger) => { al(id).alanlar[alan] = deger; },
    degiskenOku: (id, ad) => al(id).degiskenler[ad],
    degiskenYaz: (id, ad, deger) => { al(id).degiskenler[ad] = deger; },
  };
  return { aktorler, y };
}

const dunya = (aktor?: AktorYetenegi): GrafYetenegi => grafYetenegiKur({
  ajanlar: () => [], kapi: () => null, nesneler: () => NESNELER, capalar: () => tumCapalar(), ...(aktor ? { aktor } : {}),
});

const graf = (dugumler: GrafDugumu[], baglar: [string, string, string, string][]): Graf => {
  const r = grafDogrula({ surum: 1, ad: "aktor-deneme", tur: "olay", dugumler, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const basla: GrafDugumu = { id: "b", tip: "olay.basla" };

async function kos(g: Graf, ek: { aktor?: AktorYetenegi; bu?: string | null } = {}) {
  const c = grafCalistir(g, { kayit: grafKutuphanesi(), desen: () => null, yetenek: dunya(ek.aktor), uyu: async () => {}, ...(ek.bu !== undefined ? { aktor: ek.bu } : {}) });
  return c.sonuc;
}

// ── şema ──
test("grafta açık alanlar şemadan türer: yalnız `grafta` bayraklı alanlar, pin türü alan türünden (renk→metin)", () => {
  assert.deepEqual({ ...GRAFTA_ALANLARI }, { renk: "metin", siddet: "sayi", menzil: "sayi", gizli: "bool" });
  const acik = new Set(Object.values(BILESEN_SEMALARI).flatMap((s) => s.alanlar.filter((a) => a.grafta).map((a) => a.ad)));
  assert.deepEqual(new Set(Object.keys(GRAFTA_ALANLARI)), acik, "düğüm alan listesi ile şema aynı kümeyi söylemeli");
  for (const kapali of ["konum", "donus", "olcek", "kilitli"]) assert.equal(GRAFTA_ALANLARI[kapali], undefined, `${kapali} grafta kapalı`);
});

test("denetim: grafta kapalı alan (konum) ve geçersiz değişken adı kontrol aşamasında nedenle düşer", () => {
  const k = grafKutuphanesi();
  const d = (g: Graf) => grafTurDenetle(g, k, { desen: () => null, buGraf: null });
  const konum = graf([basla, { id: "o", tip: AKTOR_DUGUMU.oku, ayar: { alan: "konum" } }], []);
  assert.match(JSON.stringify(d(konum)), /alan: .konum. grafta kullanılamaz/);
  const adsiz = graf([basla, { id: "o", tip: AKTOR_DUGUMU.degiskenOku, ayar: { ad: "bo şluk" } }], []);
  assert.match(JSON.stringify(d(adsiz)), /geçersiz/);
});

// ── alan oku/yaz ──
test("Yaz → Oku: @bu ışığın şiddetini yazar, aynı çalışmada okuyup değeri günlüğe verir; öteki alanlar dokunulmaz", async () => {
  const { aktorler, y } = sahteAktorler();
  const g = graf([basla,
    { id: "w", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "siddet", deger: 0.25 } },
    { id: "w2", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "gizli", deger: true } }],
  [["b", "sonra", "w", "giris"], ["w", "sonra", "w2", "giris"]]);
  const s = await kos(g, { aktor: y, bu: "i1" });
  assert.equal(s.durum, "bitti", s.hata ?? "");
  assert.deepEqual(aktorler["i1"]!.alanlar, { renk: "#ffd9a0", siddet: 0.25, menzil: 8, gizli: true });
  assert.deepEqual(aktorler["n1"]!.alanlar, { gizli: false }, "başka aktöre sızmaz");
});

test("Oku: değer çıkış pininden akar (şiddet → alan yaz'a bağlanıp menzile kopyalanır)", async () => {
  const { aktorler, y } = sahteAktorler();
  const g = graf([basla,
    { id: "o", tip: AKTOR_DUGUMU.oku, ayar: { alan: "siddet" } },
    { id: "w", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "menzil" } }],
  [["b", "sonra", "w", "giris"], ["o", "deger", "w", "deger"]]);
  const s = await kos(g, { aktor: y, bu: "i1" });
  assert.equal(s.durum, "bitti", s.hata ?? "");
  assert.equal(aktorler["i1"]!.alanlar["menzil"], 1.5);
});

test("açık aktör kimliği: @bu olmadan da (Graf sekmesinden) çalışır", async () => {
  const { aktorler, y } = sahteAktorler();
  const g = graf([basla, { id: "w", tip: AKTOR_DUGUMU.yaz, ayar: { aktor: "n1", alan: "gizli", deger: true } }], [["b", "sonra", "w", "giris"]]);
  const s = await kos(g, { aktor: y });
  assert.equal(s.durum, "bitti", s.hata ?? "");
  assert.equal(aktorler["n1"]!.alanlar["gizli"], true);
});

// ── hata yolları: hepsi nedenli, hiçbiri yazmaz ──
test("@bu aktörsüz çalışmada (Graf sekmesi ▶) nedenle düşer ve hiçbir şey yazmaz", async () => {
  const { aktorler, y } = sahteAktorler();
  const g = graf([basla, { id: "w", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "siddet", deger: 9 } }], [["b", "sonra", "w", "giris"]]);
  const s = await kos(g, { aktor: y });
  assert.equal(s.durum, "hata");
  assert.match(s.hata ?? "", /@bu.*çözülemez/);
  assert.equal(aktorler["i1"]!.alanlar["siddet"], 1.5);
});

test("olmayan aktör, yetenek yokluğu ve yanlış tür nedenle düşer", async () => {
  const { aktorler, y } = sahteAktorler();
  const yaz = (ayar: Record<string, string | number | boolean>) => graf([basla, { id: "w", tip: AKTOR_DUGUMU.yaz, ayar }], [["b", "sonra", "w", "giris"]]);
  const yok = await kos(yaz({ aktor: "hayalet", alan: "gizli", deger: true }), { aktor: y });
  assert.match(yok.hata ?? "", /'hayalet' level'da yok/);
  const yeteneksiz = await kos(yaz({ alan: "gizli", deger: true }), { bu: "i1" });
  assert.match(yeteneksiz.hata ?? "", /aktör yeteneği yok/);
  const tur = await kos(yaz({ alan: "siddet", deger: "parlak" }), { aktor: y, bu: "i1" });
  assert.equal(tur.durum, "hata");
  assert.equal(aktorler["i1"]!.alanlar["siddet"], 1.5, "yanlış türde yazma reddedilir, değer değişmez");
});

// ── değişkenler ──
test("Değişken yaz → oku: Details'te tanımlı değişken okunur, yazılan aynı çalışmada görülür; tanımsız değişken HATA", async () => {
  const { aktorler, y } = sahteAktorler();
  const g = graf([basla,
    { id: "w", tip: AKTOR_DUGUMU.degiskenYaz, ayar: { ad: "hiz", deger: 7 } },
    { id: "o", tip: AKTOR_DUGUMU.degiskenOku, ayar: { ad: "hiz" } },
    { id: "k", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "siddet" } }],
  [["b", "sonra", "w", "giris"], ["w", "sonra", "k", "giris"], ["o", "deger", "k", "deger"]]);
  const s = await kos(g, { aktor: y, bu: "i1" });
  assert.equal(s.durum, "bitti", s.hata ?? "");
  assert.equal(aktorler["i1"]!.degiskenler["hiz"], 7);
  assert.equal(aktorler["i1"]!.alanlar["siddet"], 7, "okunan değişken alana yazıldı");
  const tanimsiz = graf([basla, { id: "o", tip: AKTOR_DUGUMU.degiskenOku, ayar: { ad: "yok" } }, { id: "k", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "siddet" } }],
    [["b", "sonra", "k", "giris"], ["o", "deger", "k", "deger"]]);
  const t = await kos(tanimsiz, { aktor: y, bu: "i1" });
  assert.equal(t.durum, "hata");
  assert.match(t.hata ?? "", /'yok' değişkeni yok/);
});
