// mind/calismaBellegi.ts — ŞU ANKİ durum. Anı değil.
//
// Spec 06 K2. "Önümde ne var" dünya değişince YANLIŞA döner: Orion iki adım
// atınca o cümle artık doğru değildir. Böyle bilgi epizodik hafızaya
// yazılmamalı — yazıldığı için Orion dünkü gözlemini bugün anlatıyordu
// (spec 06 §1, ölçüldü).
//
// Bu yüzden iki kural:
//   ÜZERİNE YAZILIR — aynı anahtarın yeni gözlemi eskisini siler, biriktirmez.
//   ESKİR          — azami yaşı geçen gözlem okunmaz; "son görülen konum"
//                    sonsuza kadar doğru değildir (oyun motorlarının algı
//                    sistemlerindeki uyaran yaşı).
//
// Bağımlılık: yalnızca protokolün etiket haritası (iç ad → Türkçe).
"use strict";
import { SORU_ETIKETI } from "../protocol/algi.ts";

export interface CalismaAyari {
  /** Bu yaşı geçen gözlem okunmaz. */
  azamiYasMs?: number;
  simdi?: () => number;
}

export interface Gozlem {
  anahtar: string;
  deger: string;
  yasMs: number;
}

export interface CalismaBellegi {
  yaz(anahtar: string, deger: string): void;
  /** Süresi dolmamış gözlemler, en yeniden eskiye. */
  oku(): Gozlem[];
  /** Beyne giden ŞİMDİ satırları. Boşsa boş dizi. */
  satirlar(): string[];
  unut(anahtar: string): void;
}

export function calismaBellegiKur(ayar: CalismaAyari = {}): CalismaBellegi {
  const azamiYas = ayar.azamiYasMs ?? 30_000;
  const simdi = ayar.simdi ?? (() => Date.now());
  const kayit = new Map<string, { deger: string; an: number }>();

  const taze = (): Gozlem[] => {
    const t = simdi();
    const cikti: Gozlem[] = [];
    for (const [anahtar, g] of kayit) {
      const yasMs = t - g.an;
      if (yasMs > azamiYas) kayit.delete(anahtar);       // okurken temizle
      else cikti.push({ anahtar, deger: g.deger, yasMs });
    }
    return cikti.sort((a, b) => a.yasMs - b.yasMs);
  };

  return {
    yaz(anahtar, deger) { kayit.set(anahtar, { deger, an: simdi() }); },
    oku: taze,
    unut(anahtar) { kayit.delete(anahtar); },
    satirlar() {
      // Yaş HER SATIRDA yazılır: model "3 sn önce" ile "25 sn önce" arasındaki
      // farkı ancak söylenirse bilebilir (spec 06 K3).
      return taze().map((g) =>
        `${SORU_ETIKETI[g.anahtar] ?? g.anahtar}: ${g.deger} (${Math.round(g.yasMs / 1000)} sn önce baktın)`);
    },
  };
}
