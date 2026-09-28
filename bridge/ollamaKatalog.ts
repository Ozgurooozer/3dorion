// bridge/ollamaKatalog.ts — Ollama'da KURULU olan modellerin kataloğu.
//
// NEDEN VAR: yerel beyin seçenekleri `giris.ts`'te elle yazılıydı
// (`yerel:qwen2.5`, `yerel:qwen3`). Ozyn yeni bir model indirdiğinde onu
// seçebilmek için kod değiştirmek gerekiyordu; listedeki bir modeli sildiğinde
// seçenek yine duruyor ve seçilince sağlık kontrolünde sessizce düşüyordu.
// Liste artık TEK KAYNAKTAN gelir: Ollama'nın kendisinden, açılışta taranır.
//
// Tarama üç uç okur ve hiçbiri zorunlu değildir:
//   /api/tags     kurulu modeller (boyut, aile, parametre, niceleme) — ASIL
//   /api/ps       şu an belleğe yüklü olanlar (ilk cevap hızlı gelir)
//   /api/show     yetenekler: araç çağrısı, düşünme, görme, gömme
// `tags` dışındakiler düşerse katalog yine döner, yalnızca o bilgi eksik kalır.
// Eski Ollama sürümleri `capabilities` alanı vermez: yetenek `null` = BİLİNMİYOR
// (yok değil). Bilinmeyeni "yok" saymak araçları gereksiz yere kapatırdı.
//
// Bağımlılık: yalnızca fetch. Babylon yok, Electron yok; testte sahte fetch.
"use strict";

export const OLLAMA_VARSAYILAN_ADRES = "http://127.0.0.1:11434";

/** Katalogdaki tek model — seçici bunu kart olarak gösterir. */
export interface OllamaModeli {
  /** Ollama'nın tam adı: `qwen2.5:7b`. Beyin buna göre kurulur. */
  ad: string;
  /** Diskteki boyut (bayt). */
  boyutBayt: number;
  /** `7.6B` gibi; Ollama vermezse "". */
  parametre: string;
  aile: string;
  niceleme: string;
  /** Son değişiklik (ISO); sıralamada değil, bilgi olarak. */
  degisti: string;
  /** Şu an belleğe yüklü mü (`/api/ps`). Yüklü model ilk turda bekletmez. */
  yuklu: boolean;
  /** Yüklüyse GPU'daki kısmı (bayt). CPU'ya taşmış model yavaştır. */
  vramBayt: number;
  /**
   * `/api/show` yetenekleri: `completion`, `tools`, `thinking`, `vision`,
   * `embedding`. `null` = sorulamadı ya da sürüm vermiyor — BİLİNMİYOR.
   */
  yetenekler: readonly string[] | null;
}

export interface OllamaKatalogu {
  adres: string;
  /** Sunucuya hiç ulaşılabildi mi. `false` → `hata` sebebini söyler. */
  ulasildi: boolean;
  /** `/api/version`; eski sürümde ya da hata hâlinde `null`. */
  surum: string | null;
  modeller: readonly OllamaModeli[];
  hata?: string;
  /** Taramanın bittiği an (epoch ms). Seçici "ne kadar taze" diye okur. */
  an: number;
}

export interface TaramaAyari {
  adres?: string;
  /** Test için sahte fetch. Verilmezse küresel `fetch`. */
  fetch?: typeof fetch;
  /** Uç başına süre. Ollama kapalıyken açılış beklememeli. */
  zamanAsimiMs?: number;
  /**
   * `/api/show` ile yetenek sorulsun mu. Model başına bir istek; 30 modelde
   * bile yerelde ~ms'ler, ama kapatılabilir olsun.
   */
  yetenekSor?: boolean;
}

// ── Ollama cevap biçimleri (yalnızca okunan alanlar) ───────────────────────
interface HamTag {
  name?: string; model?: string; size?: number; modified_at?: string;
  details?: { family?: string; parameter_size?: string; quantization_level?: string };
}
interface HamPs { name?: string; model?: string; size_vram?: number }

/**
 * `qwen3` ile `qwen3:latest` AYNI modeldir. Ollama etiketsiz adı `:latest`
 * sayar; karşılaştırma bunu bilmezse `?beyin=yerel:qwen3` kurulu modeli
 * "hazır değil" diye reddederdi.
 */
export function adNormal(ad: string): string {
  const a = ad.trim();
  // Etiket ayracı SON `/`den sonraki `:` — `host:port/model` biçimine dikkat.
  const son = a.slice(a.lastIndexOf("/") + 1);
  return son.includes(":") ? a : `${a}:latest`;
}

export function adEsit(a: string, b: string): boolean {
  return adNormal(a) === adNormal(b);
}

/** `/api/tags` gövdesi → modeller (yüklü/yetenek bilgisi henüz yok). SAF. */
export function tagleriCoz(govde: unknown): OllamaModeli[] {
  const liste = (govde as { models?: HamTag[] } | null)?.models;
  if (!Array.isArray(liste)) return [];
  const cikti: OllamaModeli[] = [];
  const gorulen = new Set<string>();
  for (const m of liste) {
    const ad = typeof m?.name === "string" && m.name ? m.name : (typeof m?.model === "string" ? m.model : "");
    if (!ad || gorulen.has(adNormal(ad))) continue;
    gorulen.add(adNormal(ad));
    cikti.push({
      ad,
      boyutBayt: Number.isFinite(m.size) ? Number(m.size) : 0,
      parametre: m.details?.parameter_size ?? "",
      aile: m.details?.family ?? "",
      niceleme: m.details?.quantization_level ?? "",
      degisti: m.modified_at ?? "",
      yuklu: false,
      vramBayt: 0,
      yetenekler: null,
    });
  }
  return cikti;
}

