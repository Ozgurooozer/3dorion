// bridge/yapisalSozlesme.ts — Dış beyin (claude -p) için YAPISAL çıktı sözleşmesi (spec 26 F1).
//
// NEDEN: `satirSozlesmesi.ts` Haiku'ya yalnız DÖRT eylem bırakıyor (KOMUT, TAHTA, GIDILECEK, BAK). Oturma, kalkma, durma,
// jest, poz, odaklanma, Ozyn'e gelme onun için YOK: "otur" deyince `GIDILECEK: sandalye` uyduruyor, "kalk" → git,
// "dur" → yalnız söz. F0 ölçümü (docs/olcum/f0-taban-*): Haiku beden kümesi 1/6; aynı senaryolarda gerçek araç
// yüzeyi olan yerel modeller 17–18/18. Sorun model değil, ifade edebildiği eylemlerin azlığıydı.
//
// ÇÖZÜM: Claude Code'un `--json-schema` çıktısı. Model `{ soz, eylemler: [{ arac, girdi }] }` döner; `arac` araç tablosunun
// (araclar.ts) ADIDIR, bu yüzden satır sözleşmesi gibi ikinci bir eylem sözlüğü yoktur — kopya değil, tablodan türer.
// Araç yüzeyi modele sıkıştırılmış bir REHBER olarak verilir (tam JSON şeması 5 bin karakter; rehber ~2 bin).
//
// SAF: bağımlılık yok (araclar.ts + protokol), ağ yok.
"use strict";
import { ARAC_TABLOSU, araclariUret, type AracTanimi } from "./araclar.ts";
import type { AracCagrisi, BeyinCikti } from "./beyin.ts";

/** `soz` alanı konuşmayı taşır (dunya_soyle); eylem listesinde ayrıca bulunmaz. */
const KONUSMA_ARACI = "dunya_soyle";

/** Modelin `arac` alanına yazabileceği adlar: araç tablosu eksi konuşma (konuşma `soz` alanında). */
export function yapisalAraclar(araclar: readonly AracTanimi[] = araclariUret()): string[] {
  return araclar.map((a) => a.ad).filter((ad) => ad !== KONUSMA_ARACI);
}

/** Claude Code `--json-schema` için şema. `girdi` serbest nesne: doğrulama köprüde (protocol/dogrula.ts), şemada değil. */
export function yapisalSema(araclar?: readonly AracTanimi[]): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      soz: { type: "string", description: "What you say aloud, in Turkish. Empty string if there is nothing to say." },
      eylemler: {
        type: "array",
        description: "Body/world actions to perform, in order. Empty if none.",
        items: {
          type: "object",
          properties: {
            arac: { type: "string", enum: yapisalAraclar(araclar) },
            girdi: { type: "object" },
          },
          required: ["arac", "girdi"],
        },
      },
    },
    required: ["soz", "eylemler"],
  };
}

/** Bir tanımın ilk iki cümlesi (rehber kısa kalsın; `sor`un değerlerinin anlamı gibi ayırt edici bilgi ikinci cümlede). */
const ilkCumle = (s: string): string => (s.match(/[^.]*\.(?:\s|$)/g) ?? [s]).slice(0, 2).join("").trim();

/**
 * Araç rehberi: araç başına tek satır — ad, argümanlar, ilk cümle. Enum'lar (poz, jest, sor) satırda; hedef biçimi
 * bir kez, en altta. Tablodan ÜRETİLİR: araç eklenince/değişince rehber kendiliğinden güncellenir.
 */
export function aracRehberi(araclar: readonly AracTanimi[] = araclariUret()): string {
  const satirlar = araclar.filter((a) => a.ad !== KONUSMA_ARACI).map((a) => {
    const props = a.sema.properties as Record<string, { enum?: string[] }>;
    const gerekli = new Set(a.sema.required ?? []);
    const arg = Object.entries(props).map(([ad, p]) => {
      const tur = p.enum ? p.enum.join("|") : "";
      return `${ad}${gerekli.has(ad) ? "" : "?"}${tur ? `=${tur}` : ""}`;
    }).join(", ");
    return `- ${a.ad}${arg ? `{${arg}}` : ""}: ${ilkCumle(a.aciklama)}`;
  });
  return [
    "ACTIONS you can perform (put them in `eylemler`, in order, each as {arac, girdi}):",
    ...satirlar,
    "hedef = {tip:'oyuncu'} for Ozyn himself · {tip:'capa',ad:<place name>} for a place · {tip:'nesne',ad} · {tip:'nokta',x,y,z}.",
    "Speech goes in `soz` (Turkish), never in `eylemler`. Leave `eylemler` empty when no action is needed.",
  ].join("\n");
}

/** Modelin yapısal cevabı (`structured_output`) → köprünün beklediği `BeyinCikti`. Bozuk girdi: boş çıktı + not (sessiz düşme yok). */
export function yapisaldanCikti(ham: unknown, bilgi: Record<string, unknown> = {}, araclar?: readonly AracTanimi[]): BeyinCikti {
  const o = ham !== null && typeof ham === "object" ? (ham as Record<string, unknown>) : null;
  if (!o) return { metin: "", cagrilar: [], bilgi: { ...bilgi, yapisalHata: "cevap nesne değil" } };
  // Tur için SUNULAN araçlar (köprü süzmüş olabilir): sunulmayanı çağıran cevap geçersiz sayılır, kayda düşer.
  const bilinen = new Set(yapisalAraclar(araclar));
  const cagrilar: AracCagrisi[] = [];
  const notlar: string[] = [];
  for (const e of Array.isArray(o["eylemler"]) ? o["eylemler"] : []) {
    const ad = e !== null && typeof e === "object" ? (e as Record<string, unknown>)["arac"] : undefined;
    const girdi = e !== null && typeof e === "object" ? (e as Record<string, unknown>)["girdi"] : undefined;
    if (typeof ad === "string" && bilinen.has(ad)) cagrilar.push({ ad, girdi: girdi ?? {} });
    else notlar.push(`bilinmeyen araç: ${String(ad)}`);
  }
  const soz = typeof o["soz"] === "string" ? o["soz"].trim() : "";
  if (soz) cagrilar.push({ ad: KONUSMA_ARACI, girdi: { metin: soz } });
  return { metin: "", cagrilar, bilgi: { ...bilgi, ...(notlar.length ? { yapisalHata: notlar.join("; ") } : {}) } };
}

/** Test/ölçüm için: şemadaki `arac` enum'u araç tablosunun anahtarlarıyla birebir mi (konuşma hariç). */
export const TABLO_ADLARI = (Object.keys(ARAC_TABLOSU) as string[]).filter((t) => `dunya_${t}` !== KONUSMA_ARACI).map((t) => `dunya_${t}`);
