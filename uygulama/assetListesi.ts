// uygulama/assetListesi.ts — MENÜ İÇİN ASSET LİSTESİ (spec 30): katalog + anlam sözlüğü → kategori grupları. SAF.
//
// Menü yolu `Asset ▸ Kategori ▸ Ad ▸ Yerleştir` olduğundan aynı kategoride iki varlığın görünen adı AYNI olamaz (menü çekirdeği çakışan yolu hata sayar):
// çakışan adlar varlığın kısa adıyla, o da çakışırsa tam katalog adıyla ayırt edilir. Görünen ad: anlam sözlüğündeki Türkçe ad, yoksa `kisaAd`.
// Aynı görünen kategori adına düşen farklı kategori kodları tek grupta birleşir. Gruplar ve öğeler ada göre (Türkçe sıralama).
"use strict";
import type { Katalog } from "../world/level/cekirdek/katalog.ts";
import { KATEGORI_ADLARI, kisaAd } from "../world/level/cekirdek/katalog.ts";
import type { AnlamSozlugu } from "../world/level/cekirdek/anlam.ts";

export interface AssetOgesi { /** Katalogdaki kararlı ad (yerleştirmeye bu gider). */ varlik: string; /** Menüde görünen ad. */ ad: string }
export interface AssetGrubu { /** Menüde görünen kategori adı. */ ad: string; ogeler: AssetOgesi[] }
/** Alt çubuktaki asset kartı: menüyle AYNI görünen ad ve kategori, ek olarak önizleme yolu ve boyut (m: en, yükseklik, boy). */
export interface AssetKarti { varlik: string; ad: string; kategori: string; onizleme: string; boyut: readonly [number, number, number] }

const sirala = (a: string, b: string): number => a.localeCompare(b, "tr");

/** Adı çakışanları `ek(öğe)` ile ayırt eder (çakışmayanlara dokunmaz). */
function ayirtEt(liste: readonly AssetOgesi[], ek: (o: AssetOgesi) => string): AssetOgesi[] {
  const sayim = new Map<string, number>();
  for (const o of liste) sayim.set(o.ad, (sayim.get(o.ad) ?? 0) + 1);
  return liste.map((o) => (sayim.get(o.ad)! > 1 ? { varlik: o.varlik, ad: `${o.ad} ${ek(o)}` } : o));
}

export function assetGruplari(k: Katalog, anlam: AnlamSozlugu | null): AssetGrubu[] {
  const kategoriler = new Map<string, AssetOgesi[]>();
  for (const v of k.varliklar) {
    const kategoriAdi = KATEGORI_ADLARI[v.kategori] ?? v.kategori;
    const oge: AssetOgesi = { varlik: v.ad, ad: anlam?.varliklar[v.ad]?.ad ?? kisaAd(v.ad) };
    (kategoriler.get(kategoriAdi) ?? kategoriler.set(kategoriAdi, []).get(kategoriAdi)!).push(oge);
  }
  return [...kategoriler]
    .map(([ad, liste]) => ({ ad, ogeler: ayirtEt(ayirtEt(liste, (o) => `(${kisaAd(o.varlik)})`), (o) => `[${o.varlik}]`).sort((a, b) => sirala(a.ad, b.ad)) }))
    .sort((a, b) => sirala(a.ad, b.ad));
}

/** Alt çubuk için kartlar (ada göre Türkçe sıralı). Görünen ad ve kategori `assetGruplari` ile BİREBİR aynıdır: menüde ve çubukta aynı şey aynı adla görünür. */
export function assetKartlari(k: Katalog, anlam: AnlamSozlugu | null): AssetKarti[] {
  const bilgi = new Map<string, { ad: string; kategori: string }>();
  for (const g of assetGruplari(k, anlam)) for (const o of g.ogeler) bilgi.set(o.varlik, { ad: o.ad, kategori: g.ad });
  return k.varliklar
    .map((v): AssetKarti => {
      const b = bilgi.get(v.ad)!;
      return { varlik: v.ad, ad: b.ad, kategori: b.kategori, onizleme: v.onizleme, boyut: [v.boyut[0], v.boyut[1], v.boyut[2]] };
    })
    .sort((x, y) => sirala(x.ad, y.ad));
}
