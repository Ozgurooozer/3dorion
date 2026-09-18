// host/kopru.ts — Electron main ↔ renderer IPC sözleşmesinin TİPLERİ.
//
// KANAL ADLARI BURADA DEĞİL: tek kaynakları `host/kanallar.cjs`. Bu dosyada
// eskiden `CAGRI` ve `OLAY` sabitlerinin ikinci bir kopyası duruyordu ve
// kimse onları import etmiyordu (2026-09-19, grep ile doğrulandı) — yani
// `kanallar.cjs`'in önlemek için yaratıldığı hata sınıfının ta kendisi:
// kanal eklenir, bir kopyaya yazılmaz, `ipcMain.handle(undefined, ...)`
// sessizce hiçbir şey kaydetmez. Silindi; burada yalnızca tipler kalır.
"use strict";
import type { DosyaDurumu } from "../mind/hafizaGocu.ts";

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
  /**
   * Hafıza dosyası (spec 07 K4). Okuma SENKRON — `bridge/kopru.ts` depoyu
   * kurucuda senkron okuyor ve K7 arayüzü değiştirmeyi yasaklıyor.
   * Dönüş biçimi `mind/hafizaGocu.ts` → `DosyaDurumu`.
   */
  hafizaOku(): DosyaDurumu;
  hafizaYaz(kayitlar: unknown[]): void;
  /** Göç için: sonuç bilinmeden "taşındı" denemez. */
  hafizaYazSenkron(kayitlar: unknown[]): boolean;
}

declare global {
  interface Window { kopru: Kopru }
}
