// bridge/ozerkYetenek.ts — Hangi beyin kendiliğinden turda SUSMAYI biliyor (ölçülmüş tablo; OB15, T3-K5).
//
// "Sessizlik" uyanışı (uzun sessizlik, açık iş yok) ancak model gerektiğinde susabiliyorsa değerlidir: susamayan
// model her uyanışta boş bir söz üretir ve Ozyn'i böler. Ölçüm: vault forum/orion-beyin0fis/kanit/h3-ozerk2.json
// (ön-kayıt 001 H3 ikinci koşu, sessizlik senaryoları z5–z8, n=1): Haiku 4/4, ornith-32k 4/4, qwen2.5:7b 0/4,
// gemma4:e2b 0/4. Açık iş hatırlatması bu tabloya bağlı DEĞİL (dört model de ≥ 3/4 hatırlattı).
//
// ÖLÇÜLMEMİŞ beyin susamaz sayılır: izin ölçümle verilir, varsayımla değil. Yeni bir model eklemek için önce
// `tools/f0-olc.ts --fixture fixtures/f0/ozerk*.json` ile sessizlik senaryolarını koş.
"use strict";

/** Model adı (`:latest` eki atılmış) → sessizlik senaryolarında susabildi mi. */
export const SUSMA_OLCUMU: Readonly<Record<string, boolean>> = {
  "claude:haiku": true,
  "ornith-32k": true,
  "qwen2.5:7b": false,
  "gemma4:e2b": false,
};

/** Bu beyin "sessizlik" nedeniyle kendiliğinden uyandırılabilir mi. */
export function sessizlikIzinliMi(beyinAdi: string): boolean {
  return SUSMA_OLCUMU[beyinAdi.replace(/:latest$/, "")] === true;
}
