// world/level/cekirdek/anlam.test.ts — Level nesnelerinin Orion için anlamı (spec 23 B): öncelik zinciri, kayıt,
// görünürlükle uyum.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { etkinAnlam, levelNesneleri, anlamHatasi, anlamSozluguOku, type AnlamSozlugu } from "./anlam.ts";
import { levelTanimiDogrula, type NesneYeri } from "./levelTanimi.ts";
import { ornekTanim } from "./ornekTanim.ts";
import { gorunenNesneler } from "../../player/gorunurluk.ts";

const S: AnlamSozlugu = anlamSozluguOku({
  surum: 1,
  kategoriler: { bina: { tur: "yapi", eylemler: ["bak", "git"] }, detay: { tur: "detay", algilanir: false } },
  varliklar: { BLD_A: { ad: "gökdelen" }, DET_B: { ad: "boru" }, LAMBA: { ad: "sokak lambası", tur: "aydinlatma" } },
});
const KAT: Record<string, string> = { BLD_A: "bina", DET_B: "detay", LAMBA: "esya" };
const kisa = (a: string) => a.toLowerCase();
const N = (id: string, varlik: string, ek: Partial<NesneYeri> = {}): NesneYeri => ({ id, varlik, konum: [0, 0, 0], donus: 0, olcek: 1, ...ek });
const anlam = (n: NesneYeri) => etkinAnlam(n, KAT[n.varlik], S, kisa);

test("ad varlıktan, tür ve eylemler kategoriden", () => {
  const a = anlam(N("n1", "BLD_A"));
  assert.deepEqual([a.ad, a.tur, a.eylemler], ["gökdelen", "yapi", ["bak", "git"]]);
});
test("yerleşimin adı sözlüğünkini ezer", () => { assert.equal(anlam(N("n1", "BLD_A", { ad: "Ozyn'in kulesi" })).ad, "Ozyn'in kulesi"); });
test("yerleşimin eylemleri kategoriyi ezer", () => { assert.deepEqual(anlam(N("n1", "BLD_A", { anlam: { eylemler: ["bak"] } })).eylemler, ["bak"]); });
test("her alanın kaynağı bilinir (editör varsayılanı gri gösterir)", () => {
  assert.deepEqual(anlam(N("n1", "BLD_A", { ad: "x" })).kaynak, { ad: "yerlesim", tur: "kategori", eylemler: "kategori", algilanir: "varsayilan" });
});
test("hiçbir katmanda yoksa varsayılan: kısa ad, eşya, yalnız bak", () => {
  const a = etkinAnlam(N("n1", "BILINMEZ"), undefined, S, kisa);
  assert.deepEqual([a.ad, a.tur, a.eylemler, a.algilanir], ["bilinmez", "esya", ["bak"], true]);
});
test("sözlük yüklenmemişse de çalışır (varsayılan)", () => { assert.equal(etkinAnlam(N("n1", "X"), "bina", null, kisa).tur, "esya"); });

const KUTU = { min: [0, 0, 0], max: [2, 4, 2] };
const kutular = (ids: string[]) => new Map(ids.map((id) => [id, KUTU]));
const kayit = (l: NesneYeri[]) => levelNesneleri(l, kutular(l.map((n) => n.id!)), anlam);
test("kayıt kutuyu merkez + boyuta çevirir (spec 15 biçimi)", () => {
  assert.deepEqual(kayit([N("n1", "BLD_A")])[0]!.kutu, { x: 1, y: 2, z: 1, g: 2, yuk: 4, d: 2 });
});
test("algılanmayan (detay) kayda girmez", () => { assert.deepEqual(kayit([N("n1", "BLD_A"), N("n2", "DET_B")]).map((n) => n.id), ["n1"]); });
test("gizli nesne kayda girmez", () => { assert.deepEqual(kayit([N("n1", "BLD_A", { gizli: true })]), []); });
test("kutusu bilinmeyen (yüklenmemiş) nesne kayda girmez — bilinmiyor, yok değil", () => {
  assert.deepEqual(levelNesneleri([N("n1", "BLD_A")], new Map(), anlam), []);
});
test("level kaydı oda görünürlüğüyle çalışır: önündeki bina görünür", () => {
  const l = levelNesneleri([N("n1", "BLD_A")], new Map([["n1", { min: [4, 0, -1], max: [6, 4, 1] }]]), anlam);
  const g = gorunenNesneler({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.7, l, l.map((n) => ({ kutu: n.kutu, capa: null })));
  assert.deepEqual([g[0]!.gorunur, g[0]!.konide], [true, true]);
});
test("arkasındaki bina öndekinin ardında örtülür", () => {
  const l = levelNesneleri([N("on", "BLD_A"), N("arka", "BLD_A")],
    new Map([["on", { min: [3, 0, -3], max: [5, 6, 3] }], ["arka", { min: [8, 0, -1], max: [9, 2, 1] }]]), anlam);
  const g = gorunenNesneler({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.7, l, l.map((n) => ({ kutu: n.kutu, capa: null })));
  assert.equal(g.find((x) => x.id === "arka")!.gorunur, false);
});

// ── doğrulama ──
test("bilinmeyen eylem reddedilir (protokol sözlüğü)", () => { assert.equal(anlamHatasi({ eylemler: ["uç"] })?.alan, "eylemler"); });
test("bilinmeyen tür reddedilir", () => { assert.equal(anlamHatasi({ tur: "uzay gemisi" })?.alan, "tur"); });
test("yerleşimde anlam.ad reddedilir (ad tek yerde: nesneler[].ad)", () => {
  const d = levelTanimiDogrula({ ...ornekTanim(), nesneler: [{ varlik: "A", konum: [0, 0, 0], donus: 0, olcek: 1, anlam: { ad: "x" } }] });
  assert.match(d.ok ? "" : d.hata, /anlam\.ad/);
});
test("geçerli yerleşim anlamı kabul edilir", () => {
  assert.ok(levelTanimiDogrula({ ...ornekTanim(), nesneler: [{ varlik: "A", konum: [0, 0, 0], donus: 0, olcek: 1, anlam: { tur: "mobilya", eylemler: ["otur"], not: "bank" } }] }).ok);
});
test("bozuk sözlük yolu ve nedeniyle fırlatır", () => { assert.throws(() => anlamSozluguOku({ surum: 1, kategoriler: {}, varliklar: { X: { tur: "?" } } }), /varliklar\.X\.tur/); });
