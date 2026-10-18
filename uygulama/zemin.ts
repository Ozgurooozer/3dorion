// uygulama/zemin.ts — OYUN İÇİ ZEMİN ŞEKİLLENDİRME DURUMU (Yapı çubuğu · Zemin sekmesi): zemin katmanının yükseklik farkı, kayıt biçimi, geri al yığını. SAF (Babylon ve DOM yok).
//
// Editörün arazi kalemi (`editor/cekirdek/araziKomutu.ts`) level TANIMINDAKİ zemin katmanının `duzenleme` verisini değiştirir (seyrek hücre dizisi). Level DOSYASI
// (`ova.level.json`) Ozyn'indir ve burada yazılmaz: Orion'daki şekil ayrı bir kayıtta durur (`orion.zemin.v1`) ve açılışta o katmanın ÜSTÜNE yazılır.
// Kayıt "ben zemini şöyle şekillendirdim" demektir: dosyadaki hâlin yerine geçer (`null` = dokunulmamış, dosyadaki zemin geçerli).
//   • Geri al yığını bellekte (oturum boyu), vuruş başına bir adım; adım ZEMİN + o vuruşla araziye oturtulan nesneleri birlikte geri alır.
//   • Nesne oturtma: tabanı eski arazide olan nesneler yeni araziye taşınır (editördeki `nesneleriOturt`); hangi nesnelerin kaç metre oynadığı `oturanlar`la
//     bulunur ki yerleştirme kaydına (`yerlestirme.donustur`) yazılabilsin — yoksa yeniden açılışta nesneler eski yüksekliğe dönerdi.
"use strict";
import type { LevelTanimi, Vec3 } from "../world/level/cekirdek/levelTanimi.ts";
import type { Bolge } from "../world/level/cekirdek/modul.ts";
import { ayarBirlestir } from "../world/level/cekirdek/modul.ts";
import { seyrekOku } from "../world/level/cekirdek/arazi.ts";
import { ZEMIN_VARSAYILAN, zeminYuksekligi, type ZeminAyari } from "../world/level/moduller/zemin.ts";
import { araziKatmani, nesneleriOturt } from "../world/level/editor/cekirdek/araziKomutu.ts";

/** Zemin katmanının kullanıcı şekli: yükseklik farkı (seyrek [anahtar, değer, …] dizisi) ve hücre aralığı (m). */
export interface ZeminKaydi { duzenleme: number[]; hucre: number }

export const ZEMIN_ANAHTARI = "orion.zemin.v1";

/** Level'ın ilk açık "zemin" katmanındaki şekil; zemin katmanı yoksa null. */
export function zeminOku(t: LevelTanimi): ZeminKaydi | null {
  const i = araziKatmani(t, "yukseklik");
  if (i < 0) return null;
  const ay = t.katmanlar[i]!.ayar;
  const d = ay["duzenleme"];
  return { duzenleme: Array.isArray(d) ? [...(d as number[])] : [], hucre: Number(ay["duzenlemeHucre"] ?? ZEMIN_VARSAYILAN.duzenlemeHucre) };
}

/** Şekli level'a yaz (yeni tanım; girdi değişmez). Zemin katmanı yoksa tanım aynen döner. */
export function zeminYaz(t: LevelTanimi, k: ZeminKaydi): LevelTanimi {
  const i = araziKatmani(t, "yukseklik");
  if (i < 0) return t;
  return { ...t, katmanlar: t.katmanlar.map((x, j) => (j === i ? { ...x, ayar: { ...x.ayar, duzenleme: [...k.duzenleme], duzenlemeHucre: k.hucre } } : x)) };
}

export function zeminEsit(a: ZeminKaydi | null, b: ZeminKaydi | null): boolean {
  if (a === null || b === null) return a === b;
  return a.hucre === b.hucre && a.duzenleme.length === b.duzenleme.length && a.duzenleme.every((v, i) => v === b.duzenleme[i]);
}

/** Zemin katmanının TAM ayarı, istenirse `k` şekliyle (yükseklik işlevi için). Katman yoksa null. */
export function zeminAyari(t: LevelTanimi, k?: ZeminKaydi): ZeminAyari | null {
  const i = araziKatmani(t, "yukseklik");
  if (i < 0) return null;
  const ay = t.katmanlar[i]!.ayar;
  return ayarBirlestir("zemin", ZEMIN_VARSAYILAN, k ? { ...ay, duzenleme: k.duzenleme, duzenlemeHucre: k.hucre } : ay);
}

