// uygulama/graf/npcDavranisi.test.ts — spec 35 dilim 2: ⚡ dinleme (olay tetikli çalışma ve onun güvenlik kuralı), seçimli diyalog, nöbetçi şablonu.
//
// Dünya sahte: ajan kapıları niyeti bir diziye yazar ve (`elle` değilse) sonucu kendisi verir; söz `sozler`e düşer. Olay yolu gerçek (`olayYoluKur`),
// diyalog denetimcisi gerçek, yalnız saati sahte (zaman aşımını test tetikler). Asılı kalabilecek her test zaman aşımlı (dilim 0 dersi).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import { HAREKET_OLAYLARI } from "../../protocol/algi.ts";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";
import { grafYetenegiKur, type AjanKapisi } from "./grafYetenegi.ts";
import { GRAF_SABLONLARI, grafKutuphanesi, nobetciSablonu } from "./kutuphane.ts";
import { grafCalistiriciKur, type GrafCalistirici } from "./grafCalistirici.ts";
import { grafDinleyiciKur, olayYoluKur, desenleriDondur, DINLEME_AZAMI, type GrafDinleyici, type OlayYolu } from "./grafDinleyici.ts";
import { GrafDurumDeposu } from "./grafDurumu.ts";
import { diyalogDenetimiKur, type DiyalogDenetimi } from "./diyalogDenetimi.ts";
import { OLAY_TANIMLARI } from "./olayDugumleri.ts";
import { diyalogTusu } from "../yapi/diyalogKutusu.ts";

const ZAMAN = { timeout: 3000 };

// ── sahte dünya ──
function sahteKapi(id: string, ad: string, elle = false) {
  const dinleyiciler = new Set<(s: NiyetSonucu) => void>();
  const gelen: { n: Niyet; id: string }[] = [];
  const sozler: string[] = [];
  const bekleyen = new Set<string>();
  const ver = (nid: string, durum: NiyetSonucu["durum"]) => { bekleyen.delete(nid); for (const d of [...dinleyiciler]) d({ niyet_id: nid, durum }); };
  const kapi: AjanKapisi = {
    id, ad,
    niyet(n, nid) {
      gelen.push({ n, id: nid });
      if (n.tur === "dur") { for (const b of [...bekleyen]) queueMicrotask(() => ver(b, "iptal")); queueMicrotask(() => ver(nid, "bitti")); return; }
      if (elle) bekleyen.add(nid); else queueMicrotask(() => ver(nid, "bitti"));
    },
    sonucDinle(cb) { dinleyiciler.add(cb); return () => { dinleyiciler.delete(cb); }; },
    async soyle(m) { sozler.push(m); },
  };
  return { kapi, gelen, sozler, ver, turler: () => gelen.map((g) => g.n.tur), ilkBekleyen: () => [...bekleyen][0] };
}

function dunya(o: { kapilar: AjanKapisi[]; grafikler?: Graf[]; desenler?: Graf[]; saat?: () => number; simdi?: () => number; dd?: DiyalogDenetimi; olaylar?: string[] }) {
  const yol: OlayYolu = olayYoluKur();
  for (const a of o.olaylar ?? ["flash"]) yol.ajanEkle(a);
  const dd = o.dd ?? diyalogDenetimiKur({ zamanla: () => () => {} });
  const grafikler = o.grafikler ?? [];
  const yetenek = grafYetenegiKur({
    ajanlar: () => o.kapilar.map((k) => ({ id: k.id, ad: k.ad })), kapi: (id) => o.kapilar.find((k) => k.id === id) ?? null,
    nesneler: () => [], capalar: () => [], diyalog: (i) => dd.ac(i),
  });
  const durum = new GrafDurumDeposu();
  const taban = {
    kayit: grafKutuphanesi(), yetenek, durum, uyu: async () => {},
    depo: { al: (ad: string) => grafikler.find((g) => g.ad === ad) ?? null, desen: (ad: string) => o.desenler?.find((g) => g.ad === ad) ?? null },
    ajanlar: () => o.kapilar.map((k) => k.id), saat: o.saat ?? (() => 10), ...(o.simdi ? { simdi: o.simdi } : {}),
  };
  const calistirici: GrafCalistirici = grafCalistiriciKur({ ...taban, mesgul: (ad) => (dinleyici.calisiyorMu(ad) ? "olayla çalışıyor" : null) });
  const dinleyici: GrafDinleyici = grafDinleyiciKur({ ...taban, kaynak: yol, disMesgul: (ad) => calistirici.durum().calisiyor?.graf === ad });
  return { yol, dd, durum, calistirici, dinleyici, grafikler };
}

