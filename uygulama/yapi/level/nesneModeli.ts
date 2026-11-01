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
  /** Hiyerarşi girintisi (spec 45 B7): kök 0, çocuk 1… Arama açıkken hep 0 (süzülmüş liste ağaç değildir). */
  girinti: number;
  /** Üst aktör (level aktörü ya da `beden:<ad>`); yoksa null. Listede olmayan üstlü nesne kök gibi girintisiz çizilir. */
  ust: string | null;
  /** Bu nesnenin kaç çocuğu (nesne) var. */
  cocuk: number;
}

export interface NesneListesi { satirlar: NesneSatiri[]; toplam: number; kesildi: boolean }

/** `varlik` yolundan kısa ad: son parça, uzantısız ("kit/agac.glb" → "agac"). */
export function kisaVarlikAdi(varlik: string): string {
  const son = varlik.split(/[\\/]/).pop() ?? varlik;
  const i = son.lastIndexOf(".");
  return i > 0 ? son.slice(0, i) : son;
}

/**
 * Listeyi hiyerarşi sırasına dizer: her kök, hemen ardından çocukları (derinlik öncelikli, level sırası korunur). Üstü LİSTEDE olmayan (ışık, beden, silinmiş) nesne kök sayılır.
 * Döngülü veri (level doğrulaması reddeder ama ham tanım gelebilir) sonsuz döngüye girmez: ziyaret edilmiş nesne bir daha eklenmez, kalanlar sona kök olarak eklenir.
 */
function agacSirasi(liste: NesneSatiri[]): NesneSatiri[] {
  const kimlikler = new Set(liste.map((s) => s.id));
  const cocuklar = new Map<string, NesneSatiri[]>();
  for (const s of liste) if (s.ust !== null && kimlikler.has(s.ust) && s.ust !== s.id) cocuklar.set(s.ust, [...(cocuklar.get(s.ust) ?? []), s]);
  const sonuc: NesneSatiri[] = [], goruldu = new Set<string>();
  const ekle = (s: NesneSatiri, girinti: number): void => {
    if (goruldu.has(s.id)) return;
    goruldu.add(s.id);
    sonuc.push({ ...s, girinti, cocuk: cocuklar.get(s.id)?.length ?? 0 });
    for (const c of cocuklar.get(s.id) ?? []) ekle(c, girinti + 1);
  };
  for (const s of liste) if (s.ust === null || !kimlikler.has(s.ust) || s.ust === s.id) ekle(s, 0);
  for (const s of liste) ekle(s, 0);   // döngüye düşüp köke ulaşılamayanlar (veri bozuksa) görünmez kalmasın
  return sonuc;
}

export function nesneListesi(t: LevelTanimi, arama = ""): NesneListesi {
  const q = arama.trim().toLocaleLowerCase("tr");
  const hepsi: NesneSatiri[] = [];
  for (const n of t.nesneler ?? []) {
    if (!n.id) continue;
    const ad = n.ad && n.ad.length ? n.ad : kisaVarlikAdi(n.varlik);
    if (q && !ad.toLocaleLowerCase("tr").includes(q) && !n.id.toLocaleLowerCase("tr").includes(q)) continue;
    hepsi.push({ id: n.id, ad, varlik: n.varlik, gizli: n.gizli === true, kilitli: n.kilitli === true, graf: n.graf ?? null, girinti: 0, ust: n.ust ?? null, cocuk: 0 });
  }
  // Süzülmüş liste ağaç değildir (çocuğu süzülmüş ata girintiyle yalan söylerdi): arama varken düz.
  const sirali = q ? hepsi : agacSirasi(hepsi);
  return { satirlar: sirali.slice(0, NESNE_LISTE_AZAMI), toplam: hepsi.length, kesildi: hepsi.length > NESNE_LISTE_AZAMI };
}
