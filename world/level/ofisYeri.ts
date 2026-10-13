// world/level/ofisYeri.ts — Ofisin ova'nın İÇİNDEKİ yeri: level tanımına UYGULANAN SAF yerleştirme (spec 27).
//
// Ozyn (2026-10-14): "ofisi özel güzel ve biraz yüksekte bir düzlüğe koy; ofis olduğu gibi kalsın, ova olduğu gibi." Ofis kodla
// kurulur ve orijin-mutlak koordinatlara bağlıdır (`olculer.ts`, y = 0 zemin): TAŞINAMAZ. Bu yüzden ova ofise göre düzenlenir:
//   - orijin çevresinde `platoYaricap` yarıçaplı TAM DÜZ bir plato (zemin modülü), çevresi `PLATO.cukur` m çöker: ofis yüksekte;
//   - platonun içinde ofisin altından çim sürmesin diye çim ayak izinde yok (`maske` verisi: kod değişikliği gerekmedi, spike);
//   - kaya/dekor plato ve eteğinde başlamasın (iç yarıçap büyür);
//   - dosyada mutlak `y`si olan yerleşimler (boru, kule…) araziyle aynı miktar kayar, yoksa havada kalırlardı; su yüzeyi de
//     (göl çukuruyla birlikte indi);
//   - ofise açılan geçit/kapı kalkar (kapıdan ışınlanma yok: ofis aynı sahnede) ve HEAD'deki eski `ofis` bina yerleşimi düşer
//     (bir bina daha olmasın).
// `ova.level.json` DEĞİŞMEZ (Ozyn'in dosyası): yerleştirme yükleme anında koddan uygulanır; editör sayfası düz ova'yı gösterir.
// Saf ve eşgüçlü: iki kez uygulamak bir kez uygulamakla aynı sonucu verir; girdi değişmez.
"use strict";
import type { LevelTanimi } from "./cekirdek/levelTanimi.ts";
import { anahtar, seyrekOku, seyrekYaz } from "./cekirdek/arazi.ts";
import { ODA } from "./olculer.ts";
import { ZEMIN_VARSAYILAN, platoFarki, type ZeminAyari } from "./moduller/zemin.ts";
import { SU_VARSAYILAN } from "./moduller/su.ts";

/** Plato ölçüleri (m). Merkez = ofisin merkezi = orijin. */
export const PLATO = {
  /** Tam düz yarıçap: ofisin köşegen yarısı 6,7 m; kapının önünde ~7 m geniş bir teras kalır. */
  yaricap: 14,
  /** Platodan doğal araziye yükselme boyu (eğim ≈ cukur / gecis ≈ 9°). */
  gecis: 20,
  /** Plato zemini ofisin zemininin (y = 0) 5 cm ALTINDA: üst üste binip titremesin (z-fighting). */
  yukseklik: -0.05,
  /** Plato çevresindeki halkanın çökmesi: ofis bu kadar "yüksekte". */
  cukur: 3,
  cukurBas: 140,
  cukurSon: 260,
} as const;

/** Ofisin yer izi (duvarlar dahil), merkezden yarı ölçüler (m). */
export const OFIS_IZI = { yariX: ODA.genislik / 2 + ODA.duvarKalinlik, yariZ: ODA.derinlik / 2 + ODA.duvarKalinlik } as const;

/** Çim maskesi hücreleri: ayak izi + 2 m pay (çift doğrusal geçiş), hücre 2 m. */
function izMaskesi(hucre: number): number[] {
  const iMax = Math.ceil((OFIS_IZI.yariX + 2) / hucre), jMax = Math.ceil((OFIS_IZI.yariZ + 2) / hucre);
  const m: number[] = [];
  for (let i = -iMax; i <= iMax; i++) for (let j = -jMax; j <= jMax; j++) m.push(anahtar(i, j), 1);
  return m;
}

const yuvarla = (v: number) => Math.round(v * 1000) / 1000;

/** Ova tanımını ofis için düzenler (yeni tanım döner). `zemin` katmanı yoksa fırlatır: plato olmadan ofis havada kalırdı. */
export function ofisiOvayaKur(t: LevelTanimi): LevelTanimi {
  const y = structuredClone(t);
  const zeminKatmani = y.katmanlar.find((k) => k.tur === "zemin");
  if (!zeminKatmani) throw new Error("ofis yerleştirme: ova tanımında zemin katmanı yok");
  const eskiZemin: ZeminAyari = { ...ZEMIN_VARSAYILAN, ...(zeminKatmani.ayar as Partial<ZeminAyari> | undefined) };
  // İdempotans: plato zaten bu ölçülerdeyse nesne/su kaydırması bir daha uygulanmaz.
  const zatenKurulu = eskiZemin.platoYaricap === PLATO.yaricap && eskiZemin.platoCukur === PLATO.cukur;
  const yeniZemin: ZeminAyari = {
    ...eskiZemin, platoX: 0, platoZ: 0, platoYaricap: PLATO.yaricap, platoGecis: PLATO.gecis, platoYukseklik: PLATO.yukseklik,
    platoCukur: PLATO.cukur, platoCukurBas: PLATO.cukurBas, platoCukurSon: PLATO.cukurSon,
  };
  zeminKatmani.ayar = yeniZemin;

  if (!zatenKurulu) {
    // Arazi farkı plato olmadan → plato ile: yerleşimler ve su aynı miktar kayar.
    const fark = platoFarki(yeniZemin);
    for (const n of y.nesneler ?? []) n.konum = [n.konum[0], yuvarla(n.konum[1] + fark(n.konum[0], n.konum[2])), n.konum[2]];
    const su = y.katmanlar.find((k) => k.tur === "su");
    if (su) {
      const a = { ...SU_VARSAYILAN, ...(su.ayar as Partial<typeof SU_VARSAYILAN> | undefined) };
      su.ayar = { ...a, seviye: yuvarla(a.seviye + fark(a.x, a.z)) };
    }
  }

  // Çim maskesi: Ozyn'un fırça seyreltmesi varsa KORUNUR, ayak izi hücreleri 1'e (hiç yok) çıkar.
  const cim = y.katmanlar.find((k) => k.tur === "cim");
  if (cim) {
    const mevcut = seyrekOku((cim.ayar as { maske?: number[] } | undefined)?.maske ?? []);
    const iz = seyrekOku(izMaskesi(2));
    for (const k of iz.keys()) mevcut.set(k, 1);
    cim.ayar = { ...(cim.ayar ?? {}), maske: seyrekYaz(mevcut), maskeHucre: 2 };
  }
  const kaya = y.katmanlar.find((k) => k.tur === "kaya");
  if (kaya) kaya.ayar = { ...(kaya.ayar ?? {}), icYaricap: Math.max(Number((kaya.ayar as { icYaricap?: number } | undefined)?.icYaricap ?? 0), PLATO.yaricap + 2) };
  const dekor = y.katmanlar.find((k) => k.tur === "dekor");
  if (dekor) dekor.ayar = { ...(dekor.ayar ?? {}), icYaricap: Math.max(Number((dekor.ayar as { icYaricap?: number } | undefined)?.icYaricap ?? 0), PLATO.yaricap + 4) };

  y.nesneler = (y.nesneler ?? []).filter((n) => n.id !== "ofis");
  delete y.gecitler;
  return y;
}

/** Plato zemininin (ofisin dışında, terasta) yüksekliği — yürüme yüksekliği için tek kaynak. */
export const TERAS_YUKSEKLIGI = PLATO.yukseklik;
