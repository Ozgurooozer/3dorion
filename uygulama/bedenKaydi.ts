// uygulama/bedenKaydi.ts — Ozyn'in beden ayarının kalıcılığı (tarayıcı localStorage). Saf mantık `world/player/bedenAyari.ts`te; burası yalnız okur/yazar.
// Depolama kapalı/dolu/özel pencerede fırlatabilir: her erişim try/catch'te, hata SESSİZ değil uyarı olarak basılır ve beden yine de çalışır (kaydedilmez).
"use strict";
import { ayariOku, ayariYaz, type BedenAyari } from "../world/player/bedenAyari.ts";

export const BEDEN_ANAHTARI = "orion.beden.v1";

export interface Depo {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const varsayilanDepo = (): Depo | null => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

export function bedenAyariniYukle(depo: Depo | null = varsayilanDepo()): BedenAyari {
  try { return ayariOku(depo?.getItem(BEDEN_ANAHTARI) ?? null); }
  catch (err) { console.warn("[beden] kayıt okunamadı, varsayılan:", err instanceof Error ? err.message : String(err)); return ayariOku(null); }
}

/** true: yazıldı. */
export function bedenAyariniKaydet(a: BedenAyari, depo: Depo | null = varsayilanDepo()): boolean {
  if (!depo) { console.warn("[beden] depolama yok, ayar kaydedilmedi"); return false; }
  try { depo.setItem(BEDEN_ANAHTARI, ayariYaz(a)); return true; }
  catch (err) { console.warn("[beden] ayar kaydedilemedi:", err instanceof Error ? err.message : String(err)); return false; }
}
