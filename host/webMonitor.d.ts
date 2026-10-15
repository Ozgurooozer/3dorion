// host/webMonitor.d.ts — host/webMonitor.js'in tip yüzü (testler ve renderer tipleri için; JS dosyası tipsiz).
export const VARSAYILAN_ADRES: string;
export const GENISLIK: number;
export const YUKSEKLIK: number;

export function adresGecerliMi(adres: unknown): boolean;
export function pikselCevir(nx: number, ny: number, g?: number, y?: number): { x: number; y: number };

export interface WebmonKareOlayi { olay: "kare"; jpeg: Uint8Array; g: number; y: number }
export interface WebmonDurumOlayi { olay: "durum"; d: "yukleniyor" | "acik" | "kapali" | "sonlandi" }

export interface WebMonitorAyari {
  pencereKur?: () => unknown;
  zamanlayici?: (f: () => void, ms: number) => unknown;
  simdi?: () => number;
}

export interface FareOlayi {
  tip: "hareket" | "bas" | "birak" | "tekerlek" | (string & {});
  x: number;
  y: number;
  dugme?: "left" | "right" | "middle";
  dy?: number;
  dx?: number;
}

export class WebMonitor {
  constructor(olayVer: (olay: WebmonKareOlayi | WebmonDurumOlayi) => void, ayar?: WebMonitorAyari);
  readonly acik: boolean;
  ac(adres?: string): boolean;
  fare(olay: FareOlayi): boolean;
  kapat(): void;
}
