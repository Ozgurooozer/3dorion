// host/kararDosyasi.d.ts — `kararDosyasi.js` için tip bildirimi.
//
// Modül .js kalıyor çünkü Electron ana süreci (main.js, ESM) onu doğrudan
// yüklüyor. Önek `mind/kararKaydi.ts` → `KARAR_ONEKI` ile aynı olmalı;
// eşitliği kararDosyasi.test.ts bekler.

export const KARAR_ONEKI: "[KARAR]";
export function kararSatiriMi(mesaj: unknown): boolean;
export function gunlukYol(kok: string, tarih?: Date): string;

export interface KararYazici {
  /** Konsol mesajını alır; karar satırıysa dosyaya ekler ve true döner. */
  yaz(mesaj: unknown): boolean;
  sayac(): { yazilan: number; bozuk: number; hata: number };
  yol(): string;
}

export function kararYaziciKur(ayar: {
  kok?: string;
  sabitDosya?: string;
  simdi?: () => Date;
  uyar?: (m: string) => void;
}): KararYazici;
