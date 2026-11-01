// uygulama/aktor/calisma/aktorIsiklari.test.ts — `isik` bileşeni çalışma zamanı (spec 45): aktöre bağlı nokta ışık; ayar değişince yerinde güncelleme; tavan; renk hatası; bayrak.
//
// Ekransız Babylon (NullEngine), gerçek levelKur: ışıklar gerçek `PointLight`; model yüklenemese de nesne düğümleri senkron vardır (aktorCalismaZamani.test.ts ile aynı kabul).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { levelKur, type Level } from "../../../world/level/cekirdek/levelKur.ts";
import { ornekTanim } from "../../../world/level/cekirdek/ornekTanim.ts";
import { ISIK_TAVANI, type IsikAktoru, type LevelTanimi, type NesneYeri } from "../../../world/level/cekirdek/levelTanimi.ts";
import type { AlanDegeri } from "../../../world/level/cekirdek/alanSemasi.ts";
import type { PointLight } from "@babylonjs/core/Lights/pointLight";
import { aktorOlayYoluKur } from "../../../world/level/cekirdek/aktorOlayYolu.ts";
import { aktorCalismaZamaniKur, type AktorCalismaZamani } from "./aktorCalismaZamani.ts";
import { aktorGunluguKur, type AktorGunlugu } from "./aktorGunlugu.ts";
import { ISIK_BILESENI_ONEKI } from "./aktorIsiklari.ts";

const nesne = (id: string, ek: Partial<NesneYeri> = {}): NesneYeri => ({ id, varlik: "kutu", konum: [0, 0, 0], donus: 0, olcek: 1, ...ek });
const ISIK = (ayar: Record<string, AlanDegeri> = {}, id = "i1") => ({ id, tur: "isik", ayar });
const isikAktoru = (id: string): IsikAktoru => ({ id, tur: "nokta", konum: [0, 1, 0], renk: "#ffffff", siddet: 1, menzil: 5 });

interface Dunya { sahne: Scene; level: Level; z: AktorCalismaZamani; gunluk: AktorGunlugu }
function dunya(nesneler: NesneYeri[], isiklar: IsikAktoru[] = []): Dunya {
  const t: LevelTanimi = ornekTanim();
  t.katmanlar = [];
  t.nesneler = nesneler;
  t.isiklar = isiklar;
  const sahne = new Scene(new NullEngine());
  const level = levelKur(sahne, t, new Map());
  const gunluk = aktorGunluguKur();
  const olay = aktorOlayYoluKur({ ustu: () => undefined, altlari: () => [], hata: () => {} });
  const z = aktorCalismaZamaniKur({ level: () => level, olay, gunluk });
  return { sahne, level, z, gunluk };
}
const kareler = (d: Dunya, n: number): void => { for (let i = 0; i < n; i++) d.z.kare(0.05); };
const ayniIsik = (d: Dunya, anahtar: string) => d.sahne.getLightByName(`${ISIK_BILESENI_ONEKI}${anahtar}`);
/** Tanımı değiştirir (level doğrular, canlı uygular); çalışma zamanı 0,25 sn'de bir tanıma bakar → 8 kare. */
function tanimiDegistir(d: Dunya, f: (t: LevelTanimi) => void): void { const t = d.level.tanim(); f(t); d.level.ayarla(t); kareler(d, 8); }

