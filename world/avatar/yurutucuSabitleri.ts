// world/avatar/yurutucu.ts'ten ayrıldı (kalite turu, 2026-11-01; davranış AYNI): yürütücünün ÖLÇÜLERİ, HIZLARI ve küçük SAF yardımcıları.
// Sayılar `protocol/bedenTanimi.ts` künyesinden gelir; adlar `yurutucu.ts`'ten yeniden dışa verilir (`yurutucu.test.ts` oradan import eder).
"use strict";
import type { Poz } from "../../protocol/niyet.ts";
import { BEDEN } from "../../protocol/bedenTanimi.ts";
import { SANDALYE } from "../level/olculer.ts";
import { AVATAR_YARICAP } from "./yolBulma.ts";

// ── Ölçüler ve hızlar ──────────────────────────────────────────────────────
//
// Sayılar artık BURADA DEĞİL: `protocol/bedenTanimi.ts` künyesinden geliyor.
// Aynı gövdenin ölçüleri üç dosyada üç kez yaşıyordu (burası, `prosedurel.ts`,
// `mind/algiHizmeti.ts`) ve VRM iskeleti hiçbirini paylaşmıyordu.
//
// Adlar dışa verilmeye DEVAM EDİYOR: `yurutucu.test.ts` sınırları buradan
// import ediyor ve testin künyeyi değil DAVRANIŞI sınaması doğru — sınır
// künyede değişirse test yine gerçek sınırı görür.

/** Yürüme hızı (m/s). Sakin, ofis içi tempo. */
export const YURUME_HIZI = BEDEN.hareket.yurumeHizi;
/** Koşma hızı (m/s). Uzun mesafede kendiliğinden devreye girer. */
export const KOSMA_HIZI = BEDEN.hareket.kosmaHizi;
/** Kalan yol bundan uzunsa avatar koşar. 10×8 m odada nadiren aşılır. */
export const KOSMA_ESIGI = BEDEN.hareket.kosmaEsigi;
/** Gövde dönüş hızı (rad/s). */
export const GOVDE_DONME_HIZI = BEDEN.eklem.govdeYaw.aciHiz;
/** Baş dönüş hızı (rad/s) — gövdeden hızlı, insan böyle. */
export const BAS_DONME_HIZI = BEDEN.eklem.basYaw.aciHiz;
/** İvme (m/s²) — aktüatör doyumu; hız azami değere sıçramaz. */
export const IVME = BEDEN.hareket.ivme;
/** Frenleme (m/s²) — durmak hızlanmaktan hızlı. */
export const FREN = BEDEN.hareket.fren;

/** İnsan boyun sınırı, yaw. Aşılırsa GÖVDE döner — donuk kafa dönüşü yok. */
export const BOYUN_YAW_SINIRI = BEDEN.eklem.basYaw.sinir;
/** İnsan boyun sınırı, pitch. Aşılamaz; gövde pitch'i telafi etmez. */
export const BOYUN_PITCH_SINIRI = BEDEN.eklem.basPitch.sinir;

/** `git {tip:"nokta"}` için varsayılan varış toleransı. */
export const NOKTA_TOLERANSI = 0.25;
/** Ara noktanın "geçildi" sayılma yarıçapı. */
export const ARA_NOKTA_TOLERANSI = 0.02;
/** Bir `git`/`otur` işi bu süreyi aşarsa `hata` yayılır. Sonsuz döngü kalkanı. */
export const IS_ZAMAN_ASIMI = 20;

export const OTURMA_SURESI = 0.8;
export const KALKMA_SURESI = 0.7;
export const JEST_SURESI = 1.1;

/** Baş yüksekliği (ayak hizasından). Bakış açısı buradan hesaplanır. */
export const BAS_YUKSEKLIGI = BEDEN.basYuksekligi;
/** Bir yürüme adımının uzunluğu — yürüme fazı buradan türer. */
export const ADIM_UZUNLUGU = BEDEN.adimUzunlugu;

