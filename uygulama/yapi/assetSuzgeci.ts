// uygulama/yapi/assetSuzgeci.ts — ALT ÇUBUK · ASSET SEKMESİ MANTIĞI: süzgeç (kategori / favori / son kullanılan), arama, favori ve son listeleri. SAF (DOM yok).
//
// Sekme (DOM) yalnız bunları çizer; hangi kartın görüneceği, sayıların kaç olduğu ve favori/son listelerinin nasıl güncellendiği burada ve testli.
//   • Süzgeç anahtarı: "*tum" | "*favori" | "*son" ya da bir kategori adı (görünen ad). Kategori adı '*' ile başlamaz, çakışma yok.
//   • Arama: boşlukla ayrılmış sözcüklerin HEPSİ ad, kategori ya da katalog adında geçmeli (Türkçe küçük harf; "ağaç" ≠ "agac" — kasıtlı: sözlük adı ne ise o).
//   • "Son": en yeni önce (kartlar listesinde artık olmayan varlık atlanır). Favoriler ve son liste kalıcıdır (`listeyiOku/listeyiYaz`, bozuk kayıt HATA).
"use strict";
import type { AssetKarti } from "../assetListesi.ts";

export const SUZGEC_TUM = "*tum";
export const SUZGEC_FAVORI = "*favori";
export const SUZGEC_SON = "*son";

export const SON_SINIRI = 24;

const kucult = (s: string): string => s.toLocaleLowerCase("tr");

/** Süzgece ve aramaya uyan kartlar (kartlar ada göre sıralı gelir; "son" süzgeci son kullanım sırasına dizer). */
export function kartlariSuz(kartlar: readonly AssetKarti[], suzgec: string, arama: string, favoriler: ReadonlySet<string>, son: readonly string[]): AssetKarti[] {
  let liste: AssetKarti[];
  if (suzgec === SUZGEC_TUM) liste = [...kartlar];
  else if (suzgec === SUZGEC_FAVORI) liste = kartlar.filter((k) => favoriler.has(k.varlik));
  else if (suzgec === SUZGEC_SON) {
    const sira = new Map(kartlar.map((k) => [k.varlik, k]));
    liste = son.flatMap((v) => { const k = sira.get(v); return k ? [k] : []; });
  } else liste = kartlar.filter((k) => k.kategori === suzgec);
  const sozcukler = kucult(arama).split(/\s+/).filter(Boolean);
  if (!sozcukler.length) return liste;
  return liste.filter((k) => {
    const saman = kucult(`${k.ad} ${k.kategori} ${k.varlik}`);
    return sozcukler.every((s) => saman.includes(s));
  });
}

export interface SuzgecSayilari { tum: number; favori: number; son: number; kategoriler: { ad: string; sayi: number }[] }

/** Sol listedeki sayılar. Kategoriler Türkçe sıralı. Katalogda olmayan favori/son sayılmaz. */
export function suzgecSayilari(kartlar: readonly AssetKarti[], favoriler: ReadonlySet<string>, son: readonly string[]): SuzgecSayilari {
  const var_ = new Set(kartlar.map((k) => k.varlik));
  const kategoriler = new Map<string, number>();
  for (const k of kartlar) kategoriler.set(k.kategori, (kategoriler.get(k.kategori) ?? 0) + 1);
  return {
    tum: kartlar.length,
    favori: kartlar.filter((k) => favoriler.has(k.varlik)).length,
    son: new Set(son.filter((v) => var_.has(v))).size,
    kategoriler: [...kategoriler].map(([ad, sayi]) => ({ ad, sayi })).sort((a, b) => a.ad.localeCompare(b.ad, "tr")),
  };
}

/** Son kullanılanlara ekle: en başa, yineleme yok, sınırlı. Yeni liste döner. */
export function sonEkle(son: readonly string[], varlik: string, sinir = SON_SINIRI): string[] {
  return [varlik, ...son.filter((v) => v !== varlik)].slice(0, sinir);
}

/** Favori aç/kapa. Yeni küme döner. */
export function favoriDegistir(favoriler: ReadonlySet<string>, varlik: string): Set<string> {
  const y = new Set(favoriler);
  if (y.has(varlik)) y.delete(varlik); else y.add(varlik);
  return y;
}

/** Süzgeç anahtarı hâlâ geçerli mi (kategori katalogdan kalktıysa "tümü"ne düşer). */
export function suzgeciDogrula(suzgec: string, s: SuzgecSayilari): string {
  if (suzgec === SUZGEC_TUM || suzgec === SUZGEC_FAVORI || suzgec === SUZGEC_SON) return suzgec;
  return s.kategoriler.some((k) => k.ad === suzgec) ? suzgec : SUZGEC_TUM;
}

// ── kalıcılık biçimi ──
export function listeyiYaz(liste: Iterable<string>): string { return JSON.stringify({ surum: 1, liste: [...liste] }); }

/** Kayıt metninden liste; boş → []; bozuksa HATA (çağıran uyarıp boşla devam eder). */
export function listeyiOku(metin: string | null): string[] {
  if (!metin) return [];
  const v: unknown = JSON.parse(metin);
  if (typeof v !== "object" || v === null) throw new Error("liste kaydı nesne değil");
  const o = v as Record<string, unknown>;
  if (o["surum"] !== 1) throw new Error(`liste kaydı sürümü desteklenmiyor: ${String(o["surum"])}`);
  if (!Array.isArray(o["liste"]) || !o["liste"].every((x) => typeof x === "string")) throw new Error("liste kaydı bozuk");
  return o["liste"] as string[];
}
