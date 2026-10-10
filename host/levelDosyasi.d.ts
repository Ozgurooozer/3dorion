// host/levelDosyasi.d.ts — `levelDosyasi.js` için tip bildirimi (modül .js: Electron ana süreci doğrudan yükler).
// Hatalar `kod` alanı taşır: 400 geçersiz ad, 404 yok, 409 zaten var.

export const LEVEL_UZANTISI: ".level.json";
export const HAZIR_UZANTISI: ".hazir.json";
export interface LevelDosyaHatasi extends Error { kod: 400 | 404 | 409 }
export interface LevelDosyaOzeti { ad: string; bayt: number; degisme: number }
export function levelAdiGecerli(ad: string): boolean;
export function hazirAdiGecerli(ad: string): boolean;
export function levelYolu(kok: string, ad: string): string;
export function levelListesi(kok: string): LevelDosyaOzeti[];
export function atomikYaz(yol: string, metin: string): void;
export function levelOku(kok: string, ad: string): string;
export function levelKaydet(kok: string, ad: string, metin: string): string;
export function levelOlustur(kok: string, ad: string, metin: string): string;
export function hazirListesi(klasor: string): string[];
export function hazirYolu(klasor: string, ad: string): string;
export function hazirKaydet(klasor: string, ad: string, metin: string, ez: boolean): string;
