// uygulama/aktor/aktorCalismaZamani.test.ts — aktör çalışma zamanı (spec 45 B4): tetik olayları, kinematik hareket, hiyerarşi/soket bağları.
//
// Ekransız Babylon (NullEngine). Nesne düğümleri model yüklemesinden BAĞIMSIZ senkron kurulur (model yüklenemese de düğüm var); gerçek görüntü canlı senaryoda (bpdene, B9).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { levelKur, type Level } from "../../world/level/cekirdek/levelKur.ts";
import { ornekTanim } from "../../world/level/cekirdek/ornekTanim.ts";
import type { LevelTanimi, NesneYeri } from "../../world/level/cekirdek/levelTanimi.ts";
import { aktorOlayYoluKur, type AktorOlayYolu } from "../../world/level/cekirdek/aktorOlayYolu.ts";
import { DT_TAVANI_S, aktorCalismaZamaniKur, type AktorCalismaZamani } from "./aktorCalismaZamani.ts";
import type { Gozlenen } from "./tetikModeli.ts";
import { aktorGunluguKur, type AktorGunlugu } from "./aktorGunlugu.ts";

const nesne = (id: string, ek: Partial<NesneYeri> = {}): NesneYeri => ({ id, varlik: "kutu", konum: [0, 0, 0], donus: 0, olcek: 1, ...ek });

interface Dunya { gozlenenCagri: () => number; level: Level; sahne: Scene; olay: AktorOlayYolu; z: AktorCalismaZamani; gelen: string[]; gozlenen: Gozlenen[]; beden: Map<string, TransformNode> }
/** Olay yolu çalışma zamanının canlı hiyerarşisini görür (levelBaglantisi.ts deseni: yol `z.hiyerarsi()`'ni okur). */
function dunya(nesneler: NesneYeri[], isiklar: LevelTanimi["isiklar"] = [], secenek: { yuk?: (x: number, z: number) => number; gunluk?: AktorGunlugu } = {}): Dunya {
  const t: LevelTanimi = ornekTanim();
  t.katmanlar = [];
  t.nesneler = nesneler;
  t.isiklar = isiklar;
  const sahne = new Scene(new NullEngine());
  const level = levelKur(sahne, t, new Map());
  const gozlenen: Gozlenen[] = [];
  let gozlenenCagri = 0;
  const yukLevel: Level = secenek.yuk ? { ...level, yukseklik: secenek.yuk } : level;
  const beden = new Map<string, TransformNode>();
  let z: AktorCalismaZamani | null = null;
  const olay = aktorOlayYoluKur({ ustu: (id) => z?.hiyerarsi().ustu(id), altlari: (id) => z?.hiyerarsi().altlari(id) ?? [], hata: () => {} });
  z = aktorCalismaZamaniKur({ level: () => yukLevel, olay, ...(secenek.gunluk ? { gunluk: secenek.gunluk } : {}), gozlenenler: () => { gozlenenCagri++; return gozlenen; }, bedenSoketi: (b, s) => beden.get(`${b}/${s}`)?.computeWorldMatrix(true) ?? null });
  const gelen: string[] = [];
  olay.dinle("*", "*", (o) => gelen.push(`${o.aktor}:${o.ad}${o.veri["kim"] !== undefined ? `(${o.veri["kim"]})` : ""}`));
  return { gozlenenCagri: () => gozlenenCagri, level, sahne, olay, z, gelen, gozlenen, beden };
}
const kareler = (d: Dunya, n: number, dt = 0.05): void => { for (let i = 0; i < n; i++) d.z.kare(dt); };
const dunyaKonumu = (d: Dunya, id: string): [number, number, number] => {
  const n = d.level.nesneler.dugum(id)!;
  n.computeWorldMatrix(true);
  const p = n.getAbsolutePosition();
  return [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000, Math.round(p.z * 1000) / 1000];
};
const TETIK = { id: "t1", tur: "tetik", ayar: { yaricap: 2 } };
const HAREKET = (ayar: Record<string, number | boolean> = {}) => ({ id: "h1", tur: "hareket", ayar: { azamiHiz: 10, ivme: 100, zemineYapis: false, ...ayar } });

