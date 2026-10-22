// uygulama/sekans/oynatici.test.ts — sekans oynatıcısı (spec 36 S1c–d) GERÇEK yürütücüyle (beden kararı: `world/avatar/yurutucu.ts`): tek eylem yolu
// (klipli `jest` niyeti, `elle_` önekli), bedenin klibi değerlendirmenin aynısı, bitiş, ■ HEMEN keser, dış kesilme, ret nedenleri, döngü, @ben.
// Saat elle ilerletilir (`adim`): zamanlayıcı yok, asılı kalamaz; zaman aşımlı test kısa pay ile.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";
import type { Uzuv } from "../../protocol/animasyon.ts";
import { sekansDogrula, type Sekans } from "../../protocol/sekans.ts";
import { Yurutucu } from "../../world/avatar/index.ts";
import { klipKutuphanesiKur, klipleriYukle } from "../../world/avatar/klipKutuphanesi.ts";
import { klipOrnekle } from "../../world/avatar/klipOrnekleyici.ts";
import { degerlendir } from "./degerlendir.ts";
import { GECICI_ONEK, geciciKlipKatmaniKur } from "./geciciKlipler.ts";
import { sekansOynaticiKur, type SekansKapisi } from "./oynatici.ts";

const ZAMAN = { timeout: 8000 };
const kutuphane = klipKutuphanesiKur();
const yuklendi = klipleriYukle((yol) => readFile(new URL(`../../assets/${yol}`, import.meta.url), "utf8")).then((r) => kutuphane.doldur(r.klipler, r.hatalar));

function sekans(izler: unknown[], ek: Record<string, unknown> = {}): Sekans {
  const r = sekansDogrula({ surum: 1, ad: "t", fps: 30, sure_kare: 60, baglamalar: [{ id: "b1", ajan: "orion" }], izler, ...ek });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
}
const salla = { id: "k", baglama: "b1", tur: "klip", bolumler: [{ klip: "basla_onayla", baslangic_kare: 0, uzunluk_kare: 36 }] };

/** Gerçek yürütücülü beden; sonuçlar `adim(dt)` ile (yürütücünün kendi saatiyle) dağıtılır. */
function beden(katman: ReturnType<typeof geciciKlipKatmaniKur>, id = "orion", ad = "Orion", klipUzuvlari?: ReadonlySet<Uzuv>) {
  const y = new Yurutucu({ klipler: katman, ...(klipUzuvlari ? { klipUzuvlari } : {}) });
  const dinleyiciler = new Set<(s: NiyetSonucu) => void>();
  const gelen: { n: Niyet; id: string }[] = [];
  const kapi: SekansKapisi = { id, ad, niyet: (n, nid) => { gelen.push({ n, id: nid }); y.niyet(n, nid); }, sonucDinle: (cb) => { dinleyiciler.add(cb); return () => { dinleyiciler.delete(cb); }; } };
  const adim = (dt = 0.05) => { for (const s of y.ilerle(dt)) for (const d of [...dinleyiciler]) d(s); };
  return { y, kapi, gelen, adim };
}

function dunya(bedenSayisi: 1 | 2 = 1, ek: { klipUzuvlari?: ReadonlySet<Uzuv>; bitisPayiMs?: number } = {}) {
  const katman = geciciKlipKatmaniKur(kutuphane);
  const orion = beden(katman, "orion", "Orion", ek.klipUzuvlari);
  const flash = beden(katman, "flash", "Flash");
  const bedenler = bedenSayisi === 2 ? [orion, flash] : [orion];
  let saat = 0;
  const gunluk: string[] = [];
  const o = sekansOynaticiKur({
    katman, ajanlar: () => ["orion", "flash"], kapi: (id) => bedenler.find((b) => b.kapi.id === id)?.kapi ?? null, simdi: () => saat,
    gunluk: (_s, m) => gunluk.push(m), ...(ek.bitisPayiMs !== undefined ? { bitisPayiMs: ek.bitisPayiMs } : {}),
  });
  /** Saat ve bedenler birlikte ilerler. */
  const ilerle = (sn: number) => { for (let t = 0; t < sn - 1e-9; t += 0.05) { saat += 50; for (const b of bedenler) b.adim(0.05); } };
  return { o, katman, orion, flash, ilerle, gunluk, saat: () => saat };
}