/** `/api/ps` gövdesi → yüklü model adı → VRAM. SAF. */
export function yukluleriCoz(govde: unknown): Map<string, number> {
  const liste = (govde as { models?: HamPs[] } | null)?.models;
  const harita = new Map<string, number>();
  if (!Array.isArray(liste)) return harita;
  for (const m of liste) {
    const ad = m?.name || m?.model;
    if (typeof ad === "string" && ad) harita.set(adNormal(ad), Number(m.size_vram) || 0);
  }
  return harita;
}

/** `/api/show` gövdesi → yetenekler; alan yoksa `null` (bilinmiyor). SAF. */
export function yetenekleriCoz(govde: unknown): string[] | null {
  const y = (govde as { capabilities?: unknown } | null)?.capabilities;
  if (!Array.isArray(y)) return null;
  return y.filter((s): s is string => typeof s === "string");
}

/**
 * Model sohbet edebilir mi. Yalnızca-gömme modelleri (`nomic-embed-text`)
 * kurulu listede durur ama beyin olamaz: seçilince ilk turda hata verir.
 * Yetenek bilinmiyorsa adına bakılır — yanlış pozitif, seçilmeyen bir
 * modelden iyidir.
 */
export function sohbetEdebilir(m: OllamaModeli): boolean {
  if (m.yetenekler) return m.yetenekler.includes("completion");
  return !/embed/i.test(m.ad) && !/bert/i.test(m.aile);
}

/** Araç çağrısı: `true`/`false`, bilinmiyorsa `null`. */
export function aracDestekler(m: Pick<OllamaModeli, "yetenekler">): boolean | null {
  return m.yetenekler ? m.yetenekler.includes("tools") : null;
}

/** `4.7 GB` — insan ölçeğinde. */
export function boyutYaz(bayt: number): string {
  if (!(bayt > 0)) return "?";
  const gb = bayt / 1e9;
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  return `${Math.round(bayt / 1e6)} MB`;
}

/**
 * Seçici sırası: önce belleğe yüklü olanlar (anında cevap), sonra araç
 * çağırabilenler (Orion'un eli ayağı araçlar — araçsız model yalnızca satır
 * sözleşmesiyle konuşabilir), sonra küçükten büyüğe (8 GB VRAM bütçesi).
 */
export function modelleriSirala(ms: readonly OllamaModeli[]): OllamaModeli[] {
  const puan = (m: OllamaModeli) => (m.yuklu ? 0 : 2) + (aracDestekler(m) === false ? 1 : 0);
  return [...ms].sort((a, b) =>
    puan(a) - puan(b) || a.boyutBayt - b.boyutBayt || a.ad.localeCompare(b.ad));
}

async function jsonAl(
  f: typeof fetch, url: string, ms: number, govde?: unknown,
): Promise<unknown> {
  const c = new AbortController();
  const saat = setTimeout(() => c.abort(), ms);
  try {
    const y = await f(url, govde === undefined ? { signal: c.signal } : {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(govde), signal: c.signal,
    });
    if (!y.ok) throw new Error(`${url.replace(/^.*\/api\//, "/api/")} → ${y.status}`);
    return await y.json();
  } finally {
    clearTimeout(saat);
  }
}

/**
 * Ollama'yı tarar. FIRLATMAZ: kapalı sunucu `ulasildi: false` döner.
 *
 * Açılışta çağrılır; beklemeyi dünyaya dayatmaz (çağıran `await` etmeden
 * sonucu sonra işler). Zaman aşımı kısa: yerel sunucu ya hemen cevap verir
 * ya da yoktur.
 */
export async function ollamaTara(ayar: TaramaAyari = {}): Promise<OllamaKatalogu> {
  const adres = (ayar.adres ?? OLLAMA_VARSAYILAN_ADRES).replace(/\/+$/, "");
  const f = ayar.fetch ?? globalThis.fetch;
  const ms = ayar.zamanAsimiMs ?? 2500;
  const bos = (hata: string): OllamaKatalogu =>
    ({ adres, ulasildi: false, surum: null, modeller: [], hata, an: Date.now() });

  let modeller: OllamaModeli[];
  try {
    modeller = tagleriCoz(await jsonAl(f, `${adres}/api/tags`, ms));
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return bos(/abort/i.test(m) ? `Ollama cevap vermedi (${ms} ms)` : `Ollama'ya ulaşılamadı: ${m}`);
  }

  // Geri kalan uçlar İSTEĞE BAĞLI ve paralel: biri düşerse yalnızca o bilgi eksik.
  const [surum, ps, yetenekler] = await Promise.all([
    jsonAl(f, `${adres}/api/version`, ms)
      .then((g) => (g as { version?: string })?.version ?? null).catch(() => null),
    jsonAl(f, `${adres}/api/ps`, ms).then(yukluleriCoz).catch(() => new Map<string, number>()),
    ayar.yetenekSor === false
      ? Promise.resolve(modeller.map(() => null))
      : Promise.all(modeller.map((m) =>
          jsonAl(f, `${adres}/api/show`, ms, { model: m.ad }).then(yetenekleriCoz).catch(() => null))),
  ]);

  modeller = modeller.map((m, i) => {
    const vram = ps.get(adNormal(m.ad));
    return { ...m, yuklu: vram !== undefined, vramBayt: vram ?? 0, yetenekler: yetenekler[i] ?? null };
  });
  return { adres, ulasildi: true, surum, modeller: modelleriSirala(modeller), an: Date.now() };
}
