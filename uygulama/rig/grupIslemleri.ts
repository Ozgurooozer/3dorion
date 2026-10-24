// uygulama/rig/grupIslemleri.ts — RİG TOPLU İŞLEMLERİ (spec 38 §8): grubu/pozu sıfırla, sol↔sağ yansıt, pozu kopyala/yapıştır. SAF, DEĞİŞTİRİLEMEZ.
//
// Hepsi tek kareye ve `rigDuzenle`ye dayanır (anahtar yazma kuralları değişmez: klip altta oynarken katkısı çıkarılır, kilitli iz reddedilir). Çok uzuvlu işlem ARA durumları
// yazmaz: sekans uzuv uzuv güncellenir ve BİR sonuç döner (editörde tek geri al adımı); herhangi bir uzuv reddedilirse işlemin tamamı reddedilir (yarım poz yok).
"use strict";
import type { Uzuv } from "../../protocol/animasyon.ts";
import type { Sonuc } from "../../protocol/dogrula.ts";
import type { Sekans } from "../../protocol/sekans.ts";
import { KONTROL_GRUPLARI, eulerEsit, karsiUzuv, yansit, type Euler, type KlipBulucu, type KontrolGrubu } from "../../world/avatar/index.ts";
import { rigDuzenle, uzuvEuleri } from "./anahtarla.ts";

export type RigPozu = ReadonlyMap<Uzuv, Euler>;
export interface TopluSonuc { sekans: Sekans; /** Gerçekten değişen uzuv sayısı. */ degisen: number }

const SIFIR: Euler = { x: 0, y: 0, z: 0 };

/** Kanonik tüm uzuvların karedeki TOPLAM dönmesi (kopyalama için). */
export function pozuOku(s: Sekans, baglama: string, kare: number, klipler: KlipBulucu): Map<Uzuv, Euler> {
  const m = new Map<Uzuv, Euler>();
  for (const g of KONTROL_GRUPLARI) for (const u of g.uzuvlar) m.set(u, uzuvEuleri(s, baglama, u, kare, klipler));
  return m;
}

/** Verilen uzuvların karedeki toplam dönmesini hedefe getirir; hepsi geçerliyse tek yeni sekans. */
export function topluAyarla(s: Sekans, baglama: string, kare: number, hedefler: RigPozu, klipler: KlipBulucu): Sonuc<TopluSonuc> {
  let x = s, degisen = 0;
  for (const [u, h] of hedefler) {
    if (eulerEsit(uzuvEuleri(x, baglama, u, kare, klipler), h, 1e-3)) continue;
    const r = rigDuzenle(x, baglama, u, kare, h, klipler);
    if (!r.ok) return { ok: false, hata: `${u}: ${r.hata}` };
    x = r.deger.sekans; degisen++;
  }
  return { ok: true, deger: { sekans: x, degisen } };
}

/** Bir grubun bütün uzuvlarını bu karede sıfırlar. */
export function grubuSifirla(s: Sekans, baglama: string, kare: number, g: KontrolGrubu, klipler: KlipBulucu): Sonuc<TopluSonuc> {
  return topluAyarla(s, baglama, kare, new Map(g.uzuvlar.map((u) => [u, SIFIR] as const)), klipler);
}

/** Bütün bedeni bu karede sıfırlar. */
export function bedeniSifirla(s: Sekans, baglama: string, kare: number, klipler: KlipBulucu): Sonuc<TopluSonuc> {
  return topluAyarla(s, baglama, kare, new Map(KONTROL_GRUPLARI.flatMap((g) => g.uzuvlar).map((u) => [u, SIFIR] as const)), klipler);
}

/** Kaynak grubun bu karedeki duruşunu karşı tarafa YANSITIR (sol kol → sağ kol): yan eksen aynı, y ve z işaret değiştirir. Karşısı olmayan grupta neden. */
export function grubuYansit(s: Sekans, baglama: string, kare: number, kaynak: KontrolGrubu, klipler: KlipBulucu): Sonuc<TopluSonuc> {
  if (!kaynak.karsi) return { ok: false, hata: `'${kaynak.ad}' grubunun karşı tarafı yok (yansıtma yalnız kol ve bacakta)` };
  const hedefler = new Map<Uzuv, Euler>();
  for (const u of kaynak.uzuvlar) { const k = karsiUzuv(u); if (k) hedefler.set(k, yansit(uzuvEuleri(s, baglama, u, kare, klipler))); }
  return topluAyarla(s, baglama, kare, hedefler, klipler);
}

/** Panodaki pozu bu kareye yazar (bütün uzuvlar). */
export function pozuYapistir(s: Sekans, baglama: string, kare: number, pano: RigPozu, klipler: KlipBulucu): Sonuc<TopluSonuc> {
  return topluAyarla(s, baglama, kare, pano, klipler);
}
