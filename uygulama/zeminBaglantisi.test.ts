// uygulama/zeminBaglantisi.test.ts — kalemin bitirdiği vuruşun kayda/geçmişe/nesnelere/Yer'e işlenmesi (sahte Level; Babylon yok).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { ornekTanim } from "../world/level/cekirdek/ornekTanim.ts";
import type { LevelTanimi, NesneYeri, Vec3 } from "../world/level/cekirdek/levelTanimi.ts";
import type { Level } from "../world/level/cekirdek/levelKur.ts";
import type { Yer } from "../world/yer/yer.ts";
import { anahtar } from "../world/level/cekirdek/arazi.ts";
import { zeminYuksekligi } from "../world/level/moduller/zemin.ts";
import { zeminBaglantisiKur, type Vurus, type ZeminBaglantisi } from "./zeminBaglantisi.ts";
import { zeminAyari, zeminOku, zeminYaz, ZEMIN_ANAHTARI, kaydiYaz, type ZeminKaydi } from "./zemin.ts";
import type { Degisim } from "./yerlestirme.ts";

const DUZ: ZeminKaydi = { duzenleme: [], hucre: 2 };
const TEPE: ZeminKaydi = { duzenleme: [anahtar(0, 0), 3], hucre: 2 };
const BOLGE = { x0: -6, z0: -6, x1: 6, z1: 6 };

const baslangic = (nesneler: NesneYeri[] = []): LevelTanimi => ({
  ...ornekTanim(), nesneler,
  katmanlar: [{ tur: "zemin", ad: "zemin", acik: true, ayar: { duzenleme: [], duzenlemeHucre: 2 } }],
});
const yerde = (id: string): NesneYeri => ({ id, varlik: "A", konum: [0, zeminYuksekligi(zeminAyari(baslangic(), DUZ)!)(0, 0), 0], donus: 0, olcek: 1 });

function sahne(t0: LevelTanimi, depoMetni: string | null = null) {
  let t = structuredClone(t0);
  const level = { tanim: () => structuredClone(t), ayarla: (y: LevelTanimi) => { t = structuredClone(y); } } as unknown as Level;
  const depo = new Map<string, string>(depoMetni === null ? [] : [[ZEMIN_ANAHTARI, depoMetni]]);
  const tasinan: { degisim: ReadonlyMap<string, Degisim>; mesaj: string }[] = [];
  const altyazi: string[] = [];
  let yerSayisi = 0;
  let tasiHatasi: string | null = null;
  const b: ZeminBaglantisi = zeminBaglantisiKur({
    level: () => level,
    yeniYer: async () => ({ ad: "sahte" } as unknown as Yer),
    yerGuncelle: () => { yerSayisi++; },
    // Gerçek yerleştirme bağlantısı gibi: nesnelerin konumu level'a da işlenir (sonraki oturtma hesabı bunu görür).
    nesneleriTasi: async (degisim, mesaj) => {
      if (tasiHatasi) throw new Error(tasiHatasi);
      tasinan.push({ degisim, mesaj });
      const y = level.tanim();
      level.ayarla({ ...y, nesneler: (y.nesneler ?? []).map((n) => { const g = n.id ? degisim.get(n.id) : undefined; return g?.konum ? { ...n, konum: g.konum } : n; }) });
    },
    altyazi: (m) => { altyazi.push(m); },
    depo: { getItem: (k) => depo.get(k) ?? null, setItem: (k, v) => { depo.set(k, v); } },
  });
  return { b, level, depo, tasinan, altyazi, yerSayisi: () => yerSayisi, tasiHatasi: (m: string | null) => { tasiHatasi = m; } };
}
/** Kalem vuruşunu taklit eder: level canlı değişir, sonra vuruş bitti bildirilir. */
async function vur(s: ReturnType<typeof sahne>, sonra: ZeminKaydi, o: Partial<Vurus> = {}) {
  const once = zeminOku(s.level.tanim())!;
  s.level.ayarla(zeminYaz(s.level.tanim(), sonra));
  await s.b.vurusBitti({ once, bolge: BOLGE, ad: "yükselt", nesneleriOturt: true, ...o });
}
/** Oturtma yüksekliği 3 basamağa yuvarlanır (editörün `nesneleriOturt`u): milimetre farkı hata değildir. */
const yakin = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.01, `${a} ≈ ${b} olmalı`);
const simdi = (s: ReturnType<typeof sahne>) => zeminOku(s.level.tanim())!;

