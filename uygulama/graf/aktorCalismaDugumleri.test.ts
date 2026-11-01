// uygulama/graf/aktorCalismaDugumleri.test.ts — aktör çalışma zamanı düğümleri (spec 45 B4): `aktor.hareket_et`, `aktor.sokete_tak`, `aktor.sokettan_al`.
//
// İki katman: (1) düğüm kuralları sahte yetenekle (`@bu`, ayar/giriş, yetenek yokluğu → nedenli hata); (2) GERÇEK çalışma zamanı (NullEngine) + olay yolu + dinleyiciyle
// uçtan uca: Ozyn tetik alanına girer → `tetik.girdi` → ⚡ graf → araba hareket eder, kılıç sokete takılır. Dinlemeyi yalnız Ozyn'in tıklaması kurar (test `dinlemeyeAl` der).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import { levelKur } from "../../world/level/cekirdek/levelKur.ts";
import { ornekTanim } from "../../world/level/cekirdek/ornekTanim.ts";
import type { LevelTanimi, NesneYeri } from "../../world/level/cekirdek/levelTanimi.ts";
import { aktorOlayYoluKur } from "../../world/level/cekirdek/aktorOlayYolu.ts";
import { grafYetenegiKur, type AktorYetenegi, type GrafYetenegi } from "./grafYetenegi.ts";
import { grafKutuphanesi } from "./kutuphane.ts";
import { grafCalistir } from "./yorumlayici.ts";
import { GrafDurumDeposu } from "./grafDurumu.ts";
import { grafCalistiriciKur } from "./grafCalistirici.ts";
import { grafDinleyiciKur, olayYoluKur } from "./grafDinleyici.ts";
import { AKTOR_DUGUMU, AKTOR_OLAYI_TIPI } from "./aktorDugumleri.ts";
import { aktorOlayKaynagiKur } from "./aktorOlayKaynagi.ts";
import { aktorCalismaZamaniKur } from "../aktor/calisma/aktorCalismaZamani.ts";
import { aktorYetenegiKur } from "../aktorYetenegi.ts";
import type { Gozlenen } from "../aktor/calisma/tetikModeli.ts";

