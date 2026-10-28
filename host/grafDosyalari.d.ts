// host/grafDosyalari.d.ts — `grafDosyalari.js` için tip bildirimi (Electron ana süreci .js'i doğrudan yüklüyor; test ve tipler buradan).
import type { DosyaBilgisi } from "./dosyaKlasoru.js";
export type { DosyaBilgisi };
export const GRAF_BOYUT_SINIRI: number;
export function grafAdiGecerli(ad: unknown): ad is string;
/** `projeDizini` (spec 39): açık projenin `Content/Graphs`ı; env ve senaryo ondan önce gelir. */
export function grafDizini(env: Record<string, string | undefined>, kullaniciVerisi: string, gecici: string, projeDizini?: string): string;
/** Hata nesnesinin `kod` alanı: yok | var | gecersiz-ad | gecersiz-icerik | cok-buyuk. */
export function grafListe(dizin: string): DosyaBilgisi[];
export function grafOku(dizin: string, ad: string): string;
export function grafYaz(dizin: string, ad: string, metin: string): void;
export function grafYeni(dizin: string, ad: string, metin: string): void;
/** Kalıcı silmez: `<dizin>/.silinenler/<ad>.json.<zaman>`a taşır. Yoksa `yok`. */
export function grafSil(dizin: string, ad: string, simdi?: () => number): void;
