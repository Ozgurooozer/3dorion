// uygulama/graf/ajanDugumleri.test.ts — ajan düğümleri + dünya kapısı + ▶/■ denetimcisi (spec 35 dilim 1): sonuç BEKLEME, ■'nin ajanı durdurması,
// ajan seçimi doğrulaması, protokol doğrulayıcısı, söz hattı, nesne bulma, tek çalışma, canlı satır.
//
// Dünya sahte: her ajanın KAPISI niyetleri bir diziye yazar; sonucu test VERİR (`ver`) ya da kapı kendisi verir (`otomatik`). Böylece "sonuç gelmeden
// sonraki düğüm yürüdü mü" sorusu doğrudan görülür. Asılı kalabilecek her test zaman aşımlıdır: bozulan bekleme kırmızı yanmak yerine sonsuza dek
// beklerdi (dilim 0'ın Durdur testinde görüldü).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";
import type { Nesne } from "../../world/level/nesneKaydi.ts";
import { NESNELER } from "../../world/level/nesneKaydi.ts";
import { tumCapalar } from "../../world/level/capalar.ts";
import { nesneHedefleri } from "../../world/yer/nesneEylemleri.ts";
import { niyetDogrula } from "../../protocol/dogrula.ts";
import { grafYetenegiKur, GRAF_NIYET_ONEKI, type AjanKapisi, type GrafYetenegi } from "./grafYetenegi.ts";
import { grafKutuphanesi, yeniDesenSablonu, yeniGrafSablonu } from "./kutuphane.ts";
import { nesneBul } from "./ajanDugumleri.ts";
import { grafCalistiriciKur, canliSatir, sonucSatiri } from "./grafCalistirici.ts";
import { grafCalistir } from "./yorumlayici.ts";

const ZAMAN = { timeout: 3000 };

// ── sahte dünya ──
type Durum = NiyetSonucu["durum"];
function sahteKapi(id: string, ad: string, otomatik: ((n: Niyet) => Durum | null) | null = () => "bitti") {
  const dinleyiciler = new Set<(s: NiyetSonucu) => void>();
  const gelen: { n: Niyet; id: string }[] = [];
  const sozler: string[] = [];
  let sustu = 0;
  /** Sonucu henüz verilmemiş niyetler: gerçek avatar gibi `dur` onları `iptal` eder. */
  const bekleyen = new Set<string>();
  const ver = (nid: string, durum: Durum, not?: string) => {
    bekleyen.delete(nid);
    for (const d of [...dinleyiciler]) d({ niyet_id: nid, durum, ...(not ? { not } : {}) });
  };
  const kapi: AjanKapisi = {
    id, ad,
    niyet(n, nid) {
      gelen.push({ n, id: nid });
      if (n.tur === "dur") for (const b of [...bekleyen]) queueMicrotask(() => ver(b, "iptal", "kesildi"));
      const d = otomatik?.(n) ?? null;
      if (d) queueMicrotask(() => ver(nid, d)); else bekleyen.add(nid);
    },
    sonucDinle(cb) { dinleyiciler.add(cb); return () => { dinleyiciler.delete(cb); }; },
    async soyle(m) { sozler.push(m); },
    sus() { sustu++; },
  };
  return { kapi, gelen, sozler, ver, sustu: () => sustu, dinleyiciSayisi: () => dinleyiciler.size, turler: () => gelen.map((g) => g.n.tur) };
}

function dunya(kapilar: AjanKapisi[], ek: { ajanlar?: { id: string; ad: string }[]; nesneler?: readonly Nesne[]; adimSiniriMs?: number } = {}): GrafYetenegi {
  const ajanlar = ek.ajanlar ?? kapilar.map((k) => ({ id: k.id, ad: k.ad }));
  return grafYetenegiKur({
    ajanlar: () => ajanlar, kapi: (id) => kapilar.find((k) => k.id === id) ?? null,
    nesneler: () => ek.nesneler ?? NESNELER, capalar: () => tumCapalar(),
    ...(ek.adimSiniriMs ? { adimSiniriMs: ek.adimSiniriMs } : {}),
  });
}