/**
 * Otururken kök, oturma yüzeyinin bu kadar (m) ALTINDA kalır: bacaklar bükülür, kalça yüzeye oturur. Kökün mutlak y'si = çapanın oturma yüzeyi − bu pay
 * (`capa.konum.y - OTURMA_KALCA_PAYI`): sandalye 0,46 → 0,16; terastaki bank 0,40 → 0,10.
 */
export const OTURMA_KALCA_PAYI = 0.30;
/** Sandalyeye oturunca kökün yükselmesi (geriye dönük dışa aktarım; yürütücü çapadan hesaplar). */
export const OTURMA_YUKSELMESI = SANDALYE.oturma - OTURMA_KALCA_PAYI;

/**
 * Sandalyeye YANDAN, sırtı dönük oturulur; oturunca döner sandalye masaya
 * çevrilir (2026-09-26).
 *
 * NEDEN. Eskiden kök masa/monitör durağından (z=-1.62) oturma noktasına
 * düz ileri kayıyordu: sandalyenin SIRTLIĞININ içinden, yüzü masaya dönük,
 * ~0.9 m. Prosedürel robotta göze batmıyordu; iskeletli low-poly bedende
 * `otur` klibi kökün 0.45 m GERİ gittiğini varsayıp ayakları buna göre
 * telafi ediyor. Canlı ölçüm (deneme `?kamera=yan`): kök 0.93 m İLERİ gitti,
 * ayaklar masanın altına ~1.4 m kaydı.
 *
 * Önden oturmak mümkün değil: oturağın ön kenarı ile masa kenarı arası
 * 0.215 m — ayakta durulacak yer yok. Sandalyenin kolçağı yok (`sandalye_kol`
 * tabanın yıldız kolları), yani YANDAN yaklaşılabilir: yana gel, arkanı dön,
 * geri otur, sonra sandalyeyle masaya dön. Gerçek bir döner sandalyede de
 * böyle oturulur.
 *
 * `OTURMA_ADIMI` klipteki telafiyle AYNI olmalı (assets/orion-lowpoly.glb
 * `otur`/`kalk`: ayakta bilek → oturmuş bilek = 0.453 m). Değişirse klip
 * yeniden bake edilir; biri değişip öteki değişmezse ayak kayar.
 */
export const OTURMA_ADIMI = 0.45;
/**
 * Yol bulmanın gidebildiği en yakın yanaşma noktasının oturma noktasına uzaklığı: oturağın yanaşma yönündeki yarı boyu + avatar yarıçapı. Oturma yeri
 * (0.45) bunun İÇİNDE kalır — çarpışma yarıçapı omuz genişliğine göre cömert, oturak ise diz hizasında. Son kısmı `_yoluKur` düz bir adım olarak
 * ekler. Sandalye için yarı boy genişlik/2: eski sabitle birebir aynı.
 */
export const yanasmaUzakligi = (yariBoy: number): number => yariBoy + AVATAR_YARICAP + 0.02;
/** Oturma yerine varış eşiği — klibin varsaydığı mesafeyi bozmayacak kadar sıkı. */
export const OTURMA_YERI_TOLERANSI = 0.03;

/** `poz` niyetiyle doğrudan girilebilen pozlar. Diğerleri kendi niyetini ister. */
export const SERBEST_POZLAR: readonly Poz[] = ["duruyor", "eğiliyor", "yatıyor", "bakıyor"];

// ── Yardımcılar ────────────────────────────────────────────────────────────

/** Açıyı (-π, π] aralığına sarar. */
export function aciSar(a: number): number {
  let x = (a + Math.PI) % (Math.PI * 2);
  if (x < 0) x += Math.PI * 2;
  return x - Math.PI;
}

export function kis(v: number, alt: number, ust: number): number {
  return v < alt ? alt : v > ust ? ust : v;
}

/** `a`dan `b`ye en fazla `azami` kadar yaklaş (açı sarmalı). */
export function aciYaklas(a: number, b: number, azami: number): number {
  const fark = aciSar(b - a);
  if (Math.abs(fark) <= azami) return aciSar(b);
  return aciSar(a + Math.sign(fark) * azami);
}

/** Babylon sol-elli yaw: ileri = (sin ψ, 0, cos ψ). */
export function yonYaw(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}