test("vuruş bitti: şekil kaydedilir, geçmişe adım girer, Orion'un Yer'i yenilenir", async () => {
  const s = sahne(baslangic());
  await s.b.baslat();
  await vur(s, TEPE);
  assert.match(s.depo.get(ZEMIN_ANAHTARI)!, /"surum":1/);
  assert.deepEqual(s.b.sayilar(), { geri: 1, ileri: 0 });
  assert.equal(s.b.sekilVar(), true);
  assert.equal(s.yerSayisi(), 1);
  assert.equal(s.tasinan.length, 0);
});

test("vuruş bitti: araziye oturan level nesneleri yerleştirme kaydına yazılır (Yer'i o yenileyeceği için ayrıca yenilenmez)", async () => {
  const s = sahne(baslangic([yerde("n1")]));
  await s.b.baslat();
  await vur(s, TEPE);
  assert.equal(s.tasinan.length, 1);
  assert.match(s.tasinan[0]!.mesaj, /1 nesne araziye oturtuldu/);
  const k = s.tasinan[0]!.degisim.get("n1")!.konum!;
  assert.ok(k[1] > yerde("n1").konum[1] + 2, `nesne tepeye çıkmalı, y=${k[1]}`);
  assert.equal(s.yerSayisi(), 0);
});

test("vuruş bitti: nesneleriOturt kapalıysa nesnelere dokunulmaz", async () => {
  const s = sahne(baslangic([yerde("n1")]));
  await s.b.baslat();
  await vur(s, TEPE, { nesneleriOturt: false });
  assert.equal(s.tasinan.length, 0);
});

test("vuruş bitti: şekil değişmediyse geçmişe adım girmez, kayıt yazılmaz", async () => {
  const s = sahne(baslangic());
  await s.b.baslat();
  await vur(s, DUZ);
  assert.deepEqual(s.b.sayilar(), { geri: 0, ileri: 0 });
  assert.equal(s.depo.has(ZEMIN_ANAHTARI), false);
});

test("geri al: zemin ve o vuruşta oynayan nesneler birlikte eski hâline döner; ileri al tersini yapar", async () => {
  const s = sahne(baslangic([yerde("n1")]));
  await s.b.baslat();
  await vur(s, TEPE);
  const tepeY = s.tasinan[0]!.degisim.get("n1")!.konum![1];
  await s.b.geriAl();
  assert.deepEqual(simdi(s), DUZ);
  yakin(s.tasinan[1]!.degisim.get("n1")!.konum![1], yerde("n1").konum[1]);
  assert.equal(s.b.sekilVar(), false);
  await s.b.ileriAl();
  assert.deepEqual(simdi(s), TEPE);
  yakin(s.tasinan[2]!.degisim.get("n1")!.konum![1], tepeY);
  assert.deepEqual(s.b.sayilar(), { geri: 1, ileri: 0 });
});

test("geri al: dosyadaki hâle dönülünce kayıt 'dokunulmamış' olur (dosya güncellenirse o geçerli kalır)", async () => {
  const s = sahne(baslangic());
  await s.b.baslat();
  await vur(s, TEPE);
  await s.b.geriAl();
  assert.deepEqual(JSON.parse(s.depo.get(ZEMIN_ANAHTARI)!), { surum: 1, zemin: null });
});

test("geri al / ileri al: yığın boşken zararsız ve nedenini söyler", async () => {
  const s = sahne(baslangic());
  await s.b.baslat();
  await s.b.geriAl();
  await s.b.ileriAl();
  assert.match(s.altyazi[0]!, /geri alınacak/);
  assert.match(s.altyazi[1]!, /ileri alınacak/);
  assert.deepEqual(simdi(s), DUZ);
});

