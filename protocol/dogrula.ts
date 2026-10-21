// protocol/dogrula.ts — Gelen niyet GÜVENİLMEZ girdidir.
//
// Niyetler LLM çıktısından doğar: alan eksik olabilir, tür uydurulmuş olabilir,
// sayı NaN gelebilir. Dünya tarafı doğrulanmamış hiçbir niyeti işlemez.
// Bağımlılık yok — elle yazılmış doğrulayıcı (şema kütüphanesi taşımıyoruz).
"use strict";
import {
  POZLAR, JESTLER, SORULAR, ORTAM_KONULARI, ORTAM_DEGER_SINIRI, DOKTOR_KAPSAMLARI, OLGU_ANAHTAR_SINIRI, OLGU_DEGER_SINIRI, EMIR_SOZ_SINIRI, EMIR_KIME_SINIRI,
  type Niyet, type NiyetTur, type OrtamNe, type SorKonusu,
} from "./niyet.ts";
import { capaCoz, type Hedef } from "./temel.ts";

export type Sonuc<T> = { ok: true; deger: T } | { ok: false; hata: string };

const TURLER: readonly NiyetTur[] = [
  "poz", "jest", "bak", "git", "otur", "kalk", "soyle",
  "yaz", "al", "birak", "odaklan", "dur", "sor", "hatirla",
  // `komut` BURAYA EKLENMEYİ UNUTMUŞTU ve sessiz bir hata doğurdu:
  // araç tanımı vardı, doğrulayıcı tanımıyordu. Model aracı DOĞRU çağırıyor,
  // köprü "bilinmeyen niyet türü: komut" diyip reddediyordu. Canlı ölçümde
  // "model komut önermiyor" sanıldı; oysa öneriyordu, biz düşürüyorduk.
  "komut",
  "ortam",
  "doktor",
  "emret",
];

const sayi = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v);
const yazi = (v: unknown): boolean => typeof v === "string" && v.length > 0;

/**
 * Çapa adı (BY39-2d): etiket ya da yazım biçimi iç ada çevrilir ("beyaz tahta" → tahta);
 * bilinmeyen ad olduğu gibi geçer — dünya reddeder, hata metni LLM'e döner (bugünkü gibi).
 */
const capaAdi = (ad: string): string => capaCoz(ad) ?? ad;

function hedefDogrula(h: unknown, alan: string): Sonuc<Hedef> {
  if (h === null || typeof h !== "object") return { ok: false, hata: `${alan}: nesne olmalı` };
  const o = h as Record<string, unknown>;
  switch (o.tip) {
    case "oyuncu":
      return { ok: true, deger: { tip: "oyuncu" } };
    case "nesne": {
      if (!yazi(o.ad)) return { ok: false, hata: `${alan}.ad: boş olmayan metin olmalı` };
      // Odadaki şeyin adı bir çapaysa çapadır (spec 13): `sor` "çalışma masası" der, model
      // onu `nesne` diye geri verir ve avatar "bilinmeyen çapa/nesne" ile reddediyordu
      // (ortak test 2026-10-02; taban ölçüsünde 5 kez). Bilinmeyen nesne adı olduğu gibi geçer.
      const capa = capaCoz(o.ad as string);
      return { ok: true, deger: capa ? { tip: "capa", ad: capa } : { tip: "nesne", ad: o.ad as string } };
    }
    case "capa":
      if (!yazi(o.ad)) return { ok: false, hata: `${alan}.ad: boş olmayan metin olmalı` };
      return { ok: true, deger: { tip: "capa", ad: capaAdi(o.ad as string) } };
    case "nokta":
      if (!sayi(o.x) || !sayi(o.y) || !sayi(o.z))
        return { ok: false, hata: `${alan}: x/y/z sonlu sayı olmalı` };
      return { ok: true, deger: { tip: "nokta", x: o.x as number, y: o.y as number, z: o.z as number } };
    default:
      return { ok: false, hata: `${alan}.tip bilinmiyor: ${String(o.tip)} (geçerli: oyuncu, nesne, capa, nokta)` };
  }
}

/** Metin sınırı: bir "soyle" tek nefeste okunabilir olmalı, roman olmamalı. */
export const METIN_SINIRI = 1200;
/** Önerilen komut sınırı. Kısa tutulur: onaylayan insan tek bakışta okumalı. */
export const KOMUT_SINIRI = 300;

