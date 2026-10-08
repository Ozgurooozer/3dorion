// bridge/ollama.test.ts — yerel beynin Ollama'ya ne GÖNDERDİĞİ.
//
// Katalog modelin yeteneğini biliyorsa istek ona uymalı: araçsız modele
// `tools`, düşünmeyene `think` göndermek Ollama'da 400 demek.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OllamaBeyni } from "./ollama.ts";
import { araclariUret } from "./araclar.ts";

const GIRDI = { ozetler: ["Ozyn: merhaba"], dunya: "oda", gecmis: [], araclar: araclariUret() };

function sunucu(govde: unknown = { message: { content: "selam" } }) {
  const eski = globalThis.fetch;
  const istekler: { yol: string; govde?: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (u: string | URL, o?: RequestInit) => {
    istekler.push({ yol: String(u), govde: o?.body ? JSON.parse(String(o.body)) : undefined });
    return { ok: true, status: 200, json: async () => govde, text: async () => JSON.stringify(govde) } as Response;
  }) as typeof fetch;
  return { geri: () => { globalThis.fetch = eski; }, istekler };
}

test("yetenek BİLİNMİYORSA eski davranış: araçlar gider, think gitmez", async () => {
  const s = sunucu();
  try {
    await new OllamaBeyni({ model: "x:1b" }).dusun(GIRDI);
    const g = s.istekler[0]!.govde!;
    assert.ok((g.tools as unknown[]).length > 0);
    assert.equal("think" in g, false);
    assert.equal(g.keep_alive, "30m");
  } finally { s.geri(); }
});

test("girdi token sayısı prompt_eval_count'tan bilgi.girdiToken olarak döner (spec 16 F0)", async () => {
  const s = sunucu({ message: { content: "selam" }, prompt_eval_count: 1900, eval_count: 12 });
  try {
    const c = await new OllamaBeyni({ model: "x:1b" }).dusun(GIRDI);
    assert.equal(c.bilgi?.["girdiToken"], 1900);
  } finally { s.geri(); }
});

test("araçsız model: tools BOŞ — Ollama 400 vermesin, satır sözleşmesi devralır", async () => {
  const s = sunucu();
  try {
    const b = new OllamaBeyni({ model: "gemma3:1b", yetenekler: ["completion"] });
    assert.equal(b.aracli, false);
    await b.dusun(GIRDI);
    assert.deepEqual(s.istekler[0]!.govde!.tools, []);
    assert.equal("think" in s.istekler[0]!.govde!, false);
  } finally { s.geri(); }
});

test("düşünen model: think=false — tur konuşma hızında kalsın", async () => {
  const s = sunucu();
  try {
    await new OllamaBeyni({ model: "qwen3:4b", yetenekler: ["completion", "tools", "thinking"] }).dusun(GIRDI);
    assert.equal(s.istekler[0]!.govde!.think, false);
    assert.ok((s.istekler[0]!.govde!.tools as unknown[]).length > 0);
  } finally { s.geri(); }
});

test("hazirMi: etiketsiz kurulu ad :latest ile eşleşir", async () => {
  const s = sunucu({ models: [{ name: "llama3.2:latest" }] });
  try {
    assert.equal(await new OllamaBeyni({ model: "llama3.2" }).hazirMi(), true);
    assert.equal(await new OllamaBeyni({ model: "llama3.2:1b" }).hazirMi(), false);
  } finally { s.geri(); }
});

test("isit: modeli boş istemle yükler, fırlatmaz", async () => {
  const s = sunucu({});
  try {
    assert.equal(await new OllamaBeyni({ model: "qwen3:4b", sicakTut: "1h" }).isit(), true);
    assert.match(s.istekler[0]!.yol, /\/api\/generate$/);
    assert.deepEqual(s.istekler[0]!.govde, { model: "qwen3:4b", keep_alive: "1h" });
  } finally { s.geri(); }
  const eski = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("kapalı"); }) as typeof fetch;
  try { assert.equal(await new OllamaBeyni().isit(), false); }
  finally { globalThis.fetch = eski; }
});

test("GERÇEK (2026-10-02): zaman aşımı ham 'signal is aborted' değil, süreyle söylenir", async () => {
  const eski = globalThis.fetch;
  // Sinyal düşünce fetch'in yaptığı gibi AbortError fırlatan sahte sunucu.
  globalThis.fetch = ((_u: string | URL, o?: RequestInit) => new Promise((_coz, ret) => {
    o?.signal?.addEventListener("abort", () => ret(Object.assign(new Error("signal is aborted without reason"), { name: "AbortError" })));
  })) as typeof fetch;
  try {
    await assert.rejects(new OllamaBeyni({ model: "x:1b", zamanAsimiMs: 20 }).dusun(GIRDI), /yerel model 0 sn icinde cevap vermedi/);
  } finally {
    globalThis.fetch = eski;
  }
});
