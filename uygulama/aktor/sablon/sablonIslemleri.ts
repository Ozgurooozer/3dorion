// uygulama/aktor/sablon/sablonIslemleri.ts — "ŞABLON OLARAK KAYDET / ŞABLONDAN YERLEŞTİR" İŞ MANTIĞI (spec 45 B7). Babylon ve DOM YOK; dosya erişimi ENJEKTE (host IPC'si çağırandan).
//
// `aktorSablonu.ts` biçimi bilir, `host/icerik.js aktorYaz` dosyayı yazar; bu dosya ikisini birleştirir ve yerleştirme sonucunu LEVEL DOĞRULAMASINDAN geçirir
// (şablon doğrulaması level doğrulamasının eşi değildir: B6 defteri R29). Level'a yazma ve gerçek-tıklama kapısı çağıranındır (`sablonCubugu.ts`).
// Hiçbir işlev fırlatmaz; her hata AKT-SBL-NNN kodlu, host hatası `kod`uyla ayrıntıda.
"use strict";
import { levelTanimiDogrula, type LevelTanimi, type Vec3 } from "../../../world/level/cekirdek/levelTanimi.ts";
import { kodlu } from "../../../world/level/cekirdek/aktorHatalari.ts";
import { sablonCikar, sablonYerlestir } from "./aktorSablonu.ts";

export type Sonuc<T> = { ok: true; deger: T } | { ok: false; neden: string };
/** Host IPC sonucu (`host/kopru.ts` `IpcSonuc`un yalnız gereken kısmı; uygulama katmanı host tipine bağlanmasın). */
export type HostSonucu<T> = { ok: true; deger: T } | { ok: false; kod: string; mesaj: string };

export const SABLON_KLASORU = "Content/Actors/";
export const SABLON_UZANTISI = ".aktor.json";

/** `Content/Actors/kutu.aktor.json` → `kutu`; şablon dosyası değilse null. */
export function sablonAdi(adres: string): string | null {
  if (!adres.startsWith(SABLON_KLASORU) || !adres.endsWith(SABLON_UZANTISI)) return null;
  const ad = adres.slice(SABLON_KLASORU.length, -SABLON_UZANTISI.length);
  return ad && !ad.includes("/") ? ad : null;
}

/** Host listesinden şablon adları (alfabetik). */
export const sablonAdlari = (adresler: readonly string[]): string[] => adresler.flatMap((a) => { const s = sablonAdi(a); return s ? [s] : []; }).sort((a, b) => a.localeCompare(b, "tr"));

/**
 * Seçili aktörün alt ağacını `ad` adıyla şablon olarak kaydeder. Şablon biçimi ve ad önce burada doğrulanır (host yalnız ad/JSON/boyut bakar);
 * var olan dosyanın üstüne YAZILMAZ (host `var` döner). Dönüş: yazılan adres.
 */
export async function sablonKaydet(
  tanim: LevelTanimi, kokId: string, ad: string, yaz: (ad: string, metin: string) => Promise<HostSonucu<string>>, aciklama?: string,
): Promise<Sonuc<string>> {
  const s = sablonCikar(ad, { nesneler: tanim.nesneler ?? [], isiklar: tanim.isiklar ?? [] }, kokId, aciklama);
  if (!s.ok) return { ok: false, neden: s.neden };
  let r: HostSonucu<string>;
  try { r = await yaz(ad, JSON.stringify(s.deger, null, 2)); }
  catch (e) { return { ok: false, neden: kodlu("AKT-SBL-007", `yazma çağrısı patladı: ${e instanceof Error ? e.message : String(e)}`) }; }
  return r.ok ? { ok: true, deger: r.deger } : { ok: false, neden: kodlu("AKT-SBL-007", `host ${r.kod}: ${r.mesaj}`) };
}

/**
 * Şablon metnini `konum`a yerleştirilmiş YENİ level tanımı üretir (level'a yazmaz). Metin JSON değilse, şablon geçersizse, tavan aşılırsa ya da birleşik tanım
 * level doğrulamasından geçmezse nedenle reddedilir; `kok` yeni kök aktörün kimliği (seçim için).
 */
export function sablonYerlestirMetinden(tanim: LevelTanimi, metin: string, konum: Vec3): Sonuc<{ tanim: LevelTanimi; kok: string }> {
  let ham: unknown;
  try { ham = JSON.parse(metin); } catch { return { ok: false, neden: kodlu("AKT-SBL-007", "şablon dosyası geçerli JSON değil") }; }
  const y = sablonYerlestir(ham, { nesneler: tanim.nesneler ?? [], isiklar: tanim.isiklar ?? [] }, konum);
  if (!y.ok) return { ok: false, neden: y.neden };
  // Boş liste alan olarak eklenmez: şablon yalnız nesne içeriyorsa `isiklar` anahtarı yoktan var olmasın (level dosyası eski biçimde kalır).
  const nesneler = [...(tanim.nesneler ?? []), ...y.deger.nesneler], isiklar = [...(tanim.isiklar ?? []), ...y.deger.isiklar];
  const d = levelTanimiDogrula({ ...tanim, ...(nesneler.length ? { nesneler } : {}), ...(isiklar.length ? { isiklar } : {}) });
  return d.ok ? { ok: true, deger: { tanim: d.deger, kok: y.deger.kok } } : { ok: false, neden: kodlu("AKT-SBL-002", `yerleştirilen aktörler level doğrulamasından geçmedi: ${d.hata}`) };
}
