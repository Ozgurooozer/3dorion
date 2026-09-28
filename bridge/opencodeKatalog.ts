// bridge/opencodeKatalog.ts — OpenCode sunucusuna BAĞLI sağlayıcıların kataloğu.
//
// NEDEN VAR: `opencode` seçeneği elle yazılan TEK bir sağlayıcı/model çiftiydi
// (`?saglayici=` `?model=`, `world/giris.ts`). Yeni bir sağlayıcı denemek
// (NVIDIA gibi) ya da OpenRouter'daki yüzlerce modelden birini seçmek kod
// değiştirmek demekti. Liste artık TEK KAYNAKTAN gelir: OpenCode sunucusunun
// kendi `/config/providers` ucundan — kim BAĞLIYSA (kimlik bilgisi girilmişse,
// `PUT /auth/<saglayiciID>`) o burada görünür. Yeni sağlayıcı eklemek KOD
// DEĞİŞTİRMEZ; yalnızca OpenCode'a kimlik bilgisi verilir.
//
// SÜZGEÇ — araç çağırabilen VE ücretsiz olanlar (Ozyn, 2026-09-28):
// OpenRouter tek başına 300'ün üzerinde model taşıyor, hepsini kart yapmak
// seçiciyi kullanılamaz kılardı. Araçsız model satır sözleşmesiyle zar zor
// konuşur (aynı gerekçe `ollamaKatalog.ts`te). Ücretli modeli açılışta
// otomatik seçenek yapmak sürpriz faturaya yol açardı — o zaman elle
// `?saglayici=` `?model=` kullanılır (bkz. `world/giris.ts` sabit `opencode`
// seçeneği), bu tarama onu DEĞİŞTİRMEZ, tamamlar.
//
// Bağımlılık: yalnızca fetch. Babylon yok, Electron yok; testte sahte fetch.
"use strict";

export const OPENCODE_VARSAYILAN_ADRES = "http://127.0.0.1:4096";

/** Katalogdaki tek model — seçici bunu kart olarak gösterir. */
export interface OpenCodeModeli {
  providerID: string;
  modelID: string;
  /** İnsan-okur ad: "Qwen3.7 Max". Yoksa modelID. */
  ad: string;
  saglayiciAdi: string;
  aile: string;
  baglamPenceresi: number;
  gorurMu: boolean;
  dusunurMu: boolean;
}

export interface OpenCodeKatalogu {
  adres: string;
  /** Sunucuya hiç ulaşılabildi mi. `false` → `hata` sebebini söyler. */
  ulasildi: boolean;
  /** Bağlı (kimlik bilgisi girilmiş) sağlayıcı kimlikleri, ham — teşhis için. */
  saglayicilar: readonly string[];
  /** Yalnızca araç çağırabilen VE ücretsiz modeller. */
  modeller: readonly OpenCodeModeli[];
  hata?: string;
  /** Taramanın bittiği an (epoch ms). */
  an: number;
}

export interface TaramaAyari {
  adres?: string;
  /** Test için sahte fetch. Verilmezse küresel `fetch`. */
  fetch?: typeof fetch;
  /** OpenCode kapalıyken açılış beklememeli. */
  zamanAsimiMs?: number;
}

// ── OpenCode `/config/providers` cevap biçimi (yalnızca okunan alanlar) ────
interface HamModel {
  name?: string;
  family?: string;
  capabilities?: { toolcall?: boolean; reasoning?: boolean; input?: { image?: boolean } };
  cost?: { input?: number; output?: number };
  limit?: { context?: number };
}
interface HamSaglayici {
  id?: string;
  name?: string;
  models?: Record<string, HamModel>;
}

/** Bir modelin seçenek olması için: araç çağırabilir VE tamamen ücretsiz. SAF. */
export function uygunMu(m: HamModel): boolean {
  return m.capabilities?.toolcall === true
    && m.cost?.input === 0 && m.cost?.output === 0;
}

/** `/config/providers` gövdesi → bağlı sağlayıcılar + süzülmüş modeller. SAF. */
export function saglayicilariCoz(
  govde: unknown,
): { saglayicilar: string[]; modeller: OpenCodeModeli[] } {
  const liste = (govde as { providers?: HamSaglayici[] } | null)?.providers;
  if (!Array.isArray(liste)) return { saglayicilar: [], modeller: [] };
  const saglayicilar: string[] = [];
  const modeller: OpenCodeModeli[] = [];
  for (const p of liste) {
    if (typeof p?.id !== "string" || !p.id) continue;
    saglayicilar.push(p.id);
    for (const [modelID, m] of Object.entries(p.models ?? {})) {
      if (!uygunMu(m)) continue;
      modeller.push({
        providerID: p.id,
        modelID,
        ad: m.name || modelID,
        saglayiciAdi: p.name || p.id,
        aile: m.family ?? "",
        baglamPenceresi: Number.isFinite(m.limit?.context) ? Number(m.limit!.context) : 0,
        gorurMu: m.capabilities?.input?.image === true,
        dusunurMu: m.capabilities?.reasoning === true,
      });
    }
  }
  return { saglayicilar, modeller };
}

async function jsonAl(f: typeof fetch, url: string, ms: number): Promise<unknown> {
  const c = new AbortController();
  const saat = setTimeout(() => c.abort(), ms);
  try {
    const y = await f(url, { signal: c.signal });
    if (!y.ok) throw new Error(`${url} → ${y.status}`);
    return await y.json();
  } finally {
    clearTimeout(saat);
  }
}

/**
 * OpenCode sunucusunu tarar. FIRLATMAZ: kapalı sunucu `ulasildi: false` döner.
 *
 * Açılışta çağrılır; beklemeyi dünyaya dayatmaz (çağıran `await` etmeden
 * sonucu sonra işler, `ollamaTara` ile aynı kalıp).
 */
export async function opencodeTara(ayar: TaramaAyari = {}): Promise<OpenCodeKatalogu> {
  const adres = (ayar.adres ?? OPENCODE_VARSAYILAN_ADRES).replace(/\/+$/, "");
  const f = ayar.fetch ?? globalThis.fetch;
  const ms = ayar.zamanAsimiMs ?? 2500;
  const bos = (hata: string): OpenCodeKatalogu =>
    ({ adres, ulasildi: false, saglayicilar: [], modeller: [], hata, an: Date.now() });

  let govde: unknown;
  try {
    govde = await jsonAl(f, `${adres}/config/providers`, ms);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return bos(/abort/i.test(m) ? `OpenCode cevap vermedi (${ms} ms)` : `OpenCode'a ulaşılamadı: ${m}`);
  }
  const { saglayicilar, modeller } = saglayicilariCoz(govde);
  return { adres, ulasildi: true, saglayicilar, modeller, an: Date.now() };
}
