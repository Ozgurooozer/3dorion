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
import { TEMEL_TALIMAT } from "./talimat.ts";
import { adEsit, OLLAMA_VARSAYILAN_ADRES } from "./ollamaKatalog.ts";

export interface OllamaAyari {
  model?: string;
  adres?: string;
  /** Yanıt bu süreyi aşarsa iptal — dünya donmamalı. */
  zamanAsimiMs?: number;
  sicaklik?: number;
  /**
   * Katalogdan gelen yetenekler (`bridge/ollamaKatalog.ts`). `null`/yok =
   * bilinmiyor → eski davranış (araçlar gönderilir, `think` gönderilmez).
   *
   * NEDEN GEREKLİ: Ollama, araç desteklemeyen bir modele `tools` gönderilince
   * isteği 400 ile REDDEDER ("does not support tools"); `think` alanı da
   * düşünmeyen modelde aynı hatayı verir. Yetenek bilinmeden her iki alan da
   * kör atılıyordu — katalogdaki bir modeli seçmek ilk turda patlamak demekti.
   */
  yetenekler?: readonly string[] | null;
  /**
   * Model bellekte ne kadar sıcak kalsın (Ollama `keep_alive`). Varsayılan
   * 30 dk: Orion'un turları seyrek (dakikada ≤ 20) ve Ollama'nın 5 dk'lık
   * varsayılanı her sessizlikten sonra modeli boşaltıp ilk cevabı saniyelerce
   * geciktiriyordu.
   */
  sicakTut?: string;
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
  private _yetenekler: readonly string[] | null;
  private _sicakTut: string;

  constructor(ayar: OllamaAyari = {}) {
    this.ad = ayar.model ?? "qwen2.5:7b";
    this._adres = (ayar.adres ?? OLLAMA_VARSAYILAN_ADRES).replace(/\/+$/, "");
    // 60 sn (spec 13): ortak testte (2026-10-02) ilk cümle 20 sn'de "signal is aborted"
    // ile düştü — soğuk ornith-32k (6,3 GB) diskten yüklenirken. Aynı oturumda ısınmış
    // modelle 45 uyanışın en uzunu 8,5 sn'ydi [ÖLÇÜLDÜ, karar kaydı]; tavan yalnız soğuk
    // yüklemeyi kapsamak için yükseltildi.
    this._zamanAsimi = ayar.zamanAsimiMs ?? 60_000;
    this._sicaklik = ayar.sicaklik ?? 0.6;
    this._yetenekler = ayar.yetenekler ?? null;
    this._sicakTut = ayar.sicakTut ?? "30m";
  }

  /** Araçlar gönderilsin mi: bilinmiyorsa EVET (eski davranış). */
  get aracli(): boolean {
    return this._yetenekler ? this._yetenekler.includes("tools") : true;
  }

