// host/dosyaKlasoru.d.ts — `dosyaKlasoru.js` için tip bildirimi (Electron ana süreci .js'i doğrudan yüklüyor; test ve tipler buradan).
/** Klasördeki bir dosya. */
export interface DosyaBilgisi { ad: string; boyut: number; degisti: number }
/** Hata nesnesinin `kod` alanı: yok | var | gecersiz-ad | gecersiz-icerik | cok-buyuk. */
export function kodluHata(kod: string, mesaj: string): Error & { kod: string };
export function atomikYaz(hedef: string, metin: string): void;
export function klasorDizini(env: Record<string, string | undefined>, envAdi: string, klasor: string, kullaniciVerisi: string, gecici: string): string;
export interface DosyaKlasoru {
  yol(dizin: string, ad: string): string;
  liste(dizin: string): DosyaBilgisi[];
  oku(dizin: string, ad: string): string;
  yaz(dizin: string, ad: string, metin: string): void;
  yeni(dizin: string, ad: string, metin?: string): void;
  /** Kalıcı silmez: `<dizin>/.silinenler/<ad>.<zaman>`a taşır. Yoksa `yok`. */
  kaldir(dizin: string, ad: string, simdi?: () => number): void;
}
export function dosyaKlasoru(t: { adGecerli: (ad: unknown) => boolean; boyutSiniri: number; etiket: string; adEtiketi: string }): DosyaKlasoru;
/** Kayıt başına bir `<ad>.json` olan klasör (grafikler, NPC kayıtları): ad uzantısız; geçersiz ad `gecersiz-ad`. */
export interface JsonKlasoru {
  liste(dizin: string): DosyaBilgisi[];
  oku(dizin: string, ad: string): string;
  yaz(dizin: string, ad: string, metin: string): void;
  yeni(dizin: string, ad: string, metin: string): void;
  /** Kalıcı silmez: `<dizin>/.silinenler/<ad>.json.<zaman>`a taşır. Yoksa `yok`. */
  kaldir(dizin: string, ad: string, simdi?: () => number): void;
}
export function jsonKlasoru(t: { adGecerli: (ad: unknown) => boolean; boyutSiniri: number; etiket: string; adEtiketi: string }): JsonKlasoru;