const graf = (dugumler: GrafDugumu[], baglar: [string, string, string, string][], ek: Partial<Graf> = {}): Graf => {
  const r = grafDogrula({ surum: 1, ad: "nobet", tur: "olay", dugumler, ...ek, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
/** ⚡ Ozyn Flash'a yaklaştı → Söyle("mesafe " + mesafe) — kim olayın kendi `ajan` çıkışından. */
const yaklasinca = (ad = "nobet") => graf([
  { id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: "flash" } }, { id: "m", tip: "metin.birlestir", ayar: { a: "mesafe " } }, { id: "s", tip: "ajan.soyle" },
], [["y", "sonra", "s", "giris"], ["y", "ajan", "s", "kim"], ["y", "mesafe", "m", "b"], ["m", "metin", "s", "metin"]], { ad });
/** ⚡ yaklaşınca Flash Ozyn'e döner (sonucu test verir → çalışma "sürer"). */
const donunce = (ad = "nobet") => graf([{ id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: "flash" } }, { id: "d", tip: "ajan.bak", ayar: { hedef: "ozyn" } }],
  [["y", "sonra", "d", "giris"], ["y", "ajan", "d", "kim"]], { ad });
const YAKLASTI = { ad: "ozyn_yaklasti", ayrinti: { mesafe: 1.2 } };

async function bekleKosul(f: () => boolean, tur = 300): Promise<void> {
  for (let i = 0; i < tur && !f(); i++) await new Promise((r) => setTimeout(r, 1));
  assert.ok(f(), "koşul gerçekleşmedi");
}

// ── ⚡ dinleme: güvenlik ──
test("dinlemeye ALINMAMIŞ grafiğin olayı hiçbir şey yürütmez (olay ▶'siz çalıştıramaz)", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const d = dunya({ kapilar: [f.kapi], grafikler: [yaklasinca()] });
  d.yol.yay("flash", YAKLASTI);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual([f.sozler, f.gelen.length, d.dinleyici.liste().length], [[], 0, 0]);
});

test("dinlemeye alınınca olay grafiği OLAY DÜĞÜMÜNDEN yürütür; olayın ajanı ve verisi çıkışta", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const d = dunya({ kapilar: [f.kapi], grafikler: [yaklasinca()] });
  assert.deepEqual(d.dinleyici.dinlemeyeAl("nobet"), { ok: true });
  d.yol.yay("flash", YAKLASTI);
  await d.dinleyici.bitti();
  const s = d.dinleyici.liste()[0]!;
  assert.deepEqual([f.sozler, s.tetik, s.son?.durum], [["mesafe 1.2"], 1, "bitti"]);
});

test("YANLIŞ AJANIN olayı tetiklemez (Ozyn Orion'a yaklaştı → Flash'ın nöbetçisi susar); başka olay adı da tetiklemez", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash"), o = sahteKapi("orion", "Orion");
  const d = dunya({ kapilar: [o.kapi, f.kapi], grafikler: [yaklasinca()], olaylar: ["flash", "orion"] });
  d.dinleyici.dinlemeyeAl("nobet");
  d.yol.yay("orion", YAKLASTI);
  d.yol.yay("flash", { ad: "ozyn_uzaklasti", ayrinti: { mesafe: 3 } });
  d.yol.yay("flash", { ad: "ozyn_sana_bakti" });
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual([f.sozler, o.sozler, d.dinleyici.liste()[0]!.tetik], [[], [], 0]);
});

test("ÇAKIŞAN olay iki kez çalıştırmaz: çalışma sürerken gelen olay ATLANIR, sayılır, kuyruğa girmez", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", true);
  let t = 0;
  const d = dunya({ kapilar: [f.kapi], grafikler: [donunce()], simdi: () => t });
  d.dinleyici.dinlemeyeAl("nobet");
  d.yol.yay("flash", YAKLASTI);
  await bekleKosul(() => f.gelen.length === 1);
  t = 60_000;   // soğuma dolmuş olsa bile: atlanma nedeni "çalışıyor"
  d.yol.yay("flash", YAKLASTI);
  d.yol.yay("flash", YAKLASTI);
  await new Promise((r) => setTimeout(r, 10));
  // Doğrudan say (beklemeden): ikinci bir çalışma başlasaydı bedene ikinci 'bak' giderdi. Bunu beklemeye bırakmak hatayı yalnız zaman aşımıyla gösterirdi.
  assert.equal(f.gelen.length, 1, "çalışma sürerken gelen olay yeni çalışma başlattı");
  f.ver(f.ilkBekleyen()!, "bitti");
  await d.dinleyici.bitti();
  await new Promise((r) => setTimeout(r, 10));
  const s = d.dinleyici.liste()[0]!;
  assert.deepEqual([f.turler(), s.tetik, s.atlanan], [["bak"], 1, { calisiyor: 2, soguma: 0 }]);
});

test("SOĞUMA: aynı olay düğümü soğuma dolmadan yeniden tetiklenmez (sayılır); dolunca tetiklenir", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  let t = 0;
  const d = dunya({ kapilar: [f.kapi], grafikler: [yaklasinca()], simdi: () => t });
  d.dinleyici.dinlemeyeAl("nobet");
  d.yol.yay("flash", YAKLASTI); await d.dinleyici.bitti();
  t = 1000; d.yol.yay("flash", YAKLASTI); await d.dinleyici.bitti();
  t = 6000; d.yol.yay("flash", YAKLASTI); await d.dinleyici.bitti();
  const s = d.dinleyici.liste()[0]!;
  assert.deepEqual([f.sozler.length, s.tetik, s.atlanan.soguma], [2, 2, 1]);
});

