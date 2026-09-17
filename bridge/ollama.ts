// bridge/ollama.ts — Yerel model (Ollama) beyni.
//
// Neden yerel: dünyada yaşamak sürekli küçük kararlar demek — "Ozyn girdi,
// dön ve bak". Bunları buluta sormak hem pahalı hem yavaş. Ağır iş (kod,
// araştırma) zaten terminaldeki Claude'a gidiyor; bu beyin odadaki varlıktan
// sorumlu.
//
// Bağımlılık: protocol/ + beyin.ts + fetch. Babylon yok, Electron yok.
"use strict";
import type { Beyin, BeyinGirdisi, BeyinCikti, AracCagrisi } from "./beyin.ts";
import { DUNYA_TALIMATI } from "./beyin.ts";

export interface OllamaAyari {
  model?: string;
  adres?: string;
  /** Yanıt bu süreyi aşarsa iptal — dünya donmamalı. */
  zamanAsimiMs?: number;
  sicaklik?: number;
}

interface OllamaAracCagrisi { function?: { name?: string; arguments?: unknown } }
interface OllamaYanit {
  message?: { content?: string; tool_calls?: OllamaAracCagrisi[] };
  eval_count?: number;
  prompt_eval_count?: number;
}

export class OllamaBeyni implements Beyin {
  readonly ad: string;
  private _adres: string;
  private _zamanAsimi: number;
  private _sicaklik: number;

  constructor(ayar: OllamaAyari = {}) {
    this.ad = ayar.model ?? "qwen2.5:7b";
    this._adres = (ayar.adres ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
    this._zamanAsimi = ayar.zamanAsimiMs ?? 20_000;
    this._sicaklik = ayar.sicaklik ?? 0.6;
  }

  async hazirMi(): Promise<boolean> {
    try {
      const c = new AbortController();
      const saat = setTimeout(() => c.abort(), 2500);
      const y = await fetch(`${this._adres}/api/tags`, { signal: c.signal });
      clearTimeout(saat);
      if (!y.ok) return false;
      const d = await y.json() as { models?: { name?: string }[] };
      return (d.models ?? []).some((m) => m.name === this.ad);
    } catch { return false; }
  }

  async dusun(girdi: BeyinGirdisi): Promise<BeyinCikti> {
    const mesajlar = [
      { role: "system", content: girdi.sabit ? `${girdi.talimat ?? DUNYA_TALIMATI}
${girdi.sabit}` : (girdi.talimat ?? DUNYA_TALIMATI) },
      // Gecmis DOGRU temsil edilir: Orion'un sozleri gercekte `dunya_soyle`
      // arac cagrisiydi. Duz `assistant` metni olarak gostermek modele
      // "asistan duz metin yazar" oruntusunu ogretiyor ve cikti bozuluyordu
      // (olcum: `orlda_komut {...}` gibi bozuk adlar duz metin olarak).
      // Ornekler: dogru davranisi GOSTEREN kisa gosterimler. Sistemden sonra,
      // gecmisten once. Olcum: sogukta 1-3/4 -> ornekle 4/4.
      ...(girdi.ornekler ?? []),
      ...girdi.gecmis.flatMap((g) => {
        if (g.rol === "kullanici") return [{ role: "user", content: g.metin }];
        if (!g.arac) return [{ role: "assistant", content: g.metin }];
        return [
          { role: "assistant", content: "",
            tool_calls: [{ function: { name: "dunya_soyle", arguments: { metin: g.metin } } }] },
          { role: "tool", content: "bitti" },
        ];
      }),
      { role: "user", content: this._durumMetni(girdi) },
    ];

    const govde = {
      model: this.ad,
      messages: mesajlar,
      stream: false,
      options: { temperature: this._sicaklik },
      tools: girdi.araclar.map((a) => ({
        type: "function",
        function: { name: a.ad, description: a.aciklama, parameters: a.sema },
      })),
    };

    // Tanilama dokumu: canli istegin TAM olarak ne oldugunu gormek icin.
    // Sonda ile canli arasindaki fark tahminle kapanmayinca eklendi.
    if (typeof localStorage !== "undefined" && localStorage.getItem("beyinDokum") === "1") {
      console.log(`[BEYIN:dokum] arac=${govde.tools.length} ${govde.tools.map((t) => t.function.name).join(",")}`);
      for (const m of mesajlar) {
        console.log(`[BEYIN:dokum] ${m.role}: ${String(m.content).replace(/\s+/g, " ").slice(0, 1200)}`);
      }
    }

    const t0 = Date.now();
    const c = new AbortController();
    const saat = setTimeout(() => c.abort(), this._zamanAsimi);
    try {
      const y = await fetch(`${this._adres}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
        signal: c.signal,
      });
      if (!y.ok) throw new Error(`ollama ${y.status}: ${await y.text()}`);
      const d = await y.json() as OllamaYanit;

      return {
        metin: (d.message?.content ?? "").trim(),
        cagrilar: this._cagrilariCoz(d.message?.tool_calls),
        bilgi: {
          model: this.ad,
          sureMs: Date.now() - t0,
          token: (d.eval_count ?? 0) + (d.prompt_eval_count ?? 0),
        },
      };
    } finally {
      clearTimeout(saat);
    }
  }

  /** Algı özetleri + dünya durumu → modele verilecek tek blok. */
  private _durumMetni(g: BeyinGirdisi): string {
    // ANILAR UNUTULMUŞTU — yerel beyinle Orion'un uzun vadeli hafızası hiç
    // yoktu. `opencode.ts` (bkz. baglam.ts) gönderiyordu, burası göndermiyordu;
    // yani "hangi beyin" seçimi sessizce "hafıza var mı" seçimine dönüşüyordu.
    // Ölçümde yakalandı: hafıza denemesinin iki kolu bu beyinde BİREBİR aynı
    // girdiye dönüşüyor, aradaki fark gürültüden ibaret kalıyordu.
    // Biçim `baglam.ts` ile aynı (spec 06 K8: bağlam beyinden bağımsızdır).
    const satirlar = [
      g.dunya,
      ...(g.anilar?.length ? [`Hatirladiklarin: ${g.anilar.join(" | ")}`] : []),
      ...g.ozetler,
    ].filter(Boolean);
    return satirlar.join("\n");
  }

  /**
   * Araç çağrılarını normalize eder. Modeller argümanı bazen nesne, bazen
   * JSON METNİ olarak döndürür; ikisi de kabul edilir, bozuksa çağrı atlanır
   * (sessizce değil — uyarı basılır).
   */
  private _cagrilariCoz(ham: OllamaAracCagrisi[] | undefined): AracCagrisi[] {
    if (!Array.isArray(ham)) return [];
    const cikti: AracCagrisi[] = [];
    for (const c of ham) {
      const ad = c?.function?.name;
      if (typeof ad !== "string" || !ad) continue;
      let girdi = c.function?.arguments ?? {};
      if (typeof girdi === "string") {
        try { girdi = JSON.parse(girdi); }
        catch { console.warn(`[ollama] '${ad}' argümanı JSON değil, atlandı:`, girdi); continue; }
      }
      cikti.push({ ad, girdi });
    }
    return cikti;
  }
}
