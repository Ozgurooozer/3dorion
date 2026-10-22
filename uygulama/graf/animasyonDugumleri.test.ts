// uygulama/graf/animasyonDugumleri.test.ts — "ANİMASYON OYNAT" düğümü (spec 35 Dilim 5a): denetim (klip seçenekleri, döngü + bekle), niyet biçimi
// (mevcut `jest` niyeti + `klip`, `elle_` önekli), bitene kadar BEKLE / kabulde DEVAM, ■ klibi keser (bekle kapalıyken de), bedenin hatası/iptali,
// gerçek yürütücüyle uçtan uca. Asılı kalabilecek her test zaman aşımlıdır.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import type { KlipOzeti } from "../../protocol/animasyon.ts";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";
import { tumCapalar } from "../../world/level/capalar.ts";
import { Yurutucu } from "../../world/avatar/index.ts";
import { klipKutuphanesiKur, klipleriYukle } from "../../world/avatar/klipKutuphanesi.ts";
import { ARAC_TABLOSU } from "../../bridge/araclar.ts";
import { grafYetenegiKur, GRAF_NIYET_ONEKI, type AjanKapisi, type GrafYetenegi } from "./grafYetenegi.ts";
import { grafKutuphanesi } from "./kutuphane.ts";
import { grafTurDenetle } from "./grafTurDenetimi.ts";
import { grafCalistir } from "./yorumlayici.ts";

const ZAMAN = { timeout: 5000 };
const ozet = (ad: string, dongu = false, jest: KlipOzeti["jest"] = "el_salliyor"): KlipOzeti => ({ ad, jest, sure: 1, dongu, uzuvlar: ["sag_kol"] });
const KLIPLER: KlipOzeti[] = [ozet("el_salla"), ozet("basla_onayla", false, "başını_sallıyor"), ozet("bekle_dongu", true, "bekliyor")];

type Durum = NiyetSonucu["durum"];
/** Sahte kapı (ajanDugumleri.test.ts deseni): niyetleri yazar; `basladi`/sonuç test verir ya da `otomatik` verir; `dur` bekleyenleri `iptal` eder. */
function sahteKapi(otomatik: ((n: Niyet) => Durum[] | null) | null = null) {
  const dinleyiciler = new Set<(s: NiyetSonucu) => void>();
  const gelen: { n: Niyet; id: string }[] = [];
  const bekleyen = new Set<string>();
  const ver = (nid: string, durum: Durum, not?: string) => {
    if (durum !== "basladi") bekleyen.delete(nid);
    for (const d of [...dinleyiciler]) d({ niyet_id: nid, durum, ...(not ? { not } : {}) });
  };
  const kapi: AjanKapisi = {
    id: "flash", ad: "Flash",
    niyet(n, nid) {
      gelen.push({ n, id: nid });
      if (n.tur === "dur") { for (const b of [...bekleyen]) queueMicrotask(() => ver(b, "iptal", "kesildi")); queueMicrotask(() => ver(nid, "bitti")); return; }
      bekleyen.add(nid);
      for (const d of otomatik?.(n) ?? []) queueMicrotask(() => ver(nid, d));
    },
    sonucDinle(cb) { dinleyiciler.add(cb); return () => { dinleyiciler.delete(cb); }; },
    async soyle() {},
  };
  return { kapi, gelen, ver, turler: () => gelen.map((g) => g.n.tur) };
}

const dunya = (kapi: AjanKapisi): GrafYetenegi =>
  // Adım tavanı kısa: bozulmuş bir bekleme testi kırmızı yaktıktan sonra 60 sn'lik tavan zamanlayıcısı süreci ayakta tutmasın (bozma denemesinde
  // süreç 120 sn asılı kaldı; test yine kırmızıydı ama koşu bitmiyordu).
  grafYetenegiKur({ ajanlar: () => [{ id: "flash", ad: "Flash" }], kapi: (id) => (id === "flash" ? kapi : null), nesneler: () => [], capalar: () => tumCapalar(), adimSiniriMs: 2500 });

