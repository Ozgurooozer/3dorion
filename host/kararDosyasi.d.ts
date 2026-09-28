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

/** Orion dışından yazılan öğretimlerin dosyası (kaydın klasöründe ya da sabit dosyanın yanında). */
export function ogretimYolu(ayar: { kok?: string; sabitDosya?: string }): string;
/** Kayıttaki tüm öğretim satırları (ayrıştırılmış, `tur: "ogretim"` olanlar). */
export function ogretimleriOku(ayar: { kok?: string; sabitDosya?: string }): unknown[];
/**
 * Kayıttan seçilen satırlar: türü `turler`de olanlar ve algı türü `algilar`da olan
 * algı satırları (spec 10: geçmiş oturumların görev satırları).
 */
export function satirlariOku(
  ayar: { kok?: string; sabitDosya?: string },
  secim: { turler: readonly string[]; algilar: readonly string[] },
): unknown[];
/** `konum` baytından sonraki tam satırlar ve yeni konum. */
export function yeniSatirlar(yol: string, konum: number): { satirlar: unknown[]; konum: number };

export function kararYaziciKur(ayar: {
  kok?: string;
  sabitDosya?: string;
  simdi?: () => Date;
  uyar?: (m: string) => void;
}): KararYazici;
