// host/hafizaDosyasi.d.ts — `hafizaDosyasi.js` için tip bildirimi.
//
// Modül .js kalıyor çünkü Electron ana süreci (main.js, ESM) onu doğrudan
// yüklüyor. Dönüş tipi `mind/hafizaGocu.ts` → `DosyaDurumu`dan TÜRETİLİR:
// iki yerde ayrı yazılsaydı biri değişince diğeri sessizce kayardı.
//
// "hata" durumunu bu modül ÜRETMEZ — okuma hatasında fırlatır; "hata"yı
// main.js yakalayıp oluşturur. Tip bunu söylüyor.
import type { DosyaDurumu } from "../mind/hafizaGocu.ts";

/** Hafıza dosyasının yolu: ORION_HAFIZA_DOSYASI > senaryo (ORION_SMOKE=1, geçici) > gerçek dosya. */
export function hafizaYolu(env: Record<string, string | undefined>, kullaniciDizini: string, geciciDizin: string, pid?: number): string;
/** Durum defterinin yolu: ORION_DURUM_DOSYASI > senaryo (ORION_SMOKE=1, geçici) > gerçek dosya. */
export function durumYolu(env: Record<string, string | undefined>, kullaniciDizini: string, geciciDizin: string, pid?: number): string;
export function hafizaDosyasiOku(yol: string): Exclude<DosyaDurumu, { durum: "hata" }>;
export function hafizaDosyasiYaz(yol: string, kayitlar: unknown[]): void;