  /**
   * Modeli belleğe yükler — seçim anında çağrılır, ilk düşünceyi beklemeden.
   *
   * Boş istemli `/api/generate` Ollama'nın belgelenmiş "yükle" yoludur.
   * 7B bir modelin soğuk yüklenmesi 5–15 sn sürebiliyor; bunu Ozyn'in ilk
   * cümlesine yüklemek "Orion donuk" izlenimi veriyordu. FIRLATMAZ.
   */
  async isit(): Promise<boolean> {
    try {
      const y = await fetch(`${this._adres}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.ad, keep_alive: this._sicakTut }),
      });
      return y.ok;
    } catch { return false; }
  }

  async hazirMi(): Promise<boolean> {
    try {
      const c = new AbortController();
      const saat = setTimeout(() => c.abort(), 2500);
      const y = await fetch(`${this._adres}/api/tags`, { signal: c.signal });
      clearTimeout(saat);
      if (!y.ok) return false;
      const d = await y.json() as { models?: { name?: string }[] };
      // `qwen3` ile `qwen3:latest` aynı model — birebir eşitlik, etiketsiz
      // yazılmış kurulu bir modeli "hazır değil" diye reddediyordu.
      return (d.models ?? []).some((m) => typeof m.name === "string" && adEsit(m.name, this.ad));
    } catch { return false; }
  }

  async dusun(girdi: BeyinGirdisi): Promise<BeyinCikti> {
    const mesajlar = ollamaMesajlari(girdi);

    const govde = {
      model: this.ad,
      messages: mesajlar,
      stream: false,
      keep_alive: this._sicakTut,
      options: { temperature: this._sicaklik },
      // Araçsız model: `tools` HİÇ gönderilmez (Ollama 400 verir). Orion yine
      // konuşabilir — köprü düz metindeki satır sözleşmesini (`KOMUT:`,
      // `TAHTA:`) `metinKurtar` ile niyete çevirir.
      tools: this.aracli ? girdi.araclar.map((a) => ({
        type: "function",
        function: { name: a.ad, description: a.aciklama, parameters: a.sema },
      })) : [],
      // Düşünen modeller (qwen3, deepseek-r1) varsayılan olarak önce uzun bir
      // iç monolog üretir: ölçülmemiş ama saniyeler. Refleks değil düşünce
      // katmanı olsa da Orion'un turu konuşma hızında kalmalı; kapatılır.
      // Yalnızca yeteneği BİLİNEN modelde: bilinmeyene `think` göndermek
      // düşünmeyen modelde 400 demek.
      ...(this._yetenekler?.includes("thinking") ? { think: false } : {}),
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
          // Girdinin (bağlamın) token sayısı ayrı: spec 16 F0 ölçüsü bunu karar kaydına yazar.
          ...(typeof d.prompt_eval_count === "number" ? { girdiToken: d.prompt_eval_count } : {}),
        },
      };
    } catch (err) {
      // Chromium'un ham mesajı "signal is aborted without reason" — odada hiçbir şey
      // anlatmıyordu (ortak test 2026-10-02). Süreyi ve olası sebebi söyle.
      if ((err as Error)?.name === "AbortError") {
        throw new Error(`yerel model ${Math.round(this._zamanAsimi / 1000)} sn icinde cevap vermedi (model yukleniyor olabilir)`);
      }
      throw err;
    } finally {
      clearTimeout(saat);
    }
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

/** Ollama `messages` biçiminde tek mesaj (OpenAI biçimine `bridge/apiBeyni.ts` çevirir). */
export interface OllamaMesaji {
  role: string;
  content: string;
  tool_calls?: { function: { name: string; arguments: unknown } }[];
}

/**
 * Bir turun mesaj dizisi: sistem (talimat + sabit), örnekler, geçmiş, durum.
 * TEK KAYNAK: hem `OllamaBeyni` hem `ApiBeyni` (spec 13 Faz 3) buradan kurar — iki
 * beyin aynı bağlamı görsün (spec 06 K8: bağlam beyinden bağımsızdır).
 */
export function ollamaMesajlari(girdi: BeyinGirdisi): OllamaMesaji[] {
  return [
    { role: "system", content: girdi.sabit ? `${girdi.talimat ?? TEMEL_TALIMAT}
${girdi.sabit}` : (girdi.talimat ?? TEMEL_TALIMAT) },
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
      // Beden niyeti kendi araç adıyla oynatılır (spec 13): model "komut → eylem"
      // çiftlerini görsün, yalnız "komut → söz" değil.
      const cagri = g.cagri ?? { ad: "dunya_soyle", girdi: { metin: g.metin } };
      return [
        { role: "assistant", content: "",
          tool_calls: [{ function: { name: cagri.ad, arguments: cagri.girdi } }] },
        { role: "tool", content: "bitti" },
      ];
    }),
    { role: "user", content: durumMetni(girdi) },
  ];
}

/** Algı özetleri + dünya durumu → modele verilecek tek blok. */
export function durumMetni(g: BeyinGirdisi): string {
  // ANILAR UNUTULMUŞTU — yerel beyinle Orion'un uzun vadeli hafızası hiç
  // yoktu. `opencode.ts` (bkz. baglam.ts) gönderiyordu, burası göndermiyordu;
  // yani "hangi beyin" seçimi sessizce "hafıza var mı" seçimine dönüşüyordu.
  // Ölçümde yakalandı: hafıza denemesinin iki kolu bu beyinde BİREBİR aynı
  // girdiye dönüşüyor, aradaki fark gürültüden ibaret kalıyordu.
  // Biçim `baglam.ts` ile aynı (spec 06 K8: bağlam beyinden bağımsızdır).
  const satirlar = [
    g.dunya,
    ...(g.anilar?.length ? [`You remember: ${g.anilar.join(" | ")}`] : []),
    ...g.ozetler,
  ].filter(Boolean);
  return satirlar.join("\n");
}
