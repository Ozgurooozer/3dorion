// bridge/goz.ts — Orion'un GÖRMESİ (spec 25 Faz 2): göz karesi + o anki algı → yerel görme modeli → kısa betim.
//
// ALGI ile GÖRME ayrı (Ozyn, 2026-10-11): algı koddan gelir, kesindir, ucuzdur (NPC gibi: ne, nerede, hangi yönde).
// Görme onun ÜSTÜNE nitel deneyimdir — ışık, renk, ekranlarda ne var, Ozyn ne yapıyor. Bu yüzden model algıyı BAĞLAM
// olarak alır: adlar ve konumlar algıdan gelir, model onları değiştirmez, yalnız karede gördüğüyle birleştirir.
// V0 (§3) görmeyi algının yerine koyup "bulabiliyor mu" diye ölçmüştü; yanlış soruydu (§4).
//
// Bu bir beyin DEĞİL, bir araç: düşünmez, karar vermez, yalnız istenince bakar (Ozyn'in kararı: periyodik bakış yok).
// Bağımlılık: fetch. Babylon yok — kareyi dünya çeker, buraya base64 PNG gelir.
"use strict";
import { OLLAMA_VARSAYILAN_ADRES } from "./ollamaKatalog.ts";

/** Varsayılan görme modeli: V0'da e4b çok daha çok gördü (duyarlılık 0,69 / 0,44), 1,7 sn, uygulamayla 6,3 GB. */
export const GOZ_VARSAYILAN_MODEL = "gemma4:e4b";

export interface GozAyari {
  model?: string;
  adres?: string;
  /** Soğuk yükleme (e4b, V0 ön yoklaması) 14–16 sn sürdü; tavan onu kapsar. */
  zamanAsimiMs?: number;
  /** Bellekte kalma süresi (Ollama `keep_alive`). Görme seyrek: kısa tutulur, kartı beyne geri bırakır. */
  sicakTut?: string;
}

/**
 * Modelin sistem metni. İNGİLİZCE (spec 26 F1: içerisi tek dil): cevap Orion'un beynine İngilizce girer, Orion onu
 * Türkçe SÖYLER (talimat DİL bölümü). Karışık dil (İngilizce çerçeve içinde Türkçe betim) beyni şaşırtıyordu.
 * Nesne adları algıdan GELDİĞİ gibi (Türkçe adlar: "beyaz tahta", "yönetim terminali") kalır, çevrilmez.
 * "Algında olmayanı kesinmiş gibi söyleme": görme yeni şeyi fark edebilir ama ona ad koymaz — ad algının işi.
 */
export function gozIstemi(algi: string): string {
  return [
    "You are Orion. This frame is from YOUR eyes, from where you stand right now.",
    `Your perception (certain, everything around you; the frame shows only what is in front of you): ${algi}`,
    "Look at the frame and, combining it with your perception, describe in at most 3 short English sentences:",
    "light and colours, what is on the screens, and what Ozyn (the person there) is doing if he is visible.",
    "Refer to objects by the names in your perception, exactly as given (they are Turkish names; do not translate them).",
    "Do not state anything as certain that is not in your perception; if unsure, say \"looks like\".",
    "No lists, headings or bullet points.",
  ].join("\n");
}

/** Model cevabını tek paragrafa indirir: satır sonları, markdown süsleri gider (cevap ŞİMDİ satırına girer). */
export function betimiTemizle(ham: string): string {
  return ham.replace(/[*#_`]+/g, "").replace(/^\s*[-•]\s*/gm, "").replace(/\s+/g, " ").trim();
}

interface OllamaYanit { message?: { content?: string }; error?: string }

export class GozModeli {
  readonly model: string;
  private _adres: string;
  private _zamanAsimi: number;
  private _sicakTut: string;

  constructor(ayar: GozAyari = {}) {
    this.model = ayar.model ?? GOZ_VARSAYILAN_MODEL;
    this._adres = (ayar.adres ?? OLLAMA_VARSAYILAN_ADRES).replace(/\/+$/, "");
    this._zamanAsimi = ayar.zamanAsimiMs ?? 30_000;
    this._sicakTut = ayar.sicakTut ?? "10m";
  }

  /** Kare (base64 PNG, önek yok) + algı metni → betim. FIRLATIR (model yok, zaman aşımı, boş cevap): çağıran dürüst cevap kurar. */
  async gor(png: string, algi: string): Promise<string> {
    const govde = {
      model: this.model,
      messages: [
        { role: "system", content: gozIstemi(algi) },
        { role: "user", content: "Ne görüyorsun?", images: [png] },
      ],
      stream: false,
      // V0 ile aynı: düşünme kapalı (gecikme), sıcaklık 0 (aynı kare → aynı betim; ölçülebilir).
      think: false,
      keep_alive: this._sicakTut,
      options: { temperature: 0, num_ctx: 4096, num_predict: 160 },
    };
    const c = new AbortController();
    const saat = setTimeout(() => c.abort(), this._zamanAsimi);
    try {
      const y = await fetch(`${this._adres}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
        signal: c.signal,
      });
      if (!y.ok) throw new Error(`görme modeli ${y.status}: ${(await y.text()).slice(0, 160)}`);
      const d = await y.json() as OllamaYanit;
      const metin = betimiTemizle(d.message?.content ?? "");
      if (!metin) throw new Error("görme modeli boş cevap verdi");
      return metin;
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        throw new Error(`görme modeli ${Math.round(this._zamanAsimi / 1000)} sn içinde cevap vermedi`);
      }
      throw err;
    } finally {
      clearTimeout(saat);
    }
  }
}
