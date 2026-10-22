// uygulama/graf/dunyaDugumleri.test.ts — DÜNYA DEĞİŞKENLERİ (spec 35 dilim 2c): Saat, Konum, Ajan durumu, Ozyn durumu/mesafesi, En yakın nesne, "Git → konum".
//
// Dünya sahte ama yetenek GERÇEK (`grafYetenegiKur`): düğümler üretimdeki arayüzden okur. Sahte kapı gövde durumunu verir ve niyeti kaydeder; `test.yaz`
// girdisini diziye yazar (hangi dal yürüdü, ne okundu tek yerde görünür).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";
import type { Nesne } from "../../world/level/nesneKaydi.ts";
import { AKIS_GIRIS, AKIS_SONRA } from "./dugumKaydi.ts";
import { grafKutuphanesi } from "./kutuphane.ts";
import { grafTurDenetle } from "./grafTurDenetimi.ts";
import { grafCalistir } from "./yorumlayici.ts";
import type { AjanGovdesi } from "../ajanlar/ajanGovdesi.ts";
import { grafYetenegiKur, type AjanKapisi, type OzynDurumu } from "./grafYetenegi.ts";

const ZAMAN = { timeout: 3000 };

const nesne = (id: string, x: number, z: number, tur: Nesne["tur"] = "mobilya"): Nesne =>
  ({ id, ad: id, tur, capa: null, kutu: { x, y: 0.5, z, g: 1, yuk: 1, d: 1 } });

function dunya(o: { govde?: AjanGovdesi | null; ozyn?: OzynDurumu | null; nesneler?: Nesne[]; saat?: number } = {}) {
  const gelen: Niyet[] = [];
  const yazilan: string[] = [];
  const govde: AjanGovdesi | null = o.govde === undefined ? { konum: { x: 0, y: 0, z: 0 }, mesgul: false, oturuyor: false } : o.govde;
  const kapi: AjanKapisi = {
    id: "flash", ad: "Flash",
    niyet(n, id) { gelen.push(n); queueMicrotask(() => { for (const d of dinleyiciler) d({ niyet_id: id, durum: "bitti" }); }); },
    sonucDinle(cb) { dinleyiciler.add(cb); return () => { dinleyiciler.delete(cb); }; },
    async soyle() {},
    govde: () => govde,
  };
  const dinleyiciler = new Set<(s: NiyetSonucu) => void>();
  const yetenek = grafYetenegiKur({
    ajanlar: () => [{ id: "flash", ad: "Flash" }], kapi: (id) => (id === "flash" ? kapi : null),
    nesneler: () => o.nesneler ?? [], capalar: () => [],
    ozyn: () => (o.ozyn === undefined ? { konum: { x: 3, y: 0, z: 4 }, etkilesim: null } : o.ozyn),
  });
  const kayit = grafKutuphanesi();
  kayit.kaydet({
    tip: "test.yaz", ad: "Yaz", kategori: "ajan", saf: false, aciklama: "diziye yazar",
    pinler: () => ({ girisler: [AKIS_GIRIS, { ad: "deger", tip: "herhangi" }], cikislar: [AKIS_SONRA] }),
    calistir: async (c) => { yazilan.push(JSON.stringify(await c.giris("deger"))); return { sonra: "sonra" }; },
  });
  const kos = async (g: Graf) => {
    const hatalar = grafTurDenetle(g, kayit, { desen: () => null, buGraf: null, ajanlar: () => ["flash"] });
    if (hatalar.length) return { hatalar, sonuc: null };
    const c = grafCalistir(g, { kayit, desen: () => null, yetenek, uyu: async () => {}, ajanlar: () => ["flash"], saat: () => o.saat ?? 10 });
    return { hatalar, sonuc: await c.sonuc };
  };
  return { kos, gelen, yazilan, kayit };
}