const graf = (dugumler: GrafDugumu[], baglar: [string, string, string, string][], ek: Partial<Graf> = {}): Graf => {
  const r = grafDogrula({ surum: 1, ad: "deneme", tur: "olay", dugumler, ...ek, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const basla: GrafDugumu = { id: "b", tip: "olay.basla" };
const sec = (ajan: string): GrafDugumu => ({ id: "s", tip: "ajan.sec", ayar: { ajan } });

function kos(g: Graf, y: GrafYetenegi, desenler: Graf[] = []) {
  return grafCalistir(g, { kayit: grafKutuphanesi(), desen: (ad) => desenler.find((d) => d.ad === ad) ?? null, yetenek: y, ajanlar: () => y.ajanlar().map((a) => a.id), uyu: async () => {} });
}
async function bekleKosul(f: () => boolean, tur = 200): Promise<void> {
  for (let i = 0; i < tur && !f(); i++) await new Promise((r) => setTimeout(r, 1));
  assert.ok(f(), "koşul gerçekleşmedi");
}

/** Başla → Git(Ozyn) → Söyle("vardım"): sonucun beklenip beklenmediği tek bakışta. */
const gitSoyle = () => graf([basla, sec("flash"), { id: "git", tip: "ajan.git", ayar: { hedef: "ozyn" } }, { id: "soz", tip: "ajan.soyle", ayar: { metin: "vardım" } }],
  [["b", "sonra", "git", "giris"], ["git", "sonra", "soz", "giris"], ["s", "ajan", "git", "kim"], ["s", "ajan", "soz", "kim"]]);

// ── sonucu BEKLEME ──
test("Git sonucu BEKLER: 'bitti' gelmeden sonraki düğüm (Söyle) yürümez; gelince yürür ve çalışma biter", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", null);
  const c = kos(gitSoyle(), dunya([f.kapi]));
  await bekleKosul(() => f.gelen.length === 1);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(f.sozler, []);                       // sonuç yok → söz yok
  f.ver(f.gelen[0]!.id, "bitti");
  const s = await c.sonuc;
  assert.deepEqual([s.durum, f.sozler], ["bitti", ["vardım"]]);
});

test("niyet protokol biçiminde ve kimliği 'elle_' önekli (Ozyn'in ▶'si: hata Orion'un LLM'ini uyandırmaz)", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  await kos(gitSoyle(), dunya([f.kapi])).sonuc;
  assert.deepEqual([f.gelen[0]!.n, f.gelen[0]!.id.startsWith(`${GRAF_NIYET_ONEKI}_`)], [{ tur: "git", hedef: { tip: "oyuncu" }, mesafe: undefined }, true]);
});

test("ajanın HATASI düğüm hatasıdır: neden aynen söylenir, hangi düğüm olduğu döner, sonrası yürümez", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", null);
  const c = kos(gitSoyle(), dunya([f.kapi]));
  await bekleKosul(() => f.gelen.length === 1);
  f.ver(f.gelen[0]!.id, "hata", "hedefe giden yol yok");
  const s = await c.sonuc;
  assert.deepEqual([s.durum, s.hataDugumu, s.hata, f.sozler], ["hata", "git", "Flash: hedefe giden yol yok", []]);
});

test("'iptal' (başka niyet araya girdi) de hatadır: 'iş kesildi'", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", null);
  const c = kos(gitSoyle(), dunya([f.kapi]));
  await bekleKosul(() => f.gelen.length === 1);
  f.ver(f.gelen[0]!.id, "iptal", "'git' kesildi");
  assert.match((await c.sonuc).hata ?? "", /iş kesildi/);
});

test("başka bir niyetin sonucu beklemeyi BİTİRMEZ (yalnız kendi kimliği)", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", null);
  const c = kos(gitSoyle(), dunya([f.kapi]));
  await bekleKosul(() => f.gelen.length === 1);
  f.ver("n_baskasi", "bitti");
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(f.sozler, []);
  f.ver(f.gelen[0]!.id, "bitti");
  assert.equal((await c.sonuc).durum, "bitti");
});

// ── ■ DURDUR ──
test("■ beklerken: çalışma HEMEN 'durdu' olur, ajana AYNI kapıdan 'dur' gider, sonraki düğüm yürümez, dinleyici kalmaz", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", (n) => (n.tur === "dur" ? "bitti" : null));
  const c = kos(gitSoyle(), dunya([f.kapi]));
  await bekleKosul(() => f.gelen.length === 1);
  c.durdur();
  const s = await c.sonuc;
  assert.deepEqual([s.durum, f.turler(), f.sozler], ["durdu", ["git", "dur"], []]);
  f.ver(f.gelen[0]!.id, "iptal");   // dur'un iptal ettiği yürüyüş: avatarAdimi'nın dinleyicisi kapanır
  assert.equal(f.dinleyiciSayisi(), 0);
});

