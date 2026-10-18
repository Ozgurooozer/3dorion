// uygulama/zeminKaydi.ts — Oyun içi zemin şeklinin kalıcılığı (tarayıcı localStorage). Saf mantık `zemin.ts`te; burası yalnız okur/yazar.
// Level DOSYASINA yazılmaz (Ozyn'indir). Depolama kapalı/dolu/özel pencerede fırlatabilir: her erişim try/catch'te, hata SESSİZ değil uyarı olarak basılır ve
// zemin yine şekillenir (yalnız kaydedilmez). Bozuk kayıt sessizce yutulmaz: uyarı + dosyadaki zeminle devam.
"use strict";
import { ZEMIN_ANAHTARI, kaydiOku, kaydiYaz, type ZeminKaydi } from "./zemin.ts";
import type { Depo } from "./yerlestirmeKaydi.ts";

const varsayilanDepo = (): Depo | null => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

export function zeminiYukle(depo: Depo | null = varsayilanDepo()): ZeminKaydi | null {
  try { return kaydiOku(depo?.getItem(ZEMIN_ANAHTARI) ?? null); }
  catch (err) { console.warn("[ZEMIN] kayıt okunamadı, dosyadaki zeminle başlıyor:", err instanceof Error ? err.message : String(err)); return null; }
}

/** true: yazıldı. */
export function zeminiKaydet(k: ZeminKaydi | null, depo: Depo | null = varsayilanDepo()): boolean {
  if (!depo) { console.warn("[ZEMIN] depolama yok, kaydedilmedi"); return false; }
  try { depo.setItem(ZEMIN_ANAHTARI, kaydiYaz(k)); return true; }
  catch (err) { console.warn("[ZEMIN] kaydedilemedi (zemin bu oturumda kalır):", err instanceof Error ? err.message : String(err)); return false; }
}
