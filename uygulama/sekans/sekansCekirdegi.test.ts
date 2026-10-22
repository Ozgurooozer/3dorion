// uygulama/sekans/sekansCekirdegi.test.ts — sekansın başsız çekirdeği (spec 36 S1): değerlendirme (durumsuz scrub, klip bölümü, ofset, gizli, toplama,
// eksik klip), derleme (her karede değerlendirmeyle AYNI, döngü turu, sıkıştırma), geçici klip katmanı. Klipler repodaki GERÇEK dosyalar.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sekansDogrula, type Sekans } from "../../protocol/sekans.ts";
import type { AnimasyonKlibi } from "../../protocol/animasyon.ts";
import { klipKutuphanesiKur, klipleriYukle } from "../../world/avatar/klipKutuphanesi.ts";
import { klipOrnekle } from "../../world/avatar/klipOrnekleyici.ts";
import { degerlendir, eksikKlipler } from "./degerlendir.ts";
import { anahtarlariSikistir, oynatmaKareleri, sekansiDerle } from "./derleyici.ts";
import { GECICI_AZAMI, GECICI_ONEK, geciciKlipKatmaniKur } from "./geciciKlipler.ts";

const kutuphane = klipKutuphanesiKur();
const yuklendi = klipleriYukle((yol) => readFile(new URL(`../../assets/${yol}`, import.meta.url), "utf8")).then((r) => kutuphane.doldur(r.klipler, r.hatalar));

/** Doğrulanmış sekans (test girdisi de biçimden geçer: bozuk örnekle yanlış yeşil olmasın). */
function sekans(izler: unknown[], ek: Record<string, unknown> = {}): Sekans {
  const r = sekansDogrula({ surum: 1, ad: "t", fps: 30, sure_kare: 120, baglamalar: [{ id: "b1", ajan: "orion" }], izler, ...ek });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
}
const basIzi = (anahtarlar: unknown[], ek: Record<string, unknown> = {}) => ({ id: "bas", baglama: "b1", tur: "uzuv", uzuv: "bas", kanal: "donme_x", anahtarlar, ...ek });
const klipIzi = (bolumler: unknown[], ek: Record<string, unknown> = {}) => ({ id: "k", baglama: "b1", tur: "klip", bolumler, ...ek });
const deger = (s: Sekans, kare: number, uzuv: string, kanal: string) => degerlendir(s, kare, kutuphane).degerler.find((d) => d.uzuv === uzuv && d.kanal === kanal)?.deger ?? null;
const klip = (ad: string): AnimasyonKlibi => kutuphane.bul(ad)!;

test("uzuv izi: anahtarlar arası klibin kuralıyla (doğrusal yarıda yarı değer; ilk anahtardan önce ilk, sondan sonra son değer)", async () => {
  await yuklendi;
  const s = sekans([basIzi([{ kare: 10, deger: 0 }, { kare: 40, deger: 12 }])]);
  assert.deepEqual([deger(s, 0, "bas", "donme_x"), deger(s, 25, "bas", "donme_x"), deger(s, 100, "bas", "donme_x")], [0, 6, 12]);
});

