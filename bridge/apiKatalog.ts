// bridge/apiKatalog.ts — API anahtarı girilmiş sağlayıcıların modelleri (spec 13 Faz 3).
//
// `ollamaKatalog.ts` ve `opencodeKatalog.ts` ile aynı kalıp: açılışta (ve anahtar
// kaydedilince) taranır, her model bir `api:<sağlayıcı>/<model>` seçeneği ve bir
// "bulut" kartı olur. Anahtar burada YOK: liste ana süreçten gelir.
"use strict";
import type { ApiIstemcisi, ApiSonucu } from "./apiBeyni.ts";
import { ApiBeyni } from "./apiBeyni.ts";
import type { BeyinSecenegi } from "./secilebilirBeyin.ts";

/** Hazır sağlayıcılar: seçicideki listede adresleri dolu gelir. "ozel" adresi kullanıcı yazar. */
export const API_SAGLAYICILARI: readonly { ad: string; baslik: string; adres: string }[] = [
  { ad: "nvidia", baslik: "NVIDIA NIM", adres: "https://integrate.api.nvidia.com/v1" },
  { ad: "openrouter", baslik: "OpenRouter", adres: "https://openrouter.ai/api/v1" },
  { ad: "ozel", baslik: "Özel (OpenAI uyumlu)", adres: "" },
];

export const API_ONEKI = "api:";
export function apiAd(saglayici: string, model: string): string {
  return `${API_ONEKI}${saglayici}/${model}`;
}

export interface ApiModeli { saglayici: string; model: string; sahip?: string }
export interface ApiKatalogu { modeller: ApiModeli[]; hatalar: { saglayici: string; hata: string }[]; an: number }

/**
 * Sohbet modeli OLMAYANLAR seçenek olmaz: gömme, sıralama, ödül ve güvenlik
 * sınıflandırıcıları sohbet uç noktasında 4xx verir. Ad desenine bakılır — liste
 * yetenek bilgisi taşımıyor (NVIDIA `/models` yalnız `id` ve `owned_by` döner).
 */
const SOHBET_DEGIL = /embed|rerank|reward|retriever|guard|safety|clip|parse|nv-?ingest|-ocr/i;

/** `/models` cevabından model listesi; bozuk cevap boş liste. */
export function modelleriCoz(saglayici: string, veri: unknown): ApiModeli[] {
  const d = (veri ?? {}) as { data?: { id?: unknown; owned_by?: unknown }[] };
  const cikti: ApiModeli[] = [];
  for (const m of d.data ?? []) {
    if (typeof m?.id !== "string" || !m.id || SOHBET_DEGIL.test(m.id)) continue;
    cikti.push({ saglayici, model: m.id, ...(typeof m.owned_by === "string" ? { sahip: m.owned_by } : {}) });
  }
  return cikti.sort((a, b) => a.model.localeCompare(b.model));
}

/** Anahtarı olan her sağlayıcının modellerini çeker. Hata taramayı durdurmaz, listelenir. */
export async function apiTara(istemci: ApiIstemcisi & { modeller(saglayici: string): Promise<ApiSonucu> }): Promise<ApiKatalogu> {
  const k: ApiKatalogu = { modeller: [], hatalar: [], an: Date.now() };
  let durum: readonly { ad: string; anahtarVar: boolean }[] = [];
  try { durum = await istemci.durum(); }
  catch (e) { k.hatalar.push({ saglayici: "*", hata: e instanceof Error ? e.message : String(e) }); return k; }
  for (const s of durum.filter((x) => x.anahtarVar)) {
    const r = await istemci.modeller(s.ad);
    if (r.ok) k.modeller.push(...modelleriCoz(s.ad, r.veri));
    else k.hatalar.push({ saglayici: s.ad, hata: r.hata });
  }
  return k;
}

/** Kataloktaki her model için bir seçenek. */
export function apiSecenekler(katalog: ApiKatalogu, istemci: ApiIstemcisi): BeyinSecenegi[] {
  return katalog.modeller.map((m) => ({
    ad: apiAd(m.saglayici, m.model),
    kur: () => new ApiBeyni({ saglayici: m.saglayici, model: m.model, istemci }),
  }));
}
