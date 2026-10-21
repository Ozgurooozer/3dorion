// host/sesler.d.ts — `sesler.js` için tip bildirimi (Electron ana süreci .js'i doğrudan yüklüyor; test ve tipler buradan).
export const HF_KOK: string;
export const VARSAYILAN_SES: string;
export interface KatalogSesi {
  readonly dil: string;
  readonly konusmaci: string;
  readonly kalite: string;
  readonly baslik: string;
  /** Kurulumla gelen: panelden silinmez. */
  readonly dahili: boolean;
  /** Content-Length (bayt), 2026-10-21 HEAD ile doğrulandı. */
  readonly boyut: { readonly onnx: number; readonly json: number };
}
export const SES_KATALOGU: readonly KatalogSesi[];
export function sesAdi(g: KatalogSesi): string;
export function sesAdresi(g: KatalogSesi, uzanti: "onnx" | "onnx.json", kok?: string): string;
export function katalogdaBul(ad: string): KatalogSesi | null;
export function sesAdiGecerli(ad: unknown): ad is string;
export function sesDizini(env: Record<string, string | undefined>, ev?: string): string;
export function sesAyariYolu(env: Record<string, string | undefined>, kullaniciVerisi: string, gecici: string): string;

export interface KuruluSes { ad: string; yol: string; boyut: number; dil: string }
export interface BozukSes { ad: string; neden: string }
export function kuruluSesler(dizin: string): { gecerli: KuruluSes[]; bozuk: BozukSes[] };

export type SesKaynagi = "env" | "secim" | "varsayilan" | "ilk" | "yok";
export interface SesCozumu { ad: string | null; yol: string | null; kaynak: SesKaynagi; kilit: string | null; uyari: string | null }
export function sesSecimiCoz(g: {
  envModel: string | null | undefined; envVarMi?: (yol: string) => boolean;
  secili: string | null; kurulu: readonly KuruluSes[]; varsayilan?: string;
}): SesCozumu;

export interface SesAyari { surum: 1; secili: string | null; indirilenler: readonly string[] }
export function sesAyariOku(yol: string): { ayar: SesAyari; uyari: string | null };
export function sesAyariYaz(yol: string, ayar: SesAyari): void;

/** Panelin bir ses satırı (host/sesler.js `sesDurumu`). */
export interface SesSatiri {
  ad: string; baslik: string; dil: string;
  kurulu: boolean; boyut: number | null; beklenenBoyut: number | null;
  katalogda: boolean; indirilebilir: boolean; indiriliyor: boolean; indirildi: boolean;
  silinebilir: boolean; silinemezNeden: string | null;
  secili: boolean; etkin: boolean;
}
export interface SesDurumu {
  sesler: SesSatiri[];
  bozuk: BozukSes[];
  secili: string | null;
  /** Şu an çalan (çözülen) ses. */
  etkin: string | null;
  kaynak: SesKaynagi;
  /** Doluysa panel seçimi geçmez (ORION_PIPER_MODEL). */
  kilit: string | null;
  uyari: string | null;
  piperVar: boolean;
}
export function sesDurumu(g: { kurulu: readonly KuruluSes[]; bozuk?: readonly BozukSes[]; ayar: SesAyari; cozum: SesCozumu; piperVar: boolean; indirilen?: string | null }): SesDurumu;

/** İndirme ilerlemesi (main → renderer olayı). */
export interface SesIndirmeIlerlemesi { ad: string; dosya: "json" | "onnx"; alinan: number; toplam: number }
export interface SesYoneticisi {
  baslat(): SesCozumu;
  durum(): SesDurumu;
  sec(ad: string): SesDurumu;
  indir(ad: string, ilerleme?: (o: SesIndirmeIlerlemesi) => void): Promise<SesDurumu>;
  sil(ad: string): SesDurumu;
}
export function sesYoneticisiKur(g: {
  dizin: string; ayarYolu: string; env?: Record<string, string | undefined>;
  ses: { modelAyarla(yol: string | null): void; kullanilabilir(): boolean };
  indir: (g: { ses: KatalogSesi; ad: string; dizin: string; ilerleme: (o: SesIndirmeIlerlemesi) => void }) => Promise<unknown>;
  uyari?: (m: string) => void;
}): SesYoneticisi;
