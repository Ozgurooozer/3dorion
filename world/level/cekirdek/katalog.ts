// world/level/cekirdek/katalog.ts — Varlık kataloğu (assets/sehir/katalog.json) tipi ve doğrulaması. Saf.
//
// Katalog Blender betiğinden üretilir (assets/kaynak/sehir-kiti.py): her varlık ayrı glb, pivot TABAN ORTASI
// (yerleştirilen konum = nesnenin zemine değen ortası), önizleme resmi, boyut (x, yükseklik, z — metre).
"use strict";

export interface Varlik {
  ad: string;
  kategori: string;
  /** assets/ altındaki yol (varlik.ts çözer). */
  dosya: string;
  onizleme: string;
  boyut: [number, number, number];
  ucgen: number;
  bayt: number;
}

export interface Katalog { surum: number; kaynak: string; varliklar: Varlik[] }

/** Kategori kodu → panelde görünen ad. */
export const KATEGORI_ADLARI: Readonly<Record<string, string>> = {
  bina: "binalar", modul: "modüller", detay: "detaylar", yukseltilmis: "köprü/yol üstü", liman: "liman",
  altyapi: "altyapı", neon: "neon", esya: "eşya", yol: "yollar", tabela: "tabelalar",
};

/** Okunur kısa ad: "PROP_TrafficCone_SM" → "TrafficCone SM". */
export const kisaAd = (ad: string) => ad.replace(/^[A-Z]+_(BLD_|MOD_|PROP_)?/, "").replace(/_/g, " ");


const nesneMi = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Katalog JSON'unu doğrular; bozuksa HATA (sessiz boş tarayıcı yok). */
export function katalogOku(v: unknown): Katalog {
  if (!nesneMi(v) || !Array.isArray(v["varliklar"])) throw new Error("katalog: varliklar dizisi yok");
  const adlar = new Set<string>();
  const varliklar = v["varliklar"].map((x, i): Varlik => {
    const b = nesneMi(x) ? x["boyut"] : null;
    if (!nesneMi(x) || typeof x["ad"] !== "string" || typeof x["kategori"] !== "string" || typeof x["dosya"] !== "string"
      || !Array.isArray(b) || b.length !== 3 || !b.every((n) => typeof n === "number")) {
      throw new Error(`katalog: varliklar[${i}] bozuk`);
    }
    if (adlar.has(x["ad"])) throw new Error(`katalog: yinelenen ad ${x["ad"]}`);
    adlar.add(x["ad"]);
    return {
      ad: x["ad"], kategori: x["kategori"], dosya: x["dosya"], onizleme: typeof x["onizleme"] === "string" ? x["onizleme"] : "",
      boyut: [b[0] as number, b[1] as number, b[2] as number], ucgen: Number(x["ucgen"]) || 0, bayt: Number(x["bayt"]) || 0,
    };
  });
  return { surum: Number(v["surum"]) || 1, kaynak: String(v["kaynak"] ?? ""), varliklar };
}
