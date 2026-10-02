// bridge/apiBeyni.ts — OpenAI uyumlu API ile düşünen beyin (spec 13 Faz 3).
//
// Ozyn (ortak test 1): "Model küçük kalıyor." Yerel 7–9B modeller iki adımı
// zincirleyemedi ve geçmişe duyarlıydı (spec 13 Faz 0–1). Bu beyin, anahtarı M
// seçicide girilen bir sağlayıcının (NVIDIA NIM, OpenRouter, özel adres) modeliyle
// düşünür.
//
// ANAHTAR BURADA YOK. İstek `istemci` üzerinden ana sürece gider (host/apiIstek.js);
// Authorization başlığını orası ekler. Bu dosya anahtarı ne görür ne basar.
//
// BAĞLAM TEK KAYNAKTAN: mesajlar `ollamaMesajlari` ile kurulur (spec 06 K8: bağlam
// beyinden bağımsızdır) ve yalnız biçim OpenAI'ya çevrilir:
//   - araç çağrısı `id` ve `type:"function"` alır, argüman JSON METNİ olur;
//   - her `tool` mesajı kendinden önceki çağrının `tool_call_id`'sini taşır.
"use strict";
import type { Beyin, BeyinCikti, BeyinGirdisi, AracCagrisi } from "./beyin.ts";
import { ollamaMesajlari, type OllamaMesaji } from "./ollama.ts";

export type ApiSonucu = { ok: true; veri: unknown } | { ok: false; hata: string };

/** Renderer'ın ana sürece açılan yüzü (host/kopru.ts `apiDurum`/`apiSohbet`). */
export interface ApiIstemcisi {
  durum(): Promise<readonly { ad: string; anahtarVar: boolean }[]>;
  sohbet(saglayici: string, govde: unknown): Promise<ApiSonucu>;
}

export interface ApiAyari {
  saglayici: string;
  model: string;
  istemci: ApiIstemcisi;
  sicaklik?: number;
  /** Cevap üst sınırı (token). Orion iki cümle konuşur; araç çağrıları kısa. */
  enFazlaToken?: number;
}

/** OpenAI biçiminde tek mesaj. */
export interface ApiMesaji {
  role: string;
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

/**
 * Ollama biçimli mesajları OpenAI biçimine çevirir. Çağrı kimlikleri sırayla verilir
 * (`c1`, `c2`, …); her `tool` mesajı henüz cevaplanmamış en eski çağrıya bağlanır —
 * örnekler ve geçmiş "çağrılar, sonra her biri için bir sonuç" sırasında kurulur.
 */
export function apiMesajlari(mesajlar: readonly OllamaMesaji[]): ApiMesaji[] {
  let sayac = 0;
  const bekleyen: string[] = [];
  return mesajlar.map((m): ApiMesaji => {
    if (m.tool_calls?.length) {
      const tool_calls = m.tool_calls.map((c) => {
        const id = `c${++sayac}`;
        bekleyen.push(id);
        return { id, type: "function" as const, function: { name: c.function.name, arguments: JSON.stringify(c.function.arguments ?? {}) } };
      });
      return { role: m.role, content: m.content, tool_calls };
    }
    if (m.role === "tool") return { role: "tool", content: m.content, tool_call_id: bekleyen.shift() ?? `c${sayac}` };
    return { role: m.role, content: m.content };
  });
}

interface ApiCevabi {
  choices?: { message?: { content?: string | null; reasoning_content?: string | null;
    tool_calls?: { function?: { name?: string; arguments?: unknown } }[] } }[];
  usage?: { total_tokens?: number };
}

/** Cevabı `BeyinCikti`ya çevirir. Argümanı bozuk çağrı atlanır (sessizce değil: uyarı). */
export function apiCevabiniCoz(veri: unknown): { metin: string; cagrilar: AracCagrisi[]; dusunce?: string; token: number } {
  const d = (veri ?? {}) as ApiCevabi;
  const m = d.choices?.[0]?.message ?? {};
  const cagrilar: AracCagrisi[] = [];
  for (const c of m.tool_calls ?? []) {
    const ad = c?.function?.name;
    if (typeof ad !== "string" || !ad) continue;
    let girdi = c.function?.arguments ?? {};
    if (typeof girdi === "string") {
      try { girdi = girdi.trim() ? JSON.parse(girdi) : {}; }
      catch { console.warn(`[api] '${ad}' argümanı JSON değil, atlandı`); continue; }
    }
    cagrilar.push({ ad, girdi });
  }
  const dusunce = typeof m.reasoning_content === "string" && m.reasoning_content.trim() ? m.reasoning_content.trim() : undefined;
  return { metin: (m.content ?? "").trim(), cagrilar, ...(dusunce ? { dusunce } : {}), token: d.usage?.total_tokens ?? 0 };
}

export class ApiBeyni implements Beyin {
  readonly ad: string;
  private _a: ApiAyari;

  constructor(a: ApiAyari) {
    this._a = a;
    this.ad = `api:${a.saglayici}/${a.model}`;
  }

  /** Anahtar kayıtlı mı. İstek atmaz: sağlık kontrolü kota yemesin. */
  async hazirMi(): Promise<boolean> {
    try { return (await this._a.istemci.durum()).some((s) => s.ad === this._a.saglayici && s.anahtarVar); }
    catch { return false; }
  }

  async dusun(girdi: BeyinGirdisi): Promise<BeyinCikti> {
    const govde = {
      model: this._a.model,
      messages: apiMesajlari(ollamaMesajlari(girdi)),
      tools: girdi.araclar.map((a) => ({ type: "function", function: { name: a.ad, description: a.aciklama, parameters: a.sema } })),
      temperature: this._a.sicaklik ?? 0.6,
      max_tokens: this._a.enFazlaToken ?? 1024,
    };
    const t0 = Date.now();
    const r = await this._a.istemci.sohbet(this._a.saglayici, govde);
    if (!r.ok) throw new Error(r.hata);
    const c = apiCevabiniCoz(r.veri);
    return {
      metin: c.metin,
      cagrilar: c.cagrilar,
      bilgi: { model: this.ad, sureMs: Date.now() - t0, token: c.token, ...(c.dusunce ? { dusunce: c.dusunce } : {}) },
    };
  }
}