test("TEK EYLEM YOLU: ▶ bedene klipli `jest` niyeti olarak gider (geçici klip adı, `elle_` kimliği)", ZAMAN, async () => {
  await yuklendi;
  const d = dunya();
  d.o.sekansiOynat(sekans([salla]), { baslangic: 0, dongu: false });
  const n = d.orion.gelen[0]!;
  assert.deepEqual([n.n.tur, n.n.tur === "jest" && n.n.klip?.startsWith(GECICI_ONEK), n.id.startsWith("elle_")], ["jest", true, true]);
});

test("bedenin oynadığı klip, oynayan karede değerlendirmenin AYNISI (bas.donme_x, 0.5 sn)", ZAMAN, async () => {
  await yuklendi;
  const d = dunya();
  const s = sekans([salla]);
  d.o.sekansiOynat(s, { baslangic: 0, dongu: false });
  d.ilerle(0.5);
  const g = d.orion.y.gorunum().klip!;
  const bedende = klipOrnekle(g.klip, g.gecen).find((x) => x.uzuv === "bas" && x.kanal === "donme_x")!.deger;
  const sekansta = degerlendir(s, Math.round(g.gecen * 30), kutuphane).degerler.find((x) => x.uzuv === "bas")!.deger;
  assert.ok(Math.abs(bedende - sekansta) < 1e-6, `beden ${bedende} · sekans ${sekansta}`);
});

test("sona dek oynar: durum BİTTİ, geçici klip katmandan kalkar, beden boşta", ZAMAN, async () => {
  await yuklendi;
  const d = dunya();
  d.o.sekansiOynat(sekans([salla]), { baslangic: 0, dongu: false });
  d.ilerle(2.2);   // aralık 0–60 kare = 2 sn
  assert.deepEqual([d.o.durum().son?.durum, d.o.durum().calisiyor, d.katman.sayi(), d.orion.y.gorunum().klip], ["bitti", null, 0, null]);
});

test("■ DURDUR HEMEN keser: durum DURDU, bedene `dur` gider, bir sonraki tikte klip YOK, katman boş", ZAMAN, async () => {
  await yuklendi;
  const d = dunya();
  d.o.sekansiOynat(sekans([salla]), { baslangic: 0, dongu: false });
  d.ilerle(0.3);
  d.o.durdur();
  d.ilerle(0.05);
  assert.deepEqual([d.o.durum().son?.durum, d.orion.gelen.at(-1)!.n.tur, d.orion.y.gorunum().klip, d.katman.sayi()], ["durdu", "dur", null, 0]);
});

test("bilinmeyen ajan: nedenle RET ve hiçbir bedene niyet gitmez", ZAMAN, async () => {
  await yuklendi;
  const d = dunya();
  const r = d.o.sekansiOynat(sekans([salla], { baglamalar: [{ id: "b1", ajan: "hayalet" }] }), { baslangic: 0, dongu: false });
  assert.deepEqual([r.ok ? "" : r.neden, d.orion.gelen.length], ["bağlama 'b1': ajan 'hayalet' defterde yok (var: orion, flash)", 0]);
});

test("@ben: editörden (ben yok) nedenle RET; ben verilince o ajana oynar", ZAMAN, async () => {
  await yuklendi;
  const d = dunya();
  const s = sekans([salla], { baglamalar: [{ id: "b1", ajan: "@ben" }] });
  const r1 = d.o.sekansiOynat(s, { baslangic: 0, dongu: false });
  const r2 = d.o.sekansiOynat(s, { baslangic: 0, dongu: false, ben: "orion" });
  assert.deepEqual([r1.ok ? "" : r1.neden.includes("'@ben' çözülemez"), r2.ok], [true, true]);
});

