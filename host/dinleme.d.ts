// host/dinleme.d.ts — `dinleme.js` için tip bildirimi.
//
// Modül .js kalıyor çünkü Electron ana süreci (main.js, ESM) onu doğrudan yüklüyor.

export const BETIK_YOLU: string;

/** Dinleme sürecinden renderer'a giden olay. */
export type DinlemeOlayi =
  | { olay: "hazir"; mikrofon: string }
  | { olay: "tanima"; metin: string; ms: number; sure: number; tepe: number }
  | { olay: "bos"; neden: "cok kisa" | "sessiz" }
  | { olay: "hata"; hata: string }
  | { olay: "kapandi"; kod: number | null };

export function satirCoz(satir: string): ({ olay: string } & Record<string, unknown>) | null;

export class Dinleyici {
  constructor(olayVer: (o: DinlemeOlayi) => void, ayar?: { spawn?: (...a: any[]) => any; python?: string; betik?: string });
  readonly calisiyor: boolean;
  baslat(): void;
  kayit(): boolean;
  dur(): boolean;
  kapat(): void;
}