const graf = (dugumler: GrafDugumu[], baglar: [string, string, string, string][]): Graf => {
  const r = grafDogrula({ surum: 1, ad: "deneme", tur: "olay", dugumler, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const basla: GrafDugumu = { id: "b", tip: "olay.basla" };
const flash: GrafDugumu = { id: "f", tip: "ajan.sec", ayar: { ajan: "flash" } };
const yaz: GrafDugumu = { id: "y", tip: "test.yaz" };
/** Başla → Yaz(deger = <dugum>.<pin>); `kaynak` düğümü `f` (Ajan seç) ile beslenir. */
const oku = (d: GrafDugumu, pin: string, kimBagla = true) => graf([basla, flash, d, yaz],
  [["b", "sonra", "y", "giris"], ...(kimBagla ? [["f", "ajan", d.id, "kim"] as [string, string, string, string]] : []), [d.id, pin, "y", "deger"]]);

// ── Saat ──
test("Saat: kesirli saat, tam saat ve dakika (14:30 → 14.5 / 14 / 30)", ZAMAN, async () => {
  const d = dunya({ saat: 14.5 });
  for (const [pin, beklenen] of [["saat", "14.5"], ["tam_saat", "14"], ["dakika", "30"]] as const) {
    const y: string[] = [];
    const g = graf([basla, { id: "s", tip: "saat.simdi" }, yaz], [["b", "sonra", "y", "giris"], ["s", pin, "y", "deger"]]);
    const r = await d.kos(g);
    assert.equal(r.sonuc?.durum, "bitti", String(r.hatalar));
    y.push(d.yazilan.at(-1)!);
    assert.equal(y[0], beklenen, pin);
  }
});

test("Saat geçersizse (24 ve üstü) nedenli hata, sessiz geçiş yok", ZAMAN, async () => {
  const r = await dunya({ saat: 24 }).kos(graf([basla, { id: "s", tip: "saat.simdi" }, yaz], [["b", "sonra", "y", "giris"], ["s", "saat", "y", "deger"]]));
  assert.match(r.sonuc?.hata ?? "", /saat 0–24 arası/);
});

test("MAVİ KUTU ÖRNEĞİ: saat 12'den önceyse bir konuma git, değilse söyle (Saat → Karşılaştır → Eğer → Git konum)", ZAMAN, async () => {
  const g = graf([
    basla, flash, { id: "s", tip: "saat.simdi" }, { id: "on", tip: "veri.sayi", ayar: { deger: 12 } },
    { id: "k", tip: "veri.karsilastir", ayar: { islem: "<" } }, { id: "e", tip: "akis.eger" },
    { id: "kn", tip: "veri.konum", ayar: { x: 2, y: 0, z: -3 } }, { id: "git", tip: "ajan.git", ayar: { hedef: "konum" } },
    { id: "soz", tip: "ajan.soyle", ayar: { metin: "Öğleden sonra" } },
  ], [
    ["b", "sonra", "e", "giris"], ["s", "saat", "k", "a"], ["on", "deger", "k", "b"], ["k", "sonuc", "e", "kosul"],
    ["e", "dogru", "git", "giris"], ["e", "yanlis", "soz", "giris"], ["f", "ajan", "git", "kim"], ["f", "ajan", "soz", "kim"], ["kn", "konum", "git", "konum"],
  ]);
  const sabah = dunya({ saat: 9 });
  assert.equal((await sabah.kos(g)).sonuc?.durum, "bitti");
  assert.deepEqual(sabah.gelen.map((n) => [n.tur, n.tur === "git" ? n.hedef : null]), [["git", { tip: "nokta", x: 2, y: 0, z: -3 }]]);
  const ogleden = dunya({ saat: 15 });
  assert.equal((await ogleden.kos(g)).sonuc?.durum, "bitti");
  assert.deepEqual(ogleden.gelen, []);   // söz niyet değil: dala girdi, git'e girmedi
});

// ── Ajan / Ozyn durumu ──
test("Ajan durumu: konum, x, z, meşgul, oturuyor gövdeden okunur", ZAMAN, async () => {
  const govde: AjanGovdesi = { konum: { x: 1.5, y: 0, z: -2 }, mesgul: true, oturuyor: false };
  const d = dunya({ govde });
  const okunan: Record<string, string> = {};
  for (const pin of ["konum", "x", "z", "mesgul", "oturuyor"]) {
    const r = await d.kos(oku({ id: "a", tip: "ajan.durum" }, pin));
    assert.equal(r.sonuc?.durum, "bitti", String(r.hatalar));
    okunan[pin] = d.yazilan.at(-1)!;
  }
  assert.deepEqual(okunan, { konum: '{"x":1.5,"y":0,"z":-2}', x: "1.5", z: "-2", mesgul: "true", oturuyor: "false" });
});

test("Ajan durumu: bedeni hazır değilse nedenli hata", ZAMAN, async () => {
  const r = await dunya({ govde: null }).kos(oku({ id: "a", tip: "ajan.durum" }, "x"));
  assert.match(r.sonuc?.hata ?? "", /Flash: bedeni hazır değil/);
});

test("Ajan durumu verilen konum bir KOPYADIR: grafik gövdenin gerçek durumunu değiştiremez", ZAMAN, async () => {
  const govde: AjanGovdesi = { konum: { x: 1, y: 0, z: 1 }, mesgul: false, oturuyor: false };
  const d = dunya({ govde });
  await d.kos(oku({ id: "a", tip: "ajan.durum" }, "konum"));
  const y = grafYetenegiKur({ ajanlar: () => [], kapi: () => ({ id: "x", ad: "X", niyet() {}, sonucDinle: () => () => {}, soyle: async () => {}, govde: () => govde }), nesneler: () => [], capalar: () => [] });
  const k = y.ajanDurumu("x")!;
  (k.konum as { x: number }).x = 99;
  assert.equal(govde.konum.x, 1);
});

test("Ozyn durumu: konum ve yüzey; yüzey yoksa boş metin", ZAMAN, async () => {
  const d = dunya({ ozyn: { konum: { x: 3, y: 0, z: 4 }, etkilesim: null } });
  await d.kos(graf([basla, { id: "o", tip: "ozyn.durum" }, yaz], [["b", "sonra", "y", "giris"], ["o", "yuzey", "y", "deger"]]));
  assert.equal(d.yazilan.at(-1), '""');
  const m = dunya({ ozyn: { konum: { x: 0, y: 0, z: 0 }, etkilesim: "monitor" } });
  await m.kos(graf([basla, { id: "o", tip: "ozyn.durum" }, yaz], [["b", "sonra", "y", "giris"], ["o", "yuzey", "y", "deger"]]));
  assert.equal(m.yazilan.at(-1), '"monitor"');
});

test("Ozyn'e mesafe YATAYDIR (3-4-5): göz hizası farkı mesafeye karışmaz", ZAMAN, async () => {
  const d = dunya({ govde: { konum: { x: 0, y: 0, z: 0 }, mesgul: false, oturuyor: false }, ozyn: { konum: { x: 3, y: 1.7, z: 4 }, etkilesim: null } });
  const r = await d.kos(oku({ id: "m", tip: "ozyn.mesafe" }, "mesafe"));
  assert.equal(r.sonuc?.durum, "bitti", String(r.hatalar));
  assert.equal(d.yazilan.at(-1), "5");
});

test("Ozyn yoksa (oyuncu bağlı değil) Ozyn düğümleri nedenle düşer", ZAMAN, async () => {
  const r = await dunya({ ozyn: null }).kos(graf([basla, { id: "o", tip: "ozyn.durum" }, yaz], [["b", "sonra", "y", "giris"], ["o", "x", "y", "deger"]]));
  assert.match(r.sonuc?.hata ?? "", /Ozyn'in durumu okunamıyor/);
});

// ── En yakın nesne ──
const KONUM_NESNELER = [nesne("uzak", 10, 0), nesne("yakin", 2, 0), nesne("orta", -4, 0), nesne("lamba", 1, 1, "aydinlatma")];

test("En yakın nesne: ajana yatayda en yakın olanı verir (mesafesiyle)", ZAMAN, async () => {
  const d = dunya({ nesneler: KONUM_NESNELER });
  const g = graf([basla, flash, { id: "e", tip: "nesne.en_yakin", ayar: { tur: "mobilya" } }, yaz],
    [["b", "sonra", "y", "giris"], ["f", "ajan", "e", "kim"], ["e", "mesafe", "y", "deger"]]);
  assert.equal((await d.kos(g)).sonuc?.durum, "bitti");
  assert.equal(d.yazilan.at(-1), "2");
});

test("En yakın nesne: tür süzgeci (lamba 1,4 m'de en yakın ama mobilya aranıyor) ve menzil dışı nedenli hata", ZAMAN, async () => {
  const tumu = dunya({ nesneler: KONUM_NESNELER });
  await tumu.kos(graf([basla, flash, { id: "e", tip: "nesne.en_yakin" }, yaz], [["b", "sonra", "y", "giris"], ["f", "ajan", "e", "kim"], ["e", "mesafe", "y", "deger"]]));
  assert.ok(Math.abs(Number(tumu.yazilan.at(-1)) - Math.SQRT2) < 1e-9);   // süzgeçsiz: lamba kazanır
  const dar = await dunya({ nesneler: KONUM_NESNELER }).kos(graf([basla, flash, { id: "e", tip: "nesne.en_yakin", ayar: { tur: "mobilya", menzil: 1 } }, yaz],
    [["b", "sonra", "y", "giris"], ["f", "ajan", "e", "kim"], ["e", "mesafe", "y", "deger"]]));
  assert.match(dar.sonuc?.hata ?? "", /yakınında nesne yok.*mobilya.*menzil 1 m/);
});

test("En yakın nesne: eşit uzaklıkta kimlik sırasındaki ilk kazanır (deterministik)", ZAMAN, async () => {
  const d = dunya({ nesneler: [nesne("b_sag", 3, 0), nesne("a_sol", -3, 0)] });
  const g = graf([basla, flash, { id: "e", tip: "nesne.en_yakin" }, { id: "n", tip: "ajan.git", ayar: { hedef: "nesne" } }],
    [["b", "sonra", "n", "giris"], ["f", "ajan", "e", "kim"], ["f", "ajan", "n", "kim"], ["e", "nesne", "n", "nesne"]]);
  assert.equal((await d.kos(g)).sonuc?.durum, "bitti");
  assert.equal(d.gelen[0]?.tur, "git");
  assert.deepEqual((d.gelen[0] as Extract<Niyet, { tur: "git" }>).hedef, { tip: "nokta", x: -3, y: 0, z: 0 });
});

// ── Git → konum ve tür denetimi ──
test("Git hedefi 'konum' iken konum pini zorunlu: bağsızsa Kontrol et nedenle söyler; sayı pinine konum bağlanamaz", () => {
  const d = dunya();
  const bagsiz = graf([basla, flash, { id: "git", tip: "ajan.git", ayar: { hedef: "konum" } }], [["b", "sonra", "git", "giris"], ["f", "ajan", "git", "kim"]]);
  assert.ok(grafTurDenetle(bagsiz, d.kayit, { desen: () => null, buGraf: null, ajanlar: () => ["flash"] }).length > 0);
  const yanlis = graf([basla, { id: "kn", tip: "veri.konum" }, { id: "k", tip: "veri.karsilastir" }, yaz],
    [["b", "sonra", "y", "giris"], ["kn", "konum", "k", "a"], ["k", "sonuc", "y", "deger"]]);
  assert.ok(grafTurDenetle(yanlis, d.kayit, { desen: () => null, buGraf: null, ajanlar: () => ["flash"] }).length > 0);
});

test("Git konum: çalışma anında konum olmayan değer (örn. sayı) reddedilir, (0,0)'a yürümez", ZAMAN, async () => {
  const d = dunya();
  d.kayit.kaydet({
    tip: "test.sahte_konum", ad: "Sahte", kategori: "veri", saf: true, aciklama: "konum pininde konum olmayan değer verir",
    pinler: () => ({ girisler: [], cikislar: [{ ad: "konum", tip: "konum" }] }),
    calistir: () => ({ cikti: { konum: { x: "yok" } } }),
  });
  const g = graf([basla, flash, { id: "kn", tip: "test.sahte_konum" }, { id: "git", tip: "ajan.git", ayar: { hedef: "konum" } }],
    [["b", "sonra", "git", "giris"], ["f", "ajan", "git", "kim"], ["kn", "konum", "git", "konum"]]);
  const r = await d.kos(g);
  assert.match(r.sonuc?.hata ?? "", /konum: bir konum olmalı/);
  assert.deepEqual(d.gelen, []);
});

test("Konum ayarı tavanlıdır (±200 m): ova dışı yazım hatası yürüyüş hedefi olmaz", () => {
  const d = dunya();
  const g = graf([basla, { id: "kn", tip: "veri.konum", ayar: { x: 5000 } }, yaz], [["b", "sonra", "y", "giris"], ["kn", "konum", "y", "deger"]]);
  assert.ok(grafTurDenetle(g, d.kayit, { desen: () => null, buGraf: null, ajanlar: () => ["flash"] }).length > 0);
});