test("dosyadaki zemine dön: şekil atılır, nesneler yeniden oturur ve bu da geri alınabilir", async () => {
  const s = sahne(baslangic([yerde("n1")]));
  await s.b.baslat();
  await vur(s, TEPE);
  await s.b.dosyadakineDon();
  assert.deepEqual(simdi(s), DUZ);
  assert.equal(s.b.sekilVar(), false);
  yakin(s.tasinan.at(-1)!.degisim.get("n1")!.konum![1], yerde("n1").konum[1]);
  await s.b.geriAl();
  assert.deepEqual(simdi(s), TEPE);
});

test("dosyadaki zemine dön: zaten dosyadaki hâldeyse bunu söyler, geçmiş değişmez", async () => {
  const s = sahne(baslangic());
  await s.b.baslat();
  await s.b.dosyadakineDon();
  assert.match(s.altyazi.at(-1)!, /zaten dosyadaki/);
  assert.deepEqual(s.b.sayilar(), { geri: 0, ileri: 0 });
});

test("başlat: kayıtlı şekil level'a uygulanır ve Yer yenilenir", async () => {
  const s = sahne(baslangic(), kaydiYaz(TEPE));
  await s.b.baslat();
  assert.deepEqual(simdi(s), TEPE);
  assert.equal(s.b.sekilVar(), true);
  assert.equal(s.yerSayisi(), 1);
});

test("başlat: kayıt dosyadakiyle aynıysa dokunulmaz; bozuk kayıt dosyadaki zeminle devam eder", async () => {
  const ayni = sahne(baslangic(), kaydiYaz(DUZ));
  await ayni.b.baslat();
  assert.equal(ayni.b.sekilVar(), false);
  assert.equal(ayni.yerSayisi(), 0);
  const bozuk = sahne(baslangic(), "{");
  await bozuk.b.baslat();
  assert.deepEqual(simdi(bozuk), DUZ);
  assert.equal(bozuk.b.sekilVar(), false);
});

test("nesneler yazılamazsa: neden altyazıda, adım geri alınabilir kalır, sonraki komutlar çalışır", async () => {
  const s = sahne(baslangic([yerde("n1")]));
  await s.b.baslat();
  s.tasiHatasi("depo dolu");
  await vur(s, TEPE);
  assert.match(s.altyazi.at(-1)!, /nesneler\/Yer güncellenemedi \(depo dolu\)/);
  assert.deepEqual(s.b.sayilar(), { geri: 1, ileri: 0 });
  s.tasiHatasi(null);
  await s.b.geriAl();
  assert.deepEqual(simdi(s), DUZ);
});

test("komutlar kuyrukta sırayla çalışır (art arda çağrı yarışmaz)", async () => {
  const s = sahne(baslangic());
  await s.b.baslat();
  const ikinci: ZeminKaydi = { duzenleme: [anahtar(0, 0), 3, anahtar(1, 0), 1], hucre: 2 };
  const once1 = zeminOku(s.level.tanim())!;
  s.level.ayarla(zeminYaz(s.level.tanim(), TEPE));
  const p1 = s.b.vurusBitti({ once: once1, bolge: BOLGE, ad: "bir", nesneleriOturt: false });
  s.level.ayarla(zeminYaz(s.level.tanim(), ikinci));
  const p2 = s.b.vurusBitti({ once: TEPE, bolge: BOLGE, ad: "iki", nesneleriOturt: false });
  await Promise.all([p1, p2, s.b.geriAl()]);
  assert.equal(s.b.sayilar().geri, 1);
});

test("dünya hazır değilken komut: neden altyazıda, çökmez", async () => {
  const b = zeminBaglantisiKur({ level: () => null, yeniYer: async () => ({} as Yer), yerGuncelle: () => {}, nesneleriTasi: async () => {}, altyazi: () => {}, depo: null });
  await b.baslat();
  await b.vurusBitti({ once: DUZ, bolge: null, ad: "x", nesneleriOturt: false });
  assert.deepEqual(b.sayilar(), { geri: 0, ileri: 0 });
});

// konum tipi kontrolü (Vec3 uçtan uca)
const _tip: Vec3 = [0, 0, 0]; void _tip;
