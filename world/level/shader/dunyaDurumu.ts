// world/level/shader/dunyaDurumu.ts — Dünyanın ANLIK durumu: saat, güneş/ay, gece oranı, zamanda palet. Saf çekirdek.
//
// Neden: gün/gece ve özel shader'lar (spec 20) aynı birkaç sayıyı okur. Bu sayılar her karede değişebilir (zaman
// akarken); level tanımı ise yalnız BAŞLANGICI tutar (saat, hız). Böylece zaman akarken tanım yeniden kurulmaz:
// ışık sistemi ve shader'lar bu nesneyi okuyup uniform yazar (ucuz).
//
// Güneş yolu: 06:00 doğuda (+X) doğar, 12:00'de en yüksekte (eğimli yörünge: tam tepeye çıkmaz — gölge hep biraz
// yan düşsün), 18:00 batıda (−X) batar. Gece ay, güneşin karşısında. Saat 24'lük döngüdür (25 = 1).
"use strict";
import type { Vec3 } from "../cekirdek/levelTanimi.ts";
import { hex, karistir, type Renk } from "../cekirdek/renk.ts";

export interface ZamanAyari {
  /** Başlangıç saati (0–24). */
  saat: number;
  /** Oyun saati / gerçek saniye (0,1 → 4 dk'da bir saat; 24 sa ≈ 4 dk için 0,1). */
  hiz: number;
  /** Zaman kendiliğinden aksın mı. */
  akiyor: boolean;
  /** Güneş yörüngesinin dikeyden eğimi (derece): 0 = tam tepeye çıkar. */
  egim: number;
  /** Etkin dünya paleti (shader/paletler.ts dizini: 0 ova · 1 siberpunk · 2 ortaçağ · 3 büyü). */
  dunya: number;
}
export const ZAMAN_VARSAYILAN: ZamanAyari = { saat: 13, hiz: 0.1, akiyor: false, egim: 35, dunya: 0 };

export interface DunyaDurumu {
  saat: number;
  /** Gerçek geçen süre (sn) — titreşim/tarama gibi canlı efektler için. */
  sure: number;
  /** Güneşe doğru birim yön (gece ufkun altında). */
  gunesYonu: Vec3;
  /** Aya doğru birim yön (güneşin karşısı). */
  ayYonu: Vec3;
  /** 0 gece … 1 tam gündüz (güneş yüksekliğinden, yumuşak). */
  gunIsigi: number;
  /** 0 gündüz … 1 tam gece (gök ve palet haritası bunu okur). */
  gece: number;
  /** Alacakaranlık (şafak/akşam) payı 0…1: güneş ufka yakınken en yüksek. */
  alacakaranlik: number;
  /** Etkin dünya paletinin bu saatteki renkleri (gokZenit, gokUfuk, isik, dolgu, r0…r4). */
  palet: Record<string, Renk>;
  /** Etkin dünyanın zaman çizelgesi (başka saatin paleti gereken shader'lar için: zaman kırığı). */
  kareler: readonly PaletKaresi[];
}

export const dunyaDurumuYap = (): DunyaDurumu => ({
  saat: 13, sure: 0, gunesYonu: [0, 1, 0], ayYonu: [0, -1, 0], gunIsigi: 1, gece: 0, alacakaranlik: 0, palet: {}, kareler: [],
});

const yumusak = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Saati [0, 24) aralığına sarar. */
export const saatSar = (s: number) => ((s % 24) + 24) % 24;

/** Saat → güneşe doğru birim yön. */
export function gunesYonuSaatten(saat: number, egimDerece: number): Vec3 {
  const a = ((saatSar(saat) - 6) / 12) * Math.PI;           // 06 → 0, 12 → π/2, 18 → π
  const e = (egimDerece * Math.PI) / 180;
  const v: Vec3 = [Math.cos(a), Math.sin(a) * Math.cos(e), -Math.sin(a) * Math.sin(e)];
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Durumu saate göre doldurur (zaman akışı `zamanIlerle` ile). Saf: aynı saat → aynı durum. */
export function durumuSaateGoreYaz(d: DunyaDurumu, saat: number, egimDerece: number): void {
  d.saat = saatSar(saat);
  d.gunesYonu = gunesYonuSaatten(d.saat, egimDerece);
  d.ayYonu = [-d.gunesYonu[0], -d.gunesYonu[1], -d.gunesYonu[2]];
  const y = d.gunesYonu[1];
  d.gunIsigi = yumusak(-0.05, 0.25, y);
  d.gece = 1 - yumusak(-0.18, 0.04, y);
  d.alacakaranlik = 1 - yumusak(0, 0.22, Math.abs(y + 0.03));
}

/** Zaman akıyorsa saati ilerletir (dt gerçek saniye) ve paleti o saate göre yazar. */
export function zamanIlerle(d: DunyaDurumu, z: ZamanAyari, dt: number, kareler: readonly PaletKaresi[]): void {
  d.sure += dt;
  durumuSaateGoreYaz(d, z.akiyor ? d.saat + z.hiz * dt : d.saat, z.egim);
  d.kareler = kareler;
  d.palet = paletZamanda(kareler, d.saat);
}

/** Palet kare'si: bir saatte geçerli renkler (ad → "#rrggbb"). */
export interface PaletKaresi { saat: number; renkler: Readonly<Record<string, string>> }

/**
 * Zaman çizelgesindeki iki komşu kare arasında doğrusal ara değer (24 sa döngüsel). Karede olmayan ad bir öncekinden
 * gelir. Saf: test edilir.
 */
export function paletZamanda(kareler: readonly PaletKaresi[], saat: number): Record<string, Renk> {
  if (kareler.length === 0) return {};
  const s = saatSar(saat);
  const sirali = [...kareler].sort((a, b) => a.saat - b.saat);
  let sonraki = sirali.findIndex((k) => k.saat > s);
  if (sonraki === -1) sonraki = 0;
  const once = sirali[(sonraki - 1 + sirali.length) % sirali.length]!, sonra = sirali[sonraki]!;
  const aralik = saatSar(sonra.saat - once.saat) || 24;
  const t = saatSar(s - once.saat) / aralik;
  const sonuc: Record<string, Renk> = {};
  for (const ad of new Set([...Object.keys(once.renkler), ...Object.keys(sonra.renkler)])) {
    const a = once.renkler[ad] ?? sonra.renkler[ad]!, b = sonra.renkler[ad] ?? once.renkler[ad]!;
    sonuc[ad] = karistir(hex(a), hex(b), t);
  }
  return sonuc;
}