test("■ çalışma bittikten sonra basılırsa ajana 'dur' GİTMEZ (geç ■ eski işi kesmez)", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const c = kos(gitSoyle(), dunya([f.kapi]));
  await c.sonuc;
  c.durdur();
  assert.deepEqual(f.turler(), ["git"]);
});

test("■ söz sürerken: söz hattı susturulur", ZAMAN, async () => {
  let bitir: () => void = () => {};
  const f = sahteKapi("flash", "Flash");
  const kapi: AjanKapisi = { ...f.kapi, soyle: () => new Promise<void>((r) => { bitir = r; }) };
  const c = kos(graf([basla, sec("flash"), { id: "soz", tip: "ajan.soyle", ayar: { metin: "uzun söz" } }], [["b", "sonra", "soz", "giris"], ["s", "ajan", "soz", "kim"]]), dunya([kapi]));
  await new Promise((r) => setTimeout(r, 10));
  c.durdur();
  const s = await c.sonuc;
  bitir();
  assert.deepEqual([s.durum, f.sustu()], ["durdu", 1]);
});

test("adım zaman aşımı: sonuç gelmezse düğüm nedenle düşer ve beden DURDURULUR", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", (n) => (n.tur === "dur" ? "bitti" : null));
  const s = await kos(gitSoyle(), dunya([f.kapi], { adimSiniriMs: 30 })).sonuc;
  assert.deepEqual([s.durum, /zaman aşımı/.test(s.hata ?? ""), f.turler()], ["hata", true, ["git", "dur"]]);
});

// ── ajan seçimi ──
const kontrolEt = (g: Graf, ajanlar: string[], desenler: Graf[] = []) => grafCalistiriciKur({
  kayit: grafKutuphanesi(), depo: { al: () => null, desen: (ad) => desenler.find((d) => d.ad === ad) ?? null }, yetenek: dunya([]), ajanlar: () => ajanlar,
}).kontrol(g);

test("Ajan seç: defterde olmayan kimlik DENETİMDE hata (hangi ajanların olduğunu söyler)", () => {
  assert.match(kontrolEt(gitSoyle(), ["orion"]).join(), /s\.ajan: 'flash' geçersiz \(seçenekler: orion\)/);
});

test("Ajan seç: liste ÇALIŞMA ANINDA okunur — Flash sonradan gelince aynı grafik denetimden geçer", () => {
  const ajanlar = ["orion"];
  const c = grafCalistiriciKur({ kayit: grafKutuphanesi(), depo: { al: () => null, desen: () => null }, yetenek: dunya([]), ajanlar: () => ajanlar });
  assert.notDeepEqual(c.kontrol(gitSoyle()), []);
  ajanlar.push("flash");
  assert.deepEqual(c.kontrol(gitSoyle()), []);
});

test("Ajan seç: seçim yapılmamışsa denetim nedenle söyler", () => {
  assert.match(kontrolEt(graf([basla, { id: "s", tip: "ajan.sec" }], []), ["flash"]).join(), /ajan seçilmedi/);
});

test("bilinmeyen ajanlı grafik hiç başlamaz: tek niyet bile gitmez", ZAMAN, async () => {
  const f = sahteKapi("orion", "Orion");
  const s = await kos(gitSoyle(), dunya([f.kapi])).sonuc;
  assert.deepEqual([s.durum, f.gelen.length], ["hata", 0]);
});

test("ayar.kim (bağsız) da defterden denetlenir", () => {
  const g = graf([basla, { id: "k", tip: "ajan.kalk", ayar: { kim: "hayalet" } }], [["b", "sonra", "k", "giris"]]);
  assert.match(kontrolEt(g, ["flash"]).join(), /k\.kim: 'hayalet' geçersiz/);
});

test("defterde olan ama bedeni hazır olmayan ajan: düğüm hatası nedeniyle", ZAMAN, async () => {
  const s = await kos(gitSoyle(), dunya([], { ajanlar: [{ id: "flash", ad: "Flash" }] })).sonuc;
  assert.match(s.hata ?? "", /bedeni hazır değil/);
});

// ── protokol doğrulayıcısı ve söz ──
test("niyet PROTOKOL DOĞRULAYICISINDAN geçer: boş söz reddedilir, reddin metni düğüm hatasıdır, ajana hiçbir şey gitmez", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const g = graf([basla, sec("flash"), { id: "soz", tip: "ajan.soyle", ayar: { metin: "" } }], [["b", "sonra", "soz", "giris"], ["s", "ajan", "soz", "kim"]]);
  const s = await kos(g, dunya([f.kapi])).sonuc;
  assert.deepEqual([s.durum, s.hataDugumu, s.hata, f.sozler, f.gelen.length], ["hata", "soz", "niyet reddedildi: metin: boş olmayan metin olmalı", [], 0]);
});