test("■ durdur süren olay çalışmasını keser (bedene 'dur'), dinleme SÜRER; bırakınca sonraki olay hiçbir şey yapmaz", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", true);
  let t = 0;
  const d = dunya({ kapilar: [f.kapi], grafikler: [donunce()], simdi: () => t });
  d.dinleyici.dinlemeyeAl("nobet");
  d.yol.yay("flash", YAKLASTI);
  await bekleKosul(() => f.gelen.length === 1);
  assert.equal(d.dinleyici.durdur(), 1);
  await d.dinleyici.bitti();
  assert.deepEqual([f.turler(), d.dinleyici.liste()[0]!.son?.durum, d.dinleyici.dinlemedeMi("nobet")], [["bak", "dur"], "durdu", true]);
  assert.equal(d.dinleyici.birak("nobet"), true);
  t = 60_000;
  d.yol.yay("flash", YAKLASTI);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual([f.turler(), d.dinleyici.liste()], [["bak", "dur"], []]);
});

test("bırakınca olay ABONELİĞİ kapanır (sızıntı yok: yeniden kur-bırak döngüsü abone biriktirmez)", () => {
  const f = sahteKapi("flash", "Flash");
  let acik = 0;
  const kaynak = { ajanlar: () => ["flash"], dinle: () => { acik++; return () => { acik--; }; } };
  const g = yaklasinca();
  const dinleyici = grafDinleyiciKur({
    kayit: grafKutuphanesi(), yetenek: grafYetenegiKur({ ajanlar: () => [{ id: "flash", ad: "Flash" }], kapi: () => f.kapi, nesneler: () => [], capalar: () => [] }),
    depo: { al: () => g, desen: () => null }, ajanlar: () => ["flash"], kaynak,
  });
  for (let i = 0; i < 3; i++) { dinleyici.dinlemeyeAl("nobet"); assert.equal(acik, 1); dinleyici.birak("nobet"); assert.equal(acik, 0); }
  dinleyici.dinlemeyeAl("nobet");
  dinleyici.hepsiniBirak();
  assert.equal(acik, 0);
});

test("bırak süren çalışmayı da durdurur; hepsini bırak listeyi boşaltır", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", true);
  const d = dunya({ kapilar: [f.kapi], grafikler: [donunce("a"), yaklasinca("b")] });
  d.dinleyici.dinlemeyeAl("a"); d.dinleyici.dinlemeyeAl("b");
  d.yol.yay("flash", YAKLASTI);
  await bekleKosul(() => f.turler().includes("bak"));
  d.dinleyici.birak("a");
  await d.dinleyici.bitti();
  assert.ok(f.turler().includes("dur"));
  assert.equal(d.dinleyici.hepsiniBirak(), 1);
  assert.deepEqual(d.dinleyici.liste(), []);
});

test("dinlemeye alınan KOPYADIR: dosya sonradan değişse de dinlenen program değişmez", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const g = graf([{ id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: "flash" } }, { id: "s", tip: "ajan.soyle", ayar: { metin: "eski" } }],
    [["y", "sonra", "s", "giris"], ["y", "ajan", "s", "kim"]]);
  const d = dunya({ kapilar: [f.kapi], grafikler: [g] });
  d.dinleyici.dinlemeyeAl("nobet");
  g.dugumler[1]!.ayar = { metin: "yeni (onaylanmadı)" };
  d.yol.yay("flash", YAKLASTI);
  await d.dinleyici.bitti();
  assert.deepEqual(f.sozler, ["eski"]);
});

test("kurulamayan dinleme NEDENLE: olay düğümü yok, bozuk/yok, desen, tür hatası, ajanın olayları kapalı (Orion), zaten dinlemede", () => {
  const f = sahteKapi("flash", "Flash"), o = sahteKapi("orion", "Orion");
  const sadeceBasla = graf([{ id: "b", tip: "olay.basla" }], [], { ad: "duz" });
  const desen = graf([{ id: "g", tip: "fonksiyon.giris" }], [], { ad: "dsn", tur: "fonksiyon" });
  const turHatali = graf([{ id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: "flash" } }, { id: "e", tip: "akis.eger" }], [["y", "sonra", "e", "giris"], ["y", "mesafe", "e", "kosul"]], { ad: "turlu" });
  const orionun = graf([{ id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: "orion" } }], [], { ad: "orionun" });
  const d = dunya({ kapilar: [o.kapi, f.kapi], grafikler: [sadeceBasla, desen, turHatali, orionun, yaklasinca()] });
  const neden = (ad: string) => { const r = d.dinleyici.dinlemeyeAl(ad); return r.ok ? "KURULDU" : r.neden; };
  assert.match(neden("duz"), /hiçbir olayı dinlemiyor/);
  assert.match(neden("yok"), /yüklenemedi/);
  assert.match(neden("dsn"), /desen/);
  assert.match(neden("turlu"), /Kontrol et: .*tür uyuşmuyor/);
  assert.match(neden("orionun"), /'orion' ajanının olayları grafiğe açık değil \(açık: flash/);
  assert.equal(neden("nobet"), "KURULDU");
  assert.match(neden("nobet"), /zaten dinlemede/);
  assert.deepEqual(d.dinleyici.liste().map((x) => x.graf), ["nobet"]);
});

