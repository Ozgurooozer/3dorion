// host/proje.d.ts — `proje.js` için tip bildirimi (Electron ana süreci .js'i doğrudan yüklüyor; test ve tipler buradan).
export const PROJE_UZANTISI: string;
export const PROJE_SURUMU: number;
export const PROJELER_KLASORU: string;
export const ICERIK: string;
export const KAYITLI: string;
export type IcerikTuru = "level" | "karakter" | "animasyon" | "sekans" | "graf" | "npc" | "asset";
export const ICERIK_KLASORLERI: Readonly<Record<IcerikTuru, string>>;
export function projeAdiGecerli(ad: unknown): ad is string;
export function projelerKoku(env: Record<string, string | undefined>, belgeler: string, gecici: string): string;
export interface ProjeTanimi { surum: number; ad: string; motorSurumu: string; varsayilanLevel: string; olusturuldu: number }
export function projeTanimiHatasi(t: unknown): string | null;
export interface ProjeBilgisi { ad: string; dizin: string; icerik: string; kayitli: string; varsayilanLevel: string; tanim: ProjeTanimi }
export interface ProjeOzeti { ad: string; dizin: string; degisti: number; hata?: string }
export function projeListe(kok: string): ProjeOzeti[];
/** Hata `kod`u: gecersiz-ad | yok | bozuk. */
export function projeAc(kok: string, ad: string): ProjeBilgisi;
export function icerikDizini(proje: { icerik: string }, tur: IcerikTuru): string;
export function kopyala(kaynak: string, hedef: string): number;
export interface Kopya { kaynak: string; hedef: string }
export interface ProjeSablonu { varsayilanLevel: string; kopyalar?: Kopya[]; yazilacaklar?: { hedef: string; metin: string }[] }
export function projeOlustur(kok: string, ad: string, sablon: ProjeSablonu, secenek?: { goc?: Kopya[]; simdi?: () => number; motorSurumu?: string }): ProjeBilgisi & { kopyalanan: number };
export function sonProjelerOku(yol: string): { gecmis: string[] };
export function sonProjeYaz(yol: string, ad: string): string[];
export function projeSec(env: Record<string, string | undefined>, kok: string, sonYolu: string): string | null;
export function projeHazirla(a: {
  env: Record<string, string | undefined>; kok: string; sonYolu: string; ilkAd: string; sablon: ProjeSablonu; goc?: Kopya[]; simdi?: () => number; motorSurumu?: string;
}): ProjeBilgisi & { olusturuldu: boolean; kopyalanan: number };
export const SABLON_ADLARI: readonly ["ofis", "bos"];
export type SablonAdi = "ofis" | "bos";
/** Hata `kod`u: gecersiz-sablon. */
export function projeSablonu(ad: string, motorKoku: string): ProjeSablonu;
export interface ProjeSatiri extends ProjeOzeti { son: number | null; acik: boolean }
export interface ProjeDurumu { kok: string; acik: string | null; projeler: ProjeSatiri[] }
export function projeDurumu(kok: string, sonYolu: string, acikAd: string | null | undefined): ProjeDurumu;
