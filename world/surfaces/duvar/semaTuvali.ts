// world/surfaces/duvar/semaTuvali.ts — MESH'SİZ ŞEMA: bir ajanın zihin akışı, duvarsız (spec 33, Yapı çubuğu · Zihin sekmesi).
//
// Duvardaki `semaKur` (sema.ts) bir mesh'e, dinamik dokuya ve devre panosuna bağlı: Orion'un tek zihin duvarı. Flash'ın (ve ileride başka
// ajanların) duvarı yok; zihin haritası yalnız Yapı çubuğunun 2B tuvalinde görünür. Bu dosya o yüzden YALNIZ durum + çizim taşır:
// aynı çekirdek (`semaCekirdek.ts`: durum, parıltı, yerleşim) ve aynı çizim (`cizSema`), kendi şema tanımıyla. Kopya çizim yok.
// `semaKur` DEĞİŞMEDİ: duvardaki Orion şeması bugünkü gibi çalışır.
//
// Detay görünümü YOK (bilerek): duvardaki detay devre panosunu ve Orion'un düğüm tanımlarını okur. Burada tıklama bir şey seçmez
// (`tikla` false, `hedef` null) — sekme bunu "salt izlenir" diye söyler. Gerekirse ayrı iş.
//
// Bağımlılık sınırı (K4): kardeş yüzey modülleri.
"use strict";
import type { YuzeyOlcusu } from "../yuzeyStil.ts";
import { semaDurumuKur, type DugumDurumu, type SemaTanimi } from "./semaCekirdek.ts";
import { cizSema } from "./semaCizim.ts";

export interface SemaTuvali {
  readonly tanim: SemaTanimi;
  vur(ad: string, not?: string): void;
  not(ad: string, metin: string): void;
  ariza(ad: string, arizali: boolean, not?: string): void;
  durumYaz(metin: string): void;
  oku(ad: string): DugumDurumu;
  ciz(bag: CanvasRenderingContext2D): void;
  olcu(): YuzeyOlcusu;
  /** Tıklama hiçbir şey seçmez (detay yok): her zaman false. */
  tikla(u: number, v: number): boolean;
  hedef(u: number, v: number): string | null;
  secili(): string | null;
  sec(ad: string | null): void;
}

export function semaTuvaliKur(a: { tanim: SemaTanimi; olcu: YuzeyOlcusu }): SemaTuvali {
  const durum = semaDurumuKur();
  let altDurum = "";
  return {
    tanim: a.tanim,
    vur(ad, not) { durum.vur(ad, not); },
    not(ad, metin) { durum.notYaz(ad, metin); },
    ariza(ad, arizali, not) { durum.ariza(ad, arizali, not); },
    durumYaz(metin) { altDurum = metin.replace(/\s+/g, " ").trim(); },
    oku: (ad) => durum.oku(ad),
    ciz(bag) { cizSema(bag, a.olcu, { durum, altDurum, simdi: Date.now(), tanim: a.tanim }); },
    olcu: () => a.olcu,
    tikla: () => false,
    hedef: () => null,
    secili: () => null,
    sec: () => {},
  };
}