test(`tavan: en çok ${DINLEME_AZAMI} grafik aynı anda dinler`, () => {
  const f = sahteKapi("flash", "Flash");
  const l = Array.from({ length: DINLEME_AZAMI + 1 }, (_, i) => yaklasinca(`g${i}`));
  const d = dunya({ kapilar: [f.kapi], grafikler: l });
  for (let i = 0; i < DINLEME_AZAMI; i++) assert.deepEqual(d.dinleyici.dinlemeyeAl(`g${i}`), { ok: true });
  const r = d.dinleyici.dinlemeyeAl(`g${DINLEME_AZAMI}`);
  assert.match(r.ok ? "" : r.neden, /en çok 8 grafik/);
});

test("aynı grafik tek çalışma: ▶ sürerken gelen olay atlanır; olay çalışması sürerken ▶ reddedilir", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash", true);
  const g = graf([{ id: "b", tip: "olay.basla" }, { id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: "flash" } }, { id: "sec", tip: "ajan.sec", ayar: { ajan: "flash" } }, { id: "d", tip: "ajan.bak", ayar: { hedef: "ozyn" } }],
    [["b", "sonra", "d", "giris"], ["y", "sonra", "d", "giris"], ["sec", "ajan", "d", "kim"]]);
  const d = dunya({ kapilar: [f.kapi], grafikler: [g] });
  d.dinleyici.dinlemeyeAl("nobet");
  assert.deepEqual(d.calistirici.calistir("nobet"), { ok: true });
  await bekleKosul(() => f.gelen.length === 1);
  d.yol.yay("flash", YAKLASTI);
  assert.equal(d.dinleyici.liste()[0]!.atlanan.calisiyor, 1);
  f.ver(f.ilkBekleyen()!, "bitti");
  await d.calistirici.bitti();
  d.yol.yay("flash", YAKLASTI);
  await bekleKosul(() => f.gelen.length === 2);
  const r = d.calistirici.calistir("nobet");
  assert.match(r.ok ? "" : r.neden, /olayla çalışıyor/);
  f.ver(f.ilkBekleyen()!, "bitti");
  await d.dinleyici.bitti();
});

// ── olay düğümü ve denetim ──
test("▶ olay düğümünden başlamaz: Başla'sız grafik ▶ ile nedenle düşer (olay düğümü yürümez)", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const d = dunya({ kapilar: [f.kapi], grafikler: [yaklasinca()] });
  d.calistirici.calistir("nobet");
  await d.calistirici.bitti();
  assert.match(d.calistirici.durum().son?.hata ?? "", /olayla çalışır \('▶ Başla' yok\)/);
  assert.deepEqual(f.sozler, []);
});

test("denetim: girişsiz olay grafiği, iki Başla, desende olay düğümü, defterde olmayan olay ajanı", () => {
  const d = dunya({ kapilar: [sahteKapi("flash", "Flash").kapi] });
  const k = (g: Graf) => d.calistirici.kontrol(g).join(" | ");
  assert.match(k(graf([{ id: "s", tip: "akis.sira" }], [])), /girişi olmalı: tam bir '▶ Başla'/);
  assert.match(k(graf([{ id: "a", tip: "olay.basla" }, { id: "b", tip: "olay.basla" }], [])), /en çok bir '▶ Başla'/);
  assert.match(k(graf([{ id: "g", tip: "fonksiyon.giris" }, { id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: "flash" } }], [], { tur: "fonksiyon" })), /desen grafiğinde olay düğümü olmaz/);
  assert.match(k(graf([{ id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: "hayalet" } }], [])), /y\.ajan: 'hayalet' geçersiz/);
  assert.match(k(graf([{ id: "y", tip: "olay.ozyn_yaklasti" }], [])), /olayın ajanı seçilmedi/);
  assert.deepEqual(k(yaklasinca()), "");
});

test("BEKÇİ: olay düğümleri protokolün hareket olaylarının TAMAMI ve yalnız onlar", () => {
  assert.deepEqual(OLAY_TANIMLARI.map((t) => t.olay).sort(), [...HAREKET_OLAYLARI].sort());
});

// ── seçimli diyalog ──
function sahteSaat() {
  const isler: { f: () => void; iptal: boolean }[] = [];
  return { zamanla: (f: () => void) => { const i = { f, iptal: false }; isler.push(i); return () => { i.iptal = true; }; }, doldur: () => { for (const i of isler) if (!i.iptal) { i.iptal = true; i.f(); } } };
}
const ISTEK = { ajan: { id: "flash", ad: "Flash" }, metin: "Dur! Parola?", secenekler: ["Ay ışığı", "Bilmiyorum"], sureMs: 30_000 };

