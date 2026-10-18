// uygulama/yerlestirmeKaydi.ts — Menüden yerleştirilen asset'lerin kalıcılığı (tarayıcı localStorage). Saf mantık `yerlestirme.ts`te; burası yalnız okur/yazar.
// Level DOSYASINA yazılmaz (Ozyn'indir). Depolama kapalı/dolu/özel pencerede fırlatabilir: her erişim try/catch'te, hata SESSİZ değil uyarı olarak basılır
// ve yerleştirme yine de çalışır (yalnız kaydedilmez). Bozuk kayıt sessizce yutulmaz: uyarı + boş durumla devam.
"use strict";
import { bosDurum, durumuOku, durumuYaz, type YerlestirmeDurumu } from "./yerlestirme.ts";

export const YERLESTIRME_ANAHTARI = "orion.yerlestirme.v1";

export interface Depo {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const varsayilanDepo = (): Depo | null => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

export function yerlestirmeyiYukle(depo: Depo | null = varsayilanDepo()): YerlestirmeDurumu {
  try { return durumuOku(depo?.getItem(YERLESTIRME_ANAHTARI) ?? null); }
  catch (err) { console.warn("[YERLESTIRME] kayıt okunamadı, boş başlıyor:", err instanceof Error ? err.message : String(err)); return bosDurum(); }
}

/** true: yazıldı. */
export function yerlestirmeyiKaydet(d: YerlestirmeDurumu, depo: Depo | null = varsayilanDepo()): boolean {
  if (!depo) { console.warn("[YERLESTIRME] depolama yok, kaydedilmedi"); return false; }
  try { depo.setItem(YERLESTIRME_ANAHTARI, durumuYaz(d)); return true; }
  catch (err) { console.warn("[YERLESTIRME] kaydedilemedi:", err instanceof Error ? err.message : String(err)); return false; }
}
