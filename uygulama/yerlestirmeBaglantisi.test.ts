// uygulama/yerlestirmeBaglantisi.test.ts — menü komutları level'a doğru uygulanıyor mu (sahte Level): yerleştir/çağır, kopyala-yapıştır, taşı, kaldır, hata geri alma, kayıt.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { yerlestirmeKur } from "./yerlestirmeBaglantisi.ts";
import { YERLESTIRME_ANAHTARI } from "./yerlestirmeKaydi.ts";
import type { Level } from "../world/level/cekirdek/levelKur.ts";
import type { LevelTanimi, NesneYeri } from "../world/level/cekirdek/levelTanimi.ts";
import type { Katalog } from "../world/level/cekirdek/katalog.ts";
import type { Yer } from "../world/yer/yer.ts";
import type { Nesne } from "../world/level/nesneKaydi.ts";

const KATALOG: Katalog = { surum: 1, kaynak: "t", varliklar: [
  { ad: "PROP_Bench", kategori: "esya", dosya: "b.glb", onizleme: "", boyut: [1, 1, 1], ucgen: 0, bayt: 0 },
  { ad: "PROP_Lamp", kategori: "esya", dosya: "l.glb", onizleme: "", boyut: [1, 1, 1], ucgen: 0, bayt: 0 },
] };
const LEVEL_NESNESI: NesneYeri = { id: "n1", varlik: "PROP_Bench", ad: "Eski bank", konum: [10, 0, 10], donus: [0, 30, 0], olcek: [1, 2, 1] };

function duzenek(secenek: { ayarlaHata?: () => string | null; baslangicKayit?: string } = {}) {
  let tanim = { nesneler: [LEVEL_NESNESI] } as unknown as LevelTanimi;
  const olay = { ayarla: [] as NesneYeri[][], yerler: 0, altyazi: [] as string[], yazilan: [] as string[], hazir: 0 };
  const level = {
    tanim: () => structuredClone(tanim),
    ayarla: (y: LevelTanimi) => {
      const h = secenek.ayarlaHata?.();
      if (h) throw new Error(h);
      tanim = y; olay.ayarla.push([...(y.nesneler ?? [])]);
    },
    yukseklik: (x: number, z: number) => 0.1 * z + x * 0,
    nesneler: { katalog: async () => KATALOG, anlamlar: async () => ({ surum: 1 as const, kategoriler: {}, varliklar: { PROP_Bench: { ad: "Bank" } } }), hazir: async () => { olay.hazir++; } },
  } as unknown as Level;
  const kayit = new Map<string, string>(secenek.baslangicKayit ? [[YERLESTIRME_ANAHTARI, secenek.baslangicKayit]] : []);
  const depo = { getItem: (k: string) => kayit.get(k) ?? null, setItem: (k: string, v: string) => { kayit.set(k, v); olay.yazilan.push(v); } };
  const y = yerlestirmeKur({
    level: () => level, yeniYer: async () => ({ ad: "ova" } as unknown as Yer), yerGuncelle: () => { olay.yerler++; },
    altyazi: (m) => { olay.altyazi.push(m); }, depo,
  });
  const son = () => olay.ayarla[olay.ayarla.length - 1]!;
  return { y, olay, son, kayit };
}
const nokta = { x: 3, y: 0.3, z: 4 };
const nesne = (id: string): Nesne => ({ id, ad: id, tur: "mobilya", capa: null, kutu: { x: 0, y: 0, z: 0, g: 1, yuk: 1, d: 1 } });

test("yerleştir: level'a VERİLEN noktada yeni nesne eklenir; yer yenilenir; kayıt yazılır; level nesneleri korunur", async () => {
  const { y, olay, son } = duzenek();
  await y.baslat();
  await y.yerlestir("PROP_Lamp", [nokta.x, nokta.y, nokta.z]);
  assert.deepEqual(son().map((n) => n.id), ["n1", "yer-1"]);
  assert.deepEqual(son()[1]!.konum, [3, 0.3, 4]);
  assert.equal(son()[1]!.varlik, "PROP_Lamp");
  assert.equal(olay.yerler, 1);
  assert.equal(olay.yazilan.length, 1);
  assert.match(olay.altyazi.at(-1)!, /yerleştirildi/);
});

test("yerleştir: hayaletin döndürdüğü açı (derece) nesneye yazılır", async () => {
  const { y, son } = duzenek();
  await y.baslat();
  await y.yerlestir("PROP_Lamp", [1, 0, 1], [0, 135, 0]);
  assert.deepEqual(son()[1]!.donus, [0, 135, 0]);
});