test("diyalog denetimcisi: aç → görünür; seç → sonuç ve ekrandan kalkar; geç gelen seçim yok sayılır", ZAMAN, async () => {
  const dd = diyalogDenetimiKur({ zamanla: sahteSaat().zamanla });
  const is = dd.ac(ISTEK);
  assert.deepEqual(dd.acik()?.secenekler, ["Ay ışığı", "Bilmiyorum"]);
  assert.equal(dd.sec(5), false);
  assert.equal(dd.sec(1), true);
  assert.deepEqual([await is.sonuc, dd.acik(), dd.sec(0)], [{ tur: "secildi", indeks: 1 }, null, false]);
});

test("diyalog: ekranda TEK diyalog (ikinci istek nedenle reddedilir); süre dolunca zamanAsimi; kapat ekrandan kaldırır", ZAMAN, async () => {
  const saat = sahteSaat();
  const dd = diyalogDenetimiKur({ zamanla: saat.zamanla });
  const is = dd.ac(ISTEK);
  assert.throws(() => dd.ac({ ...ISTEK, ajan: { id: "barmen", ad: "Barmen" } }), /başka bir diyalog açık \(Flash/);
  saat.doldur();
  assert.deepEqual([await is.sonuc, dd.acik()], [{ tur: "zamanAsimi" }, null]);
  const iki = dd.ac(ISTEK);
  iki.kapat();
  assert.deepEqual([await iki.sonuc, dd.acik()], [{ tur: "kapandi" }, null]);
});

test("diyalog isteği bozuksa nedenle: tek seçenek, beş seçenek, boş seçenek, boş metin, süre tavan dışı", () => {
  const dd = diyalogDenetimiKur({ zamanla: sahteSaat().zamanla });
  assert.throws(() => dd.ac({ ...ISTEK, secenekler: ["tek"] }), /2–4 seçenek/);
  assert.throws(() => dd.ac({ ...ISTEK, secenekler: ["a", "b", "c", "d", "e"] }), /2–4 seçenek/);
  assert.throws(() => dd.ac({ ...ISTEK, secenekler: ["a", "  "] }), /seçenek 2 boş/);
  assert.throws(() => dd.ac({ ...ISTEK, metin: "" }), /metni boş/);
  assert.throws(() => dd.ac({ ...ISTEK, sureMs: 120_000 }), /3–60 sn/);
  assert.equal(dd.acik(), null);
});

const parolaGrafi = (ayar: Record<string, string | number> = { secenek1: "Ay ışığı", secenek2: "Bilmiyorum", secenek3: "Sana ne!" }) => graf([
  { id: "b", tip: "olay.basla" }, { id: "sec", tip: "ajan.sec", ayar: { ajan: "flash" } },
  { id: "p", tip: "diyalog.sec", ayar: { metin: "Dur! Parola?", ...ayar } },
  { id: "g", tip: "ajan.soyle", ayar: { metin: "Geç." } }, { id: "h", tip: "ajan.soyle", ayar: { metin: "Geçemezsin." } }, { id: "z", tip: "ajan.soyle", ayar: { metin: "Cevap yok." } },
], [["b", "sonra", "p", "giris"], ["p", "1", "g", "giris"], ["p", "2", "h", "giris"], ["p", "3", "h", "giris"], ["p", "zamanAsimi", "z", "giris"],
  ...["p", "g", "h", "z"].map((x): [string, string, string, string] => ["sec", "ajan", x, "kim"])]);

test("Seçimli diyalog düğümü: seçilen seçeneğin akışı yürür; başlık ajanın adıyla", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const dd = diyalogDenetimiKur({ zamanla: sahteSaat().zamanla });
  const d = dunya({ kapilar: [f.kapi], grafikler: [parolaGrafi()], dd });
  d.calistirici.calistir("nobet");
  await bekleKosul(() => dd.acik() !== null);
  assert.deepEqual([dd.acik()?.ajan.ad, dd.acik()?.metin, f.sozler], ["Flash", "Dur! Parola?", []]);
  dd.sec(2);
  await d.calistirici.bitti();
  assert.deepEqual([f.sozler, d.calistirici.durum().son?.durum], [["Geçemezsin."], "bitti"]);
});

test("Seçimli diyalog: süre dolarsa 'zamanAsimi' dalı", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const saat = sahteSaat();
  const dd = diyalogDenetimiKur({ zamanla: saat.zamanla });
  const d = dunya({ kapilar: [f.kapi], grafikler: [parolaGrafi()], dd });
  d.calistirici.calistir("nobet");
  await bekleKosul(() => dd.acik() !== null);
  saat.doldur();
  await d.calistirici.bitti();
  assert.deepEqual(f.sozler, ["Cevap yok."]);
});

