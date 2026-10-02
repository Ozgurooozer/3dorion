// host/apiIstek.d.ts — `apiIstek.js` için tip bildirimi.

export type ApiSonucu = { ok: true; veri: unknown } | { ok: false; hata: string };

export function maskele(metin: string, anahtar: string): string;
export function apiIstek(a: {
  depo: { anahtar(ad: string): { adres: string; anahtar: string } | null };
  getir?: typeof fetch;
  saglayici: string;
  yol: string;
  govde?: unknown;
  zamanAsimiMs?: number;
}): Promise<ApiSonucu>;
