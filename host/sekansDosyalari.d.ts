// host/sekansDosyalari.d.ts — `sekansDosyalari.js` için tip bildirimi (Electron ana süreci .js'i doğrudan yüklüyor; test ve tipler buradan).
import type { DosyaBilgisi } from "./dosyaKlasoru.js";
export type { DosyaBilgisi };
export const SEKANS_BOYUT_SINIRI: number;
export function sekansAdiGecerli(ad: unknown): ad is string;
/** `projeDizini` (spec 39): açık projenin `Content/Sequences`ı; env ve senaryo ondan önce gelir. */
export function sekansDizini(env: Record<string, string | undefined>, kullaniciVerisi: string, gecici: string, projeDizini?: string): string;
/** Hata nesnesinin `kod` alanı: yok | var | gecersiz-ad | gecersiz-icerik | cok-buyuk. */
export function sekansListe(dizin: string): DosyaBilgisi[];
export function sekansOku(dizin: string, ad: string): string;
export function sekansYaz(dizin: string, ad: string, metin: string): void;
export function sekansYeni(dizin: string, ad: string, metin: string): void;
/** Kalıcı silmez: `<dizin>/.silinenler/<ad>.json.<zaman>`a taşır. Yoksa `yok`. */
export function sekansSil(dizin: string, ad: string, simdi?: () => number): void;