test("■ diyalog beklerken: çalışma 'durdu' ve diyalog EKRANDAN KALKAR (açık kalmaz)", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const dd = diyalogDenetimiKur({ zamanla: sahteSaat().zamanla });
  const d = dunya({ kapilar: [f.kapi], grafikler: [parolaGrafi()], dd });
  d.calistirici.calistir("nobet");
  await bekleKosul(() => dd.acik() !== null);
  d.calistirici.durdur();
  await d.calistirici.bitti();
  assert.deepEqual([dd.acik(), d.calistirici.durum().son?.durum, f.sozler], [null, "durdu", []]);
});

test("Seçimli diyalog denetimde: tek seçenek, sıra boşluğu (1 ve 3 dolu), çıkış pinleri seçenek sayısı kadar", () => {
  const d = dunya({ kapilar: [sahteKapi("flash", "Flash").kapi] });
  assert.match(d.calistirici.kontrol(parolaGrafi({ secenek1: "tek" })).join(), /2–4 seçenek/);
  assert.match(d.calistirici.kontrol(parolaGrafi({ secenek1: "a", secenek3: "c" })).join(), /sırayla olmalı: secenek2 boş/);
  assert.match(d.calistirici.kontrol(parolaGrafi({ secenek1: "a", secenek2: "b" })).join(), /'p' düğümünün '3' adlı ÇIKIŞ pini yok/);
  assert.deepEqual(d.calistirici.kontrol(parolaGrafi()), []);
});

test("başka diyalog açıkken ikinci NPC'nin diyaloğu NEDENLE düşer; diyalog ekranı olmayan dünyada da", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const dd = diyalogDenetimiKur({ zamanla: sahteSaat().zamanla });
  dd.ac({ ...ISTEK, ajan: { id: "barmen", ad: "Barmen" } });
  const d = dunya({ kapilar: [f.kapi], grafikler: [parolaGrafi()], dd });
  d.calistirici.calistir("nobet");
  await d.calistirici.bitti();
  assert.match(d.calistirici.durum().son?.hata ?? "", /başka bir diyalog açık \(Barmen/);
  const y = grafYetenegiKur({ ajanlar: () => [], kapi: () => null, nesneler: () => [], capalar: () => [] });
  assert.throws(() => y.diyalogAc(ISTEK), /diyalog ekranı yok/);
});

// ── 1–4 tuşu ──
const tus = (key: string, ek: Record<string, unknown> = {}) => ({ key, code: /^[0-9]$/.test(key) ? `Digit${key}` : "", target: null, ...ek });
test("diyalogTusu: açıkken 1–n seçer, n+1..4 YUTULUR (oyuna sızmaz), 5+ ve harfler diyaloğun değil", () => {
  const d = { acik: true, secenekSayisi: 3, tusSerbest: true };
  assert.deepEqual(["1", "3", "4", "5", "w"].map((k) => diyalogTusu(tus(k), d)), [{ sec: 0 }, { sec: 2 }, { sec: null }, null, null]);
  assert.deepEqual(diyalogTusu({ key: "&", code: "Numpad2", target: null }, d), { sec: 1 });
});

test("diyalogTusu: kapalıyken, sohbet/terminal/onay (serbest değil), yazı alanında, Ctrl ile tuşa DOKUNMAZ; basılı tutma yalnız yutulur", () => {
  const acik = { acik: true, secenekSayisi: 3, tusSerbest: true };
  assert.equal(diyalogTusu(tus("1"), { ...acik, acik: false }), null);
  assert.equal(diyalogTusu(tus("1"), { ...acik, tusSerbest: false }), null);
  assert.equal(diyalogTusu(tus("1", { target: { tagName: "INPUT" } as unknown as EventTarget }), acik), null);
  assert.equal(diyalogTusu(tus("1", { ctrlKey: true }), acik), null);
  assert.deepEqual(diyalogTusu(tus("1", { repeat: true }), acik), { sec: null });
});

// ── nöbetçi şablonu ──
test("nöbetçi şablonu 'Yeni' listesinde, biçimden ve denetimden geçer", () => {
  assert.deepEqual(GRAF_SABLONLARI.map((s) => s.id), ["selam", "nobetci"]);
  const g = nobetciSablonu("nobetci");
  assert.equal(grafDogrula(JSON.parse(JSON.stringify(g))).ok, true);
  assert.deepEqual(dunya({ kapilar: [sahteKapi("flash", "Flash").kapi] }).calistirici.kontrol(g), []);
});

test("nöbetçi uçtan uca (⚡ dinlemede, gündüz): döner, 'Ziyaret: 1', parola sorar; doğru → 'Geç.'; ikinci ziyarette sayaç 2, yanlış → 'Geçemezsin.'", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const dd = diyalogDenetimiKur({ zamanla: sahteSaat().zamanla });
  let t = 0;
  const d = dunya({ kapilar: [f.kapi], grafikler: [nobetciSablonu("nobetci")], dd, simdi: () => t, saat: () => 14 });
  assert.deepEqual(d.dinleyici.dinlemeyeAl("nobetci"), { ok: true });
  d.yol.yay("flash", YAKLASTI);
  await bekleKosul(() => dd.acik() !== null);
  assert.deepEqual([f.turler(), f.sozler, dd.acik()?.secenekler.length], [["bak"], ["Hoş geldin yolcu. Ziyaret: 1"], 3]);
  dd.sec(0);
  await d.dinleyici.bitti();
  t = 10_000;
  d.yol.yay("flash", YAKLASTI);
  await bekleKosul(() => dd.acik() !== null);
  dd.sec(2);
  await d.dinleyici.bitti();
  assert.deepEqual([f.sozler, d.durum.ozet("nobetci")], [["Hoş geldin yolcu. Ziyaret: 1", "Geç.", "Hoş geldin yolcu. Ziyaret: 2", "Geçemezsin."], { ziyaret: 2 }]);
});