test("boş çapa adı: niyet hiç gitmez, neden söylenir", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const g = graf([basla, sec("flash"), { id: "o", tip: "ajan.otur", ayar: { capa: "   " } }], [["b", "sonra", "o", "giris"], ["s", "ajan", "o", "kim"]]);
  const s = await kos(g, dunya([f.kapi])).sonuc;
  assert.deepEqual([s.durum, /capa/.test(s.hata ?? ""), f.gelen.length], ["hata", true, 0]);
});

test("Söyle niyet DEĞİL söz hattına gider (avatar 'soyle'yi reddeder): kapının soyle'si çağrılır, niyet gönderilmez", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const g = graf([basla, sec("flash"), { id: "t", tip: "akis.tekrar", ayar: { sayi: 2 } }, { id: "soz", tip: "ajan.soyle" }],
    [["b", "sonra", "t", "giris"], ["t", "govde", "soz", "giris"], ["t", "indeks", "soz", "metin"], ["s", "ajan", "soz", "kim"]]);
  const s = await kos(g, dunya([f.kapi])).sonuc;
  assert.deepEqual([s.durum, f.sozler, f.gelen.length], ["bitti", ["0", "1"], 0]);   // sayı da söylenir
});

test("söz hattı söyleyemezse (fırlatırsa) düğüm nedeniyle düşer", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const kapi: AjanKapisi = { ...f.kapi, soyle: async () => { throw new Error("ses yok"); } };
  const s = await kos(graf([basla, sec("flash"), { id: "soz", tip: "ajan.soyle", ayar: { metin: "x" } }], [["b", "sonra", "soz", "giris"], ["s", "ajan", "soz", "kim"]]), dunya([kapi])).sonuc;
  assert.match(s.hata ?? "", /Flash söyleyemedi: ses yok/);
});

test("Jest: geçersiz jest adı denetimde, geçerli jest niyet olarak gider", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const kotu = graf([basla, sec("flash"), { id: "j", tip: "ajan.jest", ayar: { jest: "dans" } }], [["b", "sonra", "j", "giris"], ["s", "ajan", "j", "kim"]]);
  assert.match(kontrolEt(kotu, ["flash"]).join(), /j\.jest: 'dans' geçersiz/);
  const iyi = graf([basla, sec("flash"), { id: "j", tip: "ajan.jest", ayar: { jest: "başını_sallıyor" } }], [["b", "sonra", "j", "giris"], ["s", "ajan", "j", "kim"]]);
  await kos(iyi, dunya([f.kapi])).sonuc;
  assert.deepEqual(f.gelen.map((g) => g.n), [{ tur: "jest", jest: "başını_sallıyor" }]);
});

test("Otur/Kalk/Bak(serbest)/Git(çapa, etiketle): doğrulanmış niyetler", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const g = graf([basla, sec("flash"), { id: "o", tip: "ajan.otur" }, { id: "k", tip: "ajan.kalk" }, { id: "bk", tip: "ajan.bak", ayar: { hedef: "serbest" } }, { id: "g", tip: "ajan.git", ayar: { hedef: "capa", capa: "beyaz tahta", mesafe: 1.5 } }],
    [["b", "sonra", "o", "giris"], ["o", "sonra", "k", "giris"], ["k", "sonra", "bk", "giris"], ["bk", "sonra", "g", "giris"], ["s", "ajan", "o", "kim"], ["s", "ajan", "k", "kim"], ["s", "ajan", "bk", "kim"], ["s", "ajan", "g", "kim"]]);
  assert.equal((await kos(g, dunya([f.kapi])).sonuc).durum, "bitti");
  assert.deepEqual(f.gelen.map((x) => x.n), [
    { tur: "otur", capa: "sandalye" }, { tur: "kalk" }, { tur: "bak", hedef: null },
    { tur: "git", hedef: { tip: "capa", ad: "tahta" }, mesafe: 1.5 },   // "beyaz tahta" → tahta (doğrulayıcı)
  ]);
});

