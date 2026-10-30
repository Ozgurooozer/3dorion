// uygulama/yapi/level/nesneModeli.ts — NESNELER PANELİ SATIRLARI (spec 43 A5; Unreal Outliner'ın nesne kısmı). SAF (DOM yok).
//
// Level'ın `nesneler` listesini panelde bir satır listesine çevirir. Kimliği olmayan nesne (levelKur doldurmadan önceki ham tanım) listede YOKTUR: kimliksiz aktöre
// graf/değişken/alan yazılamaz (`bilesen.ts` kimlikle çalışır). Yazma yok: Details yazmaları `bilesen.ts` işlemleriyle yapılır (şema + tanım doğrulaması).
"use strict";
import type { LevelTanimi } from "../../../world/level/cekirdek/levelTanimi.ts";

/** Panelde listelenen en çok nesne (asset yerleştirmeyle yüzlercesi olabilir; liste kaydırılır ama DOM şişmesin). */
export const NESNE_LISTE_AZAMI = 300;

export interface NesneSatiri {
  id: string;
  /** Görünen ad: `ad`, yoksa varlığın kısa adı. */
  ad: string;
  varlik: string;
  gizli: boolean;
  kilitli: boolean;
  /** Bu nesnenin grafı var mı (satırda ⚡ yerine küçük işaret). */
  graf: string | null;
}

export interface NesneListesi { satirlar: NesneSatiri[]; toplam: number; kesildi: boolean }

/** `varlik` yolundan kısa ad: son parça, uzantısız ("kit/agac.glb" → "agac"). */
export function kisaVarlikAdi(varlik: string): string {
  const son = varlik.split(/[\\/]/).pop() ?? varlik;
  const i = son.lastIndexOf(".");
  return i > 0 ? son.slice(0, i) : son;
}

export function nesneListesi(t: LevelTanimi, arama = ""): NesneListesi {
  const q = arama.trim().toLocaleLowerCase("tr");
  const hepsi: NesneSatiri[] = [];
  for (const n of t.nesneler ?? []) {
    if (!n.id) continue;
    const ad = n.ad && n.ad.length ? n.ad : kisaVarlikAdi(n.varlik);
    if (q && !ad.toLocaleLowerCase("tr").includes(q) && !n.id.toLocaleLowerCase("tr").includes(q)) continue;
    hepsi.push({ id: n.id, ad, varlik: n.varlik, gizli: n.gizli === true, kilitli: n.kilitli === true, graf: n.graf ?? null });
  }
  return { satirlar: hepsi.slice(0, NESNE_LISTE_AZAMI), toplam: hepsi.length, kesildi: hepsi.length > NESNE_LISTE_AZAMI };
}
