// uygulama/sekans/editor/zamanEkseni.ts — SEKANS EDİTÖRÜNÜN ZAMAN EKSENİ MATEMATİĞİ (spec 36 S2): kare ↔ piksel, imleç merkezli yakınlaştırma, kaydırma,
// aralığa sığdırma, cetvel işaretleri, yaslama (snap) ve eksen kısıtı. SAF: DOM yok (çizim `uygulama/yapi/sekans/zamanCizelgesi.ts`; testler burada).
//
// Görünüm iki sayıdır: ekranda 0. karenin x'i ve ölçek (piksel/kare).   ekranX = kare · ölçek + x      kare = (ekranX − x) / ölçek
// Yakınlaştırma İMLEÇ MERKEZLİDİR (imlecin altındaki kare yerinde kalır): formül graf tuvalininkinin AYNISI (`uygulama/duzenleyici/tuvalMatematigi.ts`
// `yakinlastir`, kendi ölçek sınırlarıyla; yalnız yatay eksen) — kopya yok.
"use strict";
import { yakinlastir } from "../../duzenleyici/tuvalMatematigi.ts";
import { SEKANS_FPS } from "../../../protocol/sekans.ts";

export interface ZamanGorunumu { x: number; olcek: number }

/** Ölçek sınırları (piksel/kare): 0.5'te 60 sn ≈ 900 px (bütün sekans görünür), 40'ta tek kare 40 px (anahtar tek tek tutulur). */
export const ZAMAN_OLCEGI = { en: 0.5, cok: 40 } as const;
export const BASLANGIC_ZAMANI: Readonly<ZamanGorunumu> = { x: 16, olcek: 6 };

export const kareX = (g: ZamanGorunumu, kare: number): number => kare * g.olcek + g.x;
export const xKare = (g: ZamanGorunumu, x: number): number => (x - g.x) / g.olcek;
/** Ekrandaki x'in en yakın TAMSAYI karesi, [0, sure] içinde (zaman kare tabanlı: scrub hep bir kareye oturur). */
export const xTamKare = (g: ZamanGorunumu, x: number, sure: number): number => Math.max(0, Math.min(sure, Math.round(xKare(g, x))));

export const zamanKaydir = (g: ZamanGorunumu, dx: number): ZamanGorunumu => ({ x: g.x + dx, olcek: g.olcek });

/** İmleç merkezli yakınlaştırma (yalnız yatay): `imlecX`teki kare yakınlaşmadan sonra da imlecin altında kalır; ölçek ZAMAN_OLCEGI içinde. */
export function zamanYakinlastir(g: ZamanGorunumu, imlecX: number, carpan: number): ZamanGorunumu {
  const y = yakinlastir({ x: g.x, y: 0, olcek: g.olcek }, { x: imlecX, y: 0 }, carpan, ZAMAN_OLCEGI);
  return { x: y.x, olcek: y.olcek };
}

/** [bas, bit] aralığı `genislik` piksele `bosluk` kenarla sığar (ölçek sınırlı; sığmazsa sola yaslanır). */
export function araligaSigdir(bas: number, bit: number, genislik: number, bosluk = 24): ZamanGorunumu {
  const kare = Math.max(1, bit - bas);
  const olcek = Math.max(ZAMAN_OLCEGI.en, Math.min(ZAMAN_OLCEGI.cok, Math.max(1, genislik - 2 * bosluk) / kare));
  return { x: bosluk - bas * olcek, olcek };
}

/** Cetvel: büyük işaretler arası kare (etiketli) — en az 70 px aralık; küçük işaret bölüntüsü. Adımlar 30 fps'ye göre (1 sn = 30 kare). */
const ADIMLAR: readonly (readonly [buyuk: number, kucuk: number])[] = [[1, 1], [2, 1], [5, 1], [10, 2], [15, 3], [30, 5], [60, 10], [150, 30], [300, 60], [600, 150]];
export function cetvelAdimi(olcek: number): { buyuk: number; kucuk: number } {
  const [buyuk, kucuk] = ADIMLAR.find(([b]) => b * olcek >= 70) ?? ADIMLAR[ADIMLAR.length - 1]!;
  return { buyuk, kucuk };
}

export interface CetvelIsareti { kare: number; x: number; etiket: string | null }

/** Görünen [0, genislik] aralığındaki cetvel işaretleri (yalnız 0..sure kareleri). Etiket büyük işarette. */
export function cetvelIsaretleri(g: ZamanGorunumu, genislik: number, sure: number): CetvelIsareti[] {
  const { buyuk, kucuk } = cetvelAdimi(g.olcek);
  const ilk = Math.max(0, Math.floor(xKare(g, 0) / kucuk) * kucuk);
  const son = Math.min(sure, Math.ceil(xKare(g, genislik)));
  const l: CetvelIsareti[] = [];
  for (let k = ilk; k <= son && l.length < 2000; k += kucuk) l.push({ kare: k, x: kareX(g, k), etiket: k % buyuk === 0 ? sureYazisi(k) : null });
  return l;
}

/** "1,5 sn" (kare/30, en çok iki ondalık; Türkçe virgül). */
export function sureYazisi(kare: number): string {
  const s = Math.round((kare / SEKANS_FPS) * 100) / 100;
  return `${String(s).replace(".", ",")} sn`;
}

/** Playhead etiketi: "kare 45 · 1,5 sn". */
export const kareYazisi = (kare: number): string => `kare ${kare} · ${sureYazisi(kare)}`;

/**
 * YASLAMA (snap): açıkken ham kare en yakın tamsayıya ve `esikPx` piksel içindeki KOMŞUYA (başka anahtar, bölüm kenarı, playhead) yapışır; kapalıyken
 * yalnız tamsayıya (zaman kare tabanlı: yarım kare yok). En yakın komşu kazanır.
 */
export function kareyiYasla(ham: number, g: ZamanGorunumu, acik: boolean, komsular: readonly number[], esikPx = 6): number {
  const tam = Math.round(ham);
  if (!acik) return tam;
  let en: number | null = null;
  for (const k of komsular) if (Math.abs(k - ham) * g.olcek <= esikPx && (en === null || Math.abs(k - ham) < Math.abs(en - ham))) en = k;
  return en ?? tam;
}

/** Shift ile EKSEN KISITI: sürükleme baskın eksende kalır (yatay = zaman, dikey = değer). */
export function eksenKisiti(dx: number, dy: number, shift: boolean): { dx: number; dy: number } {
  if (!shift) return { dx, dy };
  return Math.abs(dx) >= Math.abs(dy) ? { dx, dy: 0 } : { dx: 0, dy };
}