// ── nesne ──
test("Nesne bul: tam ad, ad içinde geçen, birden çok aday (hata), bulunamayan (hata, var olanları söyler)", () => {
  const ad = (r: ReturnType<typeof nesneBul>) => (r.ok ? r.deger.id : r.hata);
  assert.equal(ad(nesneBul(NESNELER, "raf", "")), "raf");
  assert.equal(ad(nesneBul(NESNELER, "BERJER", "")), "berjer");
  assert.equal(ad(nesneBul(NESNELER, "lamba", "")), "ayakli_lamba");
  assert.match(ad(nesneBul(NESNELER, "uçak", "")), /bulunamadı \(var: /);
  assert.match(ad(nesneBul(NESNELER, "", "mobilya")), /birden çok nesne/);
  assert.equal(ad(nesneBul(NESNELER, "", "aydinlatma")), "ayakli_lamba");
});

test("Git(nesne): hedef etkileşim menüsüyle AYNI kuraldan — çapasız nesneye nokta + yarıçap, çapalıya çapa", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const yap = (ad: string) => graf([basla, sec("flash"), { id: "n", tip: "nesne.bul", ayar: { ad } }, { id: "g", tip: "ajan.git", ayar: { hedef: "nesne" } }],
    [["b", "sonra", "g", "giris"], ["s", "ajan", "g", "kim"], ["n", "nesne", "g", "nesne"]]);
  await kos(yap("raf"), dunya([f.kapi])).sonuc;
  await kos(yap("sandalye"), dunya([f.kapi])).sonuc;
  const bul = (id: string) => NESNELER.find((n) => n.id === id)!;
  const dogru = (n: Niyet) => { const r = niyetDogrula(n); assert.ok(r.ok); return r.deger; };
  assert.deepEqual(f.gelen.map((x) => x.n), [dogru(nesneHedefleri(bul("raf"), tumCapalar()).git), dogru(nesneHedefleri(bul("sandalye"), tumCapalar()).git)]);
});

test("Nesne bul bulamazsa grafik o düğümde nedenle düşer (yanlış yere yürünmez)", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const g = graf([basla, sec("flash"), { id: "n", tip: "nesne.bul", ayar: { ad: "uçak" } }, { id: "g", tip: "ajan.git", ayar: { hedef: "nesne" } }],
    [["b", "sonra", "g", "giris"], ["s", "ajan", "g", "kim"], ["n", "nesne", "g", "nesne"]]);
  const s = await kos(g, dunya([f.kapi])).sonuc;
  assert.deepEqual([s.durum, s.hataDugumu, /bulunamadı/.test(s.hata ?? ""), f.gelen.length], ["hata", "n", true, 0]);
});

// ── şablonlar ──
test("'Yeni' şablonu biçimden ve denetimden geçer, uçtan uca çalışır: git → 3 × (jest) → söz", ZAMAN, async () => {
  const g = yeniGrafSablonu("ornek");
  assert.equal(grafDogrula(JSON.parse(JSON.stringify(g))).ok, true);
  assert.deepEqual(kontrolEt(g, ["orion", "flash"]), []);
  const f = sahteKapi("flash", "Flash");
  const s = await kos(g, dunya([f.kapi])).sonuc;
  assert.deepEqual([s.durum, f.turler(), f.sozler], ["bitti", ["git", "jest", "jest", "jest"], ["Merhaba Ozyn!"]]);
});

test("desen şablonu tek düğüm olarak çağrılır ('kim' girişiyle)", ZAMAN, async () => {
  const d = yeniDesenSablonu("selamla");
  assert.deepEqual(kontrolEt(d, ["flash"]), []);
  const g = graf([basla, sec("flash"), { id: "c", tip: "desen.cagir", ayar: { desen: "selamla" } }], [["b", "sonra", "c", "giris"], ["s", "ajan", "c", "kim"]]);
  const f = sahteKapi("flash", "Flash");
  const s = await kos(g, dunya([f.kapi]), [d]).sonuc;
  assert.deepEqual([s.durum, f.turler(), f.sozler], ["bitti", ["jest"], ["Selam!"]]);
});

// ── ▶ / ■ denetimcisi ──
function calistirici(desenler: Graf[], grafikler: Graf[], f: ReturnType<typeof sahteKapi>) {
  const y = dunya([f.kapi]);
  return grafCalistiriciKur({
    kayit: grafKutuphanesi(), yetenek: y, ajanlar: () => y.ajanlar().map((a) => a.id), uyu: async () => {},
    depo: { al: (ad) => grafikler.find((g) => g.ad === ad) ?? null, desen: (ad) => desenler.find((g) => g.ad === ad) ?? null },
  });
}

