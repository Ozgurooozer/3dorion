// host/anahtarDeposu.d.ts — `anahtarDeposu.js` için tip bildirimi (modül .js: main.js doğrudan yükler).

export interface Sifreleyici {
  kullanilabilir(): boolean;
  sifrele(metin: string): Buffer;
  coz(sifreli: Buffer): string;
}

/** Renderer'a giden görünüm: anahtarın kendisi YOK. */
export interface ApiSaglayiciDurumu { ad: string; adres: string; anahtarVar: true; kalici: boolean }

export interface AnahtarDeposu {
  durum(): ApiSaglayiciDurumu[];
  kaydet(ad: string, adres: string, anahtar: string): { ok: true; kalici: boolean } | { ok: false; hata: string };
  sil(ad: string): { ok: true } | { ok: false; hata: string };
  /** YALNIZ ana süreç. */
  anahtar(ad: string): { adres: string; anahtar: string; kalici: boolean } | null;
}

export function adresHatasi(adres: string): string;
export function anahtarDeposuKur(ayar: { yol: string; sifreleyici: Sifreleyici }): AnahtarDeposu;