export function niyetDogrula(ham: unknown): Sonuc<Niyet> {
  if (ham === null || typeof ham !== "object") return { ok: false, hata: "niyet nesne olmalı" };
  const o = ham as Record<string, unknown>;
  const tur = o.tur;
  if (typeof tur !== "string" || !TURLER.includes(tur as NiyetTur))
    return { ok: false, hata: `bilinmeyen niyet türü: ${String(tur)} (geçerli: ${TURLER.join(", ")})` };

  switch (tur as NiyetTur) {
    case "poz":
      if (!POZLAR.includes(o.poz as never))
        return { ok: false, hata: `poz geçersiz: ${String(o.poz)} (geçerli: ${POZLAR.join(", ")})` };
      return { ok: true, deger: { tur: "poz", poz: o.poz as never } };

    case "jest": {
      if (!JESTLER.includes(o.jest as never))
        return { ok: false, hata: `jest geçersiz: ${String(o.jest)} (geçerli: ${JESTLER.join(", ")})` };
      if (o.hedef === undefined)
        return { ok: true, deger: { tur: "jest", jest: o.jest as never } };
      const h = hedefDogrula(o.hedef, "hedef");
      if (!h.ok) return h;
      return { ok: true, deger: { tur: "jest", jest: o.jest as never, hedef: h.deger } };
    }

    case "bak": {
      if (o.hedef === null) return { ok: true, deger: { tur: "bak", hedef: null } };
      const h = hedefDogrula(o.hedef, "hedef");
      if (!h.ok) return h;
      return { ok: true, deger: { tur: "bak", hedef: h.deger } };
    }

    case "git": {
      const h = hedefDogrula(o.hedef, "hedef");
      if (!h.ok) return h;
      if (o.mesafe !== undefined && (!sayi(o.mesafe) || (o.mesafe as number) < 0))
        return { ok: false, hata: "mesafe: negatif olmayan sayı olmalı" };
      return { ok: true, deger: { tur: "git", hedef: h.deger, mesafe: o.mesafe as number | undefined } };
    }

    case "otur":
      if (o.capa !== undefined && !yazi(o.capa)) return { ok: false, hata: "capa: metin olmalı" };
      return { ok: true, deger: { tur: "otur", capa: o.capa === undefined ? undefined : capaAdi(o.capa as string) } };

    case "soyle": {
      if (!yazi(o.metin)) return { ok: false, hata: "metin: boş olmayan metin olmalı" };
      const m = o.metin as string;
      if (m.length > METIN_SINIRI)
        return { ok: false, hata: `metin çok uzun (${m.length} > ${METIN_SINIRI})` };
      if (o.ses !== undefined && typeof o.ses !== "boolean")
        return { ok: false, hata: "ses: boolean olmalı" };
      return { ok: true, deger: { tur: "soyle", metin: m, ses: o.ses as boolean | undefined } };
    }

    case "yaz": {
      if (!yazi(o.metin)) return { ok: false, hata: "metin: boş olmayan metin olmalı" };
      if ((o.metin as string).length > METIN_SINIRI)
        return { ok: false, hata: `metin çok uzun (> ${METIN_SINIRI})` };
      return { ok: true, deger: { tur: "yaz", metin: o.metin as string, temizle: o.temizle === true } };
    }

    case "komut": {
      // Tek satır zorunlu: çok satırlı bir "komut" onay ekranında yanıltıcı
      // görünür ve kullanıcı ne onayladığını göremez.
      if (!yazi(o.metin)) return { ok: false, hata: "metin: boş olmayan komut olmalı" };
      const k = (o.metin as string).trim();
      if (k.length > KOMUT_SINIRI) return { ok: false, hata: `komut çok uzun (> ${KOMUT_SINIRI})` };
      if (k.includes(String.fromCharCode(13)) || k.includes(String.fromCharCode(10))) {
        return { ok: false, hata: "komut tek satir olmali - cok satirli oneri onaylanamaz" };
      }
      if (!yazi(o.gerekce)) return { ok: false, hata: "gerekce: neden bu komut? Gerekçesiz öneri kabul edilmez" };
      const g = (o.gerekce as string).trim();
      if (g.length > METIN_SINIRI) return { ok: false, hata: `gerekce çok uzun (> ${METIN_SINIRI})` };
      return { ok: true, deger: { tur: "komut", metin: k, gerekce: g } };
    }

    case "al":
      if (!yazi(o.nesne)) return { ok: false, hata: "nesne: boş olmayan metin olmalı" };
      return { ok: true, deger: { tur: "al", nesne: o.nesne as string } };

    case "odaklan":
      if (!yazi(o.capa)) return { ok: false, hata: "capa: boş olmayan metin olmalı" };
      return { ok: true, deger: { tur: "odaklan", capa: capaAdi(o.capa as string) } };

    case "sor": {
      const ne = o.ne;
      if (!SORULAR.includes(ne as never))
        return { ok: false, hata: `sor.ne geçersiz: ${String(ne)} (geçerli: ${SORULAR.join(", ")})` };
      return { ok: true, deger: { tur: "sor", ne: ne as SorKonusu } };
    }

    case "hatirla": {
      if (!yazi(o.anahtar)) return { ok: false, hata: "anahtar: boş olmayan konu adı olmalı" };
      if (!yazi(o.deger)) return { ok: false, hata: "deger: boş olmayan olgu olmalı" };
      const a = (o.anahtar as string).trim().toLocaleLowerCase("tr").replace(/\s+/g, "_");
      const d = (o.deger as string).trim();
      if (a.length > OLGU_ANAHTAR_SINIRI) return { ok: false, hata: `anahtar çok uzun (> ${OLGU_ANAHTAR_SINIRI})` };
      if (d.length > OLGU_DEGER_SINIRI) return { ok: false, hata: `deger çok uzun (> ${OLGU_DEGER_SINIRI}): kısa, damıtılmış bir olgu yaz` };
      return { ok: true, deger: { tur: "hatirla", anahtar: a, deger: d } };
    }

    case "ortam": {
      if (!ORTAM_KONULARI.includes(o.ne as never))
        return { ok: false, hata: `ortam.ne geçersiz: ${String(o.ne)} (geçerli: ${ORTAM_KONULARI.join(", ")})` };
      // HOŞGÖRÜ (ölçümden, on-kayit-ortam.md ilk koşu): Haiku saati `deger: 18` (sayı) olarak yolladı, `sayi`ya değil;
      // 24 denemenin 12'si yalnız bu yüzden düştü. Niyet açık: sayı `deger`de geldiyse `sayi`ya taşınır; `sayi` sayı
      // gibi bir metinse ("21") sayıya çevrilir. Yanlış adlar (uydurma stil) bu hoşgörüye GİRMEZ: açık hata döner.
      let deger = o.deger, sayiHam = o.sayi;
      if (typeof deger === "number" && sayiHam === undefined) { sayiHam = deger; deger = undefined; }
      if (typeof sayiHam === "string" && sayiHam.trim() !== "" && Number.isFinite(Number(sayiHam))) sayiHam = Number(sayiHam);
      if (deger !== undefined && (typeof deger !== "string" || deger.trim().length === 0 || deger.length > ORTAM_DEGER_SINIRI))
        return { ok: false, hata: `ortam.deger: kısa (≤ ${ORTAM_DEGER_SINIRI}) boş olmayan metin olmalı (sayılar \`sayi\`ya)` };
      if (sayiHam !== undefined && !sayi(sayiHam))
        return { ok: false, hata: "ortam.sayi: sonlu sayı olmalı" };
      const g: Niyet = { tur: "ortam", ne: o.ne as OrtamNe };
      if (deger !== undefined) g.deger = (deger as string).trim();
      if (sayiHam !== undefined) g.sayi = sayiHam as number;
      return { ok: true, deger: g };
    }

    case "doktor": {
      // `kapsam` isteğe bağlı (varsayılan hızlı); verilmişse listede olmalı (uydurma kapsam sessizce hızlıya düşmez).
      if (o.kapsam === undefined) return { ok: true, deger: { tur: "doktor" } };
      if (!DOKTOR_KAPSAMLARI.includes(o.kapsam as never))
        return { ok: false, hata: `doktor.kapsam geçersiz: ${String(o.kapsam)} (geçerli: ${DOKTOR_KAPSAMLARI.join(", ")})` };
      return { ok: true, deger: { tur: "doktor", kapsam: o.kapsam as (typeof DOKTOR_KAPSAMLARI)[number] } };
    }

    case "emret": {
      if (!yazi(o.kime)) return { ok: false, hata: "emret.kime: ajan kimliği olmalı (örn. flash)" };
      if (!yazi(o.soz)) return { ok: false, hata: "emret.soz: boş olmayan kısa komut olmalı (örn. otur)" };
      const kime = (o.kime as string).trim().toLocaleLowerCase("tr");
      // Satır sonları ve çoklu boşluk tek boşluğa iner: komut tek satırdır (çok satırlı metin bir ajanın girdisine ek komut sokamaz).
      const soz = (o.soz as string).trim().replace(/\s+/g, " ");
      if (soz === "") return { ok: false, hata: "emret.soz: boş olmayan kısa komut olmalı (örn. otur)" };
      if (kime.length > EMIR_KIME_SINIRI || !/^[a-z0-9_-]+$/.test(kime)) return { ok: false, hata: `emret.kime geçersiz: ${String(o.kime).slice(0, 30)} (ajan kimliği: harf, rakam, _ ve -)` };
      if (soz.length > EMIR_SOZ_SINIRI) return { ok: false, hata: `emret.soz çok uzun (> ${EMIR_SOZ_SINIRI}): kısa bir komut yaz (otur, bana gel…)` };
      return { ok: true, deger: { tur: "emret", kime, soz } };
    }

    case "kalk":   return { ok: true, deger: { tur: "kalk" } };
    case "birak":  return { ok: true, deger: { tur: "birak" } };
    case "dur":    return { ok: true, deger: { tur: "dur" } };
  }
}