test("aynı anda TEK çalışma: ikinci ▶ nedenle reddedilir; canlı satır şu anki düğümü (kimlik + tür adı) söyler", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", null);
  const c = calistirici([], [gitSoyle()], f);
  assert.deepEqual(c.calistir("deneme"), { ok: true });
  await bekleKosul(() => f.gelen.length === 1);
  assert.match(String((c.calistir("deneme") as { neden?: string }).neden), /zaten çalışıyor/);
  assert.match(canliSatir(c.durum(), Date.now()), /^▶ deneme · git \(Git\) · /);
  f.ver(f.gelen[0]!.id, "bitti");
  await c.bitti();
  assert.deepEqual([c.durum().calisiyor, c.durum().son?.durum], [null, "bitti"]);
});

test("■ denetimcide: sonuç 'durdu' ve son düğüm satırda", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", (n) => (n.tur === "dur" ? "bitti" : null));
  const c = calistirici([], [gitSoyle()], f);
  c.calistir("deneme");
  await bekleKosul(() => f.gelen.length === 1);
  assert.equal(c.durdur(), true);
  await c.bitti();
  assert.equal(sonucSatiri(c.durum().son!), "■ deneme durduruldu · son düğüm: git (Git) · 3 adım");
  assert.equal(c.durdur(), false);   // çalışma yok
});

test("hata desenin İÇİNDEYSE satır desenin adını ve düğümünü söyler", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", (n) => (n.tur === "jest" ? "hata" : "bitti"));
  const g = graf([basla, sec("flash"), { id: "c", tip: "desen.cagir", ayar: { desen: "selamla" } }], [["b", "sonra", "c", "giris"], ["s", "ajan", "c", "kim"]], { ad: "ana" });
  const c = calistirici([yeniDesenSablonu("selamla")], [g], f);
  c.calistir("ana");
  await c.bitti();
  assert.match(sonucSatiri(c.durum().son!), /^✗ ana: salla \(Jest\) \[desen 'selamla'\]: Flash: /);
});

test("desen ve olmayan grafik ▶ ile başlamaz (nedenle)", () => {
  const f = sahteKapi("flash", "Flash");
  const c = calistirici([], [yeniDesenSablonu("selamla")], f);
  assert.match(String((c.calistir("selamla") as { neden?: string }).neden), /desen/);
  assert.match(String((c.calistir("yok") as { neden?: string }).neden), /yüklenemedi/);
});

test("▶ anındaki grafik çalışır: çalışırken depodaki grafik değişse de süren çalışma değişmez", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", null);
  const g = gitSoyle();
  const c = calistirici([], [g], f);
  c.calistir("deneme");
  await bekleKosul(() => f.gelen.length === 1);
  g.dugumler.find((d) => d.id === "soz")!.ayar = { metin: "değişti" };
  f.ver(f.gelen[0]!.id, "bitti");
  await c.bitti();
  assert.deepEqual(f.sozler, ["vardım"]);
});

// ── bekçi: ▶ yalnız Ozyn'in tıklamasından ──
test("▶ TEK YERDEN: çalıştırıcının `calistir`ı üretim kodunda yalnız Graf sekmesinden çağrılır; arka katmanlar grafiğe dokunmaz", () => {
  const kok = path.resolve(import.meta.dirname, "..", "..");
  const tara = (klasor: string): string[] => fs.readdirSync(path.join(kok, klasor), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tara(path.join(klasor, e.name)) : /\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [path.join(klasor, e.name).split(path.sep).join("/")] : []);
  const uretim = ["uygulama", "bridge", "mind", "flash", "world", "voice", "protocol"].flatMap(tara);
  const cagiranlar = uretim.filter((d) => /calistirici\.calistir\(/.test(fs.readFileSync(path.join(kok, d), "utf8")));
  // BİLİNÇLİ İZİN LİSTESİ (dilim 2b): Graf sekmesi ve görsel editörün ▶ düğmesi. Her çağrının isTrusted'a baktığını npcDavranisi.test.ts sınar.
  assert.deepEqual(cagiranlar, ["uygulama/yapi/graf/calistirmaDugmeleri.ts", "uygulama/yapi/grafSekmesi.ts"]);
  const arka = uretim.filter((d) => /^(bridge|mind|flash)\//.test(d) && /uygulama\/graf\//.test(fs.readFileSync(path.join(kok, d), "utf8")));
  assert.deepEqual(arka, []);
});
