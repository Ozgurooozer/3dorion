// uygulama/yapi/level/detayModeli.ts — DETAILS SATIRLARI (spec 43 A2; Unreal Details paneli). SAF (DOM yok): bir aktörün bileşen şemasından çizilecek satırları üretir.
//
// DOM (`detayPaneli.ts`) yalnız bu satırları çizer; hangi alanın nasıl görüneceği, graf satırının "eksik graf" uyarısı ve değişken değerinin metinden çözümü burada (testli).
// Yazma bu dosyada YOK: panel her değişikliği `bilesen.ts` işlemleriyle (şema + tanım doğrulaması) yapar.
"use strict";
import { aktorBul, alanOku, BILESEN_SEMALARI, type AlanDegeri, type AlanTipi, type Sonuc } from "../../../world/level/cekirdek/bilesen.ts";
import type { AktorDegiskeni, LevelTanimi } from "../../../world/level/cekirdek/levelTanimi.ts";

export type DegiskenTipi = "sayi" | "metin" | "bool";
export const DEGISKEN_TIPLERI: readonly DegiskenTipi[] = ["sayi", "metin", "bool"];
export const DEGISKEN_TIP_ADI: Readonly<Record<DegiskenTipi, string>> = { sayi: "sayı", metin: "metin", bool: "doğru/yanlış" };
/** "+ değişken"in ilk değeri (türün sıfırı: graf değişkenleriyle aynı). */
export const DEGISKEN_ILK_DEGERI: Readonly<Record<DegiskenTipi, AktorDegiskeni>> = { sayi: 0, metin: "", bool: false };

export type DetaySatiri =
  | { tur: "alan"; ad: string; etiket: string; tip: AlanTipi; deger: AlanDegeri; en?: number; cok?: number; adim?: number; birim?: string; secenekler?: readonly string[] }
  /** `eksik`: seçili graf grafik deposunda yok (çalışma anında nedenle düşer; burada görünür olsun). */
  | { tur: "graf"; secili: string | null; secenekler: readonly string[]; eksik: boolean }
  | { tur: "degisken"; ad: string; tip: DegiskenTipi; deger: AktorDegiskeni };

export interface DetayBaslik { id: string; aktorTuru: "isik" | "nesne"; baslik: string; satirlar: DetaySatiri[] }

export const degiskenTipi = (v: AktorDegiskeni): DegiskenTipi => (typeof v === "number" ? "sayi" : typeof v === "string" ? "metin" : "bool");

/** Girişteki metni değişken türüne çevirir; çevrilemezse nedeni (sessiz 0 yok). */
export function degiskenDegeriCoz(tip: DegiskenTipi, ham: string): Sonuc<AktorDegiskeni> {
  if (tip === "metin") return { ok: true, deger: ham };
  if (tip === "bool") {
    if (ham === "true") return { ok: true, deger: true };
    if (ham === "false") return { ok: true, deger: false };
    return { ok: false, neden: "doğru/yanlış olmalı" };
  }
  const t = ham.trim();
  const n = Number(t);
  return t !== "" && Number.isFinite(n) ? { ok: true, deger: n } : { ok: false, neden: "sayı olmalı" };
}

/**
 * Aktörün Details satırları: şemadaki her alan (tanımdan okunan değerle), graf satırı, değişkenler (eklenme sırasıyla). Aktör yoksa nedenli hata.
 * `grafAdlari`: grafik deposundaki olay grafikleri (seçenekler); seçili graf listede yoksa `eksik`.
 */
export function detaySatirlari(t: LevelTanimi, id: string, grafAdlari: readonly string[]): Sonuc<DetayBaslik> {
  const y = aktorBul(t, id);
  if (!y) return { ok: false, neden: `aktör yok: ${id}` };
  const veri = y.tur === "nesne" ? t.nesneler![y.sira]! : t.isiklar![y.sira]!;
  const satirlar: DetaySatiri[] = [];
  for (const a of BILESEN_SEMALARI[y.tur].alanlar) {
    const o = alanOku(t, id, a.ad);
    if (!o.ok) return o;
    satirlar.push({ tur: "alan", ad: a.ad, etiket: a.etiket, tip: a.tip, deger: o.deger, ...(a.en !== undefined ? { en: a.en } : {}), ...(a.cok !== undefined ? { cok: a.cok } : {}), ...(a.adim !== undefined ? { adim: a.adim } : {}), ...(a.birim ? { birim: a.birim } : {}) });
  }
  const secili = veri.graf ?? null;
  satirlar.push({ tur: "graf", secili, secenekler: [...grafAdlari], eksik: secili !== null && !grafAdlari.includes(secili) });
  for (const [ad, deger] of Object.entries(veri.degiskenler ?? {})) satirlar.push({ tur: "degisken", ad, tip: degiskenTipi(deger), deger });
  const ad = ("ad" in veri && typeof veri.ad === "string" && veri.ad) || ("varlik" in veri ? veri.varlik : id);
  return { ok: true, deger: { id, aktorTuru: y.tur, baslik: `${BILESEN_SEMALARI[y.tur].etiket}: ${ad}`, satirlar } };
}
