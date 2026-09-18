// host/hafizaDosyasi.d.ts — `hafizaDosyasi.js` için tip bildirimi.
//
// Modül .js kalıyor çünkü Electron ana süreci (main.js, ESM) onu doğrudan
// yüklüyor. Dönüş tipi `mind/hafizaGocu.ts` → `DosyaDurumu`dan TÜRETİLİR:
// iki yerde ayrı yazılsaydı biri değişince diğeri sessizce kayardı.
//
// "hata" durumunu bu modül ÜRETMEZ — okuma hatasında fırlatır; "hata"yı
// main.js yakalayıp oluşturur. Tip bunu söylüyor.
import type { DosyaDurumu } from "../mind/hafizaGocu.ts";

export function hafizaDosyasiOku(yol: string): Exclude<DosyaDurumu, { durum: "hata" }>;
export function hafizaDosyasiYaz(yol: string, kayitlar: unknown[]): void;