// ── tetik ──
test("tetik: Ozyn alana girince tetik.girdi, çıkınca tetik.cikti; olay aktör adına ve bileşen kimliğiyle", () => {
  const d = dunya([nesne("kapi", { konum: [10, 0, 0], bilesenler: [TETIK] })]);
  d.gozlenen.push({ id: "ozyn", tur: "ozyn", konum: { x: 0, y: 0, z: 0 } });
  kareler(d, 2);
  assert.deepEqual(d.gelen, [], "uzakta");
  d.gozlenen[0] = { id: "ozyn", tur: "ozyn", konum: { x: 9, y: 0, z: 0 } };
  kareler(d, 2);
  assert.deepEqual(d.gelen, ["kapi:tetik.girdi(ozyn)"], "yalnız bir kez");
  d.gozlenen[0] = { id: "ozyn", tur: "ozyn", konum: { x: 0, y: 0, z: 0 } };
  kareler(d, 1);
  assert.deepEqual(d.gelen, ["kapi:tetik.girdi(ozyn)", "kapi:tetik.cikti(ozyn)"]);
});

test("tetik: kim süzgeci ve hareketli aktör ('aktor') gözlenir; sahibi kendini tetiklemez", () => {
  const d = dunya([
    nesne("bolge", { konum: [0, 0, 0], bilesenler: [{ id: "t1", tur: "tetik", ayar: { yaricap: 3, kim: "aktor" } }, { id: "h0", tur: "hareket", ayar: {} }] }),
    nesne("araba", { konum: [20, 0, 0], bilesenler: [HAREKET()] }),
  ]);
  d.gozlenen.push({ id: "ozyn", tur: "ozyn", konum: { x: 0, y: 0, z: 0 } });
  kareler(d, 2);
  assert.deepEqual(d.gelen, [], "Ozyn içeride ama kim=aktor; sahibi (bolge) hareketli olsa da kendini saymaz");
  d.level.nesneler.dugum("araba")!.position.set(1, 0, 0);
  kareler(d, 1);
  assert.deepEqual(d.gelen, ["bolge:tetik.girdi(araba)"]);
});

test("tetik: çıkan tetik bileşeni (ve silinen aktör) durumu unutulur: tanım değişince eski içerdekiler için çıkış üretilmez, yenisi doğru çalışır", () => {
  const d = dunya([nesne("kapi", { konum: [0, 0, 0], bilesenler: [TETIK] })]);
  d.gozlenen.push({ id: "ozyn", tur: "ozyn", konum: { x: 0, y: 0, z: 0 } });
  kareler(d, 1);
  assert.equal(d.z.durum().tetik, 1);
  const t = d.level.tanim();
  t.nesneler = [nesne("kapi", { konum: [0, 0, 0] })];
  d.level.ayarla(t);
  kareler(d, 8);   // yenileme aralığı (0.25 sn) dolsun
  assert.equal(d.z.durum().tetik, 0);
});

// ── hareket ──
test("hareket: komutla ileri gider (yaw 0 → +Z), hız/ivme sınırlıdır, durdurunca durur; basladi/durdu olayları bir kez", () => {
  const d = dunya([nesne("araba", { konum: [0, 0, 0], bilesenler: [HAREKET({ azamiHiz: 4, ivme: 100 })] })]);
  kareler(d, 1);
  d.z.hareketEt("araba", 4, 0);
  kareler(d, 20, 0.05);   // 1 sn
  const [x, , z] = dunyaKonumu(d, "araba");
  assert.ok(Math.abs(x) < 1e-6);
  assert.ok(z > 3.5 && z <= 4.01, `1 sn × 4 m/s ≈ 4 m (z=${z})`);
  assert.deepEqual(d.gelen, ["araba:hareket.basladi"]);
  d.z.hareketEt("araba", 0, 0);
  kareler(d, 5, 0.05);
  assert.deepEqual(d.gelen, ["araba:hareket.basladi", "araba:hareket.durdu"]);
  assert.equal(d.z.durum().hareketli, 0, "durunca izleme bırakılır");
  const durdu = dunyaKonumu(d, "araba");
  kareler(d, 5);
  assert.deepEqual(dunyaKonumu(d, "araba"), durdu);
});