test("nöbetçi gece vardiyasında farklı söz; ▶ ile de çalışır; cevap gelmezse 'Cevap yok mu? Geçemezsin.'", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const saat = sahteSaat();
  const dd = diyalogDenetimiKur({ zamanla: saat.zamanla });
  const d = dunya({ kapilar: [f.kapi], grafikler: [nobetciSablonu("nobetci")], dd, saat: () => 23 });
  d.calistirici.calistir("nobetci");
  await bekleKosul(() => dd.acik() !== null);
  saat.doldur();
  await d.calistirici.bitti();
  assert.deepEqual(f.sozler, ["Gece vardiyası. Fenerini indir, yüzünü göreyim!", "Cevap yok mu? Geçemezsin."]);
});

// ── bekçiler: kurmak yalnız Ozyn'in gerçek tıklaması, dinleme yalnız bellekte ──
const KOK = path.resolve(import.meta.dirname, "..", "..");
const uretimDosyalari = (): string[] => {
  const tara = (klasor: string): string[] => fs.readdirSync(path.join(KOK, klasor), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tara(path.join(klasor, e.name)) : /\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [path.join(klasor, e.name).split(path.sep).join("/")] : []);
  return ["uygulama", "bridge", "mind", "flash", "world", "voice", "protocol"].flatMap(tara);
};

/**
 * ▶ ve ⚡ çağrılarının BİLİNÇLİ İZİN LİSTESİ: Graf sekmesi (dilim 1–2) ve görsel editörün düğmeleri (dilim 2b). Yeni bir çağrı yeri bu listeye gerekçeyle
 * girmeden geçemez; listedeki her dosyanın HER çağrısı aşağıdaki isTrusted bekçisinden geçer.
 */
const CALISTIRMA_YERLERI = ["uygulama/yapi/graf/calistirmaDugmeleri.ts", "uygulama/yapi/grafSekmesi.ts"];