test("DURUMSUZ: kareleri karışık sırayla değerlendirmek sıralı değerlendirmeyle AYNI sonucu verir (scrub/geri sarma)", async () => {
  await yuklendi;
  const s = sekans([basIzi([{ kare: 0, deger: 0, yumusatma: "yumusak" }, { kare: 60, deger: 20 }]), klipIzi([{ klip: "el_salla", baslangic_kare: 5, uzunluk_kare: 72 }])]);
  const kareler = Array.from({ length: 121 }, (_, i) => i);
  const sirali = kareler.map((k) => degerlendir(s, k, kutuphane));
  const karisik = [...kareler].reverse().map((k) => [k, degerlendir(s, k, kutuphane)] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  assert.deepEqual(karisik, sirali);
});

test("klip bölümü: bölüm içinde klibin kendi örneklemesi (bölüm başından geçen süre), bölüm dışında katkı YOK", async () => {
  await yuklendi;
  const s = sekans([klipIzi([{ klip: "el_salla", baslangic_kare: 30, uzunluk_kare: 72 }])]);
  const beklenen = klipOrnekle(klip("el_salla"), 15 / 30).find((d) => d.uzuv === "sag_kol" && d.kanal === "donme_z")!.deger;
  assert.deepEqual([deger(s, 45, "sag_kol", "donme_z"), deger(s, 29, "sag_kol", "donme_z"), deger(s, 102, "sag_kol", "donme_z")], [beklenen, null, null]);
});

test("bölüm ofseti (kırpılmış baş): bölümün ilk karesi klibin ofset anı", async () => {
  await yuklendi;
  const s = sekans([klipIzi([{ klip: "el_salla", baslangic_kare: 30, uzunluk_kare: 30, ofset_kare: 15 }])]);
  const beklenen = klipOrnekle(klip("el_salla"), 0.5).find((d) => d.uzuv === "sag_kol" && d.kanal === "donme_z")!.deger;
  assert.equal(deger(s, 30, "sag_kol", "donme_z"), beklenen);
});

test("gizli iz değerlendirilmez", async () => {
  await yuklendi;
  const s = sekans([basIzi([{ kare: 0, deger: 30 }], { gizli: true })]);
  assert.deepEqual(degerlendir(s, 10, kutuphane).degerler, []);
});

test("KATMANLAMA: klip bölümü + aynı kanaldaki uzuv izi TOPLANIR", async () => {
  await yuklendi;
  const s = sekans([klipIzi([{ klip: "basla_onayla", baslangic_kare: 0, uzunluk_kare: 36 }]), basIzi([{ kare: 0, deger: 5 }])]);
  const klipte = klipOrnekle(klip("basla_onayla"), 6 / 30).find((d) => d.uzuv === "bas" && d.kanal === "donme_x")!.deger;
  assert.equal(deger(s, 6, "bas", "donme_x"), klipte + 5);
});

test("toplam klibin tavanına KISILIR (±180°): el_salla'nın 130°'si + elle 170° → 180", async () => {
  await yuklendi;
  // Aynı bağlamada aynı uzuv kanalı iki uzuv izi biçimce yasak; tavan klip + iz toplamıyla sınanır (el_salla 0.45–1.95 sn'de sag_kol.donme_z = 130).
  const t = sekans([klipIzi([{ klip: "el_salla", baslangic_kare: 0, uzunluk_kare: 72 }]), { id: "kol", baglama: "b1", tur: "uzuv", uzuv: "sag_kol", kanal: "donme_z", anahtarlar: [{ kare: 0, deger: 170 }] }]);
  assert.equal(deger(t, 30, "sag_kol", "donme_z"), 180);
});

test("kütüphanede olmayan klip: katkı yok ve adı NEDEN olarak listelenir (sessiz yutma yok)", async () => {
  await yuklendi;
  const s = sekans([klipIzi([{ klip: "yok_boyle", baslangic_kare: 0, uzunluk_kare: 30 }])]);
  assert.deepEqual([degerlendir(s, 5, kutuphane), eksikKlipler(s, kutuphane)], [{ degerler: [], eksikKlipler: ["yok_boyle"] }, ["yok_boyle"]]);
});

test("oynatma kareleri: döngüsüzde başlangıçtan sona (son dahil); başlangıç sonda/dışarıdaysa aralığın başından", () => {
  assert.deepEqual([oynatmaKareleri({ bas: 0, bit: 4 }, 2, false).kareler, oynatmaKareleri({ bas: 0, bit: 4 }, 4, false).kareler], [[2, 3, 4], [0, 1, 2, 3, 4]]);
});

test("oynatma kareleri: DÖNGÜDE döndürülmüş tek tur + kapanış (2,3,0,1,2); süre aralığın süresi", () => {
  const p = oynatmaKareleri({ bas: 0, bit: 4 }, 2, true);
  assert.deepEqual([p.kareler, p.sure, p.dongu], [[2, 3, 0, 1, 2], 4 / 30, true]);
});

test("sıkıştırma: sabit ve doğrusal kısımlar iki anahtara iner, kırılma noktası korunur", () => {
  assert.deepEqual(anahtarlariSikistir([0, 1, 2, 3, 3, 3]).map((a) => [a.t * 30, a.deger]), [[0, 0], [3, 3], [5, 3]]);
});

/** Derlenmiş klibi plandaki her karede örnekler ve değerlendirmeyle en büyük farkı döner. */
function enBuyukFark(s: Sekans, baslangic: number, dongu: boolean): number {
  const d = sekansiDerle(s, kutuphane, baslangic, dongu, (b) => `${GECICI_ONEK}t_${b}`);
  const k = d.klipler[0]!.klip;
  let fark = 0;
  // Döngüde son eleman tur kapanışıdır (t = süre → sarınca 0): yalnız turun içi örneklenir.
  const kareler = dongu ? d.plan.kareler.slice(0, -1) : d.plan.kareler;
  for (const [i, kare] of kareler.entries()) {
    const ornek = klipOrnekle(k, i / 30);
    for (const e of degerlendir(s, kare, kutuphane).degerler) fark = Math.max(fark, Math.abs((ornek.find((o) => o.uzuv === e.uzuv && o.kanal === e.kanal)?.deger ?? 0) - e.deger));
  }
  return fark;
}

test("DERLEME = DEĞERLENDİRME: derlenmiş klip plandaki HER karede değerlendirmeyle aynı (fark < 1e-6) — ortadan başlayan döngüsüz oynatma", async () => {
  await yuklendi;
  const s = sekans([klipIzi([{ klip: "el_salla", baslangic_kare: 10, uzunluk_kare: 72 }]), basIzi([{ kare: 0, deger: 0, yumusatma: "yumusak" }, { kare: 90, deger: 15 }])]);
  assert.ok(enBuyukFark(s, 37, false) < 1e-6);
});

test("DERLEME = DEĞERLENDİRME: döndürülmüş DÖNGÜ turunda da her karede aynı", async () => {
  await yuklendi;
  const s = sekans([klipIzi([{ klip: "dusun", baslangic_kare: 0, uzunluk_kare: 90 }]), basIzi([{ kare: 0, deger: 0 }, { kare: 100, deger: -10 }])], { aralik: { bas: 20, bit: 110 } });
  assert.ok(enBuyukFark(s, 64, true) < 1e-6);
});

test("derleme: hiç hareket etmeyen bağlama klip ALMAZ (bos listesinde)", async () => {
  await yuklendi;
  const s = sekans([basIzi([{ kare: 0, deger: 0 }, { kare: 30, deger: 0 }])]);
  const d = sekansiDerle(s, kutuphane, 0, false, (b) => `${GECICI_ONEK}${b}`);
  assert.deepEqual([d.klipler.length, d.bos], [0, ["b1"]]);
});

test("geçici katman: önekli ad YALNIZ katmandan çözülür (kütüphaneden asla), adlar() yalnız kütüphanenin", async () => {
  await yuklendi;
  const taban = { bul: (ad: string) => (ad === `${GECICI_ONEK}sahte` ? klip("dusun") : kutuphane.bul(ad)), adlar: () => kutuphane.adlar() };
  const k = geciciKlipKatmaniKur(taban);
  assert.deepEqual([k.bul(`${GECICI_ONEK}sahte`), k.bul("dusun")?.ad, k.adlar().some((a) => a.startsWith(GECICI_ONEK))], [null, "dusun", false]);
});

test(`geçici katman: önek zorunlu, aynı ad iki kez yok, en çok ${GECICI_AZAMI} kayıt`, async () => {
  await yuklendi;
  const k = geciciKlipKatmaniKur(kutuphane);
  const yeni = (ad: string): AnimasyonKlibi => ({ ...klip("dusun"), ad });
  const sonuclar = [k.ekle(yeni("dusun2")).ok, k.ekle(yeni(`${GECICI_ONEK}a`)).ok, k.ekle(yeni(`${GECICI_ONEK}a`)).ok];
  for (let i = 1; i < GECICI_AZAMI; i++) k.ekle(yeni(`${GECICI_ONEK}x${i}`));
  assert.deepEqual([...sonuclar, k.ekle(yeni(`${GECICI_ONEK}fazla`)).ok, k.sayi()], [false, true, false, false, GECICI_AZAMI]);
});
