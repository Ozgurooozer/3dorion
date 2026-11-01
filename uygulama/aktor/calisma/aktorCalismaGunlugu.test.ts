// uygulama/aktor/calisma/aktorCalismaGunlugu.test.ts — çalışma zamanının GÜNLÜK / BAYRAK / KODLU HATA davranışı (spec 45 §13).
// Soru: "neyin çalıştığını, neyin hata verdiğini günlükte görebiliyor muyuz, hata kodu nerede olduğunu söylüyor mu?" Ekransız Babylon (NullEngine).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { levelKur, type Level } from "../../../world/level/cekirdek/levelKur.ts";
import { ornekTanim } from "../../../world/level/cekirdek/ornekTanim.ts";
import type { LevelTanimi, NesneYeri } from "../../../world/level/cekirdek/levelTanimi.ts";
import { aktorOlayYoluKur, type AktorOlayYolu } from "../../../world/level/cekirdek/aktorOlayYolu.ts";
import { kodOku } from "../../../world/level/cekirdek/aktorHatalari.ts";
import { aktorCalismaZamaniKur, type AktorCalismaZamani } from "./aktorCalismaZamani.ts";
import { aktorGunluguKur, bayraklariOku, type AktorGunlugu } from "./aktorGunlugu.ts";
import type { Gozlenen } from "./tetikModeli.ts";

const nesne = (id: string, ek: Partial<NesneYeri> = {}): NesneYeri => ({ id, varlik: "kutu", konum: [0, 0, 0], donus: 0, olcek: 1, ...ek });
const TETIK = { id: "t1", tur: "tetik", ayar: { yaricap: 2 } };
const HAREKET = { id: "h1", tur: "hareket", ayar: { azamiHiz: 10, ivme: 100, zemineYapis: false } };

interface Dunya { level: Level; sahne: Scene; olay: AktorOlayYolu; z: AktorCalismaZamani; g: AktorGunlugu; gozlenen: Gozlenen[]; beden: Map<string, TransformNode>; gelen: string[] }
function dunya(nesneler: NesneYeri[], o: { bayrak?: string; kareTavani?: number; gozlenenler?: () => Gozlenen[] } = {}): Dunya {
  const t: LevelTanimi = ornekTanim();
  t.katmanlar = []; t.nesneler = nesneler; t.isiklar = [];
  const sahne = new Scene(new NullEngine());
  const level = levelKur(sahne, t, new Map());
  const gozlenen: Gozlenen[] = [];
  const beden = new Map<string, TransformNode>();
  const g = aktorGunluguKur({ bayrak: bayraklariOku(o.bayrak) });
  let z: AktorCalismaZamani | null = null;
  const olay = aktorOlayYoluKur({ ustu: (id) => z?.hiyerarsi().ustu(id), altlari: (id) => z?.hiyerarsi().altlari(id) ?? [], hata: () => {}, ...(o.kareTavani ? { kareTavani: o.kareTavani } : {}) });
  z = aktorCalismaZamaniKur({ level: () => level, olay, gunluk: g, gozlenenler: o.gozlenenler ?? (() => gozlenen), bedenSoketi: (b, s) => beden.get(`${b}/${s}`)?.computeWorldMatrix(true) ?? null });
  const gelen: string[] = [];
  olay.dinle("*", "*", (e) => gelen.push(`${e.aktor}:${e.ad}`));
  return { level, sahne, olay, z, g, gozlenen, beden, gelen };
}
const kareler = (d: Dunya, n: number, dt = 0.05): void => { for (let i = 0; i < n; i++) d.z.kare(dt); };

test("çözülemeyen bağ: kodlu uyarı BİR KEZ yazılır (kare başına değil), bağ kurulunca 'çözüldü' kaydı düşer", () => {
  const d = dunya([nesne("kilic", { ust: "beden:orion", soket: "el_sag" })]);
  kareler(d, 40);
  const uyarilar = d.g.son(50, { seviye: "uyari" });
  assert.equal(uyarilar.length, 1, "40 karede tek uyarı");
  assert.equal(uyarilar[0]!.kod, "AKT-BAG-012");
  assert.equal(uyarilar[0]!.aktor, "kilic");
  assert.equal(uyarilar[0]!.tekrar, 1, "tekrar sayacı da şişmez: durum değişiminde yazılır");
  d.beden.set("orion/el_sag", new TransformNode("el", d.sahne));
  kareler(d, 2);
  const iyi = d.g.son(50, { seviye: "iyi" });
  assert.equal(iyi.length, 1);
  assert.match(iyi[0]!.metin, /çözüldü/);
  assert.equal(d.z.durum().uyarilar.length, 0);
});

