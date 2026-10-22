// uygulama/graf/editor/tuvalMatematigi.ts — GÖRSEL EDİTÖRÜN TUVAL MATEMATİĞİ (spec 35 dilim 2b): dünya ↔ ekran dönüşümü, imleç merkezli yakınlaştırma,
// kaydırma, "sığdır" ve kutu seçimi. SAF: DOM yok (tuval katmanı `uygulama/yapi/graf/` bunu çağırır; testler burada).
//
// Dünya koordinatı = grafiğin `GrafDugumu.konum` birimi (piksel ölçek 1'de). Görünüm üç sayıdır: ekrandaki dünya başlangıcı (x, y) ve ölçek.
//   ekran = dünya · ölçek + (x, y)        dünya = (ekran − (x, y)) / ölçek
// Yakınlaştırma İMLEÇ MERKEZLİDİR: imlecin altındaki dünya noktası yakınlaşmadan sonra da imlecin altında kalır (Blueprint/Figma hissi; aksi hâlde
// tekerlek her dönüşte grafiği köşeye kaçırır). Ölçek tavanlı: çok küçükte yazı okunmaz, çok büyükte tek düğüm ekranı doldurur.
"use strict";

export interface Nokta { x: number; y: number }
/** Dünya ya da ekran kutusu: sol üst köşe, genişlik (g), yükseklik (h). */
export interface Kutu { x: number; y: number; g: number; h: number }
export interface Gorunum { x: number; y: number; olcek: number }

export const OLCEK_EN = 0.25;
export const OLCEK_COK = 2;
export const BASLANGIC_GORUNUMU: Readonly<Gorunum> = { x: 40, y: 40, olcek: 1 };

const sinirla = (v: number, en: number, cok: number) => Math.min(cok, Math.max(en, v));

export const dunyadanEkrana = (g: Gorunum, p: Nokta): Nokta => ({ x: p.x * g.olcek + g.x, y: p.y * g.olcek + g.y });
export const ekrandanDunyaya = (g: Gorunum, p: Nokta): Nokta => ({ x: (p.x - g.x) / g.olcek, y: (p.y - g.y) / g.olcek });

/** Ekranda (dx, dy) piksel kaydırma (arka planı sürükleme, orta tuş). */
export const kaydir = (g: Gorunum, dx: number, dy: number): Gorunum => ({ x: g.x + dx, y: g.y + dy, olcek: g.olcek });

/**
 * `carpan` kadar yakınlaştırır (>1 yakın, <1 uzak); `imlec` (ekran) noktasının altındaki dünya noktası SABİT kalır. Ölçek [OLCEK_EN, OLCEK_COK]
 * dışına çıkmaz (sınıra dayanınca sabit nokta yine korunur: etkin çarpan küçülür).
 */
export function yakinlastir(g: Gorunum, imlec: Nokta, carpan: number): Gorunum {
  if (!Number.isFinite(carpan) || carpan <= 0) return g;
  const olcek = sinirla(g.olcek * carpan, OLCEK_EN, OLCEK_COK);
  const d = ekrandanDunyaya(g, imlec);
  return { x: imlec.x - d.x * olcek, y: imlec.y - d.y * olcek, olcek };
}

/** Tekerlek adımı → çarpan (deltaY > 0 uzaklaştırır). Fare tekerleği ~100, dokunmatik yüzey küçük adımlar verir: üstel, ikisinde de yumuşak. */
export const tekerlekCarpani = (deltaY: number): number => Math.exp(-sinirla(deltaY, -300, 300) * 0.0015);

/** Kutuların birleşimi (boşsa null). */
export function kutulariBirlestir(kutular: readonly Kutu[]): Kutu | null {
  if (!kutular.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const k of kutular) { x1 = Math.min(x1, k.x); y1 = Math.min(y1, k.y); x2 = Math.max(x2, k.x + k.g); y2 = Math.max(y2, k.y + k.h); }
  return { x: x1, y: y1, g: x2 - x1, h: y2 - y1 };
}

/**
 * "Sığdır" (F): kutuların hepsi `ekran` boyutuna `bosluk` piksel kenarla sığar ve ortalanır. Ölçek 1'i GEÇMEZ (küçük grafik büyütülüp şişmesin) ve
 * OLCEK_EN'in altına inmez (çok büyük grafik okunmaz olmasın: o zaman sol üstten başlar, kaydırılır). Kutu yoksa başlangıç görünümü.
 */
export function sigdir(kutular: readonly Kutu[], ekran: { g: number; h: number }, bosluk = 48): Gorunum {
  const b = kutulariBirlestir(kutular);
  if (!b || ekran.g <= 0 || ekran.h <= 0) return { ...BASLANGIC_GORUNUMU };
  const kullanilir = { g: Math.max(1, ekran.g - 2 * bosluk), h: Math.max(1, ekran.h - 2 * bosluk) };
  const olcek = sinirla(Math.min(kullanilir.g / Math.max(1, b.g), kullanilir.h / Math.max(1, b.h), 1), OLCEK_EN, 1);
  const x = (ekran.g - b.g * olcek) / 2 - b.x * olcek;
  const y = (ekran.h - b.h * olcek) / 2 - b.y * olcek;
  // Sığmıyorsa (ölçek tabanda) ortalamak sol üstü ekran dışına iterdi: sol üst kenara yasla.
  if (b.g * olcek > ekran.g - 2 * bosluk || b.h * olcek > ekran.h - 2 * bosluk) return { x: bosluk - b.x * olcek, y: bosluk - b.y * olcek, olcek };
  return { x, y, olcek };
}

/** İki köşeden (sürükleme başlangıcı ve şimdi, herhangi bir yönde) kutu. */
export const koselerdenKutu = (a: Nokta, b: Nokta): Kutu => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), g: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

/** Kutu seçimi: düğüm kutusu seçim kutusuyla KESİŞİRSE seçilir (tamamen içinde olması gerekmez; Blueprint gibi). */
export const kutularKesisir = (a: Kutu, b: Kutu): boolean => a.x < b.x + b.g && b.x < a.x + a.g && a.y < b.y + b.h && b.y < a.y + a.h;

/** Izgara adımı (dünya birimi) ve ızgaraya yaslama (sürükleme bırakılınca düzgün dizilsin; Shift ile serbest). */
export const IZGARA = 20;
export const izgarayaYasla = (v: number, adim = IZGARA): number => Math.round(v / adim) * adim;