test("hareket: dönme yönü değiştirir; dönünce ileri başka yöne gider (90° → +X)", () => {
  const d = dunya([nesne("araba", { bilesenler: [HAREKET({ azamiHiz: 10, ivme: 200 })] })]);
  kareler(d, 1);
  d.z.hareketEt("araba", 0, 90);
  kareler(d, 20, 0.05);   // 1 sn × 90°/s = 90°
  d.z.hareketEt("araba", 2, 0);
  kareler(d, 20, 0.05);
  const [x, , z] = dunyaKonumu(d, "araba");
  assert.ok(x > 1.5 && Math.abs(z) < 0.2, `x=${x} z=${z}`);
});

test("hareket: hareket bileşeni yoksa, azami hızı aşınca, ışık için ve olmayan aktör NEDENLE reddedilir", () => {
  const d = dunya([nesne("kutu1"), nesne("araba", { bilesenler: [HAREKET({ azamiHiz: 3 })] })], [{ id: "i1", tur: "nokta", konum: [0, 1, 0], renk: "mavi", siddet: 1, menzil: 5, bilesenler: [HAREKET()] }]);
  kareler(d, 1);
  assert.throws(() => d.z.hareketEt("kutu1", 1, 0), /hareket bileşeni yok/);
  assert.throws(() => d.z.hareketEt("araba", 5, 0), /azami hızı aşıyor/);
  assert.throws(() => d.z.hareketEt("araba", 1, 9999), /dönme hızını aşıyor/);
  assert.throws(() => d.z.hareketEt("araba", NaN, 0), /sonlu/);
  assert.throws(() => d.z.hareketEt("yok", 1, 0), /aktör yok/);
  assert.throws(() => d.z.hareketEt("i1", 1, 0), /ışık hareket edemez/);
});

// ── hiyerarşi ──
test("ust: çocuğun konumu üste göre YEREL; üst hareket edince çocuk onu izler", () => {
  const d = dunya([
    nesne("masa", { konum: [10, 0, 0], bilesenler: [HAREKET({ azamiHiz: 10, ivme: 200 })] }),
    nesne("lamba", { konum: [0, 1, 0], ust: "masa" }),
  ]);
  kareler(d, 2);
  assert.deepEqual(dunyaKonumu(d, "lamba"), [10, 1, 0], "yerel (0,1,0) + üst (10,0,0)");
  d.z.hareketEt("masa", 5, 0);
  kareler(d, 20, 0.05);
  const [mx, , mz] = dunyaKonumu(d, "masa"), [lx, ly, lz] = dunyaKonumu(d, "lamba");
  assert.ok(mz > 3);
  assert.deepEqual([lx, ly, lz], [mx, 1, mz], "çocuk üstle birlikte");
});

test("ust: üst DÖNÜNCE çocuk onun yerel eksenlerinde döner (yaw 90°: yerel +Z → dünya +X)", () => {
  const d = dunya([nesne("tabla", { konum: [0, 0, 0], donus: [0, 90, 0] }), nesne("kutu1", { konum: [0, 0, 2], ust: "tabla" })]);
  kareler(d, 2);
  const [x, , z] = dunyaKonumu(d, "kutu1");
  assert.ok(Math.abs(x - 2) < 1e-3 && Math.abs(z) < 1e-3, `x=${x} z=${z}`);
});

