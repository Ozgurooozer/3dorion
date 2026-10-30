// uygulama/yapi/level/levelGecisiModeli.ts — ORION'UN YENİ LEVEL'A GEÇİŞİ: bir level açılış level'ı yapılabilir mi (spec 42 2. aşama). SAF (DOM yok).
//
// Geçiş açılış level'ını değiştirip yeniden başlatır (canlı geçiş yok: spec 42 §8). Ofis, level'ın ZEMİN katmanına gömülür (`ofisYeri.ts`: plato zemin modülünün ayarıdır;
// zemin katmanı yoksa kurulum fırlatır ve dünya ofis tek başına kalır). Bu yüzden zeminsiz level ("Tamamen boş" şablonu) geçişte REDDEDİLİR, nedeni söylenir:
// yeniden başlatıp ofis havada kalsın ya da dünya hiç kurulmasın diye gitmeden önce bakılır (Ozyn'in kararı, 2026-10-30).
"use strict";
import { levelTanimiDogrula } from "../../../world/level/cekirdek/levelTanimi.ts";

export type GecisDegerlendirmesi =
  | { ok: true; ad: string; isik: number; nesne: number; katman: number }
  | { ok: false; neden: string };

/** Ham level tanımı açılış level'ı olabilir mi; olabilirse özet (onay penceresinde gösterilir). */
export function gecisiDegerlendir(ham: unknown): GecisDegerlendirmesi {
  const d = levelTanimiDogrula(ham);
  if (!d.ok) return { ok: false, neden: `level tanımı bozuk: ${d.hata}` };
  const t = d.deger;
  if (!t.katmanlar.some((k) => k.tur === "zemin")) return { ok: false, neden: "bu level'da zemin katmanı yok: ofis zemine gömülür (zemin ekleyin ya da 'Düz zemin' şablonunu kullanın)" };
  return { ok: true, ad: t.ad, isik: t.isiklar?.length ?? 0, nesne: t.nesneler?.length ?? 0, katman: t.katmanlar.length };
}
