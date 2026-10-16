// uygulama/nesneEtkilesimi.ts — MENÜDEN EYLEM (spec 28): panelde bir düğmeye basılınca ne olur. İnce kompozisyon; yeni eylem yolu AÇMAZ.
//
// "Orion yapsın" → eylemin `Niyet`i TEK eylem yolundan (`niyetiYurut`: yakınlık kuralı, onay kapısı, kısaltma) geçer; "ben yapayım" → oyuncunun KENDİ
// etkileşimi (`Oyuncu.etkilesimBaslat`, `F` ile aynı olay yolu: oturma, odaklanma). Gri (uygun değil) bir eylem çalıştırılmaz ve NEDEN altyazıda söylenir:
// panel zaten düğmeyi kapatır, bu ikinci savunma (menü bayatlamış olabilir).
"use strict";
import type { Niyet } from "../protocol/niyet.ts";
import type { NesneEylemi } from "../world/yer/nesneEylemleri.ts";
import type { SeciliNesne } from "../mind/komutSozlugu.ts";

export interface NesneEtkilesimiAyari {
  niyetiYurut: (n: Niyet, id: string) => void;
  /** Oyuncunun kendi etkileşimini başlat (çapa adı, eylem); başarı. */
  oyuncuEtkilesim: (capa: string, eylem: string) => boolean;
  altyazi: (metin: string, ms?: number) => void;
}

export function nesneEtkilesimiKur(a: NesneEtkilesimiAyari): { calistir(e: NesneEylemi): void } {
  let sayac = 0;
  return {
    calistir(e) {
      if (!e.uygun) { a.altyazi(`${e.ad}: ${e.neden ?? "şu an yapılamaz"}`, 3000); return; }
      if (e.kim === "orion") {
        if (!e.niyet) { a.altyazi(`${e.ad}: niyet yok`, 2500); return; }
        a.niyetiYurut(e.niyet, `menu_${++sayac}_${e.kimlik}`);
        a.altyazi(`Orion'a: ${e.ad}`, 1800);
        return;
      }
      if (!e.etkilesim || !a.oyuncuEtkilesim(e.etkilesim.capa, e.etkilesim.eylem)) a.altyazi(`${e.ad}: şu an yapılamıyor (yaklaş ya da başka bir etkileşim açık)`, 3000);
    },
  };
}

/** Menüdeki ORION eylemlerinden söz sözlüğünün görünümü (`SeciliNesne`): "buraya otur" ile menüdeki "Otur" AYNI veriden beslenir (spec 28). */
export function seciliSozOlustur(ad: string, eylemler: readonly NesneEylemi[]): SeciliNesne {
  return {
    ad,
    eylemler: eylemler.filter((e) => e.kim === "orion")
      .map((e) => ({ kimlik: e.kimlik, uygun: e.uygun, ...(e.niyet ? { niyet: e.niyet } : {}), ...(e.soz ? { soz: e.soz } : {}) })),
  };
}