test("bilinmeyen klip: nedenle RET (yüklü klipler söylenir), bedene niyet gitmez", ZAMAN, async () => {
  await yuklendi;
  const d = dunya();
  const r = d.o.sekansiOynat(sekans([{ ...salla, bolumler: [{ klip: "yok_boyle", baslangic_kare: 0, uzunluk_kare: 10 }] }]), { baslangic: 0, dongu: false });
  assert.deepEqual([r.ok ? "" : r.neden.startsWith("bilinmeyen klip: yok_boyle (yüklü: el_salla"), d.orion.gelen.length], [true, 0]);
});

test("TEK OYNATMA: oynarken ikinci ▶ nedenle reddedilir", ZAMAN, async () => {
  await yuklendi;
  const d = dunya();
  d.o.sekansiOynat(sekans([salla]), { baslangic: 0, dongu: false });
  const r = d.o.sekansiOynat(sekans([salla]), { baslangic: 0, dongu: false });
  assert.equal(r.ok ? "" : r.neden, "zaten 't' oynuyor (■ ile durdur)");
});

test("DIŞ KESİLME: başka bir jest bir bedenin klibini keserse sekans 'kesildi' diye durur ve ÖTEKİ bağlamaya da `dur` gider", ZAMAN, async () => {
  await yuklendi;
  const d = dunya(2);
  const s = sekans([salla, { ...salla, id: "k2", baglama: "b2" }], { baglamalar: [{ id: "b1", ajan: "orion" }, { id: "b2", ajan: "flash" }] });
  d.o.sekansiOynat(s, { baslangic: 0, dongu: false });
  d.ilerle(0.2);
  d.flash.y.niyet({ tur: "jest", jest: "el_salliyor" }, "baska_1");   // Flash'ın boşta kıpırtısı gibi
  d.ilerle(0.1);
  assert.deepEqual([d.o.durum().son?.durum, /Flash: kesildi/.test(d.o.durum().son?.neden ?? ""), d.orion.gelen.at(-1)!.n.tur], ["hata", true, "dur"]);
});

test("DÖNGÜ: süre geçince bitmez, kare aralıkta sarar; ■ ile durur", ZAMAN, async () => {
  await yuklendi;
  const d = dunya();
  d.o.sekansiOynat(sekans([salla], { aralik: { bas: 0, bit: 30 } }), { baslangic: 0, dongu: true });
  d.ilerle(1.5);   // 1 sn'lik aralık + yarım tur
  const k = d.o.kare();
  d.o.durdur();
  assert.deepEqual([k, d.o.durum().son?.durum], [15, "durdu"]);
});

test("playhead ortadayken ▶ oradan başlar: 0.5 sn sonra kare = başlangıç + 15", ZAMAN, async () => {
  await yuklendi;
  const d = dunya();
  d.o.sekansiOynat(sekans([salla]), { baslangic: 20, dongu: false });
  d.ilerle(0.5);
  assert.equal(d.o.kare(), 35);
});

test("gövdede olmayan uzvun izi günlüğe uyarı olarak yazılır (sessiz yutma yok)", ZAMAN, async () => {
  await yuklendi;
  const d = dunya(1, { klipUzuvlari: new Set<Uzuv>(["kok", "sag_kol"]) });
  d.o.sekansiOynat(sekans([salla]), { baslangic: 0, dongu: false });
  d.ilerle(0.05);
  assert.ok(d.gunluk.some((m) => m.includes("uygulanamayan izler") && m.includes("bas.donme_x")), d.gunluk.join(" | "));
});

test("beden `bitti` demezse süre + pay sonunda ZAMAN AŞIMI: durum hata, bedene `dur`", ZAMAN, async () => {
  await yuklendi;
  const d = dunya(1, { bitisPayiMs: 50 });
  d.o.sekansiOynat(sekans([salla], { aralik: { bas: 0, bit: 3 } }), { baslangic: 0, dongu: false });
  await new Promise((r) => setTimeout(r, 250));   // beden ilerletilmiyor: bitti hiç gelmez (0.1 sn + 50 ms)
  assert.deepEqual([d.o.durum().son?.durum, /zaman aşımı/.test(d.o.durum().son?.neden ?? ""), d.orion.gelen.at(-1)!.n.tur], ["hata", true, "dur"]);
});