test("uyarı kaybolup geri gelirse YENİDEN yazılır (durum değişimi), aynı durumda susar", () => {
  const d = dunya([nesne("kilic", { ust: "beden:orion", soket: "el_sag" })]);
  const el = new TransformNode("el", d.sahne);
  d.beden.set("orion/el_sag", el);
  kareler(d, 3);
  assert.equal(d.g.son(50, { seviye: "uyari" }).length, 0);
  d.beden.delete("orion/el_sag");
  kareler(d, 10);
  assert.equal(d.g.son(50, { seviye: "uyari" }).length, 1);
  assert.equal(d.g.son(50, { seviye: "uyari" })[0]!.kod, "AKT-BAG-012");
});

test("bayrakla kapatma: -tetik tetik aşamasını atlar (olay gelmez), ZMN-002 BİR KEZ uyarılır; açılınca çalışır ve yeniden kapatınca yine bildirilir", () => {
  const d = dunya([nesne("kapi", { konum: [0, 0, 0], bilesenler: [TETIK] })]);
  d.gozlenen.push({ id: "ozyn", tur: "ozyn", konum: { x: 0, y: 0, z: 0 } });
  d.g.kapat("tetik", true);
  kareler(d, 10);
  assert.deepEqual(d.gelen, [], "kapalıyken tetik olayı yok");
  const kapali = d.g.son(50, { kod: "AKT-ZMN-002" });
  assert.equal(kapali.length, 1, "10 karede tek bildirim");
  d.g.kapat("tetik", false);
  kareler(d, 2);
  assert.deepEqual(d.gelen, ["kapi:tetik.girdi"]);
  d.g.kapat("tetik", true);
  kareler(d, 2);
  assert.equal(d.g.son(50, { kod: "AKT-ZMN-002" }).length, 2, "kapatma yeniden bildirilir");
});

test("bayrakla kapatma BAŞKA bileşeni etkilemez: -tetik iken hareket sürer", () => {
  const d = dunya([nesne("araba", { bilesenler: [HAREKET] })]);
  d.g.kapat("tetik", true);
  d.z.hareketEt("araba", 4, 0);
  kareler(d, 10);
  assert.ok(d.level.nesneler.dugum("araba")!.position.z > 1, "araba ilerledi");
});

test("aşama YALITIMI: tetik aşaması patlarsa ZMN-001 kodlu hata yazılır, hareket aşaması yine de çalışır; ardışık aynı hata şişmez", () => {
  const d = dunya([nesne("kapi", { bilesenler: [TETIK] }), nesne("araba", { konum: [0, 0, 5], bilesenler: [HAREKET] })], {
    gozlenenler: () => { throw new Error("gözlenen kaynağı bozuk"); },
  });
  d.z.hareketEt("araba", 4, 0);
  kareler(d, 20);
  const h = d.g.son(50, { seviye: "hata" });
  assert.equal(h.length, 1, "20 kare, tek satır");
  assert.equal(h[0]!.kod, "AKT-ZMN-001");
  assert.equal(h[0]!.tekrar, 20, "tekrar sayacı sel yerine sayar");
  assert.match(h[0]!.metin, /tetik aşaması: gözlenen kaynağı bozuk/);
  assert.ok(d.level.nesneler.dugum("araba")!.position.z > 6, "hareket aşaması patlayan tetikten etkilenmedi");
});

test("olay yolu reddi SESSİZ değil: kare tavanı aşılınca OLY-005 kodlu uyarı (olay kategorisi, aktör adıyla)", () => {
  const d = dunya([nesne("kapi", { bilesenler: [TETIK] })], { kareTavani: 1 });
  d.gozlenen.push({ id: "ozyn", tur: "ozyn", konum: { x: 0, y: 0, z: 0 } }, { id: "orion", tur: "orion", konum: { x: 0, y: 0, z: 0 } });
  kareler(d, 1);
  const u = d.g.son(10, { seviye: "uyari", kategori: "olay" });
  assert.equal(u.length, 1);
  assert.equal(u[0]!.kod, "AKT-OLY-005");
  assert.equal(u[0]!.aktor, "kapi");
  assert.equal(d.olay.sayim().atlananKare, 1);
});

test("ayrıntılı iz bayrakla: 'tetik' açıkken girdi/çıktı yazılır, kapalıyken YAZILMAZ (günlük şişmez)", () => {
  const kapali = dunya([nesne("kapi", { bilesenler: [TETIK] })]);
  kapali.gozlenen.push({ id: "ozyn", tur: "ozyn", konum: { x: 0, y: 0, z: 0 } });
  kareler(kapali, 3);
  assert.equal(kapali.g.son(50).length, 0);

  const acik = dunya([nesne("kapi", { bilesenler: [TETIK] })], { bayrak: "tetik" });
  acik.gozlenen.push({ id: "ozyn", tur: "ozyn", konum: { x: 0, y: 0, z: 0 } });
  kareler(acik, 3);
  const k = acik.g.son(50, { kategori: "tetik" });
  assert.equal(k.length, 1);
  assert.equal(k[0]!.seviye, "iyi");
  assert.match(k[0]!.metin, /ozyn kapi\/t1 alanına girdi/);
});

