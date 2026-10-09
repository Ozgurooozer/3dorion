// world/level/editor/cekirdek/araziKomutu.ts — Arazi aracı (7): bir damgayı level tanımına uygular. Saf.
//
// Hedef → katman: yükseklik → ilk "zemin" katmanının `duzenleme`si; çim/kaya/dekor → o türün ilk katmanının
// `maske`si (seyreltme). Veri biçimi ve fırça matematiği cekirdek/arazi.ts (Unreal Landscape araçlarının
// karşılıkları: düşüş eğrileri, düzle kipleri, eğime göre düzle, çekirdekli yumuşat, ısıl erozyon, pürüz, rampa).
// Taban yükseklik sahneden işlev olarak gelir: bu dosya modülleri bilmez, yalnız katman türlerini.
// Nesneler mutlak y taşır: arazi değişince TABANI eski arazide olanlar yeni araziye taşınır (`nesneleriOturt`).
"use strict";
import type { LevelTanimi } from "../../cekirdek/levelTanimi.ts";
import type { Bolge } from "../../cekirdek/modul.ts";
import {
  araziDamgasi, maskeDamgasi, rampaUygula, seyrekOku, seyrekYaz, bolgedeMi,
  type AraziFircasi, type AraziIslemi, type AraziSecenekleri, type Dusus, type MaskeIslemi, type Seyrek,
} from "../../cekirdek/arazi.ts";
import { yuvarla } from "../../cekirdek/donusum.ts";

export type AraziHedefi = "yukseklik" | "cim" | "kaya" | "dekor";

export interface AraziAyari {
  hedef: AraziHedefi;
  islem: AraziIslemi;
  maskeIslem: MaskeIslemi;
  yaricap: number;
  /** Yükselt/alçalt/pürüz: damga başına m; diğerleri ve maske: 0–1 oran. */
  guc: number;
  /** Tam etkili iç bölge oranı (Unreal "falloff"un tersi). */
  sertlik: number;
  dusus: Dusus;
  /** Düzle: ikisi / yalnız yükselt / yalnız alçalt; eğime göre; hedefi her damgada imlecin altından al. */
  duzleKip: "ikisi" | "yukselt" | "alcalt";
  egimeGore: boolean;
  hedefHerDamga: boolean;
  /** Yumuşatma çekirdeği (hücre). */
  cekirdek: number;
  /** Aşındır: dinlenme açısı (°) ve damga başına yineleme. */
  talus: number;
  yineleme: number;
  /** Pürüz ölçeği (m). */
  puruzOlcek: number;
  /** Vuruş bitince tabanı eski arazide olan nesneleri yeni araziye taşı. */
  nesneleriOturt: boolean;
}

export const ARAZI_VARSAYILAN: AraziAyari = {
  hedef: "yukseklik", islem: "yukselt", maskeIslem: "sil", yaricap: 6, guc: 0.25, sertlik: 0.3, dusus: "yumusak",
  duzleKip: "ikisi", egimeGore: false, hedefHerDamga: false, cekirdek: 2, talus: 35, yineleme: 4, puruzOlcek: 4,
  nesneleriOturt: true,
};

const TUR: Record<AraziHedefi, string> = { yukseklik: "zemin", cim: "cim", kaya: "kaya", dekor: "dekor" };
const ALAN = (h: AraziHedefi) => (h === "yukseklik" ? { veri: "duzenleme", hucre: "duzenlemeHucre" } : { veri: "maske", hucre: "maskeHucre" });

/** Hedefin katman indeksi (açık ilk katman); yoksa -1. */
export const araziKatmani = (t: LevelTanimi, h: AraziHedefi): number => t.katmanlar.findIndex((k) => k.tur === TUR[h] && k.acik);

/** Shift: işlemin tersi (yükselt ⇄ alçalt, sil ⇄ boya; diğerleri aynı). */
export const tersIslem = (i: AraziIslemi): AraziIslemi => (i === "yukselt" ? "alcalt" : i === "alcalt" ? "yukselt" : i);
export const tersMaske = (i: MaskeIslemi): MaskeIslemi => (i === "sil" ? "boya" : "sil");