test("soket: çocuk üstün 'soket' bileşeninin yerel noktasına oturur; olmayan soket uyarı verir ve bağlanmaz", () => {
  const d = dunya([
    nesne("adam", { konum: [5, 0, 0], bilesenler: [{ id: "s1", tur: "soket", ayar: { ad: "el", konum: [0.5, 1.2, 0] } }] }),
    nesne("kilic", { konum: [0, 0, 0], ust: "adam", soket: "el" }),
    nesne("hayalet", { konum: [0, 0, 0], ust: "adam", soket: "yok" }),
  ]);
  kareler(d, 2);
  assert.deepEqual(dunyaKonumu(d, "kilic"), [5.5, 1.2, 0]);
  assert.match(d.z.durum().uyarilar.join(), /hayalet: 'adam' aktöründe 'yok' soketi yok/);
  assert.equal(d.level.nesneler.dugum("hayalet")!.parent, null, "bağlanmadı");
});

test("bağ olayları: kurulunca soket.takildi (üst adına), çözülünce soket.cikarildi; çocuk eski yerel hâline döner", () => {
  const d = dunya([nesne("adam", { konum: [5, 0, 0], bilesenler: [{ id: "s1", tur: "soket", ayar: { ad: "el", konum: [0, 1, 0] } }] }), nesne("kilic", { konum: [1, 0, 0] })]);
  kareler(d, 1);
  assert.deepEqual(dunyaKonumu(d, "kilic"), [1, 0, 0]);
  d.z.soketeTak("kilic", "adam", "el");
  kareler(d, 2);
  assert.deepEqual(d.gelen, ["adam:soket.takildi(kilic)"]);
  assert.deepEqual(dunyaKonumu(d, "kilic"), [6, 1, 0], "soket (0,1,0) + yerel (1,0,0) + üst (5,0,0): yerel konum SOKETE göre");
  assert.deepEqual(d.z.bag("kilic"), { ust: "adam", soket: "el" });
  d.z.sokettanAl("kilic");
  kareler(d, 2);
  assert.deepEqual(d.gelen, ["adam:soket.takildi(kilic)", "adam:soket.cikarildi(kilic)"]);
  assert.deepEqual(dunyaKonumu(d, "kilic"), [1, 0, 0], "tanımdaki yerel konuma döndü");
  assert.equal(d.z.bag("kilic"), null);
  assert.equal(d.z.durum().bag, 0);
});

test("sokettanAl: tanımdaki üstten de ayırır (ezme); üstü olmayanı reddeder", () => {
  const d = dunya([nesne("a", { konum: [3, 0, 0] }), nesne("b", { konum: [1, 0, 0], ust: "a" })]);
  kareler(d, 2);
  assert.deepEqual(dunyaKonumu(d, "b"), [4, 0, 0]);
  d.z.sokettanAl("b");
  kareler(d, 2);
  assert.deepEqual(dunyaKonumu(d, "b"), [1, 0, 0]);
  assert.throws(() => d.z.sokettanAl("b"), /üste bağlı değil/);
  assert.throws(() => d.z.sokettanAl("yok"), /aktör yok/);
});

