// uygulama/eklenti/eklentiModeli.ts — Eklentiler paneli için SAF görünüm modeli (spec 40): kategoriye gruplama, rozet metni, başlık özeti. DOM yok.
//
// Rozet DÜRÜST olmalı: "yeniden başlat" etkili bir eklenti kapatıldığında hâlâ çalışıyordur; panel "kapalı" demez, "kapanacak" der.
"use strict";
import type { EklentiKategorisi, EklentiSecenegi } from "../../protocol/eklenti.ts";
import type { EklentiDurumu } from "./eklentiDefteri.ts";

export type RozetTuru = "iyi" | "soluk" | "uyari" | "hata";

export interface EklentiSatiri {
  id: string;
  ad: string;
  aciklama: string;
  acik: boolean;
  rozet: string;
  rozetTuru: RozetTuru;
  /** Anahtar tıklanabilir mi (kilit/bağımlılık engeli yoksa). */
  degistirilebilir: boolean;
  engel: string | null;
  etki: "aninda" | "yeniden_baslat";
  secenek: { ad: string; secenekler: readonly EklentiSecenegi[]; secili: string } | null;
}
export interface EklentiGrubu { kategori: EklentiKategorisi; ad: string; satirlar: EklentiSatiri[] }

export const KATEGORI_SIRASI: readonly EklentiKategorisi[] = ["zihin", "ajan", "beden", "arayuz"];
export const KATEGORI_ADLARI: Readonly<Record<EklentiKategorisi, string>> = { zihin: "Zihin", ajan: "Ajanlar", beden: "Beden", arayuz: "Arayüz" };

export function rozetMetni(d: EklentiDurumu): { metin: string; tur: RozetTuru } {
  if (d.hata) return { metin: "hata", tur: "hata" };
  if (d.bekleyen) return { metin: d.acik ? "açılacak · yeniden başlat" : "kapanacak · yeniden başlat", tur: "uyari" };
  if (d.acik) return { metin: d.bildirim.kilitli ? "açık · kilitli" : "açık", tur: "iyi" };
  return { metin: "kapalı", tur: "soluk" };
}

export function satirKur(d: EklentiDurumu): EklentiSatiri {
  const r = rozetMetni(d), t = d.bildirim.secenek;
  return {
    id: d.bildirim.id, ad: d.bildirim.ad, aciklama: d.bildirim.aciklama, acik: d.acik,
    rozet: r.metin, rozetTuru: r.tur, degistirilebilir: d.engel === null, engel: d.engel, etki: d.bildirim.etki,
    secenek: t ? { ad: t.ad, secenekler: t.secenekler, secili: d.secenek ?? t.varsayilan } : null,
  };
}

/** Kategori sırasıyla gruplar; boş kategori atlanır; satır sırası kayıt sırasıdır. */
export function gruplariKur(durumlar: readonly EklentiDurumu[]): EklentiGrubu[] {
  return KATEGORI_SIRASI
    .map((kategori): EklentiGrubu => ({ kategori, ad: KATEGORI_ADLARI[kategori], satirlar: durumlar.filter((d) => d.bildirim.kategori === kategori).map(satirKur) }))
    .filter((g) => g.satirlar.length > 0);
}

/** Başlık özeti: "7/9 açık" (+ bekleyen/hata varsa söyler). */
export function ozetMetni(durumlar: readonly EklentiDurumu[]): string {
  const acik = durumlar.filter((d) => d.acik).length, bekleyen = durumlar.filter((d) => d.bekleyen).length, hata = durumlar.filter((d) => d.hata).length;
  return `${acik}/${durumlar.length} açık${bekleyen ? ` · ${bekleyen} yeniden başlatma bekliyor` : ""}${hata ? ` · ${hata} hata` : ""}`;
}
