// uygulama/yapi/ortak/menuModeli.ts — MENÜ ÇUBUĞU MODELİ (spec 38 §6): Dosya/Düzen/Görünüm/… menülerinin ÇÖZÜMLÜ hâli. SAF: DOM yok.
//
// Editörlerin (Sekans, Graf) üst menüsü bir TABLODUR: menü adı + satırlar (etiket, kısayol, çalıştır, etkin mi, işaretli mi). Model satırları çizim anında
// çözer (etkin/işaretli durumu o an okunur) ve ayırıcıları DÜZELTİR: başta, sonda ve art arda ayırıcı çizilmez (boş kalan bir bölüm çizgi bırakmasın).
// Çizim ve tıklama `menuCubugu.ts`te; bir satırın İŞİ `calistir`dadır — güvenlik kuralı olan işler (sekans ▶) kendi `isTrusted` denetimini kendi
// işleyicisinde yapar, menü olayı iletir (`olay`), kendisi karar vermez.
"use strict";

export interface MenuOgesi {
  etiket: string;
  /** Yalnız GÖSTERİM metni ("Ctrl+S"); gerçek tuş işleyici editörün kendi kısayol tablosundadır (kopya tuş yok: gösterim ona bakar). */
  kisayol?: string;
  ipucu?: string;
  /** `olay`: gerçek tıklama olayı (programdan çağrıda null). */
  calistir(olay: MouseEvent | null): void;
  /** Yoksa her zaman etkin. */
  etkin?(): boolean;
  /** Varsa satırın başına ✓ konur (açık/kapalı seçenekler). */
  isaretli?(): boolean;
}

export const AYIRICI = "---" as const;
export type MenuSatiri = MenuOgesi | typeof AYIRICI;
export interface Menu { ad: string; satirlar: readonly MenuSatiri[] }

export type CozulenSatir =
  | { tur: "oge"; etiket: string; kisayol: string; ipucu: string; etkin: boolean; isaretli: boolean; oge: MenuOgesi }
  | { tur: "ayirici" };
export interface CozulenMenu { ad: string; satirlar: CozulenSatir[]; /** Etkin satır var mı (hepsi pasifse menü soluk çizilir). */ etkinVar: boolean }

/** Menüyü çizim anında çözer; ayırıcıları düzeltir. */
export function menuyuCoz(m: Menu): CozulenMenu {
  const l: CozulenSatir[] = [];
  for (const s of m.satirlar) {
    if (s === AYIRICI) { if (l.length && l[l.length - 1]!.tur !== "ayirici") l.push({ tur: "ayirici" }); continue; }
    l.push({ tur: "oge", etiket: s.etiket, kisayol: s.kisayol ?? "", ipucu: s.ipucu ?? "", etkin: s.etkin ? s.etkin() : true, isaretli: s.isaretli ? s.isaretli() : false, oge: s });
  }
  while (l.length && l[l.length - 1]!.tur === "ayirici") l.pop();
  return { ad: m.ad, satirlar: l, etkinVar: l.some((x) => x.tur === "oge" && x.etkin) };
}

/** Bir menü satırını çalıştırır: pasifse hiçbir şey yapmaz (dönüş false). */
export function menuSatiriniCalistir(s: CozulenSatir, olay: MouseEvent | null): boolean {
  if (s.tur !== "oge" || !s.etkin) return false;
  s.oge.calistir(olay);
  return true;
}
