// bridge/opencodeKatalog.test.ts — OpenCode'a bağlı sağlayıcıların kataloğu.
//
// OpenCode YEREL AMA GÜVENİLİR DEĞİL: kapalı olabilir, hiç sağlayıcı
// bağlanmamış olabilir. Hiçbiri açılışı durdurmamalı (ollamaKatalog.test.ts
// ile aynı gerekçe). Asıl risk burada FARKLI: yanlışlıkla ÜCRETLİ ya da
// ARAÇSIZ bir modeli seçenek yapmak — süzgeç testleri bu yüzden ağırlıklı.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { opencodeTara, saglayicilariCoz, uygunMu } from "./opencodeKatalog.ts";

const SAGLAYICILAR = {
  providers: [
    {
      id: "openrouter", name: "OpenRouter",
      models: {
        "google/gemma-4-31b-it:free": {
          name: "Gemma 4 31B (free)", family: "gemma",
          capabilities: { toolcall: true, reasoning: false, input: { image: false } },
          cost: { input: 0, output: 0 }, limit: { context: 128000 },
        },
        "qwen/qwen3.7-max": {
          name: "Qwen3.7 Max", family: "qwen",
          capabilities: { toolcall: true, reasoning: true },
          cost: { input: 1.475, output: 4.425 }, limit: { context: 1_000_000 },
        },
        "cohere/north-mini-code:free": {
          name: "North Mini Code (free)", family: "cohere",
          capabilities: { toolcall: false },
          cost: { input: 0, output: 0 },
        },
      },
    },
    {
      id: "nvidia", name: "Nvidia",
      models: {
        "meta/llama-3.2-11b-vision-instruct": {
          name: "Llama 3.2 11B Vision Instruct", family: "llama",
          capabilities: { toolcall: true, reasoning: false, input: { image: true } },
          cost: { input: 0, output: 0 }, limit: { context: 128000 },
        },
      },
    },
  ],
};

function sahteOpenCode(uclar: { providers?: unknown | null }): typeof fetch {
  return (async (u: string | URL) => {
    const yol = String(u);
    const yanit = (kod: number, g: unknown) => ({ ok: kod < 400, status: kod, json: async () => g }) as Response;
    if (yol.endsWith("/config/providers")) {
      return uclar.providers === null ? yanit(500, {}) : yanit(200, uclar.providers ?? SAGLAYICILAR);
    }
    return yanit(404, {});
  }) as typeof fetch;
}

test("uygunMu: araç çağırabilir VE tamamen ücretsiz olmalı", () => {
  assert.equal(uygunMu({ capabilities: { toolcall: true }, cost: { input: 0, output: 0 } }), true);
  assert.equal(uygunMu({ capabilities: { toolcall: false }, cost: { input: 0, output: 0 } }), false, "araçsız elenir");
  assert.equal(uygunMu({ capabilities: { toolcall: true }, cost: { input: 1, output: 0 } }), false, "girdi ücretli elenir");
  assert.equal(uygunMu({ capabilities: { toolcall: true }, cost: { input: 0, output: 2 } }), false, "çıktı ücretli elenir");
  assert.equal(uygunMu({ capabilities: { toolcall: true } }), false, "cost alanı yoksa BİLİNMİYOR — dahil ETME");
});

test("saglayicilariCoz: yalnız uygun modeller kalır, sağlayıcı adı ve bağlam taşınır", () => {
  const { saglayicilar, modeller } = saglayicilariCoz(SAGLAYICILAR);
  assert.deepEqual(saglayicilar, ["openrouter", "nvidia"]);
  assert.deepEqual(modeller.map((m) => m.modelID), ["google/gemma-4-31b-it:free", "meta/llama-3.2-11b-vision-instruct"]);
  const g = modeller[0]!;
  assert.equal(g.providerID, "openrouter");
  assert.equal(g.saglayiciAdi, "OpenRouter");
  assert.equal(g.baglamPenceresi, 128000);
  assert.equal(g.gorurMu, false);
  const nv = modeller[1]!;
  assert.equal(nv.gorurMu, true, "input.image=true görme yeteneği taşımalı");
});

test("bozuk/eksik gövde çökertmez, boş liste döner", () => {
  assert.deepEqual(saglayicilariCoz(null), { saglayicilar: [], modeller: [] });
  assert.deepEqual(saglayicilariCoz({ providers: "bozuk" }), { saglayicilar: [], modeller: [] });
  assert.deepEqual(saglayicilariCoz({ providers: [{ id: "x" }] }), { saglayicilar: ["x"], modeller: [] });
});

test("id'siz sağlayıcı ATLANIR, diğerleri etkilenmez", () => {
  const { saglayicilar } = saglayicilariCoz({
    providers: [{ name: "kimliksiz", models: {} }, { id: "openrouter", name: "OpenRouter", models: {} }],
  });
  assert.deepEqual(saglayicilar, ["openrouter"]);
});

test("ad yoksa modelID'ye düşer — boş ad kartta görünmez", () => {
  const { modeller } = saglayicilariCoz({
    providers: [{ id: "openrouter", models: {
      "google/gemma-4-31b-it:free": { capabilities: { toolcall: true }, cost: { input: 0, output: 0 } },
    } }],
  });
  assert.equal(modeller[0]!.ad, "google/gemma-4-31b-it:free");
});

test("tam tarama: iki sağlayıcı, süzülmüş modeller", async () => {
  const k = await opencodeTara({ fetch: sahteOpenCode({}) });
  assert.equal(k.ulasildi, true);
  assert.deepEqual(k.saglayicilar, ["openrouter", "nvidia"]);
  assert.equal(k.modeller.length, 2);
});

test("KAPALI sunucu fırlatmaz: ulaşılamadı + sebep", async () => {
  const k = await opencodeTara({ fetch: (async () => { throw new TypeError("fetch failed"); }) as typeof fetch });
  assert.equal(k.ulasildi, false);
  assert.equal(k.modeller.length, 0);
  assert.match(k.hata ?? "", /ulaşılamadı/);
});

test("500 dönen uç fırlatmaz: ulaşılamadı + sebep", async () => {
  const k = await opencodeTara({ fetch: sahteOpenCode({ providers: null }) });
  assert.equal(k.ulasildi, false);
  assert.match(k.hata ?? "", /ulaşılamadı/);
});

test("ASILI sunucu zaman aşımına düşer — açılış beklemez", async () => {
  const asili = ((_u: string | URL, o?: RequestInit) => new Promise<Response>((_, red) => {
    o?.signal?.addEventListener("abort", () => red(new DOMException("aborted", "AbortError")));
  })) as typeof fetch;
  const t0 = Date.now();
  const k = await opencodeTara({ fetch: asili, zamanAsimiMs: 40 });
  assert.equal(k.ulasildi, false);
  assert.match(k.hata ?? "", /cevap vermedi/);
  assert.ok(Date.now() - t0 < 1000);
});
