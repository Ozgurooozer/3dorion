// bridge/ozerkYetenek.ts — Hangi beyin kendiliğinden turda SUSMAYI biliyor (ölçülmüş tablo; OB15, T3-K5).
//
// "Sessizlik" uyanışı (uzun sessizlik, açık iş yok) ancak model gerektiğinde susabiliyorsa değerlidir: susamayan
// model her uyanışta boş bir söz üretir ve Ozyn'i böler. Açık iş hatırlatması bu tabloya bağlı DEĞİL.
//
// ÖLÇÜM (sessizlik senaryoları, canlı yol puanı = tools/f0-canli-puan.ts; köprünün duyurduğu):
//   ozerk2 z5–z8 (ön-kayıt 001, H3 ikinci koşu)  ·  ozerk3 y5–y8 (ön-kayıt 002, H3 düzeltmesinin görmediği set)
//   claude:haiku   4/4 · 4/4  → izinli
//   gemma4:e2b     4/4 · 4/4  → izinli. Ham puan 0/4 · 0/4 idi: kendi şablonunda yazdığı `dunya_poz{…}` söz
//                  sayılıyordu; metin kurtarma o biçimi 2026-10-13'te öğrendi (bridge/metinKurtarma.ts). SONRADAN analiz.
//   ornith-32k     4/4 · 1/4  → izinsiz: görmediği sette sabah selamı ve sohbet etti (002'nin yanlışlayıcısı).
//   qwen2.5:7b     0/4 · 0/4  → izinsiz ("Do not know.", Türkçe sohbet).
// Kanıt: vault forum/orion-beyin0fis/kanit/h3-ozerk2.json, olcum-002.json; ham çıktı docs/olcum/f0-ozerk{2,3}-*.jsonl.
//
// ÖLÇÜLMEMİŞ beyin susamaz sayılır: izin ölçümle verilir, varsayımla değil. Yeni model için iki seti de koş
// (`tools/f0-olc.ts --fixture fixtures/f0/ozerk3.json`), sonra `tools/f0-canli-puan.ts`.
"use strict";

/** Model adı (`:latest` eki atılmış) → sessizlik senaryolarında (canlı yol) susabildi mi. */
export const SUSMA_OLCUMU: Readonly<Record<string, boolean>> = {
  "claude:haiku": true,
  "gemma4:e2b": true,
  "ornith-32k": false,
  "qwen2.5:7b": false,
};

/** Bu beyin "sessizlik" nedeniyle kendiliğinden uyandırılabilir mi. */
export function sessizlikIzinliMi(beyinAdi: string): boolean {
  return SUSMA_OLCUMU[beyinAdi.replace(/:latest$/, "")] === true;
}
