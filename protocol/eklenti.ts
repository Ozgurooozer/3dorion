// protocol/eklenti.ts — EKLENTİ SÖZLEŞMESİ (spec 40): motorun açılıp kapanabilen parçalarının ortak dili.
//
// Eklenti = depo içi, derleme zamanında kayıtlı modül. Dışarıdan JS yüklemek bu sözleşmenin DIŞINDA (güvenlik: ayrı spec).
// Bu dosya yalnız BİÇİMİ ve kalıcı kaydın doğrulamasını söyler; defter (`uygulama/eklenti/eklentiDefteri.ts`) kuralları işletir.
//
// SIFIR BAĞIMLILIK — `protocol/`un kuralı.
//
// İKİ EKSEN (pano.ts ile aynı ilke): `etki` = değişiklik NE ZAMAN görünür. "yeniden_baslat" anında gibi GÖSTERİLMEZ (panel rozetle söyler).
"use strict";

export const EKLENTI_SURUMU = 1;

export type EklentiKategorisi = "zihin" | "beden" | "arayuz" | "ajan";
export type EklentiEtkisi = "aninda" | "yeniden_baslat";

export interface EklentiSecenegi { id: string; ad: string; aciklama: string }
export interface EklentiSecenekTanimi { ad: string; secenekler: readonly EklentiSecenegi[]; varsayilan: string }

export interface EklentiBildirimi {
  /** Kararlı, küçük harf/rakam/tire. Kalıcı kayıtta anahtardır: değişirse Ozyn'in seçimi kaybolur. */
  id: string;
  ad: string;
  aciklama: string;
  kategori: EklentiKategorisi;
  /** Kayıt yokken durum. Mevcut motor özellikleri "acik" (bugünkü davranış), yeni deneyler "kapali". */
  varsayilan: "acik" | "kapali";
  etki: EklentiEtkisi;
  /** Açık olması gereken eklentiler. Bağımlı açıkken bunlar kapatılamaz. */
  bagimli?: readonly string[];
  /** Tek seçimli ek ayar (ör. düşünme kipi). Yoksa eklenti düz açık/kapalıdır. */
  secenek?: EklentiSecenekTanimi;
  /** Doluysa kapatılamaz; değer nedenidir (panelde gösterilir). */
  kilitli?: string;
}

export interface EklentiKaydiGirdisi { acik: boolean; secenek?: string }
/** Kalıcı biçim. Alan eklemek kırıcı değil; silmek/yeniden adlandırmak `EKLENTI_SURUMU` artırır. */
export interface EklentiKaydi { surum: number; durum: Record<string, EklentiKaydiGirdisi> }

export const EKLENTI_KIMLIGI = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const eklentiKimligiGecerli = (id: unknown): id is string => typeof id === "string" && id.length <= 48 && EKLENTI_KIMLIGI.test(id);

export interface KayitSonucu { kayit: EklentiKaydi; /** Sessiz düşüş yok: atılan/bozuk her şeyin nedeni. */ uyarilar: string[] }

const bosKayit = (): EklentiKaydi => ({ surum: EKLENTI_SURUMU, durum: {} });

/**
 * Depodan okunan ham metni doğrular. Bozuk JSON, yabancı sürüm ya da bozuk girdi kaydı ÇÖKERTMEZ: varsayılanlara dönülür, neden `uyarilar`da.
 * Bilinmeyen kimlikler KORUNUR (eklenti geçici kaldırılmış olabilir; Ozyn'in seçimi geri gelince durur).
 */
export function kayitDogrula(ham: unknown): KayitSonucu {
  const uyarilar: string[] = [];
  if (ham === null || ham === undefined || ham === "") return { kayit: bosKayit(), uyarilar };
  let o: unknown = ham;
  if (typeof ham === "string") {
    try { o = JSON.parse(ham); } catch { return { kayit: bosKayit(), uyarilar: ["eklenti kaydı bozuk JSON; varsayılanlara dönüldü"] }; }
  }
  if (typeof o !== "object" || o === null || Array.isArray(o)) return { kayit: bosKayit(), uyarilar: ["eklenti kaydı nesne değil; varsayılanlara dönüldü"] };
  const r = o as { surum?: unknown; durum?: unknown };
  if (r.surum !== EKLENTI_SURUMU) return { kayit: bosKayit(), uyarilar: [`eklenti kaydı sürümü ${String(r.surum)} (beklenen ${EKLENTI_SURUMU}); varsayılanlara dönüldü`] };
  if (typeof r.durum !== "object" || r.durum === null || Array.isArray(r.durum)) return { kayit: bosKayit(), uyarilar: ["eklenti kaydında 'durum' yok; varsayılanlara dönüldü"] };
  const durum: Record<string, EklentiKaydiGirdisi> = {};
  for (const [id, g] of Object.entries(r.durum)) {
    if (!eklentiKimligiGecerli(id)) { uyarilar.push(`geçersiz eklenti kimliği atıldı: ${JSON.stringify(id)}`); continue; }
    const e = g as { acik?: unknown; secenek?: unknown } | null;
    if (typeof g !== "object" || e === null || typeof e.acik !== "boolean") { uyarilar.push(`${id}: kayıt girdisi bozuk (acik boolean değil); atıldı`); continue; }
    durum[id] = typeof e.secenek === "string" && e.secenek.length <= 48 ? { acik: e.acik, secenek: e.secenek } : { acik: e.acik };
  }
  return { kayit: { surum: EKLENTI_SURUMU, durum }, uyarilar };
}

/** `ORION_EKLENTI` biçimi: `id:1,id:0,id=secenek` (virgülle ayrılmış). Geçersiz parçalar atılır ve nedeni söylenir. Senaryolar için. */
export function ortamKaydi(metin: string | undefined): KayitSonucu {
  const kayit = bosKayit(), uyarilar: string[] = [];
  for (const parca of (metin ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const m = /^([^:=]+)(?::([01])|=(.+))$/.exec(parca);
    if (!m || !eklentiKimligiGecerli(m[1])) { uyarilar.push(`ORION_EKLENTI parçası geçersiz: ${JSON.stringify(parca)}`); continue; }
    kayit.durum[m[1]] = m[3] !== undefined ? { acik: true, secenek: m[3] } : { acik: m[2] === "1" };
  }
  return { kayit, uyarilar };
}