test("kurulum: isik bileşeni aktöre BAĞLI nokta ışık üretir (ayar yerel konum, renk, şiddet, menzil)", () => {
  const d = dunya([nesne("direk", { konum: [3, 0, 4], bilesenler: [ISIK({ renk: "#ff0000", siddet: 3, menzil: 6, konum: [0, 2, 0] })] })]);
  kareler(d, 2);
  const l = ayniIsik(d, "direk#i1");
  assert.ok(l, "ışık kuruldu");
  assert.equal(l!.intensity, 3);
  assert.equal((l as PointLight).range, 6);
  assert.deepEqual([l!.diffuse.r, l!.diffuse.g, l!.diffuse.b], [1, 0, 0]);
  assert.equal(l!.parent, d.level.nesneler.dugum("direk"), "aktöre bağlı");
  (l as PointLight).computeTransformedInformation();
  const dunyaKonumu = (l as PointLight).transformedPosition;
  assert.deepEqual([dunyaKonumu.x, dunyaKonumu.y, dunyaKonumu.z], [3, 2, 4], "yerel (0,2,0) + aktör (3,0,4)");
  assert.deepEqual([l!.specular.r, l!.specular.g, l!.specular.b], [0, 0, 0], "mat yüzey: parlama yok (ışık aktörleriyle aynı)");
  assert.equal(d.z.durum().isik, 1);
  assert.deepEqual(d.z.hataAyiklama().isiklar, [{ aktor: "direk", bilesen: "i1", acik: true }]);
});

test("aktör taşınınca ışık onunla gider (bağlı)", () => {
  const d = dunya([nesne("direk", { bilesenler: [ISIK({ konum: [0, 1, 0] })] })]);
  kareler(d, 2);
  d.level.nesneler.dugum("direk")!.position.x = 7;
  const l = ayniIsik(d, "direk#i1") as PointLight;
  d.level.nesneler.dugum("direk")!.computeWorldMatrix(true);
  l.computeTransformedInformation();
  assert.equal(l.transformedPosition.x, 7);
});

test("varsayılanlar: ayarsız bileşen şema varsayılanlarıyla kurulur (şiddet 1,5, menzil 8)", () => {
  const d = dunya([nesne("a", { bilesenler: [ISIK()] })]);
  kareler(d, 2);
  const l = ayniIsik(d, "a#i1")!;
  assert.equal(l.intensity, 1.5);
  assert.equal((l as PointLight).range, 8);
});

test("gizli: ışık kurulur ama KAPALI; sayıya girmez; açılınca aynı ışık yerinde açılır (yeniden kurulmaz)", () => {
  const d = dunya([nesne("a", { bilesenler: [ISIK({ gizli: true })] })]);
  kareler(d, 2);
  const once = ayniIsik(d, "a#i1")!;
  assert.equal(once.isEnabled(false), false);
  assert.equal(d.z.durum().isik, 0);
  tanimiDegistir(d, (t) => { t.nesneler = [nesne("a", { bilesenler: [ISIK({ gizli: false })] })]; });
  const sonra = ayniIsik(d, "a#i1")!;
  assert.equal(sonra, once, "aynı ışık nesnesi");
  assert.equal(sonra.isEnabled(false), true);
  assert.equal(d.z.durum().isik, 1);
});

test("ayar değişince ışık YERİNDE güncellenir (yeni ışık kurulmaz)", () => {
  const d = dunya([nesne("a", { bilesenler: [ISIK({ siddet: 1 })] })]);
  kareler(d, 2);
  const once = ayniIsik(d, "a#i1")!;
  let setEnabledCagri = 0;
  const gercek = once.setEnabled.bind(once);
  once.setEnabled = (v: boolean) => { setEnabledCagri++; gercek(v); };   // casus: durum DEĞİŞMEDEN setEnabled çağrılmamalı (spec 38 tuzağı: ışık yeniden hesaplanır)
  tanimiDegistir(d, (t) => { t.nesneler = [nesne("a", { bilesenler: [ISIK({ siddet: 9 })] })]; });
  const sonra = ayniIsik(d, "a#i1")!;
  assert.equal(sonra, once);
  assert.equal(sonra.intensity, 9);
  assert.equal(setEnabledCagri, 0, "açık/kapalı durumu değişmedi → setEnabled çağrılmadı");
});

test("ayar değişmedikçe ışığa dokunulmaz (imza aynı: setEnabled/özellik yazımı yok)", () => {
  const d = dunya([nesne("a", { bilesenler: [ISIK({ siddet: 2 })] })]);
  kareler(d, 2);
  const l = ayniIsik(d, "a#i1")!;
  l.intensity = 42;   // dışarıdan elle bozulur
  kareler(d, 20);
  assert.equal(l.intensity, 42, "imza değişmedi → yeniden yazılmadı");
});