const ZAMAN = { timeout: 3000 };
const graf = (dugumler: GrafDugumu[], baglar: [string, string, string, string][] = [], ad = "calisma-deneme"): Graf => {
  const r = grafDogrula({ surum: 1, ad, tur: "olay", dugumler, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const basla: GrafDugumu = { id: "b", tip: "olay.basla" };

// ── (1) düğüm kuralları: sahte yetenek ──
function sahte(o: { yok?: boolean } = {}) {
  const cagrilar: unknown[][] = [];
  const y: AktorYetenegi = {
    var: (id) => ["a", "b"].includes(id),
    alanOku: () => 0, alanYaz: () => {}, degiskenOku: () => undefined, degiskenYaz: () => {},
    ...(o.yok ? {} : {
      hareketEt: (id: string, hiz: number, donus: number) => { cagrilar.push(["hareket", id, hiz, donus]); },
      soketeTak: (id: string, ust: string, soket?: string) => { cagrilar.push(["tak", id, ust, soket]); },
      sokettanAl: (id: string) => { cagrilar.push(["al", id]); },
    }),
  };
  return { y, cagrilar };
}
const kos = (g: Graf, y: AktorYetenegi, bu: string | null = null) =>
  grafCalistir(g, { kayit: grafKutuphanesi(), desen: () => null, yetenek: grafYetenegiKur({ ajanlar: () => [], kapi: () => null, nesneler: () => [], capalar: () => [], aktor: y }), uyu: async () => {}, ...(bu !== null ? { aktor: bu } : {}) }).sonuc;
const tek = (tip: string, ayar: Record<string, string | number | boolean>) => graf([basla, { id: "n", tip, ayar }], [["b", "sonra", "n", "giris"]]);

test("hareket_et: hız ve dönüş ayardan (varsayılan 0, 0 = dur) ya da bağlı girişten gider; @bu çözülür", async () => {
  const { y, cagrilar } = sahte();
  assert.equal((await kos(tek(AKTOR_DUGUMU.hareketEt, { hiz: 3, donus: -20 }), y, "a")).durum, "bitti");
  assert.equal((await kos(tek(AKTOR_DUGUMU.hareketEt, { aktor: "b" }), y)).durum, "bitti");
  const baglı = graf([basla, { id: "s", tip: "veri.sayi", ayar: { deger: 7 } }, { id: "n", tip: AKTOR_DUGUMU.hareketEt, ayar: { aktor: "a" } }], [["b", "sonra", "n", "giris"], ["s", "deger", "n", "hiz"]]);
  await kos(baglı, y);
  assert.deepEqual(cagrilar, [["hareket", "a", 3, -20], ["hareket", "b", 0, 0], ["hareket", "a", 7, 0]]);
});

test("sokete_tak / sokettan_al: ust ve soket yetenege gider; '@bu' üst olarak çözülür; boş soket = soketsiz", async () => {
  const { y, cagrilar } = sahte();
  await kos(tek(AKTOR_DUGUMU.soketeTak, { aktor: "b", ust: "a", soket: "el" }), y);
  await kos(tek(AKTOR_DUGUMU.soketeTak, { aktor: "b", ust: "@bu" }), y, "a");
  await kos(tek(AKTOR_DUGUMU.soketeTak, { aktor: "b", ust: "beden:orion", soket: "el_sag" }), y);
  await kos(tek(AKTOR_DUGUMU.sokettanAl, { aktor: "b" }), y);
  assert.deepEqual(cagrilar, [["tak", "b", "a", "el"], ["tak", "b", "a", undefined], ["tak", "b", "beden:orion", "el_sag"], ["al", "b"]]);
});

test("çalışma zamanı düğümleri: yetenek yokluğu, üstsüz tak, @bu'suz çalışma, olmayan aktör NEDENLE düşer", async () => {
  const yok = sahte({ yok: true }).y;
  for (const [tip, ayar] of [[AKTOR_DUGUMU.hareketEt, { aktor: "a" }], [AKTOR_DUGUMU.soketeTak, { aktor: "a", ust: "b" }], [AKTOR_DUGUMU.sokettanAl, { aktor: "a" }]] as const) {
    const s = await kos(tek(tip, ayar), yok);
    assert.equal(s.durum, "hata", tip); assert.match(s.hata ?? "", /çalışma zamanı yok/, tip);
  }
  const { y, cagrilar } = sahte();
  const ustsuz = await kos(tek(AKTOR_DUGUMU.soketeTak, { aktor: "a" }), y);
  assert.equal(ustsuz.durum, "hata"); assert.match(ustsuz.hata ?? "", /üst verilmedi/);
  const buAktorsuz = await kos(tek(AKTOR_DUGUMU.soketeTak, { aktor: "a", ust: "@bu" }), y);
  assert.equal(buAktorsuz.durum, "hata"); assert.match(buAktorsuz.hata ?? "", /ust: '@bu' çözülemez/);
  const yokAktor = await kos(tek(AKTOR_DUGUMU.hareketEt, { aktor: "hayalet" }), y);
  assert.equal(yokAktor.durum, "hata"); assert.match(yokAktor.hata ?? "", /'hayalet' level'da yok/);
  assert.deepEqual(cagrilar, [], "hatalı çalışma yetenege hiçbir şey göndermez");
});

// ── (2) uçtan uca: gerçek çalışma zamanı ──
const nesne = (id: string, ek: Partial<NesneYeri> = {}): NesneYeri => ({ id, varlik: "kutu", konum: [0, 0, 0], donus: 0, olcek: 1, ...ek });
function dunya(nesneler: NesneYeri[], grafikler: Graf[]) {
  const t: LevelTanimi = ornekTanim();
  t.katmanlar = []; t.nesneler = nesneler; t.isiklar = [];
  const level = levelKur(new Scene(new NullEngine()), t, new Map());
  const gozlenen: Gozlenen[] = [];
  let zaman: ReturnType<typeof aktorCalismaZamaniKur> | null = null;
  const olay = aktorOlayYoluKur({ ustu: (id) => zaman?.hiyerarsi().ustu(id), altlari: (id) => zaman?.hiyerarsi().altlari(id) ?? [], hata: () => {} });
  const z = aktorCalismaZamaniKur({ level: () => level, olay, gozlenenler: () => gozlenen });
  zaman = z;
  const aktor = aktorYetenegiKur({ level: () => level, olay, zaman: z });
  const ajanYolu = olayYoluKur();
  const kaynak = aktorOlayKaynagiKur({ ajan: ajanYolu, olay, aktorVar: (id) => aktor.yetenek.var(id) });
  const taban = {
    kayit: grafKutuphanesi(), durum: new GrafDurumDeposu(), uyu: async () => {}, ajanlar: () => [] as string[], saat: () => 10,
    yetenek: grafYetenegiKur({ ajanlar: () => [], kapi: () => null, nesneler: () => [], capalar: () => [], aktor: aktor.yetenek }),
    depo: { al: (ad: string) => grafikler.find((g) => g.ad === ad) ?? null, desen: () => null },
  };
  const dinleyici = grafDinleyiciKur({ ...taban, kaynak, disMesgul: () => false, sogumaMs: 0 });
  const calistirici = grafCalistiriciKur({ ...taban, mesgul: () => null });
  const konum = (id: string): [number, number, number] => { const n = level.nesneler.dugum(id)!; const p = n.computeWorldMatrix(true).getTranslation(); return [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100]; };
  return { z, olay, dinleyici, calistirici, gozlenen, konum, level, kare: (n: number, dt = 0.05) => { for (let i = 0; i < n; i++) z.kare(dt); } };
}
const bekle = async (f: () => boolean, tur = 400): Promise<void> => { for (let i = 0; i < tur && !f(); i++) await new Promise((r) => setTimeout(r, 1)); assert.ok(f(), "koşul gerçekleşmedi"); };

test("uçtan uca: Ozyn tetik alanına girer → tetik.girdi → ⚡ graf → araba hareket eder (tetik.cikti ile graf durdurur)", ZAMAN, async () => {
  const girince = graf([
    { id: "e", tip: AKTOR_OLAYI_TIPI, ayar: { aktor: "kapi", olay: "tetik.girdi" } },
    { id: "h", tip: AKTOR_DUGUMU.hareketEt, ayar: { aktor: "araba", hiz: 4 } },
  ], [["e", "sonra", "h", "giris"]], "girince");
  const cikinca = graf([
    { id: "e", tip: AKTOR_OLAYI_TIPI, ayar: { aktor: "kapi", olay: "tetik.cikti" } },
    { id: "h", tip: AKTOR_DUGUMU.hareketEt, ayar: { aktor: "araba" } },
  ], [["e", "sonra", "h", "giris"]], "cikinca");
  const d = dunya([
    nesne("kapi", { konum: [10, 0, 0], bilesenler: [{ id: "t1", tur: "tetik", ayar: { yaricap: 2 } }] }),
    nesne("araba", { konum: [0, 0, 0], bilesenler: [{ id: "h1", tur: "hareket", ayar: { azamiHiz: 10, ivme: 200, zemineYapis: false } }] }),
  ], [girince, cikinca]);
  assert.deepEqual(d.dinleyici.dinlemeyeAl("girince"), { ok: true });
  assert.deepEqual(d.dinleyici.dinlemeyeAl("cikinca"), { ok: true });
  d.kare(2);
  d.gozlenen.push({ id: "ozyn", tur: "ozyn", konum: { x: 9, y: 0, z: 0 } });
  d.kare(1);
  await bekle(() => d.z.durum().hareketli === 1);
  d.kare(20);
  assert.ok(d.konum("araba")[2] > 3, `araba +Z'ye gitti (z=${d.konum("araba")[2]})`);
  d.gozlenen[0] = { id: "ozyn", tur: "ozyn", konum: { x: 0, y: 0, z: 0 } };
  d.kare(1);
  await bekle(() => d.z.durum().hareketli === 1 && d.dinleyici.liste().every((l) => !l.calisiyor));
  d.kare(10);
  const durdu = d.konum("araba");
  d.kare(10);
  assert.deepEqual(d.konum("araba"), durdu, "çıkınca graf (0, 0) komutu verdi: araba durdu");
});

test("uçtan uca: graf kılıcı sokete takar (ust = @bu yerine açık kimlik), üst yürüyünce kılıç da yürür; sokettan_al bırakır", ZAMAN, async () => {
  const tak = graf([basla, { id: "t", tip: AKTOR_DUGUMU.soketeTak, ayar: { aktor: "kilic", ust: "adam", soket: "el" } }], [["b", "sonra", "t", "giris"]], "tak");
  const birak = graf([basla, { id: "t", tip: AKTOR_DUGUMU.sokettanAl, ayar: { aktor: "kilic" } }], [["b", "sonra", "t", "giris"]], "birak");
  const d = dunya([
    nesne("adam", { konum: [0, 0, 0], bilesenler: [{ id: "s1", tur: "soket", ayar: { ad: "el", konum: [0.5, 1, 0] } }, { id: "h1", tur: "hareket", ayar: { ivme: 200, zemineYapis: false } }] }),
    nesne("kilic", { konum: [0, 0, 0] }),
  ], [tak, birak]);
  d.kare(2);
  assert.deepEqual(d.konum("kilic"), [0, 0, 0]);
  assert.ok(d.calistirici.calistir("tak").ok);
  await bekle(() => d.calistirici.durum().calisiyor === null);
  d.kare(2);
  assert.deepEqual(d.konum("kilic"), [0.5, 1, 0]);
  d.z.hareketEt("adam", 4, 0);
  d.kare(20);
  const adam = d.konum("adam");
  assert.deepEqual(d.konum("kilic"), [0.5 + adam[0], 1, adam[2]], "kılıç elin soketinde, adamla birlikte");
  assert.ok(adam[2] > 3);
  assert.ok(d.calistirici.calistir("birak").ok);
  await bekle(() => d.calistirici.durum().calisiyor === null);
  d.kare(2);
  assert.deepEqual(d.konum("kilic"), [0, 0, 0], "ayrılınca tanımdaki yerel konum");
});