test("yerleştir: katalog adı Türkçe ada çevrilerek altyazıda söylenir", async () => {
  const { y, olay } = duzenek();
  await y.baslat();
  await y.yerlestir("PROP_Bench", [nokta.x, nokta.y, nokta.z]);
  assert.match(olay.altyazi.at(-1)!, /Bank/);
});

test("kopyala → yapıştır: level nesnesinin dönüş ve ÖLÇEĞİ (eksen başına) aynen yeni nesneye gider", async () => {
  const { y, son } = duzenek();
  await y.baslat();
  y.kopyala("n1");
  assert.equal(y.pano()?.ad, "Eski bank");
  await y.yapistir(nokta);
  const yeni = son().find((n) => n.id === "yer-1")!;
  assert.deepEqual([yeni.varlik, yeni.donus, yeni.olcek, yeni.konum], ["PROP_Bench", [0, 30, 0], [1, 2, 1], [3, 0.3, 4]]);
});

test("yapıştır: pano boşsa hiçbir şey eklenmez, nedeni söylenir", async () => {
  const { y, olay } = duzenek();
  await y.baslat();
  await y.yapistir(nokta);
  assert.equal(olay.ayarla.length, 0);
  assert.match(olay.altyazi.at(-1)!, /önce Kopyala/);
});

test("kopyala: level'da olmayan nesne (ofis eşyası) kopyalanmaz; pano boş kalır", async () => {
  const { y, olay } = duzenek();
  await y.baslat();
  y.kopyala("masa");
  assert.equal(y.pano(), null);
  assert.match(olay.altyazi.at(-1)!, /kopyalanamaz/);
});

test("dönüştür: gizmo sonucu (konum+dönüş+ölçek) level nesnesine TEK ayarla ile yazılır; kayıt güncellenir; dosya yazılmaz", async () => {
  const { y, olay, son } = duzenek();
  await y.baslat();
  await y.donustur(new Map([["n1", { konum: [3, 0.3, 4], donus: [0, 90, 0], olcek: [2, 2, 2] }]]), "1 nesne taşındı");
  const n = son().find((x) => x.id === "n1")!;
  assert.deepEqual([n.konum, n.donus, n.olcek], [[3, 0.3, 4], [0, 90, 0], [2, 2, 2]]);
  assert.equal(olay.ayarla.length, 1);
  assert.equal(olay.yerler, 1);
  assert.match(olay.altyazi.at(-1)!, /1 nesne taşındı/);
  assert.match(olay.yazilan.at(-1)!, /"n1"/);
});

test("dönüştür: eklenen nesne kendi kaydında değişir; verilmeyen alan (dönüş) korunur", async () => {
  const { y, son } = duzenek();
  await y.baslat();
  await y.yerlestir("PROP_Lamp", [1, 0, 1], [0, 30, 0]);
  await y.donustur(new Map([["yer-1", { konum: [8, 0, 8] }]]), "taşındı");
  const n = son().find((x) => x.id === "yer-1")!;
  assert.deepEqual([n.konum, n.donus], [[8, 0, 8], [0, 30, 0]]);
});

test("dönüştür: iki nesne tek komutta (tek level.ayarla)", async () => {
  const { y, olay } = duzenek();
  await y.baslat();
  await y.yerlestir("PROP_Lamp", [1, 0, 1]);
  const once = olay.ayarla.length;
  await y.donustur(new Map([["n1", { konum: [5, 0, 5] }], ["yer-1", { konum: [6, 0, 6] }]]), "2 nesne taşındı");
  assert.equal(olay.ayarla.length, once + 1);
});

test("kaldır: eklenen kalkar; level dosyasındaki nesne kaldırılamaz ve level değişmez", async () => {
  const { y, son, olay } = duzenek();
  await y.baslat();
  await y.yerlestir("PROP_Lamp", [nokta.x, nokta.y, nokta.z]);
  await y.kaldir("yer-1");
  assert.deepEqual(son().map((n) => n.id), ["n1"]);
  const sayi = olay.ayarla.length;
  await y.kaldir("n1");
  assert.equal(olay.ayarla.length, sayi);
  assert.match(olay.altyazi.at(-1)!, /kaldırılamaz/);
});

