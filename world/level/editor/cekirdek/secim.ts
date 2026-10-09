// world/level/editor/cekirdek/secim.ts — Seçim kümesi işlemleri. Saf.
//
// Seçim = nesne kimlikleri listesi (sıralı: SON eklenen "etkin" nesnedir — özellikler paneli ve hizalamanın
// referansı onu gösterir). Gizli ya da kilitli (kendisi veya grubu) nesne seçilemez.
"use strict";
import type { LevelTanimi } from "../../cekirdek/levelTanimi.ts";
import { etkinBayrak } from "../../cekirdek/grup.ts";

/** Tıklama kipi: yeni (düz tık), ekle (Shift), tersle (Ctrl: varsa çıkar, yoksa ekle). */
export type SecimKipi = "yeni" | "ekle" | "tersle";

/** Tıklama sonucu yeni seçim. `tiklanan` null = boşluğa tık (yeni kipte seçimi boşaltır, diğerlerinde dokunmaz). */
export function secimUygula(mevcut: readonly string[], tiklanan: readonly string[] | string | null, kip: SecimKipi): string[] {
  const yeni = tiklanan === null ? [] : typeof tiklanan === "string" ? [tiklanan] : [...tiklanan];
  if (kip === "yeni") return [...new Set(yeni)];
  if (kip === "ekle") return [...mevcut.filter((id) => !yeni.includes(id)), ...yeni];
  const hepsiVar = yeni.length > 0 && yeni.every((id) => mevcut.includes(id));
  return hepsiVar ? mevcut.filter((id) => !yeni.includes(id)) : [...mevcut.filter((id) => !yeni.includes(id)), ...yeni];
}

/** Nesne seçilebilir mi: var, gizli değil, kilitli değil (grubu dahil). */
export function secilebilir(t: LevelTanimi, id: string): boolean {
  const n = t.nesneler?.find((x) => x.id === id);
  const g = t.gruplar ?? [];
  return !!n && !etkinBayrak(n, g, "gizli") && !etkinBayrak(n, g, "kilitli");
}

/** Seçimi tanıma uydurur: silinmiş, gizlenmiş ya da kilitlenmiş nesneler düşer (geri al sonrası yanlış nesne kalmasın). */
export const secimiTemizle = (t: LevelTanimi, secim: readonly string[]): string[] => secim.filter((id) => secilebilir(t, id));

/** Ctrl+A: seçilebilir bütün nesneler. */
export const hepsiniSec = (t: LevelTanimi): string[] => (t.nesneler ?? []).filter((n) => n.id && secilebilir(t, n.id)).map((n) => n.id!);

/** Ekran dikdörtgeni (piksel). */
export interface Dikdortgen { x0: number; y0: number; x1: number; y1: number }

/**
 * Kutu seçimi: ekran izdüşümü kutunun içinde kalan kimlikler. `noktalar` sahneden gelir (nesne merkezinin ekran
 * konumu; kameranın arkasındakiler verilmez). Kutu hangi köşeden çekilirse çekilsin aynı.
 */
export function kutudakiler(noktalar: ReadonlyMap<string, readonly [number, number]>, k: Dikdortgen): string[] {
  const [xa, xb] = k.x0 < k.x1 ? [k.x0, k.x1] : [k.x1, k.x0];
  const [ya, yb] = k.y0 < k.y1 ? [k.y0, k.y1] : [k.y1, k.y0];
  return [...noktalar].filter(([, [x, y]]) => x >= xa && x <= xb && y >= ya && y <= yb).map(([id]) => id);
}
