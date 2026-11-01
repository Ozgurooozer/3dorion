// world/level/cekirdek/alanSemasi.ts — ALAN ŞEMASI: bir bileşen alanının adı, türü, aralığı ve değer denetimi (spec 43 A1'den ayrıldı; spec 45 B1). SAF: Babylon ve DOM yok.
//
// NEDEN AYRI DOSYA: `bilesen.ts` level tanımını (`levelTanimi.ts`) okur; tanım doğrulaması da bileşen ayarlarını denetlemek için bu şemaya muhtaç. İkisi aynı dosyada olsaydı
// import döngüsü doğardı. `bilesen.ts` bu adları aynen yeniden dışa verir (kullanıcılar değişmedi).
"use strict";
import type { Vec3 } from "./levelTanimi.ts";

export type AlanTipi = "sayi" | "metin" | "bool" | "renk" | "vec3";
export type AlanDegeri = number | string | boolean | Vec3;

export interface AlanSemasi {
  ad: string;
  etiket: string;
  tip: AlanTipi;
  varsayilan: AlanDegeri;
  /** Sayı alanında en az / en çok (sınırlar dahil). */
  en?: number;
  cok?: number;
  /** Details'te adım (sayı girişi). */
  adim?: number;
  birim?: string;
  /** Graf düğümleri bu alanı okuyup yazabilir mi (yalnız tek değerli alanlar: sayı, metin, renk, mantıksal). */
  grafta?: boolean;
  /** Metin alanında izinli değerler (seçim kutusu): dışı nedenle reddedilir. */
  secenekler?: readonly string[];
}

/** Değer şemaya uyuyor mu; uymuyorsa nedeni (renk geçerliliği level paletine bağlıdır: yazma sonrası `levelTanimiDogrula` yakalar). */
export function alanDegeriHatasi(s: AlanSemasi, v: unknown): string | null {
  switch (s.tip) {
    case "sayi": {
      if (typeof v !== "number" || !Number.isFinite(v)) return `${s.etiket}: sayı olmalı`;
      if (s.en !== undefined && v < s.en) return `${s.etiket}: en az ${s.en}`;
      if (s.cok !== undefined && v > s.cok) return `${s.etiket}: en çok ${s.cok}`;
      return null;
    }
    case "bool": return typeof v === "boolean" ? null : `${s.etiket}: doğru/yanlış olmalı`;
    case "metin": case "renk": {
      if (typeof v !== "string" || v.length === 0) return `${s.etiket}: boş olmayan metin olmalı`;
      if (s.secenekler && !s.secenekler.includes(v)) return `${s.etiket}: şunlardan biri olmalı: ${s.secenekler.join(", ")}`;
      return null;
    }
    case "vec3": {
      if (!Array.isArray(v) || v.length !== 3 || !v.every((x) => typeof x === "number" && Number.isFinite(x))) return `${s.etiket}: [x, y, z] (3 sayı) olmalı`;
      if (s.en !== undefined && (v as number[]).some((x) => x < s.en!)) return `${s.etiket}: her bileşen en az ${s.en}`;
      return null;
    }
  }
}
