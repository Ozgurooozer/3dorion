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
  description: "A target in the world. For Ozyn {tip:'oyuncu'}; for a named place {tip:'capa',ad:'tahta'}; for a free point {tip:'nokta',x,y,z}.",
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
    aciklama: "Change your posture (a continuous state). Only one posture at a time.",
    sema: { type: "object", properties: { poz: { type: "string", enum: [...POZLAR] } }, required: ["poz"] },
  },
  jest: {
    aciklama: "Make a momentary gesture. Does not change your posture. Give a target when pointing.",
    sema: { type: "object", properties: { jest: { type: "string", enum: [...JESTLER] }, hedef: HEDEF_SEMA }, required: ["jest"] },
  },
  bak: {
    aciklama: "Turn your head or body toward a target. Pass a null target to return to free gaze.",
    sema: { type: "object", properties: { hedef: HEDEF_SEMA }, required: ["hedef"] },
  },
  git: {
    aciklama: "Walk to a target. You are told when you arrive; obstacles are routed around, an unreachable target returns an error.",
    sema: {
      type: "object",
      properties: {
        hedef: HEDEF_SEMA,
        mesafe: { type: "number", description: "How many metres from the target you will stop. Defaults to the anchor's own radius." },
      },
      required: ["hedef"],
    },
  },
  otur: {
    aciklama: "Sit down somewhere. Without an anchor you go to the chair.",
    sema: { type: "object", properties: { capa: { type: "string" } } },
  },
  kalk: { aciklama: "Stand up. If you are seated this comes first, before walking.", sema: { type: "object", properties: {} } },
  soyle: {
    aciklama: "Speak out loud, IN TURKISH. A subtitle appears and audio plays. This is SEPARATE from plain text — put here what you want heard in the room.",
    sema: {
      type: "object",
      properties: {
        metin: { type: "string", description: "Turkish, at most 1200 characters. Should be readable in one breath." },
        ses:   { type: "boolean", description: "If false, subtitle only, no audio." },
      },
      required: ["metin"],
    },
  },
  komut: {
    aciklama:
      "SUGGEST a command to the terminal. The command DOES NOT RUN — it is shown " +
      "to Ozyn on screen and runs only if he approves. Must be a single line. " +
      "`gerekce` is required: why this command? Suggestions without one are " +
      "rejected. Do not insist if rejected.",
    sema: {
      type: "object",
      properties: {
        metin: { type: "string", description: "The single-line command to put before Ozyn for approval." },
        gerekce: { type: "string", description: "Why this command is needed, briefly. Turkish." },
      },
      required: ["metin", "gerekce"],
    },
  },

  yaz: {
    aciklama: "Write on the whiteboard. If you are not in front of the board you must walk there first.",
    sema: {
      type: "object",
      properties: { metin: { type: "string" }, temizle: { type: "boolean", description: "If true, clears the board first." } },
      required: ["metin"],
    },
  },
  al: {
    aciklama: "Take an object into your hand.",
    sema: { type: "object", properties: { nesne: { type: "string" } }, required: ["nesne"] },
  },
  birak: { aciklama: "Drop the object in your hand.", sema: { type: "object", properties: {} } },
  odaklan: {
    aciklama: "Give your attention to a surface (monitor, tahta). Also hints the camera.",
    sema: { type: "object", properties: { capa: { type: "string" } }, required: ["capa"] },
  },
  dur: { aciklama: "Immediately stop everything you are walking and moving.", sema: { type: "object", properties: {} } },
  sor: {
    // Orion odayı BURADAN görür. Cevap yalnızca bulunduğu yerden GÖRÜLEBİLEN
    // şeyleri içerir (mind/algiHizmeti.ts): duvarın arkası bilinmez.
    aciklama: "Look at the room. 'onumde' = the thing right in front of you, 'yakin' = your surroundings, "
      + "'oyuncu' = where Ozyn is, 'dunya' = everything visible from here. Changes nothing.",
    sema: {
      type: "object",
      properties: { ne: { type: "string", enum: ["onumde", "yakin", "oyuncu", "dunya"] } },
      required: ["ne"],
    },
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
