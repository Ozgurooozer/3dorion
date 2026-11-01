// uygulama/aktor/taslak/taslakKapisi.test.ts — Orion taslak kapısı (spec 45 B8): zarf doğrulama, özet, ad süzme, onay/red işlemleri (sahte host).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { kodOku } from "../../../world/level/cekirdek/aktorHatalari.ts";
import { DEMOLAR } from "../sablon/demolar.ts";
import { TASLAK_GEREKCE_TAVANI, TASLAK_GRAF_TAVANI, TASLAK_TAVANI, taslakAdlari, taslakCoz, taslakOzeti } from "./taslakKapisi.ts";
import { taslakOku, taslakOnayla, taslakReddet, type HostSonucu, type TaslakDosyalari } from "./taslakIslemleri.ts";

const lamba = DEMOLAR.lamba;
const graflar = lamba.graflar({ s1: "lamba1", s2: "isik1" });
const zarf = (ek: Record<string, unknown> = {}): string => JSON.stringify({ taslak: 1, ad: lamba.sablon.ad, gerekce: "Ozyn lamba istedi", sablon: lamba.sablon, graflar, ...ek });
const reddedildi = (metin: string, kod: string): void => {
  const r = taslakCoz(metin);
  assert.equal(r.ok, false, "reddedilmeliydi");
  if (!r.ok) assert.equal(kodOku(r.neden), kod, r.neden);
};

test("taslakCoz: geçerli zarf kabul edilir; şablon ve graflar korunur, gerekçe kırpılır", () => {
  const r = taslakCoz(zarf({ gerekce: "  Ozyn lamba istedi  " }));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.deger.ad, lamba.sablon.ad);
    assert.equal(r.deger.gerekce, "Ozyn lamba istedi");
    assert.equal(r.deger.graflar.length, graflar.length);
    assert.equal(r.deger.sablon.aktorler.length, lamba.sablon.aktorler.length);
  }
});

test("taslakCoz: graflar isteğe bağlı (yalnız şablon taslağı olur)", () => {
  const ham = JSON.parse(zarf()) as Record<string, unknown>;
  delete ham["graflar"];
  const r = taslakCoz(JSON.stringify(ham));
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.deger.graflar, []);
});

test("taslakCoz: zarf hataları AKT-TSL-001 (boyut, JSON, tür, bilinmeyen alan, sürüm, ad, gerekçe, ad uyuşmazlığı)", () => {
  const buyuk = taslakCoz(JSON.stringify({ ...JSON.parse(zarf()), gerekce: "g".repeat(TASLAK_TAVANI) }));
  assert.ok(!buyuk.ok && /KB/.test(buyuk.neden), "boyut sınırı JSON'a bakmadan, nedenle reddeder");
  reddedildi("{bozuk", "AKT-TSL-001");
  reddedildi("[]", "AKT-TSL-001");
  reddedildi("null", "AKT-TSL-001");
  reddedildi(zarf({ ekstra: 1 }), "AKT-TSL-001");
  reddedildi(zarf({ taslak: 2 }), "AKT-TSL-001");
  reddedildi(zarf({ ad: "a/b" }), "AKT-TSL-001");
  reddedildi(zarf({ ad: undefined }), "AKT-TSL-001");
  reddedildi(zarf({ gerekce: "" }), "AKT-TSL-001");
  reddedildi(zarf({ gerekce: "   " }), "AKT-TSL-001");
  reddedildi(zarf({ gerekce: "g".repeat(TASLAK_GEREKCE_TAVANI + 1) }), "AKT-TSL-001");
  reddedildi(zarf({ gerekce: 5 }), "AKT-TSL-001");
  reddedildi(zarf({ ad: "baska-ad" }), "AKT-TSL-001");
});

test("taslakCoz: bozuk şablon AKT-TSL-002, ayrıntıda şablon kodu korunur", () => {
  reddedildi(zarf({ sablon: { surum: 1 } }), "AKT-TSL-002");
  reddedildi(zarf({ sablon: null }), "AKT-TSL-002");
  const r = taslakCoz(zarf({ sablon: { ...lamba.sablon, kok: "yok" } }));
  assert.ok(!r.ok && /AKT-SBL-/.test(r.neden), r.ok ? "" : r.neden);
});

test("taslakCoz: bozuk/çok/yinelenen graf AKT-TSL-003", () => {
  reddedildi(zarf({ graflar: "x" }), "AKT-TSL-003");
  reddedildi(zarf({ graflar: [{ surum: 1 }] }), "AKT-TSL-003");
  reddedildi(zarf({ graflar: [graflar[0], graflar[0]] }), "AKT-TSL-003");
  reddedildi(zarf({ graflar: Array.from({ length: TASLAK_GRAF_TAVANI + 1 }, (_, i) => ({ ...graflar[0]!, ad: `g${i}` })) }), "AKT-TSL-003");
});