const graf = (dugumler: GrafDugumu[], baglar: [string, string, string, string][]): Graf => {
  const r = grafDogrula({ surum: 1, ad: "deneme", tur: "olay", dugumler, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const anim = (ayar: Record<string, string | boolean>): GrafDugumu => ({ id: "a", tip: "ajan.animasyon", ayar: { kim: "flash", ...ayar } });
/** ▶ → Animasyon → Bekle(ms) — "sonraki düğüm yürüdü mü" Bekle'nin başlamasından görülür. */
const tek = (ayar: Record<string, string | boolean>, sonraMs = 0) =>
  graf([{ id: "b", tip: "olay.basla" }, anim(ayar), { id: "sonra", tip: "akis.bekle", ayar: { ms: sonraMs } }], [["b", "sonra", "a", "giris"], ["a", "sonra", "sonra", "giris"]]);

function kos(g: Graf, y: GrafYetenegi, klipler: () => readonly KlipOzeti[] = () => KLIPLER, uyu?: (ms: number) => Promise<void>) {
  const olaylar: string[] = [];
  const c = grafCalistir(g, {
    kayit: grafKutuphanesi({ klipler }), desen: () => null, yetenek: y, ajanlar: () => ["flash"], ...(uyu ? { uyu } : { uyu: async () => {} }),
    olay: (o) => { if (o.tur === "dugum") olaylar.push(o.id); },
  });
  return { ...c, olaylar };
}
async function bekleKosul(f: () => boolean, tur = 300): Promise<void> {
  for (let i = 0; i < tur && !f(); i++) await new Promise((r) => setTimeout(r, 1));
  assert.ok(f(), "koşul gerçekleşmedi");
}
const denetle = (g: Graf, klipler: readonly KlipOzeti[] = KLIPLER) => grafTurDenetle(g, grafKutuphanesi({ klipler: () => klipler }), { desen: () => null, buGraf: null, ajanlar: () => ["flash"] });

// ── denetim ──
test("Kontrol et: yüklü klip geçer", () => assert.deepEqual(denetle(tek({ klip: "el_salla" })), []));
test("Kontrol et: SEÇENEKTE OLMAYAN klip nedenli hata, yüklüler sayılır", () => {
  assert.deepEqual(denetle(tek({ klip: "dans" })), ["a.klip: 'dans' geçersiz (seçenekler: el_salla, basla_onayla, bekle_dongu)"]);
});
test("Kontrol et: klip seçilmedi", () => assert.match(denetle(tek({})).join(" | "), /klip seçilmedi/));
test("Kontrol et: DÖNGÜLÜ klip + bekle (varsayılan) HATA — sonsuz bekleme yerine nedenli ret; bekle:false geçer", () => {
  assert.match(denetle(tek({ klip: "bekle_dongu" })).join(" | "), /döngülü klip: kendiliğinden bitmez, beklenemez/);
  assert.deepEqual(denetle(tek({ klip: "bekle_dongu", bekle: false })), []);
});
test("Kontrol et: kütüphane boşsa (yükleme bitmedi / dünya yok) 'seçenekler: yok'", () => {
  assert.deepEqual(denetle(tek({ klip: "el_salla" }), []), ["a.klip: 'el_salla' geçersiz (seçenekler: yok)"]);
});
test("kütüphanede kategori 'ajan', ad 'Animasyon oynat'", () => {
  const t = grafKutuphanesi().al("ajan.animasyon");
  assert.deepEqual([t?.kategori, t?.ad, t?.saf], ["ajan", "Animasyon oynat", false]);
});

// ── niyet ve bekleme ──
test("niyet: MEVCUT jest niyeti + klip alanı (anlam klibin jest'i), 'elle_' önekli — yeni niyet türü yok", ZAMAN, async () => {
  const f = sahteKapi(() => ["basladi", "bitti"]);
  await kos(tek({ klip: "basla_onayla" }), dunya(f.kapi)).sonuc;
  assert.deepEqual([f.gelen[0]!.n, f.gelen[0]!.id.startsWith(`${GRAF_NIYET_ONEKI}_`)], [{ tur: "jest", jest: "başını_sallıyor", klip: "basla_onayla" }, true]);
});

test("bekle (varsayılan): 'basladi' gelince DEVAM ETMEZ, 'bitti' gelince eder", ZAMAN, async () => {
  const f = sahteKapi(() => ["basladi"]);
  const c = kos(tek({ klip: "el_salla" }), dunya(f.kapi));
  await bekleKosul(() => f.gelen.length === 1);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(c.olaylar, ["b", "a"]);              // sonraki düğüm başlamadı
  f.ver(f.gelen[0]!.id, "bitti");
  const s = await c.sonuc;
  assert.deepEqual([s.durum, c.olaylar], ["bitti", ["b", "a", "sonra"]]);
});

test("bekle: false — 'basladi' (kabul) gelince devam eder, klibin bitmesini beklemez", ZAMAN, async () => {
  const f = sahteKapi(() => ["basladi"]);
  const s = await kos(tek({ klip: "el_salla", bekle: false }), dunya(f.kapi)).sonuc;
  assert.deepEqual([s.durum, f.turler()], ["bitti", ["jest"]]);
});

test("bedenin HATASI düğüm hatasıdır, nedeni aynen (bekle kapalıyken de)", ZAMAN, async () => {
  for (const bekle of [true, false]) {
    const f = sahteKapi(null);
    const c = kos(tek({ klip: "el_salla", bekle }), dunya(f.kapi));
    await bekleKosul(() => f.gelen.length === 1);
    f.ver(f.gelen[0]!.id, "hata", "bilinmeyen klip: 'el_salla' (yüklü: yok).");
    const s = await c.sonuc;
    assert.deepEqual([s.durum, s.hataDugumu, s.hata], ["hata", "a", "Flash: bilinmeyen klip: 'el_salla' (yüklü: yok)."], String(bekle));
  }
});

test("'iptal' (yeni jest klibi kesti) düğüm hatası: 'iş kesildi'", ZAMAN, async () => {
  const f = sahteKapi(() => ["basladi"]);
  const c = kos(tek({ klip: "el_salla" }), dunya(f.kapi));
  await bekleKosul(() => f.gelen.length === 1);
  f.ver(f.gelen[0]!.id, "iptal", "'el_salla' klibi kesildi (yeni jest)");
  assert.match((await c.sonuc).hata ?? "", /iş kesildi \('el_salla' klibi kesildi/);
});

test("■ klip BEKLENİRKEN: çalışma 'durdu', ajana 'dur' gider (klip kesilir)", ZAMAN, async () => {
  const f = sahteKapi(() => ["basladi"]);
  const c = kos(tek({ klip: "el_salla" }), dunya(f.kapi));
  await bekleKosul(() => f.gelen.length === 1);
  c.durdur();
  assert.deepEqual([(await c.sonuc).durum, f.turler()], ["durdu", ["jest", "dur"]]);
});

test("■ bekle KAPALIYKEN de klibi keser: düğüm geçtikten sonra (sonraki Bekle sürerken) ■ → 'dur'", ZAMAN, async () => {
  const f = sahteKapi(() => ["basladi"]);
  const c = kos(tek({ klip: "bekle_dongu", bekle: false }, 5000), dunya(f.kapi), () => KLIPLER, (ms) => new Promise((r) => setTimeout(r, ms)));
  await bekleKosul(() => c.olaylar.includes("sonra"));
  c.durdur();
  assert.deepEqual([(await c.sonuc).durum, f.turler()], ["durdu", ["jest", "dur"]]);
});

test("çalışma BİTTİKTEN sonra ■ eski klibi kesmez (geç ■)", ZAMAN, async () => {
  const f = sahteKapi(() => ["basladi"]);
  const c = kos(tek({ klip: "bekle_dongu", bekle: false }), dunya(f.kapi));
  await c.sonuc;
  c.durdur();
  assert.deepEqual(f.turler(), ["jest"]);
});

test("denetimden SONRA klip kütüphaneden düşmüşse (ikinci savunma): 'bilinmeyen klip' nedenli hata, niyet GİTMEZ", ZAMAN, async () => {
  let liste: readonly KlipOzeti[] = KLIPLER;
  const f = sahteKapi(() => ["basladi", "bitti"]);
  const g = graf([{ id: "b", tip: "olay.basla" }, { id: "once", tip: "akis.bekle", ayar: { ms: 1 } }, anim({ klip: "el_salla" })], [["b", "sonra", "once", "giris"], ["once", "sonra", "a", "giris"]]);
  const c = grafCalistir(g, { kayit: grafKutuphanesi({ klipler: () => liste }), desen: () => null, yetenek: dunya(f.kapi), ajanlar: () => ["flash"], uyu: async () => { liste = []; } });
  const s = await c.sonuc;
  assert.deepEqual([s.durum, s.hata, f.gelen.length], ["hata", "bilinmeyen klip 'el_salla' (yüklü: yok)", 0]);
});

// ── uçtan uca: gerçek yürütücü (beden kararı) + gerçek klip dosyaları ──
test("UÇTAN UCA: gerçek Yurutucu basla_onayla'yı 1.2 sn oynar; düğüm BİTİNCE devam eder", { timeout: 10_000 }, async () => {
  const kutuphane = klipKutuphanesiKur();
  const r = await klipleriYukle((yol) => readFile(new URL(`../../assets/${yol}`, import.meta.url), "utf8"));
  kutuphane.doldur(r.klipler, r.hatalar);
  const y = new Yurutucu({ klipler: kutuphane });
  const dinleyiciler = new Set<(s: NiyetSonucu) => void>();
  const saat = setInterval(() => { for (const s of y.ilerle(0.05)) for (const d of [...dinleyiciler]) d(s); }, 5);   // 10× hızlı saat
  // Test zaman aşımına düşerse `finally` koşmaz: saat süreci ayakta tutmasın (bozma denemesinde süreç 120 sn asılı kaldı).
  (saat as { unref?: () => void }).unref?.();
  try {
    const kapi: AjanKapisi = { id: "flash", ad: "Flash", niyet: (n, id) => y.niyet(n, id), sonucDinle: (cb) => { dinleyiciler.add(cb); return () => { dinleyiciler.delete(cb); }; }, async soyle() {} };
    const bas = Date.now();
    const c = kos(tek({ klip: "basla_onayla" }), dunya(kapi), () => kutuphane.ozetler());
    await bekleKosul(() => y.gorunum().klip !== null);
    assert.equal(y.gorunum().klip?.klip.ad, "basla_onayla");
    const s = await c.sonuc;
    // 1.2 sn klip / 10× saat ≈ 120 ms; en az 24 tik (5 ms) geçmiş olmalı, klip bitmiş olmalı.
    assert.deepEqual([s.durum, y.gorunum().klip, Date.now() - bas >= 100], ["bitti", null, true]);
  } finally { clearInterval(saat); }
});

// ── Orion'un araç yüzeyi DEĞİŞMEDİ ──
test("BEKÇİ: Orion'un jest aracı 'klip' alanını SUNMAZ (araç yüzeyi ve token bütçesi değişmedi; klip yalnız grafikten)", () => {
  assert.deepEqual(Object.keys((ARAC_TABLOSU.jest.sema as { properties: Record<string, unknown> }).properties), ["jest", "hedef"]);
});