test("BEKÇİ: `dinlemeyeAl` üretimde yalnız izin listesindeki yerlerden çağrılır; arka katmanlar (bridge/mind/flash) dinleyiciye uzanmaz", () => {
  const l = uretimDosyalari();
  assert.deepEqual(l.filter((d) => /\.dinlemeyeAl\(/.test(fs.readFileSync(path.join(KOK, d), "utf8"))), CALISTIRMA_YERLERI);
  assert.deepEqual(l.filter((d) => /^(bridge|mind|flash)\//.test(d) && /grafDinleyici|diyalogDenetimi/.test(fs.readFileSync(path.join(KOK, d), "utf8"))), []);
});

/**
 * Bir çağrının tıklama işleyicisi ÇAĞRIDAN ÖNCE `if (!e.isTrusted …) return;` taşıyor mu. Kalibrasyon (dilim 2b): eskiden yalnız Graf sekmesinin İLK çağrısı
 * ve yalnız "if (!e.isTrusted" metni aranıyordu; şimdi HER dosyada HER çağrı, işleyici `(e) =>` ile başlamalı ve denetim `return` etmeli
 * (yalnız günlüğe yazan bir `if (!e.isTrusted) console.warn(...)` geçmesin).
 */
function isTrustedYoklamasi(kaynak: string, cagri: number): string | null {
  const bas = kaynak.lastIndexOf('addEventListener("click"', cagri);
  if (bas < 0) return "tıklama işleyicisinin içinde değil";
  if (!kaynak.startsWith('addEventListener("click", (e) =>', bas)) return "işleyici olay parametresini (e) almıyor";
  if (!/if \(!e\.isTrusted[^)]*\)\s*return;/.test(kaynak.slice(bas, cagri))) return "çağrıdan önce `if (!e.isTrusted…) return;` yok";
  return null;
}

test("BEKÇİ: izin listesindeki her dosyada ▶ ve ⚡ çağrılarının HER BİRİ, tıklama işleyicisinde ÖNCE `isTrusted`a bakar", () => {
  const sorunlar: string[] = [];
  for (const d of CALISTIRMA_YERLERI) {
    const kaynak = fs.readFileSync(path.join(KOK, d), "utf8");
    let n = 0;
    for (const desen of [/\.calistirici\.calistir\(/g, /\.dinleyici\.dinlemeyeAl\(/g]) {
      for (const m of kaynak.matchAll(desen)) {
        n++;
        const neden = isTrustedYoklamasi(kaynak, m.index);
        if (neden) sorunlar.push(`${d}:${kaynak.slice(0, m.index).split("\n").length} ${m[0]} — ${neden}`);
      }
    }
    if (n < 2) sorunlar.push(`${d}: ▶ ve ⚡ çağrısı bekleniyordu (${n} bulundu): bekçi ne sınadığını bilmeli`);
  }
  assert.deepEqual(sorunlar, []);
});

test("BEKÇİ'nin kendisi: isTrusted yoklaması bozuk işleyicileri yakalar (kalibrasyon örnekleri)", () => {
  const cagri = (k: string) => isTrustedYoklamasi(k, k.indexOf(".calistirici.calistir("));
  assert.equal(cagri('x.addEventListener("click", (e) => { if (!e.isTrusted) return; a.calistirici.calistir(ad); });'), null);
  assert.equal(cagri('x.addEventListener("click", (e) => { if (!e.isTrusted || !secili) return; a.calistirici.calistir(ad); });'), null);
  assert.match(cagri('x.addEventListener("click", (e) => { a.calistirici.calistir(ad); });') ?? "", /isTrusted/);
  assert.match(cagri('x.addEventListener("click", (e) => { if (!e.isTrusted) console.warn("x"); a.calistirici.calistir(ad); });') ?? "", /isTrusted/);
  assert.match(cagri('x.addEventListener("click", () => { a.calistirici.calistir(ad); });') ?? "", /parametresini/);
  assert.match(cagri("a.calistirici.calistir(ad);") ?? "", /tıklama/);
});

test("BEKÇİ: dinleme ve grafik durumu YALNIZ BELLEKTE (depolama/IPC adı geçmez: uygulama kapanınca dinleme kalmaz)", () => {
  for (const d of ["uygulama/graf/grafDinleyici.ts", "uygulama/graf/grafDurumu.ts"]) {
    const kod = fs.readFileSync(path.join(KOK, d), "utf8").split("\n").filter((s) => !/^\s*(\/\/|\*|\/\*\*)/.test(s)).join("\n");
    assert.doesNotMatch(kod, /localStorage|sessionStorage|indexedDB|ipcRenderer|window\.|electron|fs\.|import .* from "\.\.\/\.\.\/host/, d);
  }
});

// ── ⚡ dinleme: desenler de dinleme anında dondurulur (onaylanan program sonradan değişmez) ──
const selamlaDeseni = (soz: string) => graf(
  [{ id: "g", tip: "fonksiyon.giris" }, { id: "m", tip: "veri.metin", ayar: { deger: soz } }, { id: "s", tip: "ajan.soyle" }, { id: "d", tip: "fonksiyon.donus" }],
  [["g", "sonra", "s", "giris"], ["g", "kim", "s", "kim"], ["m", "deger", "s", "metin"], ["s", "sonra", "d", "giris"]],
  { ad: "selamla", tur: "fonksiyon", girisler: [{ ad: "kim", tip: "ajan" }] });
const desenliNobet = () => graf(
  [{ id: "y", tip: "olay.ozyn_yaklasti", ayar: { ajan: "flash" } }, { id: "c", tip: "desen.cagir", ayar: { desen: "selamla" } }],
  [["y", "sonra", "c", "giris"], ["y", "ajan", "c", "kim"]], { ad: "nobet" });

test("dinleme kurulduktan SONRA desen dosyası değişse de çalışan program onaylanan kopyadır", ZAMAN, async () => {
  const f = sahteKapi("flash", "Flash");
  const desenler = [selamlaDeseni("ilk söz")];
  const d = dunya({ kapilar: [f.kapi], grafikler: [desenliNobet()], desenler });
  assert.deepEqual(d.dinleyici.dinlemeyeAl("nobet"), { ok: true });
  desenler[0] = selamlaDeseni("DEĞİŞTİRİLDİ");   // dosya dinleme kurulduktan sonra elle/Orion tarafından değişti
  d.yol.yay("flash", YAKLASTI);
  await d.dinleyici.bitti();
  assert.deepEqual(f.sozler, ["ilk söz"]);
});

test("desenleriDondur: iç içe desenleri toplar, döngüyü keser, olmayan deseni atlar ve KOPYA verir", () => {
  const ic = graf([{ id: "g", tip: "fonksiyon.giris" }], [], { ad: "ic", tur: "fonksiyon" });
  const dis = graf([{ id: "g", tip: "fonksiyon.giris" }, { id: "c", tip: "desen.cagir", ayar: { desen: "ic" } }, { id: "k", tip: "desen.cagir", ayar: { desen: "dis" } }, { id: "x", tip: "desen.cagir", ayar: { desen: "yok" } }],
    [], { ad: "dis", tur: "fonksiyon" });
  const kok = graf([{ id: "c", tip: "desen.cagir", ayar: { desen: "dis" } }], []);
  const depo = [dis, ic];
  const k = desenleriDondur(kok, (ad) => depo.find((g) => g.ad === ad) ?? null);
  assert.deepEqual([...k.keys()].sort(), ["dis", "ic"]);
  assert.notEqual(k.get("dis"), dis);
});
