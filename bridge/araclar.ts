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
import { POZLAR, JESTLER, SORULAR, ORTAM_KONULARI, type Niyet, type NiyetTur } from "../protocol/niyet.ts";

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
    // Spec 26 F2 (Ozyn: "terminal onaysız çalışsın"): satırı terminale YAZAR ve Enter'a basar. Kabuk komutu da olur,
    // orada çalışan programa (claude gibi) gidecek metin de: "terminale claude yaz" = `claude`, "merhaba yaz" = `merhaba`.
    // Yıkıcı komutlar Ozyn'in onayını bekleyebilir; sonuç sana söylenir.
    aciklama:
      "Type ONE line into Ozyn's terminal and press Enter: a shell command, or text for the program running there " +
      "(e.g. to talk to claude, just send the text). Type exactly what was asked; do not wrap it in echo or Write-Host. " +
      "Works from anywhere: you do not need to walk to the desk. Destructive commands may wait for Ozyn's approval; " +
      "you are told if one is rejected, do not insist. `gerekce` is required: why this line?",
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
    // Spec 13: uzaktaysa beden önce tahtaya kendisi yürür (world/giris.ts `yaz`).
    aciklama: "Write on the whiteboard. If you are not in front of it, you walk there first, then write.",
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
  hatirla: {
    // Spec 26 F3: saklanacak şey DAMITILMIŞ olgu, ham söz değil. Aynı anahtar eskisini günceller (çelişkide yenisi kazanır).
    aciklama:
      "Remember a LASTING fact about Ozyn or the work (his tools, likes, decisions, how he wants things done), " +
      "as a short sentence. Not for commands or small talk. Reuse an existing `anahtar` to update that fact.",
    sema: {
      type: "object",
      properties: {
        anahtar: { type: "string", description: "Short topic id, e.g. favori_renk, terminal_araci." },
        deger: { type: "string", description: "The fact, one short sentence (at most 200 characters)." },
      },
      required: ["anahtar", "deger"],
    },
  },
  sor: {
    // Orion odayı BURADAN görür. Cevap yalnızca bulunduğu yerden GÖRÜLEBİLEN
    // şeyleri içerir (mind/algiHizmeti.ts): duvarın arkası bilinmez.
    // `gor` GÖRME (spec 25 Faz 2): gözünden bakar, algısının üstüne ışığı, rengi, ekranları anlatır — yavaş.
    aciklama: "Look at the room. 'onumde' = the thing right in front of you, 'yakin' = your surroundings, "
      + "'oyuncu' = where Ozyn is, 'dunya' = everything visible from here, "
      + "'gor' = look with your eyes: light, colours, screens, what Ozyn is doing (takes a few seconds). Changes nothing.",
    sema: {
      type: "object",
      properties: { ne: { type: "string", enum: [...SORULAR] } },
      required: ["ne"],
    },
  },
  ortam: {
    // Ova'nın görünümü (ışık, renk, stil, zaman). Açıklama KISA: her turun sabit maliyeti; değer adları şemada.
    aciklama: "Change how the world outside looks. too dark -> isik ac; too bright -> isik kis; evening/night/day or an hour -> saat; "
      + "cartoon/anime look -> stil; fog -> sis. Only works outside.",
    sema: {
      type: "object",
      properties: {
        ne: { type: "string", enum: [...ORTAM_KONULARI] },
        deger: {
          type: "string",
          description: "A short NAME, never a number. stil: standart|cel|toon|anime90|moebius|piksel; renk: gunduz|pastel; isik: kis|ac|sicak|soguk; "
            + "sis: ac|kapat|yogun|hafif; efekt: <gi|ao|bloom|huzme|parilti|egri|vinyet|gren|sapma|keskinlik|derinlik>:ac|kapat; "
            + "shader: <gokZamani|paletHaritasi|zamanKirigi|hataImzasi|debugTarama|firca|elyazmasi|atmosfer>:ac|kapat; "
            + "akis: ac|kapat; dunya: ova|siberpunk|ortacag|buyu.",
        },
        sayi: { type: "number", description: "A NUMBER. saat: the hour 0-24 (e.g. 21); saat_kaydir: hours to move (negative = back); isik: steps (default 1)." },
      },
      required: ["ne"],
    },
  },
};

/** LLM'e sunulacak araç listesi. */
export function araclariUret(): AracTanimi[] {
  return (Object.keys(ARAC_TABLOSU) as NiyetTur[]).map((tur) => ({ ad: ONEK + tur, ...ARAC_TABLOSU[tur] }));
}

/**
 * Bir TUR için sunulacak araçlar (spec 26 F1; köprü ve ölçüm koşucusu aynı işlevi kullanır): yalnız kendi bakışının
 * cevabıyla (`gordum`) uyanan turda `dunya_sor` sunulmaz — cevap geldi, söylemek kaldı. Ölçüm: gordum→sor 6/19 Haiku turu.
 * Ozyn aynı turda konuştuysa (`duydum`) araç yerinde: yeni bir şey isteyebilir.
 */
export function turIcinAraclar(araclar: readonly AracTanimi[], turler: ReadonlySet<string>, ozerk = false): AracTanimi[] {
  // ÖZERK tur (kendiliğinden uyanış; Orion Beyin Ofisi T2-K4): yalnız söz, bak, jest, poz. `sor` yok (kendi sorgusunun
  // cevabı ikinci bir uyanış doğuruyordu: 12 Ekim'de 64/69), komut/git/otur yok (Ozyn yokken bir şey çalıştıramaz).
  if (ozerk) return araclar.filter((a) => OZERK_ARACLAR.has(a.ad));
  return turler.has("gordum") && !turler.has("duydum") ? araclar.filter((a) => a.ad !== "dunya_sor") : [...araclar];
}

/** Kendiliğinden turda sunulan araçlar. Konuşma (`dunya_soyle`) buna dahildir. */
export const OZERK_ARACLAR: ReadonlySet<string> = new Set(["dunya_soyle", "dunya_bak", "dunya_jest", "dunya_poz"]);

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
