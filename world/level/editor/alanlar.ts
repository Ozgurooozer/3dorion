// world/level/editor/alanlar.ts — Level tanımını düzenlenebilir ALANLARA açar; bir yola değer yazar. Saf.
//
// Level paneli her modüle ayrı arayüz yazmaz: tanımın yapraklarını türüne göre (sayı, renk, palet adı,
// mantıksal, dizi) burada sınıflandırır, panel her türe bir girdi koyar. Yeni bir modül ayarı eklenince
// panelde kendiliğinden görünür.
"use strict";

export type Yol = readonly (string | number)[];

export type AlanTuru = "sayi" | "renk" | "paletAdi" | "metin" | "mantik" | "sayiDizisi" | "metinDizisi";

export interface Alan { yol: Yol; deger: unknown; tur: AlanTuru }

const nesneMi = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Bir yaprağın türü. Palet adları verilirse, paletteki bir ada eşit metin "paletAdi" sayılır. */
export function alanTuru(v: unknown, paletAdlari: ReadonlySet<string>): AlanTuru | null {
  if (typeof v === "number") return "sayi";
  if (typeof v === "boolean") return "mantik";
  if (typeof v === "string") return /^#[0-9a-fA-F]{6}$/.test(v) ? "renk" : paletAdlari.has(v) ? "paletAdi" : "metin";
  if (Array.isArray(v) && v.length && v.every((x) => typeof x === "number")) return "sayiDizisi";
  if (Array.isArray(v) && v.length && v.every((x) => typeof x === "string")) return "metinDizisi";
  return null;
}

/** Nesnenin bütün yapraklarını (yol, değer, tür) sırayla döner. Katman dizisi indeksle iner. */
export function alanlar(kok: unknown, paletAdlari: ReadonlySet<string>, yol: Yol = []): Alan[] {
  const t = alanTuru(kok, paletAdlari);
  if (t) return [{ yol, deger: kok, tur: t }];
  if (Array.isArray(kok)) return kok.flatMap((v, i) => alanlar(v, paletAdlari, [...yol, i]));
  if (nesneMi(kok)) return Object.entries(kok).flatMap(([k, v]) => alanlar(v, paletAdlari, [...yol, k]));
  return [];
}

/** Yoldaki değeri okur. */
export function yoldanOku(kok: unknown, yol: Yol): unknown {
  let v: unknown = kok;
  for (const p of yol) {
    if (Array.isArray(v) && typeof p === "number") v = v[p];
    else if (nesneMi(v) && typeof p === "string") v = v[p];
    else return undefined;
  }
  return v;
}

/** Yola değer yazılmış YENİ bir kopya döner (kök değişmez). Yol yoksa hata. */
export function yolaYaz<T>(kok: T, yol: Yol, deger: unknown): T {
  if (yol.length === 0) return deger as T;
  const [bas, ...kalan] = yol;
  if (Array.isArray(kok) && typeof bas === "number" && bas >= 0 && bas < kok.length) {
    const yeni = kok.slice();
    yeni[bas] = yolaYaz(kok[bas], kalan, deger);
    return yeni as T;
  }
  if (nesneMi(kok) && typeof bas === "string" && bas in kok) {
    return { ...kok, [bas]: yolaYaz(kok[bas], kalan, deger) } as T;
  }
  throw new Error(`yol yok: ${yol.join(".")}`);
}
