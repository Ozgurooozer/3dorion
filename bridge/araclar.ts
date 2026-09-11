// bridge/araclar.ts — Dünya Protokolü'nü LLM araç yüzeyine çevirir.
//
// Orion'un dünyadaki yetkisi buradan doğar: bu tablo modele "yapabildiklerin"
// olarak sunulur, modelin araç çağrısı da buradan geçip doğrulanmış bir
// `Niyet`e döner. Tek giriş, tek çıkış — dünya başka hiçbir yoldan niyet almaz.
//
// TOKEN NOTU: bu yüzey her turda bağlama girer. Açıklamaları uzatmak her tur
// ödenen sabit maliyettir; kısa tut. Maliyet testle sınırlanıyor.
//
// Araç adları ASCII: bazı sağlayıcılar araç adında ASCII dışı karakteri
// reddediyor. Açıklamalar Türkçe — model Ozyn'le Türkçe konuşuyor.
"use strict";
import { niyetDogrula, type Sonuc } from "../protocol/dogrula.ts";
import { POZLAR, JESTLER, type Niyet, type NiyetTur } from "../protocol/niyet.ts";

/** Sağlayıcıdan bağımsız araç tanımı. Anthropic/OpenAI/Ollama biçimlerine çevrilebilir. */
export interface AracTanimi {
  ad: string;
  aciklama: string;
  sema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}

const ONEK = "dunya_";

/** Hedef şeması — birden çok araçta tekrar ettiği için tek yerde. */
const HEDEF_SEMA = {
  type: "object",
  description: "Dünyada bir hedef. Oyuncu icin {tip:'oyuncu'}; isimli bir yer icin {tip:'capa',ad:'tahta'}; serbest nokta icin {tip:'nokta',x,y,z}.",
  properties: {
    tip: { type: "string", enum: ["oyuncu", "nesne", "capa", "nokta"] },
    ad:  { type: "string", description: "tip 'nesne' veya 'capa' ise zorunlu." },
    x: { type: "number" }, y: { type: "number" }, z: { type: "number" },
  },
  required: ["tip"],
} as const;

/**
 * Her niyet türü için araç tanımı.
 *
 * Bu tablonun protokolle eşleşmesi TESTLE zorlanır: `niyet.ts`'e yeni bir tür
 * eklenip buraya eklenmezse test kırmızı yanar. Yeni yeteneğin sessizce
 * modele görünmez kalması bu şekilde engellenir.
 */