test("taslakOzeti: gerekçe, aktör/bileşen sayıları, graf düğüm türleri, ⚡ uyarısı ve yazılacak dosyalar", () => {
  const r = taslakCoz(zarf());
  assert.ok(r.ok);
  if (!r.ok) return;
  const o = taslakOzeti(r.deger).join("\n");
  assert.match(o, /gerekçesi: Ozyn lamba istedi/);
  assert.match(o, /Aktör: 2 \(nesne 1, ışık 1\)/);
  assert.match(o, /tetik×1/);
  assert.match(o, /Graf demo_lamba_yak \(olay\): \d+ düğüm — .*olay\.aktor_olayi/);
  assert.match(o, /⚡ demo_lamba_yak dinleme düğümü içerir/);
  assert.match(o, new RegExp(`Content/Actors/${lamba.sablon.ad}\\.aktor\\.json, Content/Graphs/demo_lamba_yak\\.json`));
});

test("taslakOzeti: graf ve bileşen yoksa 'yok' der, ⚡ uyarısı çıkmaz", () => {
  const r = taslakCoz(zarf({ graflar: [], sablon: { ...DEMOLAR.kilic.sablon, ad: lamba.sablon.ad, aktorler: [{ id: "s1", nesne: { varlik: "DETAIL_Junction_Box", konum: [0, 0, 0], donus: 0, olcek: 1 } }], kok: "s1" } }));
  assert.ok(r.ok, r.ok ? "" : r.neden);
  if (!r.ok) return;
  const o = taslakOzeti(r.deger).join("\n");
  assert.match(o, /Bileşenler: yok/);
  assert.ok(!/⚡/.test(o));
});

test("taslakAdlari: yalnız Content/Drafts/<geçerli-ad>.taslak.json; sıralı", () => {
  const a = taslakAdlari(["Content/Drafts/zeta.taslak.json", "Content/Drafts/alfa.taslak.json", "Content/Drafts/x.json", "Content/Actors/y.taslak.json", "Content/Drafts/a/b.taslak.json", "Content/Drafts/.taslak.json", "Content/Drafts/kotu ad.taslak.json"]);
  assert.deepEqual(a, ["alfa", "zeta"]);
});

// ── işlemler (sahte host) ──
interface SahteHost extends TaslakDosyalari { dosyalar: Map<string, string>; graflar: Map<string, string>; sablonlar: Map<string, string>; silinen: string[]; cagri: string[] }
function sahteHost(ek: { grafHata?: string; sablonHata?: boolean; silHata?: boolean; icerik?: Record<string, string> } = {}): SahteHost {
  const ok = <T,>(deger: T): HostSonucu<T> => ({ ok: true, deger });
  const h: SahteHost = {
    dosyalar: new Map(Object.entries(ek.icerik ?? {})), graflar: new Map(), sablonlar: new Map(), silinen: [], cagri: [],
    adresler: async () => ok([...h.dosyalar.keys()]),
    oku: async (a) => (h.dosyalar.has(a) ? ok(h.dosyalar.get(a)!) : { ok: false, kod: "yok", mesaj: a }),
    sil: async (a) => { h.cagri.push(`sil ${a}`); if (ek.silHata) return { ok: false, kod: "kilit", mesaj: "silinemedi" }; h.silinen.push(a); h.dosyalar.delete(a); return ok(a); },
    sablonYaz: async (ad, m) => { h.cagri.push(`sablon ${ad}`); if (ek.sablonHata) return { ok: false, kod: "var", mesaj: "zaten var" }; h.sablonlar.set(ad, m); return ok(`Content/Actors/${ad}.aktor.json`); },
    grafYeni: async (ad, m) => { h.cagri.push(`graf ${ad}`); if (ek.grafHata === ad) return { ok: false, kod: "var", mesaj: "zaten var" }; h.graflar.set(ad, m); return ok(true as const); },
    grafSil: async (ad) => { h.cagri.push(`grafSil ${ad}`); h.graflar.delete(ad); return ok(true as const); },
  };
  return h;
}
const taslak = () => { const r = taslakCoz(zarf()); if (!r.ok) throw new Error(r.neden); return r.deger; };
const ADRES = `Content/Drafts/${lamba.sablon.ad}.taslak.json`;

test("taslakOku: dosyayı okur ve kapıdan geçirir; yok → AKT-TSL-004, bozuk → kapı kodu, dosya adı uyuşmazlığı reddedilir", async () => {
  const h = sahteHost({ icerik: { [ADRES]: zarf(), "Content/Drafts/bozuk.taslak.json": "{x", "Content/Drafts/baska.taslak.json": zarf() } });
  const iyi = await taslakOku(h, lamba.sablon.ad);
  assert.ok(iyi.ok);
  const yok = await taslakOku(h, "yok");
  assert.ok(!yok.ok && kodOku(yok.neden) === "AKT-TSL-004");
  const bozuk = await taslakOku(h, "bozuk");
  assert.ok(!bozuk.ok && kodOku(bozuk.neden) === "AKT-TSL-001");
  const uyusmaz = await taslakOku(h, "baska");
  assert.ok(!uyusmaz.ok && /dosya adı/.test(uyusmaz.neden));
});