test("soketeTak reddi: olmayan üst/soket, kendi üstü, döngü, boş beden soketi, bilinmeyen beden soketi", () => {
  const d = dunya([nesne("a", { bilesenler: [{ id: "s1", tur: "soket", ayar: { ad: "el" } }] }), nesne("b", { ust: "a" }), nesne("c")]);
  kareler(d, 2);
  d.gelen.length = 0;   // tanımdaki b→a bağı kurulurken verdiği soket.takildi sayılmaz; reddedilenler YENİ olay üretmemeli
  assert.throws(() => d.z.soketeTak("c", "yok"), /level'da yok/);
  assert.throws(() => d.z.soketeTak("c", "a", "baska"), /'baska' soketi yok/);
  assert.throws(() => d.z.soketeTak("c", "c"), /kendi üstü/);
  assert.throws(() => d.z.soketeTak("a", "b"), /döngü/);
  assert.throws(() => d.z.soketeTak("c", "beden:orion"), /beden soketi adı verilmedi/);
  assert.throws(() => d.z.soketeTak("c", "beden:orion", "el_sag"), /bedeninde 'el_sag' soketi yok/);
  assert.throws(() => d.z.soketeTak("yok", "a"), /aktör yok/);
  assert.deepEqual(d.gelen, [], "reddedilen bağ olay üretmez");
});

test("beden soketi: kılıç beden:orion/el_sag'a takılınca bedenin kemik düğümünü izler", () => {
  const d = dunya([nesne("kilic", { konum: [0, 0, 0] })]);
  const el = new TransformNode("el_sag", d.sahne);
  el.position.set(2, 3, 4);
  d.beden.set("orion/el_sag", el);
  kareler(d, 1);
  d.z.soketeTak("kilic", "beden:orion", "el_sag");
  kareler(d, 2);
  assert.deepEqual(dunyaKonumu(d, "kilic"), [2, 3, 4]);
  el.position.set(5, 0, 0);
  kareler(d, 1);
  assert.deepEqual(dunyaKonumu(d, "kilic"), [5, 0, 0], "kemik hareket edince izler");
  assert.deepEqual(d.gelen, ["beden:orion:soket.takildi(kilic)"]);
});

test("olay yolu etkin hiyerarşiyi görür: ezme sonrası alt aktöre yayın yeni üstün altına gider", () => {
  const d = dunya([nesne("a", { bilesenler: [{ id: "s1", tur: "soket", ayar: { ad: "el" } }] }), nesne("b")]);
  kareler(d, 1);
  d.z.soketeTak("b", "a", "el");
  kareler(d, 1);
  d.gelen.length = 0;
  d.olay.altlaraYayinla("a", "ping");
  assert.deepEqual(d.gelen, ["b:ping"]);
});

test("ışık da üste bağlanır (lamba direğin tepesinde); üst düğümü yıkılsa bile alt aktörün düğümü YIKILMAZ (ara düğüm)", () => {
  const d = dunya([nesne("direk", { konum: [4, 0, 0] })], [{ id: "i1", tur: "nokta", konum: [0, 3, 0], renk: "mavi", siddet: 1, menzil: 5, ust: "direk" }]);
  kareler(d, 2);
  const isik = d.level.isiklar.isik("i1")!;
  assert.equal(isik.parent?.name, "bag_i1", "ışık ara düğümün çocuğu");
  const t0 = isik.computeWorldMatrix(true).getTranslation();
  assert.deepEqual([t0.x, t0.y], [4, 3]);
  // nesneSistemi'nin yaptığı: üstü ÇOCUKLARIYLA yık.
  d.level.nesneler.dugum("direk")!.dispose(false, false);
  kareler(d, 2);
  assert.equal(isik.isDisposed(), false, "ışık yıkılmadı");
  assert.match(d.z.durum().uyarilar.join(), /üst aktör henüz sahnede yok \(direk\)/);
});

test("level yokken kare ve hiyerarşi hata vermez; yokEt bağları çözer ve ara düğümleri siler", () => {
  let l: Level | null = null;
  const t: LevelTanimi = ornekTanim();
  t.katmanlar = [];
  t.nesneler = [nesne("a", { konum: [3, 0, 0] }), nesne("b", { konum: [1, 0, 0], ust: "a" })];
  t.isiklar = [];
  const sahne = new Scene(new NullEngine());
  l = levelKur(sahne, t, new Map());
  const olay = aktorOlayYoluKur({ ustu: () => undefined, altlari: () => [], hata: () => {} });
  const z = aktorCalismaZamaniKur({ level: () => l, olay });
  z.kare(0.05); z.kare(0.05);
  assert.equal(z.durum().bag, 1);
  const b = l.nesneler.dugum("b")!;
  z.yokEt();
  assert.equal(b.parent, null);
  assert.equal(sahne.getTransformNodeByName("bag_b"), null, "ara düğüm silindi");
  l = null;
  z.kare(0.05);
  assert.equal(z.durum().aktor, 0);
});

test("kare: her karede olay yolunun kare sayacı sıfırlanır (kare başına 256 tavanı birikmez)", () => {
  const d = dunya([nesne("a")]);
  for (let kare = 0; kare < 3; kare++) {
    d.z.kare(0.05);
    for (let i = 0; i < 200; i++) d.olay.yayinla("a", "ping");
  }
  assert.equal(d.olay.sayim().atlananKare, 0, "600 olay, kare başına 200: tavan (256) hiç aşılmadı");
  assert.equal(d.olay.sayim().iletilen, 600);
});

test("kare: uzun takılma (dt büyük) tek karede en çok DT_TAVANI_S ilerletir: araba ışınlanmaz", () => {
  const d = dunya([nesne("araba", { bilesenler: [HAREKET({ azamiHiz: 10, ivme: 200 })] })]);
  d.z.kare(0.05);
  d.z.hareketEt("araba", 10, 0);
  d.z.kare(5);
  const z = dunyaKonumu(d, "araba")[2];
  assert.ok(z <= 10 * DT_TAVANI_S + 1e-6 && z > 0, `5 sn'lik dt 0.1 sn sayıldı (z=${z})`);
  d.z.kare(Number.NaN);
  d.z.kare(-1);
  assert.equal(dunyaKonumu(d, "araba")[2], z, "geçersiz dt ilerletmez");
});

test("soket: ÜST DÖNMÜŞKEN soket noktası üstün yerel eksenlerinde çözülür (yaw 90°: soket yerel +Z → dünya +X)", () => {
  const d = dunya([
    nesne("adam", { konum: [5, 0, 0], donus: [0, 90, 0], bilesenler: [{ id: "s1", tur: "soket", ayar: { ad: "el", konum: [0, 0, 1] } }] }),
    nesne("kilic", { ust: "adam", soket: "el" }),
  ]);
  d.z.kare(0.05); d.z.kare(0.05);
  const [x, y, z] = dunyaKonumu(d, "kilic");
  assert.ok(Math.abs(x - 6) < 1e-3 && Math.abs(y) < 1e-3 && Math.abs(z) < 1e-3, `x=${x} y=${y} z=${z}`);
});

// ── bölme sonrası boşluklar (bozma denemesinde kaçan mutantlar) ──
test("soket: soket DÖNÜŞÜ derece cinsindendir (yaw 90°: soket yerel +Z → dünya +X)", () => {
  const d = dunya([
    nesne("adam", { bilesenler: [{ id: "s1", tur: "soket", ayar: { ad: "el", konum: [0, 0, 0], donus: [0, 90, 0] } }] }),
    nesne("kilic", { konum: [0, 0, 1], ust: "adam", soket: "el" }),
  ]);
  kareler(d, 2);
  const [x, , z] = dunyaKonumu(d, "kilic");
  assert.ok(Math.abs(x - 1) < 1e-3 && Math.abs(z) < 1e-3, `x=${x} z=${z}`);
});

test("hareket: zemineYapis AÇIKKEN düğüm zemin yüksekliğini izler; BAĞLI aktör yapışmaz (konumu üst belirler)", () => {
  const yuk = (x: number): number => x * 0.5;
  const serbest = dunya([nesne("araba", { bilesenler: [HAREKET({ azamiHiz: 10, ivme: 200, zemineYapis: true })] })], [], { yuk });
  kareler(serbest, 1);
  serbest.z.hareketEt("araba", 0, 90);
  kareler(serbest, 20);
  serbest.z.hareketEt("araba", 4, 0);
  kareler(serbest, 20);
  const [sx, sy] = dunyaKonumu(serbest, "araba");
  assert.ok(sx > 2 && Math.abs(sy - sx * 0.5) < 0.05, `x=${sx} y=${sy}`);

  const bagli = dunya([
    nesne("masa"),
    nesne("cocuk", { ust: "masa", bilesenler: [HAREKET({ azamiHiz: 10, ivme: 200, zemineYapis: true })] }),
  ], [], { yuk });
  kareler(bagli, 2);
  bagli.z.hareketEt("cocuk", 0, 90);
  kareler(bagli, 20);
  bagli.z.hareketEt("cocuk", 4, 0);
  kareler(bagli, 20);
  assert.equal(bagli.level.nesneler.dugum("cocuk")!.position.y, 0, "bağlıyken yerel y zemine göre değişmez");
});

test("tetik: gözlenenler karede EN ÇOK BİR kez toplanır (tetik sayısından bağımsız)", () => {
  const d = dunya([nesne("a", { bilesenler: [TETIK] }), nesne("b", { bilesenler: [{ ...TETIK, id: "t2" }, { ...TETIK, id: "t3" }] })]);
  kareler(d, 1);
  const once = d.gozlenenCagri();
  kareler(d, 3);
  assert.equal(d.gozlenenCagri() - once, 3);
});

test("tetik: bileşen DEĞİŞİNCE eski bileşenin durumu unutulur (aynı aktörde başka tetik olsa bile)", () => {
  const d = dunya([nesne("kapi", { bilesenler: [TETIK] })]);
  d.gozlenen.push({ id: "ozyn", tur: "ozyn", konum: { x: 0, y: 0, z: 0 } });
  kareler(d, 1);
  const t = d.level.tanim();
  t.nesneler = [nesne("kapi", { bilesenler: [{ ...TETIK, id: "t2" }] })];
  d.level.ayarla(t);
  kareler(d, 8);
  assert.equal(d.z.durum().tetik, 1, "yalnız yeni bileşenin durumu kalır");
  assert.deepEqual(d.z.hataAyiklama().tetikler.map((x) => x.bilesen), ["t2"]);
});

test("olay reddi: günlükte kod bir kez (ayrıntı metni kodsuz); kare tavanı aşılınca olaylar atlanır ve nedeni yazılır", () => {
  const gunluk = aktorGunluguKur();
  const d = dunya([nesne("kapi", { bilesenler: [TETIK] })], [], { gunluk });
  for (let i = 0; i < 300; i++) d.gozlenen.push({ id: `k${i}`, tur: "ozyn", konum: { x: 0, y: 0, z: 0 } });
  kareler(d, 1);
  const kayit = gunluk.son().filter((k) => k.kategori === "olay" && k.seviye === "uyari");
  assert.ok(kayit.length >= 1, "olay yolu reddi günlüğe yazıldı");
  assert.ok(kayit.every((k) => !/\] \[AKT-/.test(k.metin) && !/^\[AKT-[A-Z]{3}-\d{3}\] \[AKT/.test(k.metin)), JSON.stringify(kayit.map((k) => k.metin).slice(0, 2)));
  assert.ok(kayit.every((k) => k.kod === "AKT-OLY-005"));
});

test("level değişimi: eski level'in ara düğümleri (bag_*) sökülür, yeni level'de bağlar yeniden kurulur", () => {
  const kur = (): { level: Level; sahne: Scene } => {
    const t: LevelTanimi = ornekTanim();
    t.katmanlar = [];
    t.nesneler = [nesne("masa"), nesne("cocuk", { ust: "masa" })];
    t.isiklar = [];
    const sahne = new Scene(new NullEngine());
    return { level: levelKur(sahne, t, new Map()), sahne };
  };
  const bir = kur(), iki = kur();
  let aktif: Level = bir.level;
  const olay = aktorOlayYoluKur({ ustu: () => undefined, altlari: () => [], hata: () => {} });
  const z = aktorCalismaZamaniKur({ level: () => aktif, olay });
  kareler({ z } as Dunya, 2);
  assert.ok(bir.sahne.getTransformNodeByName("bag_cocuk"), "ilk level'de ara düğüm kuruldu");
  aktif = iki.level;
  kareler({ z } as Dunya, 8);   // yenileme aralığı (0.25 sn) dolunca level değişimi görülür
  assert.equal(bir.sahne.getTransformNodeByName("bag_cocuk"), null, "eski level'in ara düğümü sökülür");
  assert.ok(iki.sahne.getTransformNodeByName("bag_cocuk"), "yeni level'de yeniden kuruldu");
});