test("bileşen kalkınca ışık YOK EDİLİR; aktör silinince de", () => {
  const d = dunya([nesne("a", { bilesenler: [ISIK()] }), nesne("b", { bilesenler: [ISIK()] })]);
  kareler(d, 2);
  assert.equal(d.z.durum().isik, 2);
  tanimiDegistir(d, (t) => { t.nesneler = [nesne("a"), nesne("b", { bilesenler: [ISIK()] })]; });
  assert.equal(ayniIsik(d, "a#i1"), null, "bileşeni kalkan aktörün ışığı yok edildi");
  assert.equal(d.z.durum().isik, 1);
  tanimiDegistir(d, (t) => { t.nesneler = [nesne("a")]; });
  assert.equal(ayniIsik(d, "b#i1"), null, "aktörü silinen ışık yok edildi");
  assert.equal(d.z.durum().isik, 0);
  assert.equal(d.gunluk.sayim().kodlar["AKT-ZMN-001"] ?? 0, 0, "budama sessizce patlamadan çalıştı (aşama hatası yok)");
  assert.deepEqual(d.z.hataAyiklama().isiklar, [], "silinen aktörün kaydı da atıldı");
});

test("TAVAN: ışık aktörleri + bileşen ışıkları ISIK_TAVANI'nı aşamaz; aşan kurulmaz, AKT-ISK-001 bir kez bildirilir", () => {
  const aktorler = Array.from({ length: ISIK_TAVANI }, (_, i) => isikAktoru(`s${i}`));
  const d = dunya([nesne("a", { bilesenler: [ISIK()] })], aktorler);
  kareler(d, 40);
  assert.equal(ayniIsik(d, "a#i1"), null, "tavan dolu: kurulmadı");
  assert.equal(d.z.durum().isik, 0);
  const kayit = d.gunluk.son(20, { kod: "AKT-ISK-001" });
  assert.equal(kayit.length, 1, "her karede değil, bir kez bildirilir");
  assert.equal(kayit[0]!.tekrar, 1, "günlük kaydı birleştirse bile ÇAĞRI bir kez yapılmış olmalı");
  assert.match(kayit[0]!.metin, /ışık doldu/);
  assert.equal(kayit[0]!.aktor, "a");
});

test("TAVAN: yer açılınca bekleyen bileşen ışığı KENDİLİĞİNDEN kurulur", () => {
  const aktorler = Array.from({ length: ISIK_TAVANI }, (_, i) => isikAktoru(`s${i}`));
  const d = dunya([nesne("a", { bilesenler: [ISIK()] })], aktorler);
  kareler(d, 4);
  assert.equal(d.z.durum().isik, 0);
  tanimiDegistir(d, (t) => { t.isiklar = t.isiklar!.slice(1); });
  assert.equal(d.z.durum().isik, 1, "bir ışık aktörü silindi → yer açıldı");
  assert.ok(ayniIsik(d, "a#i1"));
});

test("TAVAN: gizli ışık tavana sayılmaz", () => {
  const aktorler = Array.from({ length: ISIK_TAVANI }, (_, i) => isikAktoru(`s${i}`));
  const d = dunya([nesne("a", { bilesenler: [ISIK({ gizli: true })] })], aktorler);
  kareler(d, 4);
  assert.ok(ayniIsik(d, "a#i1"), "kapalı ışık kurulur");
  assert.equal(d.gunluk.son(20, { kod: "AKT-ISK-001" }).length, 0);
});

