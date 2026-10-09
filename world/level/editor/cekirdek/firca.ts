// world/level/editor/cekirdek/firca.ts — Boya-yerleştir fırçası: tek DAMGADA hangi nesneler eklenir / silinir. Saf.
//
// Fırça imleçle gezerken (sahne/firca.ts) yarıçapın yarısı kadar ilerledikçe bir damga vurur. Damga dairenin
// içinde rastgele aday noktalar üretir (yoğunluk × alan), mevcut nesnelere ve birbirine `minAralik`tan yakın
// adayları atar (kümelenmesin, üst üste binmesin) — her adaya fırça listesinden rastgele bir varlık, rastgele Y
// dönüşü ve ölçek. Yükseklik sahneden işlev olarak gelir (yüzey). Silgi: dairedeki FIRÇA varlıklarını siler
// (elle yerleştirilmiş başka nesnelere dokunmaz).
"use strict";
import type { LevelTanimi, Vec3 } from "../../cekirdek/levelTanimi.ts";
import { nesneEkle, nesneSil, type Sonuc } from "./komutlar.ts";
import { kisaDonus, kisaOlcek } from "../../cekirdek/donusum.ts";

export interface FircaAyari {
  /** Yarıçap (m). */
  yaricap: number;
  /** Damga başına yoğunluk: metrekareye düşen aday (0,05 = 20 m²'ye bir). */
  yogunluk: number;
  /** İki nesne arası en az (m), mevcutlar dahil. */
  minAralik: number;
  olcekMin: number;
  olcekMax: number;
  /** Rastgele Y dönüşü (kapalıysa 0°). */
  rastgeleDonus: boolean;
  /** Yamaçta yüzey normaline eğ (sahne katmanı uygular; burada yalnız dönüş Y). */
  normaleHizala: boolean;
  /** Fırçanın serpiştirdiği varlıklar (boşsa fırça çalışmaz). */
  varliklar: string[];
}

export const FIRCA_VARSAYILAN: FircaAyari = {
  yaricap: 5, yogunluk: 0.12, minAralik: 1.5, olcekMin: 0.85, olcekMax: 1.15, rastgeleDonus: true, normaleHizala: false, varliklar: [],
};

/** Eklenecek nesnenin hesaplanmış yeri (yükseklik ve normal sahneden sonra eklenir). */
export interface Aday { varlik: string; x: number; z: number; yaw: number; olcek: number }

/** Dairede adaylar: mevcutlara (`dolu`) ve birbirine `minAralik`tan uzak. `rng` 0–1 üretir (testte sabit tohum). */
export function damgaAdaylari(merkez: { x: number; z: number }, a: FircaAyari, dolu: readonly { x: number; z: number }[], rng: () => number): Aday[] {
  if (!a.varliklar.length || a.yaricap <= 0) return [];
  const sayi = Math.max(1, Math.round(a.yogunluk * Math.PI * a.yaricap * a.yaricap));
  const kabul: Aday[] = [];
  const m2 = a.minAralik * a.minAralik;
  const yakin = (x: number, z: number) => dolu.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < m2) || kabul.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < m2);
  for (let i = 0; i < sayi * 4 && kabul.length < sayi; i++) {
    // Daire içinde düzgün dağılım: r = R·√u.
    const r = a.yaricap * Math.sqrt(rng()), aci = rng() * Math.PI * 2;
    const x = merkez.x + Math.cos(aci) * r, z = merkez.z + Math.sin(aci) * r;
    if (yakin(x, z)) continue;
    kabul.push({
      varlik: a.varliklar[Math.floor(rng() * a.varliklar.length) % a.varliklar.length]!,
      x, z,
      yaw: a.rastgeleDonus ? Math.round(rng() * 360) : 0,
      olcek: a.olcekMin + (a.olcekMax - a.olcekMin) * rng(),
    });
  }
  return kabul;
}

/** Adayları tanıma ekler; yükseklik ve (isteğe bağlı) normale hizalı dönüş `yer` işlevinden. */
export function adaylariEkle(t: LevelTanimi, adaylar: readonly Aday[], yer: (a: Aday) => { y: number; donus: Vec3 }): Sonuc {
  return nesneEkle(t, adaylar.map((a) => {
    const { y, donus } = yer(a);
    return { varlik: a.varlik, konum: [a.x, y, a.z] as Vec3, donus: kisaDonus(donus), olcek: kisaOlcek([a.olcek, a.olcek, a.olcek]) };
  }));
}

/** Silgi: dairedeki fırça varlıklarını (kilitli/gizli olmayan) siler. */
export function silgiDamgasi(t: LevelTanimi, merkez: { x: number; z: number }, yaricap: number, varliklar: readonly string[]): Sonuc {
  const v = new Set(varliklar), r2 = yaricap * yaricap;
  const silinecek = (t.nesneler ?? []).filter((n) => n.id && v.has(n.varlik) && !n.kilitli
    && (n.konum[0] - merkez.x) ** 2 + (n.konum[2] - merkez.z) ** 2 <= r2).map((n) => n.id!);
  return silinecek.length ? { ...nesneSil(t, silinecek), idler: silinecek } : { tanim: t, idler: [] };
}
