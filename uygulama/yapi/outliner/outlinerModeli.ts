// uygulama/yapi/outliner/outlinerModeli.ts — LEVEL OUTLINER MODELİ (spec 39 D6; Unreal World Outliner): sahnedeki anlamlı nesneleri türe göre gruplar, arar, sıralar. SAF (DOM/Babylon yok).
//
// Kaynak: `Yer.nesneler` (oda + level nesneleri; `world/level/nesneKaydi.ts` `Nesne`). Burada yalnız ihtiyaç duyulan alanlar yapısal tiple alınır (Level alt-sisteminin iç tipine bağlanmaz).
// Grup sırası sabit (yapı → … → detay), bilinmeyen tür sona kendi adıyla; grup içi ada göre (Türkçe, sayılar sayı gibi). Arama ad, kimlik ve tür adında (harf/Türkçe farkı gözetmez).
"use strict";

export interface OutlinerNesnesi { id: string; ad: string; tur: string; kutu: { x: number; y: number; z: number } }
export interface OutlinerSatiri { id: string; ad: string; tur: string; konum: string }
export interface OutlinerGrubu { tur: string; ad: string; satirlar: OutlinerSatiri[] }

/** Tür sırası ve Türkçe adları (world/level/cekirdek/anlam.ts NESNE_TURLERI ile aynı onbir tür). */
export const TUR_ADLARI: Readonly<Record<string, string>> = {
  yapi: "Yapı", mobilya: "Mobilya", esya: "Eşya", aydinlatma: "Aydınlatma", yuzey: "Yüzey", tabela: "Tabela", yol: "Yol", bitki: "Bitki", altyapi: "Altyapı", arac: "Araç", detay: "Detay",
};
const SIRA = Object.keys(TUR_ADLARI);

const normal = (s: string): string => s.toLocaleLowerCase("tr").normalize("NFC");
const sirala = (a: string, b: string): number => a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" });

/** Konum metni: "x, y, z" metre, bir ondalık; sayı olmayan 0. */
export function konumMetni(k: { x: number; y: number; z: number }): string {
  const f = (n: number): string => (Number.isFinite(n) ? n : 0).toFixed(1);
  return `${f(k.x)}, ${f(k.y)}, ${f(k.z)}`;
}

/** Türün görünen adı (bilinmeyen tür kendi adıyla). */
export const turAdi = (tur: string): string => TUR_ADLARI[tur] ?? tur;

/**
 * Gruplanmış, aranmış liste. Boş gruplar çıkmaz. Arama ad/kimlik/tür adında geçer; boş ya da boşluk arama süzmez.
 * Aynı kimlikli iki nesne gelirse İLKİ kalır (kimlik seçimin anahtarıdır; ikilemek yanlış nesneyi seçtirirdi).
 */
export function gruplariKur(nesneler: readonly OutlinerNesnesi[], arama = ""): OutlinerGrubu[] {
  const a = normal(arama.trim());
  const gorulen = new Set<string>(), harita = new Map<string, OutlinerSatiri[]>();
  for (const n of nesneler) {
    if (gorulen.has(n.id)) continue;
    gorulen.add(n.id);
    if (a && !normal(n.ad).includes(a) && !normal(n.id).includes(a) && !normal(turAdi(n.tur)).includes(a)) continue;
    const l = harita.get(n.tur) ?? [];
    l.push({ id: n.id, ad: n.ad, tur: n.tur, konum: konumMetni(n.kutu) });
    harita.set(n.tur, l);
  }
  const turler = [...harita.keys()].sort((x, y) => {
    const i = SIRA.indexOf(x), j = SIRA.indexOf(y);
    return (i < 0 ? 1e6 : i) - (j < 0 ? 1e6 : j) || sirala(x, y);
  });
  return turler.map((t) => ({ tur: t, ad: turAdi(t), satirlar: harita.get(t)!.sort((p, q) => sirala(p.ad, q.ad) || sirala(p.id, q.id)) }));
}

/** Liste değişti mi anlamak için imza (kimlik+ad+tür+konum): aynıysa DOM yeniden kurulmaz. */
export function imza(nesneler: readonly OutlinerNesnesi[]): string {
  return nesneler.map((n) => `${n.id}|${n.ad}|${n.tur}|${konumMetni(n.kutu)}`).join("\n");
}

/** Toplam satır sayısı (aramadan sonra). */
export const satirSayisi = (g: readonly OutlinerGrubu[]): number => g.reduce((t, x) => t + x.satirlar.length, 0);