test("renk çözülemezse AKT-ISK-002 (bir kez) ve yedek renk; ışık yine de kurulur", () => {
  const d = dunya([nesne("a", { bilesenler: [ISIK({ renk: "olmayanpaletadi" })] })]);
  kareler(d, 20);
  const l = ayniIsik(d, "a#i1")!;
  assert.ok(l, "ışık kuruldu");
  assert.ok(Math.abs(l.diffuse.r - 1) < 1e-6 && Math.abs(l.diffuse.g - 0.851) < 1e-6, "yedek renk");
  const k = d.gunluk.son(20, { kod: "AKT-ISK-002" });
  assert.equal(k.length, 1);
  assert.equal(k[0]!.tekrar, 1, "aynı sorun her karede yeniden bildirilmez");
  assert.match(k[0]!.metin, /olmayanpaletadi/);
});

test("palet adı rengi level paletinden çözülür", () => {
  const t0 = ornekTanim();
  const ad = Object.keys(t0.palet)[0]!;
  const d = dunya([nesne("a", { bilesenler: [ISIK({ renk: ad })] })]);
  kareler(d, 2);
  assert.ok(ayniIsik(d, "a#i1"));
  assert.equal(d.gunluk.son(20, { kod: "AKT-ISK-002" }).length, 0, "palette olan ad hata değildir");
});

test("bayrak: `isik` bileşeni kapatılabilir (AKT-ZMN-002), kapalıyken ışık kurulmaz", () => {
  const d = dunya([nesne("a", { bilesenler: [ISIK()] })]);
  d.gunluk.kapat("isik", true);
  kareler(d, 4);
  assert.equal(ayniIsik(d, "a#i1"), null);
  assert.equal(d.gunluk.son(20, { kod: "AKT-ZMN-002" }).length, 1);
});

test("level kapanınca/yokEt: bütün bileşen ışıkları yok edilir", () => {
  const d = dunya([nesne("a", { bilesenler: [ISIK()] })]);
  kareler(d, 2);
  assert.equal(d.z.durum().isik, 1);
  d.z.yokEt();
  assert.equal(ayniIsik(d, "a#i1"), null);
  assert.equal(d.z.durum().isik, 0);
});

test("bileşen KİMLİĞİ değişince eski ışık yok edilir, yenisi kurulur (aynı aktörde)", () => {
  const d = dunya([nesne("a", { bilesenler: [ISIK({}, "eski")] })]);
  kareler(d, 2);
  assert.ok(ayniIsik(d, "a#eski"));
  tanimiDegistir(d, (t) => { t.nesneler = [nesne("a", { bilesenler: [ISIK({}, "yeni")] })]; });
  assert.equal(ayniIsik(d, "a#eski"), null, "eski kimlikli ışık gitti");
  assert.ok(ayniIsik(d, "a#yeni"), "yeni kimlikli ışık kuruldu");
  assert.equal(d.z.durum().isik, 1);
});

test("aktörün düğümü silinince ışık da gider ve SAYIMA GİRMEZ (yok edilmiş ışık hayalet olarak kalmaz)", () => {
  const d = dunya([nesne("a", { bilesenler: [ISIK()] })]);
  kareler(d, 2);
  assert.equal(d.z.durum().isik, 1);
  d.level.nesneler.dugum("a")!.dispose();   // düğüm silinir, altındaki bağlı ışık da yok edilir
  assert.equal(d.z.durum().isik, 0);
  assert.deepEqual(d.z.hataAyiklama().isiklar, []);
  kareler(d, 2);   // çalışma zamanı patlamadan sürer
  assert.equal(d.z.durum().isik, 0);
});

test("sıfırlama (yokEt/level değişimi) uyarı belleğini temizler: tavan sorunu yeni durumda yeniden bildirilir", () => {
  const aktorler = Array.from({ length: ISIK_TAVANI }, (_, i) => isikAktoru(`s${i}`));
  const d = dunya([nesne("a", { bilesenler: [ISIK()] })], aktorler);
  kareler(d, 4);
  assert.equal(d.gunluk.sayim().kodlar["AKT-ISK-001"], 1);
  d.z.yokEt();
  kareler(d, 4);
  assert.equal(d.gunluk.sayim().kodlar["AKT-ISK-001"], 2, "sıfırlamadan sonra aynı sorun yeniden bildirilir");
});
