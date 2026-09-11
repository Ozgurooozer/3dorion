// host/kopru.ts — Electron main ↔ renderer IPC sözleşmesi. TEK KAYNAK.
//
// Hem main hem preload hem renderer buradan okur. Kanal adı burada
// tanımlanmadıysa yoktur; string literal ile IPC çağırmak yasaktır.
"use strict";

/** Renderer → main (davet/çağrı). */
export const CAGRI = {
  ptyAc:    "pty:ac",
  ptiYaz:   "pty:yaz",
  ptyBoyut: "pty:boyut",
  ptyKapat: "pty:kapat",
  /** Piper TTS: metin → wav baytları. */
  sesUret:  "ses:uret",
  /** TTS kurulu mu — UI ses düğmesini buna göre gri yapar. */
  sesVarMi: "ses:var",
  /** Mutlak yol çözümü (VRM, poster, doku) — renderer dosya sistemi görmez. */
  varlik:   "varlik:yol",
} as const;

/** Main → renderer (tek yönlü olay). */
export const OLAY = {
  ptyCikti: "pty:cikti",
  ptyBitti: "pty:bitti",
} as const;

export interface PtyAcIstek {
  /** Boş bırakılırsa ana kabuk (Windows: powershell.exe). */
  kabuk?: string;
  argv?:  string[];
  cwd?:   string;
  cols:   number;
  rows:   number;
}

export interface PtyCikti { id: string; veri: string }
export interface PtyBitti { id: string; kod: number }

/** preload'un renderer'a açtığı yüzey. `window.kopru` olarak erişilir. */
export interface Kopru {
  ptyAc(istek: PtyAcIstek): Promise<string>;
  ptyYaz(id: string, veri: string): void;
  ptyBoyut(id: string, cols: number, rows: number): void;
  ptyKapat(id: string): void;
  ptyDinle(cb: (c: PtyCikti) => void): () => void;
  ptyBittiDinle(cb: (b: PtyBitti) => void): () => void;
  /**
   * Metni sese çevirir ve wav BAYTLARINI döndürür — dosya yolu DEĞİL.
   *
   * Gerekçe: renderer geliştirme modunda http://localhost'tan yüklenir ve
   * oradan `file://` okumak Chromium tarafından engellenir. Bayt döndürmek
   * hem geliştirme hem paketli modda aynı şekilde çalışır (Blob URL).
   */
  sesUret(metin: string): Promise<{ ok: boolean; ses?: Uint8Array; hata?: string }>;
  sesVarMi(): Promise<boolean>;
  varlik(ad: string): Promise<string>;
}

declare global {
  interface Window { kopru: Kopru }
}
