// host/npcDosyalari.d.ts — `npcDosyalari.js` için tip bildirimi (Electron ana süreci .js'i doğrudan yüklüyor; test ve tipler buradan).
import type { DosyaBilgisi } from "./dosyaKlasoru.js";
export type { DosyaBilgisi };
export const NPC_BOYUT_SINIRI: number;
export function npcAdiGecerli(ad: unknown): ad is string;
export function npcDizini(env: Record<string, string | undefined>, kullaniciVerisi: string, gecici: string): string;
/** Hata nesnesinin `kod` alanı: yok | var | gecersiz-ad | gecersiz-icerik | cok-buyuk. */
export function npcListe(dizin: string): DosyaBilgisi[];
export function npcOku(dizin: string, ad: string): string;
export function npcYaz(dizin: string, ad: string, metin: string): void;
export function npcYeni(dizin: string, ad: string, metin: string): void;
/** Kalıcı silmez: `<dizin>/.silinenler/<ad>.json.<zaman>`a taşır. Yoksa `yok`. */
export function npcSil(dizin: string, ad: string, simdi?: () => number): void;