// ── nesne oturtma ──
/** Bir nesnenin zemin değişince oynadığı yer (konum = taban ortası; yalnız y değişir). */
export interface Oturan { id: string; once: Vec3; sonra: Vec3 }

/** `onceki` → `simdi` şekil değişimi `bolge`de: tabanı eski arazide olan (±10 cm) kimlikli nesneler yeni araziye taşınır. Havadakilere dokunmaz. */
export function oturanlar(t: LevelTanimi, onceki: ZeminKaydi, simdi: ZeminKaydi, bolge: Bolge): Oturan[] {
  const eskiAyar = zeminAyari(t, onceki), yeniAyar = zeminAyari(t, simdi);
  if (!eskiAyar || !yeniAyar) return [];
  const s = nesneleriOturt(t, zeminYuksekligi(eskiAyar), zeminYuksekligi(yeniAyar), bolge);
  const cikti: Oturan[] = [];
  (t.nesneler ?? []).forEach((n, i) => {
    const y = s.nesneler?.[i];
    if (!n.id || !y || n.konum[1] === y.konum[1]) return;
    cikti.push({ id: n.id, once: [...n.konum], sonra: [...y.konum] });
  });
  return cikti;
}

// ── geri al yığını ──
export interface ZeminAdimi { ad: string; once: ZeminKaydi; sonra: ZeminKaydi; oturan: Oturan[] }

export interface ZeminGecmisi {
  /** Yeni vuruş: ileri alınacaklar silinir; sınır aşılırsa en eski adım düşer. */
  ekle(a: ZeminAdimi): void;
  /** Geri alınacak adım (yoksa null); çağıran `once`'ı uygular. */
  geriAl(): ZeminAdimi | null;
  /** İleri alınacak adım (yoksa null); çağıran `sonra`'yı uygular. */
  ileriAl(): ZeminAdimi | null;
  sayilar(): { geri: number; ileri: number };
  temizle(): void;
}

export function zeminGecmisiKur(sinir = 40): ZeminGecmisi {
  let geri: ZeminAdimi[] = [];
  let ileri: ZeminAdimi[] = [];
  return {
    ekle(a) { geri.push(a); ileri = []; if (geri.length > sinir) geri = geri.slice(geri.length - sinir); },
    geriAl() { const a = geri.pop() ?? null; if (a) ileri.push(a); return a; },
    ileriAl() { const a = ileri.pop() ?? null; if (a) geri.push(a); return a; },
    sayilar: () => ({ geri: geri.length, ileri: ileri.length }),
    temizle() { geri = []; ileri = []; },
  };
}

// ── kayıt biçimi (doğrulamalı: bozuk kayıt zemini sessizce bozmaz) ──
export function kaydiYaz(k: ZeminKaydi | null): string { return JSON.stringify({ surum: 1, zemin: k }); }

/** Kayıt metninden şekil; boş/yok → null (dokunulmamış); bozuksa HATA (çağıran uyarır, dosyadaki zeminle devam eder). */
export function kaydiOku(metin: string | null): ZeminKaydi | null {
  if (!metin) return null;
  const v: unknown = JSON.parse(metin);
  if (typeof v !== "object" || v === null) throw new Error("zemin kaydı nesne değil");
  const o = v as Record<string, unknown>;
  if (o["surum"] !== 1) throw new Error(`zemin kaydı sürümü desteklenmiyor: ${String(o["surum"])}`);
  const z = o["zemin"];
  if (z === null) return null;
  const k = z as Record<string, unknown> | undefined;
  if (typeof k !== "object" || k === null || !Array.isArray(k["duzenleme"]) || typeof k["hucre"] !== "number" || !(k["hucre"] > 0) || !Number.isFinite(k["hucre"])) throw new Error("zemin kaydı bozuk");
  seyrekOku(k["duzenleme"] as number[]);   // çift sayı / tamsayı anahtar / sonlu değer; bozuksa fırlatır
  return { duzenleme: k["duzenleme"] as number[], hucre: k["hucre"] };
}
