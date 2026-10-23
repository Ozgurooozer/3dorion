// uygulama/sekans/editor/izDuzeni.ts — SEKANS EDİTÖRÜNÜN GÖRÜNÜM MODELİ (spec 36 S2): hangi satır nerede, hangi anahtar/bölüm hangi pikselde, fare neye
// değdi. SAF: DOM yok. Sol sütun (iz listesi) ve zaman çizelgesi AYNI satır listesinden çizilir — hizalanmaları tek kaynaktan gelir (DOM'da ölçülmez).
//
// Satır düzeni: her bağlama için bir BAŞLIK satırı (ajan), altında o bağlamanın izleri (dosyadaki sırayla). y = satırlar alanının üstünden piksel
// (cetvel bunun dışında, üstte).
"use strict";
import type { Baglama, Sekans, SekansIzi } from "../../../protocol/sekans.ts";
import type { Kutu } from "../../duzenleyici/tuvalMatematigi.ts";
import { kareX, type ZamanGorunumu } from "./zamanEkseni.ts";

/** Ölçüler (px). CSS bu sayılardan yazılır (`uygulama/yapi/sekans/sekansStili.ts`). */
export const DUZEN = { cetvel: 26, baslik: 22, satir: 28, elmas: 5, kenar: 6, vurus: 7 } as const;

export type Satir =
  /** Kamera satırı (spec 38 §7): her sekansta EN ÜSTTE, tek; kamera kesmeleri burada çizilir. */
  | { tur: "kamera"; y: number; h: number }
  | { tur: "baglama"; baglama: Baglama; y: number; h: number }
  | { tur: "iz"; iz: SekansIzi; baglama: Baglama; y: number; h: number };

export function satirlar(s: Sekans): Satir[] {
  const l: Satir[] = [{ tur: "kamera", y: 0, h: DUZEN.satir }];
  let y = DUZEN.satir;
  for (const b of s.baglamalar) {
    l.push({ tur: "baglama", baglama: b, y, h: DUZEN.baslik }); y += DUZEN.baslik;
    for (const iz of s.izler) if (iz.baglama === b.id) { l.push({ tur: "iz", iz, baglama: b, y, h: DUZEN.satir }); y += DUZEN.satir; }
  }
  return l;
}

export const toplamYukseklik = (l: readonly Satir[]): number => l.reduce((t, s) => Math.max(t, s.y + s.h), 0);
export const satirBul = (l: readonly Satir[], y: number): Satir | null => l.find((s) => y >= s.y && y < s.y + s.h) ?? null;
export const izSatiri = (l: readonly Satir[], izId: string): Extract<Satir, { tur: "iz" }> | null =>
  (l.find((s) => s.tur === "iz" && s.iz.id === izId) as Extract<Satir, { tur: "iz" }> | undefined) ?? null;

/** Anahtar kimliği (seçim ve sürükleme): iz + kare (bir izde kare tekil — biçim). */
export interface AnahtarRef { iz: string; kare: number }
export const refAnahtari = (r: AnahtarRef): string => `${r.iz}@${r.kare}`;

export interface AnahtarKonumu extends AnahtarRef { x: number; y: number }

/** Uzuv izlerinin anahtar elmaslarının merkezleri (ekran x, satır y). */
export function anahtarKonumlari(l: readonly Satir[], g: ZamanGorunumu): AnahtarKonumu[] {
  const k: AnahtarKonumu[] = [];
  for (const s of l) if (s.tur === "iz" && s.iz.tur === "uzuv") for (const a of s.iz.anahtarlar) k.push({ iz: s.iz.id, kare: a.kare, x: kareX(g, a.kare), y: s.y + s.h / 2 });
  return k;
}

/** (x, y)'ye `DUZEN.vurus` piksel içindeki EN YAKIN anahtar (yoksa null). */
export function anahtarVurus(k: readonly AnahtarKonumu[], x: number, y: number): AnahtarRef | null {
  let en: AnahtarKonumu | null = null, d = Infinity;
  for (const a of k) {
    const m = Math.hypot(a.x - x, a.y - y);
    if (m <= DUZEN.vurus && m < d) { en = a; d = m; }
  }
  return en ? { iz: en.iz, kare: en.kare } : null;
}

/** Kutu seçimi: kutunun içindeki anahtarlar. */
export const kutudakiAnahtarlar = (k: readonly AnahtarKonumu[], kutu: Kutu): AnahtarRef[] =>
  k.filter((a) => a.x >= kutu.x && a.x <= kutu.x + kutu.g && a.y >= kutu.y && a.y <= kutu.y + kutu.h).map((a) => ({ iz: a.iz, kare: a.kare }));

export interface BolumKutusu { iz: string; i: number; klip: string; x: number; g: number; y: number; h: number }

/** Klip bölümlerinin kutuları (ekran x, satır y; kenardan 3 px iç boşluk). */
export function bolumKutulari(l: readonly Satir[], g: ZamanGorunumu): BolumKutusu[] {
  const k: BolumKutusu[] = [];
  for (const s of l) if (s.tur === "iz" && s.iz.tur === "klip") {
    for (const [i, b] of s.iz.bolumler.entries()) {
      const x = kareX(g, b.baslangic_kare);
      k.push({ iz: s.iz.id, i, klip: b.klip, x, g: kareX(g, b.baslangic_kare + b.uzunluk_kare) - x, y: s.y + 3, h: s.h - 6 });
    }
  }
  return k;
}

export type BolumBolgesi = "sol" | "sag" | "ic";

/**
 * Bölüme vuruş: kenardan `DUZEN.kenar` px içi SOL (kırp: başı ve ofseti birlikte kaydırır) / SAĞ (uzat-kısalt) tutamağı, arası İÇ (taşı). Dar bölümde
 * (< 3 kenar) kenarlar daralır: iç bölge en az üçte bir kalır, bölüm her zaman taşınabilir.
 */
export function bolumVurus(k: readonly BolumKutusu[], x: number, y: number): { iz: string; i: number; bolge: BolumBolgesi } | null {
  for (const b of k) {
    if (y < b.y || y > b.y + b.h || x < b.x || x > b.x + b.g) continue;
    const kenar = Math.min(DUZEN.kenar, b.g / 3);
    return { iz: b.iz, i: b.i, bolge: x <= b.x + kenar ? "sol" : x >= b.x + b.g - kenar ? "sag" : "ic" };
  }
  return null;
}

export interface KesmeKutusu { kare: number; kamera: string; x: number; g: number; y: number; h: number; gecis: "kesme" | "yumusak" }

/** Kamera kesmelerinin kutuları: her kesme kendi karesinden SONRAKİ kesmeye (sonuncu sekansın sonuna) dek uzanır — Unreal'daki Camera Cut izi gibi. */
export function kesmeKutulari(s: Sekans, l: readonly Satir[], g: ZamanGorunumu): KesmeKutusu[] {
  const r = l.find((x) => x.tur === "kamera");
  const kesmeler = s.kesmeler ?? [];
  if (!r) return [];
  return kesmeler.map((k, i) => {
    const bit = kesmeler[i + 1]?.kare ?? s.sure_kare;
    const x = kareX(g, k.kare);
    return { kare: k.kare, kamera: k.kamera, x, g: kareX(g, bit) - x, y: r.y + 3, h: r.h - 6, gecis: k.gecis };
  });
}

/** (x, y)'deki kesme kutusu (yoksa null). */
export const kesmeVurus = (k: readonly KesmeKutusu[], x: number, y: number): number | null =>
  k.find((b) => y >= b.y && y <= b.y + b.h && x >= b.x && x <= b.x + b.g)?.kare ?? null;
