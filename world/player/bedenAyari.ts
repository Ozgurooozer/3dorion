// world/player/bedenAyari.ts — Ozyn'in bedeninin AYARI: hangi giysi parçaları görünür, hangi renkte. Saf (DOM ve Babylon yok).
//
// Beden modülerdir: `assets/oyuncu-beden.glb` her parçayı ayrı mesh olarak taşır (üretim `tools/avatar-blender/oyuncu_giysi.py`).
// Burası parçaları SLOT'lara böler (üst, dış, alt, ayakkabı) ve hangi mesh'lerin açılacağını hesaplar; çizim `oyuncuBeden.ts`te, düzenleme
// arayüzü `world/arayuz/bedenPaneli.ts`te, kalıcılık `uygulama/bedenKaydi.ts`te. Yeni giysi eklemek: Blender betiğine bir varyant + aşağıdaki
// SLOTLAR tablosuna bir satır; başka kod değişmez (panel seçenekleri tablodan üretir).
"use strict";

/** Bir slotun seçenekleri: id → görünen ad. `null` kimlikli "yok" seçeneği her slotta vardır (çıplak). */
export interface Slot {
  /** Ayar anahtarı. */
  readonly kimlik: "ust" | "dis" | "alt" | "ayakkabi";
  readonly ad: string;
  /** Seçenek kimliği → glb mesh adı (`oyuncu_<x>`). */
  readonly secenekler: Readonly<Record<string, { readonly ad: string; readonly mesh: string }>>;
  /** Slotun rengi tek: bütün seçenekler aynı renk anahtarını paylaşır (gömlek uzun/kısa aynı renk). */
  readonly renk: RenkAnahtari;
}

export type RenkAnahtari = "ten" | "ust" | "dis" | "alt" | "ayakkabi";

export const SLOTLAR: readonly Slot[] = [
  { kimlik: "ust", ad: "Üst", renk: "ust", secenekler: {
    gomlek_uzun: { ad: "Gömlek (uzun kollu)", mesh: "oyuncu_gomlek_uzun" },
    gomlek_kisa: { ad: "Tişört (kısa kollu)", mesh: "oyuncu_gomlek_kisa" } } },
  { kimlik: "dis", ad: "Dış", renk: "dis", secenekler: {
    ceket: { ad: "Ceket", mesh: "oyuncu_ceket" } } },
  { kimlik: "alt", ad: "Alt", renk: "alt", secenekler: {
    pantolon_uzun: { ad: "Pantolon", mesh: "oyuncu_pantolon_uzun" },
    pantolon_sort: { ad: "Şort", mesh: "oyuncu_pantolon_sort" } } },
  { kimlik: "ayakkabi", ad: "Ayakkabı", renk: "ayakkabi", secenekler: {
    ayakkabi: { ad: "Ayakkabı", mesh: "oyuncu_ayakkabi" } } },
];

/** Dosya adı; yolu ORTAMA göre çözmek çağıranın işi (`world/varlik.ts` `varlik()`): paketli Electron file:// altında "/oyuncu-beden.glb" diskin köküne bakar ve
 * yüklenemez ("Error status: 0", 2026-10-16 canlı log). */
export const OYUNCU_BEDEN_DOSYASI = "oyuncu-beden.glb";

/** Çıplak gövde her zaman görünür; rengi ten rengidir. */
export const TEN_MESHI = "oyuncu_ten";

export const YOK = "yok";

export const RENK_ADLARI: Readonly<Record<RenkAnahtari, string>> = {
  ten: "Ten", ust: "Üst", dis: "Dış (ceket)", alt: "Alt", ayakkabi: "Ayakkabı",
};

export interface BedenAyari {
  /** Slot kimliği → seçenek kimliği ya da "yok". */
  secim: Record<Slot["kimlik"], string>;
  /** Renk anahtarı → "#rrggbb" (sRGB). */
  renk: Record<RenkAnahtari, string>;
}

/** Varsayılan: gömlek + ceket + pantolon + ayakkabı (ilk giysili beden). */
export const VARSAYILAN: Readonly<BedenAyari> = {
  secim: { ust: "gomlek_uzun", dis: "ceket", alt: "pantolon_uzun", ayakkabi: "ayakkabi" },
  renk: { ten: "#bc9178", ust: "#c9cbcd", dis: "#1f335e", alt: "#404045", ayakkabi: "#2b2119" },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Bilinmeyen/bozuk her alan SESSİZCE değil, ALAN BAZINDA varsayılana döner (eski kayıt yeni glb ile bozulmasın). Dönüş her zaman geçerli. */
export function ayariDuzelt(ham: unknown): BedenAyari {
  const o = (typeof ham === "object" && ham !== null ? ham : {}) as { secim?: unknown; renk?: unknown };
  const sec = (typeof o.secim === "object" && o.secim !== null ? o.secim : {}) as Record<string, unknown>;
  const ren = (typeof o.renk === "object" && o.renk !== null ? o.renk : {}) as Record<string, unknown>;
  const secim = { ...VARSAYILAN.secim };
  for (const s of SLOTLAR) {
    const v = sec[s.kimlik];
    if (typeof v === "string" && (v === YOK || Object.hasOwn(s.secenekler, v))) secim[s.kimlik] = v;
  }
  const renk = { ...VARSAYILAN.renk };
  for (const k of Object.keys(renk) as RenkAnahtari[]) {
    const v = ren[k];
    if (typeof v === "string" && HEX.test(v)) renk[k] = v.toLowerCase();
  }
  return { secim, renk };
}

/** JSON metninden ayar; ayrıştırılamazsa varsayılan. */
export function ayariOku(metin: string | null): BedenAyari {
  if (!metin) return ayariDuzelt(null);
  try { return ayariDuzelt(JSON.parse(metin)); } catch { return ayariDuzelt(null); }
}

export const ayariYaz = (a: BedenAyari): string => JSON.stringify(a);

/** Görünmesi gereken mesh adları (çıplak gövde dahil). */
export function gorunenMeshler(a: BedenAyari): string[] {
  const liste = [TEN_MESHI];
  for (const s of SLOTLAR) {
    const sec = s.secenekler[a.secim[s.kimlik]];
    if (sec) liste.push(sec.mesh);
  }
  return liste;
}

/** Bir mesh'in rengini belirleyen anahtar (ten dahil); bedene ait değilse null. */
export function meshRengi(meshAdi: string): RenkAnahtari | null {
  if (meshAdi === TEN_MESHI) return "ten";
  for (const s of SLOTLAR) for (const x of Object.values(s.secenekler)) if (x.mesh === meshAdi) return s.renk;
  return null;
}

/** glb'deki bütün beklenen mesh adları: tablo ile glb arasındaki sözleşme (testle denetlenir). */
export const BEKLENEN_MESHLER: readonly string[] = [TEN_MESHI, ...SLOTLAR.flatMap((s) => Object.values(s.secenekler).map((x) => x.mesh))];
