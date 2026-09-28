// bridge/ollamaKatalog.test.ts — kurulu modellerin kataloğu.
//
// Ollama YEREL ama güvenilir değil: kapalı olabilir, eski sürüm olabilir
// (yetenek alanı yok), bir ucu düşebilir. Hiçbiri açılışı durdurmamalı.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ollamaTara, tagleriCoz, yukluleriCoz, yetenekleriCoz, adNormal, adEsit,
  sohbetEdebilir, aracDestekler, boyutYaz, modelleriSirala, type OllamaModeli,
} from "./ollamaKatalog.ts";

const TAGS = { models: [
  { name: "qwen2.5:7b", size: 4_683_087_332, modified_at: "2026-09-01T10:00:00Z",
    details: { family: "qwen2", parameter_size: "7.6B", quantization_level: "Q4_K_M" } },
  { name: "qwen3:4b", size: 2_600_000_000,
    details: { family: "qwen3", parameter_size: "4.0B", quantization_level: "Q4_K_M" } },
  { name: "gemma3:1b", size: 815_000_000, details: { family: "gemma3", parameter_size: "1B" } },
  { name: "nomic-embed-text:latest", size: 274_000_000, details: { family: "nomic-bert" } },
] };
const YETENEK: Record<string, string[]> = {
  "qwen2.5:7b": ["completion", "tools"],
  "qwen3:4b": ["completion", "tools", "thinking"],
  "gemma3:1b": ["completion"],
  "nomic-embed-text:latest": ["embedding"],
};