test("hareket izi: başladı/durdu ayrıntılı bayrakla; komut satırı hız ve dönüşü söyler", () => {
  const d = dunya([nesne("araba", { bilesenler: [HAREKET] })], { bayrak: "hareket" });
  d.z.hareketEt("araba", 3, 0);
  kareler(d, 5);
  d.z.hareketEt("araba", 0, 0);
  kareler(d, 40);
  const m = d.g.son(50, { kategori: "hareket" }).map((k) => k.metin);
  assert.ok(m.some((x) => /komut: hız 3 m\/s/.test(x)), m.join("|"));
  assert.ok(m.some((x) => /hareket etmeye başladı/.test(x)));
  assert.ok(m.some((x) => /durdu/.test(x)));
});

test("fırlatmalar KODLU: kod alanı programla okunur (olmayan aktör, bileşensiz aktör, beden soketi adı yok/yanlış, bağsız ayırma)", () => {
  const d = dunya([nesne("kutu"), nesne("araba", { bilesenler: [HAREKET] })]);
  const kod = (f: () => void): string | null => { try { f(); } catch (e) { return kodOku(e); } return null; };
  assert.equal(kod(() => d.z.hareketEt("yok", 1, 0)), "AKT-BAG-001");
  assert.equal(kod(() => d.z.hareketEt("kutu", 1, 0)), "AKT-HRK-001");
  assert.equal(kod(() => d.z.hareketEt("araba", 999, 0)), "AKT-HRK-003");
  assert.equal(kod(() => d.z.hareketEt("araba", Number.NaN, 0)), "AKT-HRK-002");
  assert.equal(kod(() => d.z.soketeTak("kutu", "beden:orion")), "AKT-BAG-007");
  assert.equal(kod(() => d.z.soketeTak("kutu", "beden:orion", "el_sag")), "AKT-BAG-008");
  assert.equal(kod(() => d.z.soketeTak("kutu", "kutu")), "AKT-BAG-003");
  assert.equal(kod(() => d.z.soketeTak("kutu", "yokaktor")), "AKT-BAG-002");
  assert.equal(kod(() => d.z.sokettanAl("kutu")), "AKT-BAG-010");
  assert.equal(kod(() => d.z.sokettanAl("yok")), "AKT-BAG-001");
});

test("bağ olayları günlüğe: takma isteği ve kurulum 'bag' kategorisinde (ayrıntılı bayrakla)", () => {
  const d = dunya([nesne("direk"), nesne("lamba", { konum: [0, 1, 0] })], { bayrak: "bag" });
  d.z.soketeTak("lamba", "direk");
  kareler(d, 2);
  const m = d.g.son(50, { kategori: "bag" }).map((k) => k.metin);
  assert.ok(m.some((x) => /lamba → direk takma isteği kabul edildi/.test(x)), m.join("|"));
  assert.ok(m.some((x) => /lamba → direk bağı kuruldu/.test(x)));
});

test("hataAyiklama(): bağlar (kurulu mu), tetikler (içerdekiler), hareketliler, uyarılar, kapalılar, olay sayımı", () => {
  const d = dunya([
    nesne("kapi", { konum: [0, 0, 0], bilesenler: [TETIK] }),
    nesne("araba", { konum: [30, 0, 0], bilesenler: [HAREKET] }),   // kapıdan uzak: tetiğin içine girmesin
    nesne("kilic", { ust: "beden:orion", soket: "el_sag" }),
  ]);
  d.gozlenen.push({ id: "ozyn", tur: "ozyn", konum: { x: 0, y: 0, z: 0 } });
  d.z.hareketEt("araba", 2, 0);
  d.g.kapat("hareket", true);
  kareler(d, 3);
  const o = d.z.hataAyiklama();
  assert.equal(o.aktor, 3);
  assert.deepEqual(o.baglar, [{ aktor: "kilic", ust: "beden:orion", soket: "el_sag", kurulu: false }]);
  assert.deepEqual(o.tetikler, [{ aktor: "kapi", bilesen: "t1", icerde: ["ozyn"] }]);
  assert.equal(o.uyarilar.length, 1);
  assert.match(o.uyarilar[0]!, /^\[AKT-BAG-012\] kilic: /);
  assert.deepEqual(o.kapali, ["hareket"]);
  assert.ok(o.olaySayimi.yayinlanan >= 1);
});

test("günlük verilmezse çalışma zamanı kendi sessiz günlüğüyle çalışır (geriye uyum: B4 testleri)", () => {
  const sahne = new Scene(new NullEngine());
  const t: LevelTanimi = ornekTanim(); t.katmanlar = []; t.nesneler = [nesne("kutu")]; t.isiklar = [];
  const level = levelKur(sahne, t, new Map());
  const olay = aktorOlayYoluKur({ ustu: () => undefined, altlari: () => [], hata: () => {} });
  const z = aktorCalismaZamaniKur({ level: () => level, olay });
  assert.doesNotThrow(() => z.kare(0.05));
  assert.equal(z.hataAyiklama().aktor, 1);
});
