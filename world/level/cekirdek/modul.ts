// world/level/cekirdek/modul.ts — Level modülü sözleşmesi (gök, zemin, bulut, çim, kaya…).
//
// Her katman bir MODÜL örneğidir. Modül yalnız şunu bilir: bağlam (sahne, palet, malzeme, gölge kaydı) ve
// kendi ayarı. Işık, sis, ton eşleme modülün işi değil (ışık sistemi). Böylece yeni bir katman = yeni bir
// modül dosyası + kayıtta bir satır; level tanımına bir katman eklemek = JSON'a bir nesne.
//
// AYAR: modülün `varsayilan`ı ayarın ŞEMASIDIR — tanımdaki ayar onunla birleştirilir (`ayarBirlestir`):
// bilinmeyen anahtar ve yanlış türdeki değer reddedilir (sessizce yutulmaz; yazım hatası görünür olsun).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Renk } from "./renk.ts";
import type { MalzemeTuru, MalzemeAyari } from "./malzeme.ts";
import type { Vec3 } from "./levelTanimi.ts";
import type { DunyaDurumu } from "../shader/dunyaDurumu.ts";

export interface ModulBaglami {
  sahne: Scene;
  /** Palet adı ya da "#rrggbb" → renk. */
  renk(ad: string): Renk;
  malzeme(ad: string, tur: MalzemeTuru, ayar?: MalzemeAyari): StandardMaterial;
  /** Mesh'i ışık sisteminin gölgesine kaydeder (atar: gölge düşürür, alir: üstüne gölge düşer). */
  golge(mesh: Mesh, ne: { atar?: boolean; alir?: boolean }): void;
  /** Güneşe doğru birim yön (güneş diski gibi modüller her karede okur — ışık canlı değişebilir). */
  gunesYonu(): Vec3;
  /** Canlı dünya durumu (saat, gece, gün ışığı, o saatin paleti): her karede okunur, nesne aynı kalır. */
  dunya(): DunyaDurumu;
  /** Kendinden ÖNCE kurulmuş zeminin yüksekliği (yoksa 0). Katman sırası = bağımlılık sırası. */
  yukseklik(x: number, z: number): number;
  /** Kendinden ÖNCE kurulmuş zeminin (x, z)'deki rengi (yoksa null) — çim altındaki lekeyle eşleşsin. */
  zeminRengi(x: number, z: number): Renk | null;
}

export interface ModulOrnegi {
  meshler: Mesh[];
  /** Her karede (dt saniye). */
  guncelle?(dt: number): void;
  /** Zemin gibi modüller: (x, z) noktasındaki yüzey yüksekliği (kamera ve yerleştirme için). */
  yukseklik?(x: number, z: number): number;
  /** Zemin gibi modüller: (x, z) noktasındaki yüzey rengi. */
  renk?(x: number, z: number): Renk;
  /** Meshleri ve malzemeleri bırakır. */
  yokEt(): void;
}

/**
 * Modül ayarı: düz alanlar — sayı, mantıksal, metin, sayı ya da metin dizisi. KURAL: metin değerler her
 * zaman RENK başvurusudur (palet adı ya da "#rrggbb") — panel onları renk/palet seçicisiyle gösterir,
 * bekçi test hepsinin çözüldüğünü denetler. Renk olmayan seçim gerekirse sayı (indeks) kullan.
 */
export type AyarDegeri = number | string | boolean | readonly number[] | readonly string[];
export type Ayar = Readonly<Record<string, AyarDegeri>>;

/** Panelde sayı ayarının kaydırıcı aralığı (öneri; sayı kutusuyla dışına çıkılabilir). */
export interface AyarAraligi { min: number; max: number; adim: number }

export interface LevelModulu<A extends Ayar = Ayar> {
  tur: string;
  aciklama: string;
  varsayilan: A;
  /** Sayı ayarlarının anlamlı aralıkları (panel kaydırıcısı). Verilmeyen ayar değerinden türetilir. */
  aralik?: Readonly<Partial<Record<keyof A & string, AyarAraligi>>>;
  kur(b: ModulBaglami, ayar: A): ModulOrnegi;
}

/**
 * Tanımdaki ayarı modülün varsayılanıyla birleştirir. Bilinmeyen anahtar ya da varsayılandan farklı tür →
 * hata (yol ve nedeniyle). Eksik anahtar varsayılandan gelir.
 */
export function ayarBirlestir<A extends Ayar>(tur: string, varsayilan: A, ayar: Readonly<Record<string, unknown>>): A {
  const sonuc: Record<string, AyarDegeri> = { ...varsayilan };
  for (const [k, v] of Object.entries(ayar)) {
    if (!(k in varsayilan)) throw new Error(`${tur}.${k}: bilinmeyen ayar (bilinenler: ${Object.keys(varsayilan).join(", ")})`);
    const ornek = varsayilan[k]!;
    const ayniTur = Array.isArray(ornek)
      ? Array.isArray(v) && v.every((x) => typeof x === typeof (ornek[0] ?? x))
      : typeof v === typeof ornek && (typeof v !== "number" || Number.isFinite(v));
    if (!ayniTur) throw new Error(`${tur}.${k}: tür ${Array.isArray(ornek) ? "dizi" : typeof ornek} olmalı`);
    sonuc[k] = v as AyarDegeri;
  }
  return sonuc as A;
}