test("taslakOnayla: önce graflar, en son şablon yazılır; taslak dosyası silinir; yazılanlar listelenir", async () => {
  const h = sahteHost({ icerik: { [ADRES]: zarf() } });
  const t = taslak();
  const r = await taslakOnayla(h, t);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.deger.uyari, null);
  assert.equal(r.deger.yazilan.length, t.graflar.length + 1);
  assert.deepEqual(h.cagri, [...t.graflar.map((g) => `graf ${g.ad}`), `sablon ${t.ad}`, `sil ${ADRES}`]);
  assert.equal(h.dosyalar.has(ADRES), false);
  assert.deepEqual(JSON.parse(h.sablonlar.get(t.ad)!), t.sablon);
});

test("taslakOnayla: şablon yazılamazsa yazılan graflar GERİ ALINIR, taslak dosyası kalır (AKT-TSL-005)", async () => {
  const h = sahteHost({ sablonHata: true, icerik: { [ADRES]: zarf() } });
  const r = await taslakOnayla(h, taslak());
  assert.ok(!r.ok && kodOku(r.neden) === "AKT-TSL-005", r.ok ? "" : r.neden);
  assert.equal(h.graflar.size, 0, "yarım graf kalmadı");
  assert.ok(h.dosyalar.has(ADRES), "taslak dosyası korundu");
  assert.ok(!h.cagri.some((c) => c.startsWith("sil ")));
});

test("taslakOnayla: ikinci graf yazılamazsa birincisi geri alınır, şablon HİÇ yazılmaz", async () => {
  const t = taslak();
  const ikinci = t.graflar[1]!.ad;
  const h = sahteHost({ grafHata: ikinci, icerik: { [ADRES]: zarf() } });
  const r = await taslakOnayla(h, t);
  assert.ok(!r.ok && kodOku(r.neden) === "AKT-TSL-005");
  assert.equal(h.graflar.size, 0);
  assert.equal(h.sablonlar.size, 0);
  assert.ok(h.cagri.includes(`grafSil ${t.graflar[0]!.ad}`));
});

test("taslakOnayla: taslak dosyası silinemezse onay YİNE başarılı, uyarı döner", async () => {
  const h = sahteHost({ silHata: true, icerik: { [ADRES]: zarf() } });
  const r = await taslakOnayla(h, taslak());
  assert.ok(r.ok);
  if (r.ok) assert.match(r.deger.uyari ?? "", /AKT-TSL-004/);
});

test("taslakOnayla: host çağrısı patlarsa kodlu nedenle döner (özel durum sızmaz)", async () => {
  const h = sahteHost();
  h.grafYeni = async () => { throw new Error("ipc koptu"); };
  const r = await taslakOnayla(h, taslak());
  assert.ok(!r.ok && kodOku(r.neden) === "AKT-TSL-005" && /ipc koptu/.test(r.neden));
});

test("taslakReddet: yalnız taslak dosyası silinir; başka hiçbir şey yazılmaz", async () => {
  const h = sahteHost({ icerik: { [ADRES]: zarf() } });
  const r = await taslakReddet(h, lamba.sablon.ad);
  assert.ok(r.ok);
  assert.deepEqual(h.cagri, [`sil ${ADRES}`]);
  assert.equal(h.graflar.size + h.sablonlar.size, 0);
  const hata = await taslakReddet(sahteHost({ silHata: true }), "x");
  assert.ok(!hata.ok && kodOku(hata.neden) === "AKT-TSL-004");
});

test("taslakOzeti: nesne ve ışık sayıları ayrı sayılır (yalnız nesneli şablon: ışık 0)", () => {
  const kutu = DEMOLAR.kutu.sablon;
  const r = taslakCoz(JSON.stringify({ taslak: 1, ad: kutu.ad, gerekce: "kutu", sablon: kutu }));
  assert.ok(r.ok, r.ok ? "" : r.neden);
  if (r.ok) assert.match(taslakOzeti(r.deger).join("\n"), /Aktör: 1 \(nesne 1, ışık 0\)/);
});

test("belge örneği: docs/ornekler/demo_lamba.taslak.json kapıdan geçer (örnek çürümesin)", async () => {
  const { readFileSync } = await import("node:fs");
  const r = taslakCoz(readFileSync("docs/ornekler/demo_lamba.taslak.json", "utf8"));
  assert.ok(r.ok, r.ok ? "" : r.neden);
});