/** Uç → cevap. `null` = o uç düşük (500). */
function sahteOllama(uclar: {
  tags?: unknown; ps?: unknown | null; version?: unknown | null; show?: boolean;
}): typeof fetch {
  return (async (u: string | URL, o?: RequestInit) => {
    const yol = String(u).replace(/^.*\/api\//, "");
    const yanit = (kod: number, g: unknown) =>
      ({ ok: kod < 400, status: kod, json: async () => g }) as Response;
    if (yol === "tags") return yanit(200, uclar.tags ?? TAGS);
    if (yol === "ps") return uclar.ps === null ? yanit(500, {}) : yanit(200, uclar.ps ?? { models: [] });
    if (yol === "version") return uclar.version === null ? yanit(404, {}) : yanit(200, uclar.version ?? { version: "0.12.3" });
    if (yol === "show") {
      if (uclar.show === false) return yanit(200, {});      // eski sürüm: alan yok
      const ad = JSON.parse(String(o?.body)).model as string;
      return yanit(200, { capabilities: YETENEK[ad] });
    }
    return yanit(404, {});
  }) as typeof fetch;
}

test("tam tarama: modeller, yüklü olan, yetenekler, sürüm", async () => {
  const k = await ollamaTara({ fetch: sahteOllama({
    ps: { models: [{ name: "qwen2.5:7b", size_vram: 4_000_000_000 }] },
  }) });
  assert.equal(k.ulasildi, true);
  assert.equal(k.surum, "0.12.3");
  assert.equal(k.modeller.length, 4);
  // Yüklü olan ÖNCE: ilk cevabı bekletmez.
  assert.equal(k.modeller[0]!.ad, "qwen2.5:7b");
  assert.equal(k.modeller[0]!.yuklu, true);
  assert.equal(k.modeller[0]!.vramBayt, 4_000_000_000);
  const q3 = k.modeller.find((m) => m.ad === "qwen3:4b")!;
  assert.deepEqual(q3.yetenekler, ["completion", "tools", "thinking"]);
  assert.equal(q3.parametre, "4.0B");
});

test("KAPALI sunucu fırlatmaz: ulaşılamadı + sebep", async () => {
  const k = await ollamaTara({ fetch: (async () => { throw new TypeError("fetch failed"); }) as typeof fetch });
  assert.equal(k.ulasildi, false);
  assert.equal(k.modeller.length, 0);
  assert.match(k.hata ?? "", /ulaşılamadı/);
});

test("ASILI sunucu zaman aşımına düşer — açılış beklemez", async () => {
  const asili = ((_u: string | URL, o?: RequestInit) => new Promise<Response>((_, red) => {
    o?.signal?.addEventListener("abort", () => red(new DOMException("aborted", "AbortError")));
  })) as typeof fetch;
  const t0 = Date.now();
  const k = await ollamaTara({ fetch: asili, zamanAsimiMs: 40 });
  assert.equal(k.ulasildi, false);
  assert.match(k.hata ?? "", /cevap vermedi/);
  assert.ok(Date.now() - t0 < 1000);
});

test("isteğe bağlı uçlar düşerse katalog YİNE döner", async () => {
  const k = await ollamaTara({ fetch: sahteOllama({ ps: null, version: null, show: false }) });
  assert.equal(k.ulasildi, true);
  assert.equal(k.surum, null);
  assert.equal(k.modeller.length, 4);
  assert.ok(k.modeller.every((m) => !m.yuklu));
  // Eski sürüm: yetenek BİLİNMİYOR (null), "yok" değil.
  assert.ok(k.modeller.every((m) => m.yetenekler === null));
  assert.equal(aracDestekler(k.modeller[0]!), null);
});

test("yetenek sormak kapatılabilir", async () => {
  let showSayisi = 0;
  const f = sahteOllama({});
  const say = (async (u: string | URL, o?: RequestInit) => {
    if (String(u).endsWith("/api/show")) showSayisi++;
    return f(u, o);
  }) as typeof fetch;
  await ollamaTara({ fetch: say, yetenekSor: false });
  assert.equal(showSayisi, 0);
});

test("adNormal: etiketsiz ad :latest'tir; host:port ayracı etiket sanılmaz", () => {
  assert.equal(adNormal("qwen3"), "qwen3:latest");
  assert.equal(adNormal("qwen3:4b"), "qwen3:4b");
  assert.equal(adNormal("hf.co/org/model"), "hf.co/org/model:latest");
  assert.equal(adNormal("reg:5000/model"), "reg:5000/model:latest");
  assert.ok(adEsit("llama3.2", "llama3.2:latest"));
  assert.ok(!adEsit("qwen3:4b", "qwen3:8b"));
});

test("tagleriCoz: bozuk girdi fırlatmaz, adsız atlanır, çift ad bir kez", () => {
  assert.deepEqual(tagleriCoz(null), []);
  assert.deepEqual(tagleriCoz({ models: "x" }), []);
  const ms = tagleriCoz({ models: [{ size: 1 }, { name: "a" }, { name: "a:latest" }, { model: "b:1b" }] });
  assert.deepEqual(ms.map((m) => m.ad), ["a", "b:1b"]);
  assert.equal(ms[0]!.boyutBayt, 0);
});

test("yukluleriCoz / yetenekleriCoz saf ve toleranslı", () => {
  assert.equal(yukluleriCoz({ models: [{ model: "x" }] }).get("x:latest"), 0);
  assert.equal(yukluleriCoz(undefined).size, 0);
  assert.equal(yetenekleriCoz({}), null);
  assert.deepEqual(yetenekleriCoz({ capabilities: ["tools", 3] }), ["tools"]);
});

test("gömme modeli beyin olamaz — yetenekten ya da addan", () => {
  const m = (ad: string, yetenekler: string[] | null, aile = ""): OllamaModeli => ({
    ad, boyutBayt: 1, parametre: "", aile, niceleme: "", degisti: "", yuklu: false, vramBayt: 0, yetenekler,
  });
  assert.equal(sohbetEdebilir(m("nomic-embed-text", ["embedding"])), false);
  assert.equal(sohbetEdebilir(m("nomic-embed-text", null)), false);
  assert.equal(sohbetEdebilir(m("all-minilm", null, "bert")), false);
  assert.equal(sohbetEdebilir(m("qwen3:4b", null)), true);
  assert.equal(sohbetEdebilir(m("gemma3:1b", ["completion"])), true);
});

test("sıralama: yüklü > araçlı > küçük", () => {
  const m = (ad: string, boyut: number, yuklu: boolean, y: string[] | null): OllamaModeli => ({
    ad, boyutBayt: boyut, parametre: "", aile: "", niceleme: "", degisti: "", yuklu, vramBayt: 0, yetenekler: y,
  });
  const s = modelleriSirala([
    m("buyuk-aracli", 9, false, ["completion", "tools"]),
    m("kucuk-aracsiz", 1, false, ["completion"]),
    m("kucuk-aracli", 2, false, ["completion", "tools"]),
    m("yuklu", 20, true, ["completion"]),
    m("bilinmeyen", 3, false, null),
  ]);
  assert.deepEqual(s.map((x) => x.ad), ["yuklu", "kucuk-aracli", "bilinmeyen", "buyuk-aracli", "kucuk-aracsiz"]);
});

test("boyutYaz insan ölçeğinde", () => {
  assert.equal(boyutYaz(4_683_087_332), "4.7 GB");
  assert.equal(boyutYaz(19_000_000_000), "19 GB");
  assert.equal(boyutYaz(274_000_000), "274 MB");
  assert.equal(boyutYaz(0), "?");
});