test("düzenleme uygunluğu: level nesnesi kopyalanır/düzenlenir ama kaldırılamaz; ofis eşyası hiçbiri; eklenen hepsi", async () => {
  const { y } = duzenek();
  await y.baslat();
  await y.yerlestir("PROP_Lamp", [nokta.x, nokta.y, nokta.z]);
  const u = (d: ReturnType<typeof y.duzenleme>) => [d.kopyalanabilir.uygun, d.duzenlenebilir.uygun, d.kaldirilabilir.uygun];
  assert.deepEqual(u(y.duzenleme(nesne("n1"))), [true, true, false]);
  assert.deepEqual(u(y.duzenleme(nesne("masa"))), [false, false, false]);
  assert.deepEqual(u(y.duzenleme(nesne("yer-1"))), [true, true, true]);
  assert.match(y.duzenleme(nesne("masa")).kopyalanabilir.neden!, /level nesnesi değil/);
});

test("level.ayarla hata verirse durum GERİ ALINIR, nedeni altyazıda; sonraki komut bozuk durumu taşımaz", async () => {
  let hata: string | null = "doğrulama başarısız";
  const { y, olay, son } = duzenek({ ayarlaHata: () => hata });
  await y.baslat();
  await y.yerlestir("PROP_Lamp", [nokta.x, nokta.y, nokta.z]);
  assert.match(olay.altyazi.at(-1)!, /yapılamadı: doğrulama başarısız/);
  assert.equal(olay.yazilan.length, 0);
  hata = null;
  await y.yerlestir("PROP_Lamp", [nokta.x, nokta.y, nokta.z]);
  assert.deepEqual(son().map((n) => n.id), ["n1", "yer-1"]);   // başarısız denemenin kimliği yeniden verildi, kalıntı yok
});

test("ardışık komutlar sırayla çalışır: iki yerleştirme iki ayrı kimlik", async () => {
  const { y, son } = duzenek();
  await y.baslat();
  void y.yerlestir("PROP_Lamp", [nokta.x, nokta.y, nokta.z]);
  void y.yerlestir("PROP_Lamp", [1, 0, 1]);
  await y.bitti();
  assert.deepEqual(son().map((n) => n.id), ["n1", "yer-1", "yer-2"]);
});

test("başlat: kayıtlı yerleştirmeler level'a uygulanır; katalogda artık olmayan varlık atlanır", async () => {
  const kayit = JSON.stringify({ surum: 1, tasinan: { n1: [5, 0, 5] }, eklenen: [
    { id: "yer-1", varlik: "PROP_Lamp", konum: [1, 0, 1], donus: 0, olcek: 1 },
    { id: "yer-2", varlik: "ARTIK_YOK", konum: [2, 0, 2], donus: 0, olcek: 1 },
  ] });
  const { y, son, olay } = duzenek({ baslangicKayit: kayit });
  await y.baslat();
  assert.deepEqual(son().map((n) => n.id), ["n1", "yer-1"]);
  assert.deepEqual(son()[0]!.konum, [5, 0, 5]);
  assert.equal(olay.yerler, 1);
});

test("başlat: kayıt boşsa level'a dokunulmaz; katalog grupları menü için hazır olur", async () => {
  const { y, olay } = duzenek();
  assert.equal(y.gruplar(), null);
  await y.baslat();
  assert.equal(olay.ayarla.length, 0);
  assert.deepEqual(y.gruplar()?.[0]?.ogeler.map((o) => o.ad), ["Bank", "Lamp"]);
});

test("başlat: alt çubuk kartları menüyle aynı adla hazır olur (öncesinde null)", async () => {
  const { y } = duzenek();
  assert.equal(y.kartlar(), null);
  await y.baslat();
  assert.deepEqual(y.kartlar()?.map((k) => k.ad), ["Bank", "Lamp"]);
  assert.deepEqual(y.kartlar()?.map((k) => k.ad), y.gruplar()?.flatMap((g) => g.ogeler.map((o) => o.ad)));
});

test("başlat: bozuk kayıt sessizce yutulmaz — uyarı basılır, boş durumla devam eder", async () => {
  const { y, olay } = duzenek({ baslangicKayit: "{bozuk" });
  const uyarilar: unknown[][] = [];
  const eski = console.warn; console.warn = (...a: unknown[]) => { uyarilar.push(a); };
  try { await y.baslat(); } finally { console.warn = eski; }
  assert.equal(olay.ayarla.length, 0);
  assert.ok(uyarilar.some((u) => String(u[0]).includes("YERLESTIRME")));
});
