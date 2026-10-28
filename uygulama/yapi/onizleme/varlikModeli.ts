// uygulama/yapi/onizleme/varlikModeli.ts — VARLIK ÖNİZLEME PENCERESİNİN SAF MANTIĞI (spec 39 D5): karakter tanımını okuma/doğrulama, kemik ağacı sırası, ölçü metni. Babylon/DOM YOK.
//
// Karakter tanımı (`*.karakter.json`, host/proje.js `ORION_KARAKTERI`): `{ tur: "karakter", ad, beden: "<adres>.glb", iskelet }`. `beden` bir içerik ADRESİDİR
// (`Engine/orion-lowpoly.glb` ya da `Content/Characters/X/x.glb`); önizleme o dosyayı yükler. Bozuk/eksik tanım sessiz geçilmez: neden metinle döner.
"use strict";
import { adresKurali } from "../../icerik/icerikModeli.ts";

export interface KarakterTanimi { ad: string; beden: string; iskelet: string | null }
export type KarakterSonucu = { ok: true; tanim: KarakterTanimi } | { ok: false; neden: string };

/** `*.karakter.json` metnini okur. `varsayilanAd`: tanımda `ad` yoksa dosya adından gelen ad. */
export function karakterTanimiOku(metin: string, varsayilanAd: string): KarakterSonucu {
  let h: unknown;
  try { h = JSON.parse(metin); } catch (e) { return { ok: false, neden: `JSON okunamadı: ${e instanceof Error ? e.message : String(e)}` }; }
  if (!h || typeof h !== "object" || Array.isArray(h)) return { ok: false, neden: "karakter tanımı bir nesne değil" };
  const o = h as Record<string, unknown>;
  if (o.tur !== "karakter") return { ok: false, neden: `tür 'karakter' olmalı (bulunan: ${JSON.stringify(o.tur)})` };
  if (typeof o.beden !== "string" || !o.beden) return { ok: false, neden: "'beden' yok (gövde dosyasının adresi: Engine/… ya da Content/…)" };
  const k = adresKurali(o.beden);
  if (k) return { ok: false, neden: `'beden' adresi geçersiz: ${k}` };
  if (!/\.(glb)$/i.test(o.beden)) return { ok: false, neden: `'beden' bir .glb dosyası olmalı: ${o.beden}` };
  const ad = typeof o.ad === "string" && o.ad.trim() ? o.ad.trim().slice(0, 64) : varsayilanAd;
  return { ok: true, tanim: { ad, beden: o.beden, iskelet: typeof o.iskelet === "string" ? o.iskelet : null } };
}

export interface KemikSatiri { ad: string; ust: string | null }
export interface KemikGorunumu { ad: string; ust: string | null; derinlik: number; cocuk: number }

/**
 * Düz kemik listesini AĞAÇ SIRASINA dizer (ata önce, çocuklar kendi sırasıyla) ve derinlik/çocuk sayısını verir. Kök: `ust` null ya da listede olmayan.
 * Aynı ad iki kez geçerse (glb'de olur) ilk geçen sayılır; döngü (A→B→A) sonsuz döngüye girmez, kopuk kalan kemikler sona kök gibi eklenir.
 */
export function kemikAgaci(kemikler: readonly KemikSatiri[]): KemikGorunumu[] {
  const gorulen = new Set<string>(), liste: KemikSatiri[] = [];
  for (const k of kemikler) if (!gorulen.has(k.ad)) { gorulen.add(k.ad); liste.push(k); }
  const cocuklar = new Map<string | null, KemikSatiri[]>();
  for (const k of liste) {
    const u = k.ust !== null && gorulen.has(k.ust) && k.ust !== k.ad ? k.ust : null;
    const a = cocuklar.get(u) ?? []; a.push(k); cocuklar.set(u, a);
  }
  const sonuc: KemikGorunumu[] = [], girildi = new Set<string>();
  const gez = (k: KemikSatiri, derinlik: number): void => {
    if (girildi.has(k.ad)) return;
    girildi.add(k.ad);
    const c = cocuklar.get(k.ad) ?? [];
    sonuc.push({ ad: k.ad, ust: k.ust, derinlik, cocuk: c.length });
    for (const x of c) gez(x, derinlik + 1);
  };
  for (const k of cocuklar.get(null) ?? []) gez(k, 0);
  for (const k of liste) if (!girildi.has(k.ad)) gez(k, 0);   // döngüde kalanlar kaybolmasın
  return sonuc;
}

/** İndeks sayısından üçgen sayısı (üçgen listesi: 3 indeks = 1 üçgen; artık indeks sayılmaz). */
export const ucgenSayisi = (indeksSayisi: number): number => (Number.isFinite(indeksSayisi) && indeksSayisi > 0 ? Math.floor(indeksSayisi / 3) : 0);

/** Boyut metni: metre, iki ondalık ("0.52 × 1.74 × 0.31 m"). Sayı olmayan/negatif değer 0 gösterilir. */
export function olcuMetni(b: readonly [number, number, number]): string {
  const f = (n: number): string => (Number.isFinite(n) && n > 0 ? n : 0).toFixed(2);
  return `${f(b[0])} × ${f(b[1])} × ${f(b[2])} m`;
}

/** Büyük sayı metni (binlik ayraç boşluk): 15000 → "15 000". */
export const sayiMetni = (n: number): string => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Önizlemenin tanıdığı iki tür; başkası için null (model: glb; karakter: tanım dosyası; görsel: png/jpg/webp). */
export function onizlemeTuru(adres: string): "karakter" | "model" | "gorsel" | null {
  const a = adres.toLowerCase();
  if (a.endsWith(".karakter.json")) return "karakter";
  if (/\.(glb)$/.test(a)) return "model";
  if (/\.(png|jpe?g|webp)$/.test(a)) return "gorsel";
  return null;
}