export const ARAC_TABLOSU: Record<NiyetTur, Omit<AracTanimi, "ad">> = {
  poz: {
    aciklama: "Duruşunu değiştir (sürekli hal). Bir seferde tek duruş geçerli.",
    sema: { type: "object", properties: { poz: { type: "string", enum: [...POZLAR] } }, required: ["poz"] },
  },
  jest: {
    aciklama: "Anlık bir jest yap. Duruşu bozmaz. İşaret ederken hedef ver.",
    sema: { type: "object", properties: { jest: { type: "string", enum: [...JESTLER] }, hedef: HEDEF_SEMA }, required: ["jest"] },
  },
  bak: {
    aciklama: "Başını veya gövdeni bir hedefe çevir. Serbest bakışa dönmek için hedef null ver.",
    sema: { type: "object", properties: { hedef: HEDEF_SEMA }, required: ["hedef"] },
  },
  git: {
    aciklama: "Hedefe yürü. Varınca sonuç bildirilir; engel varsa yol bulunur, ulaşılamazsa hata döner.",
    sema: {
      type: "object",
      properties: {
        hedef: HEDEF_SEMA,
        mesafe: { type: "number", description: "Hedefin kac metre yakininda duracagin. Varsayilan capanin kendi yaricapi." },
      },
      required: ["hedef"],
    },
  },
  otur: {
    aciklama: "Bir yere otur. Çapa verilmezse sandalyeye gider.",
    sema: { type: "object", properties: { capa: { type: "string" } } },
  },
  kalk: { aciklama: "Ayağa kalk. Oturuyorsan yürümek için önce bu gerekir.", sema: { type: "object", properties: {} } },
  soyle: {
    aciklama: "Yüksek sesle konuş. Altyazı görünür ve ses çalar. Sohbet metninden AYRI bir eylemdir — odada duyulmasını istediğini buraya yaz.",
    sema: {
      type: "object",
      properties: {
        metin: { type: "string", description: "En cok 1200 karakter. Tek nefeste okunabilir olsun." },
        ses:   { type: "boolean", description: "false ise yalnizca altyazi, ses calmaz." },
      },
      required: ["metin"],
    },
  },
  yaz: {
    aciklama: "Beyaz tahtaya yaz. Tahtanın önünde değilsen önce oraya gitmen gerekir.",
    sema: {
      type: "object",
      properties: { metin: { type: "string" }, temizle: { type: "boolean", description: "true ise once tahtayi siler." } },
      required: ["metin"],
    },
  },
  al: {
    aciklama: "Bir nesneyi eline al.",
    sema: { type: "object", properties: { nesne: { type: "string" } }, required: ["nesne"] },
  },
  birak: { aciklama: "Elindeki nesneyi bırak.", sema: { type: "object", properties: {} } },
  odaklan: {
    aciklama: "Dikkatini bir yüzeye ver (monitor, tahta). Kameraya da ipucu verir.",
    sema: { type: "object", properties: { capa: { type: "string" } }, required: ["capa"] },
  },
  dur: { aciklama: "Yürüdüğün ve oynattığın her şeyi hemen kes.", sema: { type: "object", properties: {} } },
  sor: {
    aciklama: "Dünya hakkında salt-okunur sorgu: nerede ne var, oyuncu nerede. Hiçbir şeyi değiştirmez.",
    sema: { type: "object", properties: { ne: { type: "string", enum: ["dunya", "yakin", "oyuncu"] } }, required: ["ne"] },
  },
};

/** LLM'e sunulacak araç listesi. */
export function araclariUret(): AracTanimi[] {
  return (Object.keys(ARAC_TABLOSU) as NiyetTur[]).map((tur) => ({ ad: ONEK + tur, ...ARAC_TABLOSU[tur] }));
}

/** Araç adı → niyet türü. Bilinmeyen ad için null. */
export function turCoz(aracAdi: string): NiyetTur | null {
  if (typeof aracAdi !== "string" || !aracAdi.startsWith(ONEK)) return null;
  const tur = aracAdi.slice(ONEK.length);
  return tur in ARAC_TABLOSU ? (tur as NiyetTur) : null;
}

/**
 * Modelin araç çağrısını doğrulanmış bir `Niyet`e çevirir.
 *
 * Doğrulama ATLANMAZ: model uydurma alan veya tür üretebilir. Reddedilen
 * çağrının hata metni geçerli seçenekleri söyler, model kendini düzeltebilsin.
 */
export function cagriyiNiyete(aracAdi: string, girdi: unknown): Sonuc<Niyet> {
  const tur = turCoz(aracAdi);
  if (!tur) {
    const gecerli = araclariUret().map((a) => a.ad).join(", ");
    return { ok: false, hata: `bilinmeyen araç: ${String(aracAdi)} (geçerli: ${gecerli})` };
  }
  const govde = (girdi && typeof girdi === "object" && !Array.isArray(girdi))
    ? { ...(girdi as Record<string, unknown>) } : {};
  // "bak" için alanın hiç verilmemesi ile null farklıdır: verilmediyse serbest bakış.
  if (tur === "bak" && !("hedef" in govde)) govde.hedef = null;
  return niyetDogrula({ ...govde, tur });
}

/** Kaba token maliyeti (4 karakter ~ 1 token). Bütçe denetimi testte sınırlanır. */
export function yuzeyMaliyeti(): number {
  return Math.ceil(JSON.stringify(araclariUret()).length / 4);
}
