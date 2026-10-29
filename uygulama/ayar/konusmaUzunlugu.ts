// uygulama/ayar/konusmaUzunlugu.ts — ORION'UN KONUŞMA UZUNLUĞU ayarı (Ses bölümü): kısa / orta / uzun. Seçim tarayıcı deposunda (kullanıcı tercihi; proje verisi değil).
//
// NEDEN AYAR: "iki cümle, 180 karakter" freni ölçümle konmuştu (qwen2.5:7b gevezelik ediyordu, `voice/kisalt.ts`), ama Ozyn'in uzun cevaplarını da yarıda kesiyordu.
// Varsayılan DEĞİŞMEDİ (kısa); uzun cevap isteyen bilerek seçer. Piper tek istekte en çok 1200 karakter alır (`host/ses.js`): "uzun" bunun altında kalır.
"use strict";
import { KONUSMA_UZUNLUKLARI, KONUSMA_UZUNLUGU_VARSAYILAN, type KonusmaUzunlugu } from "../../voice/kisalt.ts";

const ANAHTAR = "orion.konusmaUzunlugu";
type Depo = Pick<Storage, "getItem" | "setItem">;

const gecerliMi = (v: unknown): v is KonusmaUzunlugu => typeof v === "string" && Object.hasOwn(KONUSMA_UZUNLUKLARI, v);

function varsayilanDepo(): Depo | null { try { return globalThis.localStorage ?? null; } catch { return null; } }

/** Kayıtlı seçim; yok, bozuk ya da depo erişilemezse varsayılan (kısa). */
export function konusmaUzunluguOku(depo: Depo | null = varsayilanDepo()): KonusmaUzunlugu {
  try { const v = depo?.getItem(ANAHTAR); return gecerliMi(v) ? v : KONUSMA_UZUNLUGU_VARSAYILAN; } catch { return KONUSMA_UZUNLUGU_VARSAYILAN; }
}

/** Seçimi kaydet; depo yazamazsa false (bu oturumda geçerli kalmaz, sessiz değil: çağıran söyler). */
export function konusmaUzunluguYaz(v: KonusmaUzunlugu, depo: Depo | null = varsayilanDepo()): boolean {
  try { if (!depo) return false; depo.setItem(ANAHTAR, v); return true; } catch { return false; }
}