const ISLEM_ADI: Record<AraziIslemi | MaskeIslemi, string> = {
  yukselt: "yükselt", alcalt: "alçalt", duzle: "düzle", yumusat: "yumuşat", asindir: "aşındır", puruz: "pürüz", rampa: "rampa",
  sifirla: "sıfırla", sil: "sil", boya: "geri boya",
};
/** Geçmiş/durum mesajı: "yükselt", "çim sil"… (Shift tersini adlandırır). */
export const araziIslemAdi = (a: AraziAyari, ters: boolean): string => a.hedef === "yukseklik"
  ? ISLEM_ADI[ters ? tersIslem(a.islem) : a.islem]
  : `${a.hedef} ${ISLEM_ADI[ters ? tersMaske(a.maskeIslem) : a.maskeIslem]}`;

/** Hedef katmanın verisini değiştirir (yoksa tanım aynen). */
function veriyiDegistir(t: LevelTanimi, h: AraziHedefi, f: (veri: Seyrek, hucre: number) => void): LevelTanimi {
  const i = araziKatmani(t, h);
  if (i < 0) return t;
  const k = t.katmanlar[i]!, alan = ALAN(h);
  const hucre = Number(k.ayar[alan.hucre] ?? 2);
  const veri = seyrekOku((k.ayar[alan.veri] as number[] | undefined) ?? []);
  f(veri, hucre);
  return { ...t, katmanlar: t.katmanlar.map((x, j) => (j === i ? { ...x, ayar: { ...x.ayar, [alan.veri]: seyrekYaz(veri, 2) } } : x)) };
}

/** Bir damga. `taban(x, z)`: düzenlemesiz zemin; `s`: düzle hedefi/eğimi vb. (sahne katmanı doldurur). */
export function araziDamgasiUygula(t: LevelTanimi, a: AraziAyari, f: AraziFircasi, ters: boolean, taban: (x: number, z: number) => number, s: AraziSecenekleri = {}): LevelTanimi {
  const firca: AraziFircasi = { ...f, dusus: a.dusus };
  return veriyiDegistir(t, a.hedef, (veri, hucre) => {
    if (a.hedef === "yukseklik") {
      araziDamgasi(veri, hucre, firca, ters ? tersIslem(a.islem) : a.islem, taban,
        { duzleKip: a.duzleKip, cekirdek: a.cekirdek, talus: a.talus, yineleme: a.yineleme, puruzOlcek: a.puruzOlcek, ...s });
    } else maskeDamgasi(veri, hucre, firca, ters ? tersMaske(a.maskeIslem) : a.maskeIslem);
  });
}

/** Rampa: vuruşun başladığı A noktasından bırakıldığı B'ye (yarı genişlik = fırça yarıçapı). */
export function rampaKomutu(t: LevelTanimi, a: AraziAyari, A: { x: number; z: number; y: number }, B: { x: number; z: number; y: number }, taban: (x: number, z: number) => number): LevelTanimi {
  return veriyiDegistir(t, "yukseklik", (veri, hucre) => rampaUygula(veri, hucre, A, B, a.yaricap, a.sertlik, a.dusus, taban));
}

/**
 * Arazi değişti: bölgedeki nesnelerden tabanı ESKİ araziye oturanları (tolerans içinde) yeni araziye taşır.
 * Havadaki ya da başka nesnenin üstündeki nesneye dokunmaz.
 */
export function nesneleriOturt(t: LevelTanimi, eski: (x: number, z: number) => number, yeni: (x: number, z: number) => number, bolge: Bolge, tolerans = 0.1): LevelTanimi {
  return {
    ...t,
    nesneler: (t.nesneler ?? []).map((n) => {
      const [x, y, z] = n.konum;
      if (!bolgedeMi(bolge, x, z) || Math.abs(y - eski(x, z)) > tolerans) return n;
      return { ...n, konum: [x, yuvarla(y - eski(x, z) + yeni(x, z), 3), z] };
    }),
  };
}
