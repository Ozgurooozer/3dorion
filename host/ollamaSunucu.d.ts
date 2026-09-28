// host/ollamaSunucu.d.ts — `ollamaSunucu.js` için tip bildirimi.
//
// Modül .js kalıyor çünkü Electron ana süreci (main.js, ESM) onu doğrudan yüklüyor.

export const VARSAYILAN_ADRES: "http://127.0.0.1:11434";
export function ollamaAdresi(host: string | undefined): string;
export function ayaktaMi(adres: string, ayar?: { fetch?: typeof fetch; zamanAsimiMs?: number }): Promise<boolean>;

export interface OllamaHazirlik {
  durum: "kapali-istendi" | "zaten-ayakta" | "baslatildi" | "baslatilamadi";
  surec: unknown;
  /** Yalnızca BİZİM başlattığımız süreci durdurur. */
  kapat(): void;
}

export function ollamaHazirla(ayar?: {
  env?: Record<string, string | undefined>;
  spawn?: (komut: string, argv: string[], secenek: object) => unknown;
  fetch?: typeof fetch;
  log?: (m: string) => void;
  zamanAsimiMs?: number;
  beklemeMs?: number;
  aralikMs?: number;
}): Promise<OllamaHazirlik>;
