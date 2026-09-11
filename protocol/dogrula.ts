// protocol/dogrula.ts — Gelen niyet GÜVENİLMEZ girdidir.
//
// Niyetler LLM çıktısından doğar: alan eksik olabilir, tür uydurulmuş olabilir,
// sayı NaN gelebilir. Dünya tarafı doğrulanmamış hiçbir niyeti işlemez.
// Bağımlılık yok — elle yazılmış doğrulayıcı (şema kütüphanesi taşımıyoruz).
"use strict";
import { POZLAR, JESTLER, type Niyet, type NiyetTur } from "./niyet.ts";
import type { Hedef } from "./temel.ts";

export type Sonuc<T> = { ok: true; deger: T } | { ok: false; hata: string };

const TURLER: readonly NiyetTur[] = [
  "poz", "jest", "bak", "git", "otur", "kalk", "soyle",
  "yaz", "al", "birak", "odaklan", "dur", "sor",
];

const sayi = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v);
const yazi = (v: unknown): boolean => typeof v === "string" && v.length > 0;

function hedefDogrula(h: unknown, alan: string): Sonuc<Hedef> {
  if (h === null || typeof h !== "object") return { ok: false, hata: `${alan}: nesne olmalı` };
  const o = h as Record<string, unknown>;
  switch (o.tip) {
    case "oyuncu":
      return { ok: true, deger: { tip: "oyuncu" } };
    case "nesne":
      if (!yazi(o.ad)) return { ok: false, hata: `${alan}.ad: boş olmayan metin olmalı` };
      return { ok: true, deger: { tip: "nesne", ad: o.ad as string } };
    case "capa":
      if (!yazi(o.ad)) return { ok: false, hata: `${alan}.ad: boş olmayan metin olmalı` };
      return { ok: true, deger: { tip: "capa", ad: o.ad as string } };
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
      return { ok: true, deger: { tur: "otur", capa: o.capa as string | undefined } };

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

    case "al":
      if (!yazi(o.nesne)) return { ok: false, hata: "nesne: boş olmayan metin olmalı" };
      return { ok: true, deger: { tur: "al", nesne: o.nesne as string } };

    case "odaklan":
      if (!yazi(o.capa)) return { ok: false, hata: "capa: boş olmayan metin olmalı" };
      return { ok: true, deger: { tur: "odaklan", capa: o.capa as string } };

    case "sor": {
      const ne = o.ne;
      if (ne !== "dunya" && ne !== "yakin" && ne !== "oyuncu")
        return { ok: false, hata: `sor.ne geçersiz: ${String(ne)} (geçerli: dunya, yakin, oyuncu)` };
      return { ok: true, deger: { tur: "sor", ne } };
    }

    case "kalk":   return { ok: true, deger: { tur: "kalk" } };
    case "birak":  return { ok: true, deger: { tur: "birak" } };
    case "dur":    return { ok: true, deger: { tur: "dur" } };
  }
}
