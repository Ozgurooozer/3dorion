// host/mdDosyalari.d.ts — `mdDosyalari.js` için tip bildirimi (Electron ana süreci .js'i doğrudan yüklüyor; test ve tipler buradan).
export const MD_BOYUT_SINIRI: number;
export const SISTEM_DOSYALARI: readonly string[];
export interface MdBilgisi { ad: string; boyut: number; degisti: number; aktif: boolean; sistem: boolean }
/** Hata nesnesinin `kod` alanı: yok | var | gecersiz-ad | gecersiz-icerik | cok-buyuk | bozuk-ayar. */
export function mdAdiGecerli(ad: unknown): ad is string;
export function mdDizini(env: Record<string, string | undefined>, kullaniciVerisi: string, gecici: string): string;
export function mdListe(dizin: string): MdBilgisi[];
export function mdOku(dizin: string, ad: string): string;
export function mdYaz(dizin: string, ad: string, metin: string): void;
export function mdYeni(dizin: string, ad: string, metin?: string): void;
export function mdAktifYap(dizin: string, ad: string, aktif: boolean): void;
export function mdTohumla(dizin: string): string[];
