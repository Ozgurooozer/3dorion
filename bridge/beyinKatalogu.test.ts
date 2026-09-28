// bridge/beyinKatalogu.test.ts — seçenekler ve kartlar TEK kaynaktan (katalog).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  yerelSecenekler, kartlariKur, yerelAd, yereldenModel, yerelKart,
  bulutSecenekler, bulutAd, bulutKart,
} from "./beyinKatalogu.ts";
import { OllamaBeyni } from "./ollama.ts";
import { OpenCodeBeyni } from "./opencode.ts";
import type { OllamaKatalogu, OllamaModeli } from "./ollamaKatalog.ts";
import type { OpenCodeKatalogu, OpenCodeModeli } from "./opencodeKatalog.ts";

const m = (ad: string, y: string[] | null, o: Partial<OllamaModeli> = {}): OllamaModeli => ({
  ad, boyutBayt: 4_700_000_000, parametre: "7.6B", aile: "qwen2", niceleme: "Q4_K_M", degisti: "",
  yuklu: false, vramBayt: 0, yetenekler: y, ...o,
});
const KATALOG: OllamaKatalogu = {
  adres: "http://127.0.0.1:11434", ulasildi: true, surum: "0.12.3", an: 0,
  modeller: [
    m("qwen2.5:7b", ["completion", "tools"], { yuklu: true }),
    m("gemma3:1b", ["completion"]),
    m("nomic-embed-text:latest", ["embedding"]),
  ],
};

test("yerel ad gidiş-dönüş; model adındaki ':' korunur", () => {
  assert.equal(yerelAd("qwen2.5:7b"), "yerel:qwen2.5:7b");
  assert.equal(yereldenModel("yerel:qwen2.5:7b"), "qwen2.5:7b");
  assert.equal(yereldenModel("claude:haiku"), null);
});

test("seçenekler yalnızca SOHBET EDEBİLEN modeller; yetenek beyne taşınır", () => {
  const s = yerelSecenekler(KATALOG);
  assert.deepEqual(s.map((x) => x.ad), ["yerel:qwen2.5:7b", "yerel:gemma3:1b"]);
  const gemma = s[1]!.kur();
  assert.ok(gemma instanceof OllamaBeyni);
  assert.equal(gemma.ad, "gemma3:1b");
  assert.equal((gemma as OllamaBeyni).aracli, false, "araçsız modele araç gönderilecek");
  assert.equal((s[0]!.kur() as OllamaBeyni).aracli, true);
});

test("kartlar: katalogdakiler + sabitler; gömme modeli görünür ama seçilemez", () => {
  const k = kartlariKur(["claude:haiku", "opencode", "yerel:qwen2.5:7b", "yerel:gemma3:1b", "mcp", "dis"], KATALOG);
  assert.deepEqual(k.map((x) => x.ad), [
    "yerel:qwen2.5:7b", "yerel:gemma3:1b", "yerel:nomic-embed-text:latest",
    "claude:haiku", "opencode", "mcp", "dis",
  ]);
  const gomme = k.find((x) => x.ad === "yerel:nomic-embed-text:latest")!;
  assert.equal(gomme.uygun, false);
  assert.match(gomme.sebep ?? "", /gömme/);
  assert.equal(k.find((x) => x.ad === "claude:haiku")!.baslik, "Claude Haiku");
  assert.equal(k.find((x) => x.ad === "mcp")!.grup, "dis");
});

test("rozetler: bellekte, araç, boyut; araçsız UYARI tonunda", () => {
  const q = yerelKart(KATALOG.modeller[0]!);
  assert.deepEqual(q.rozetler.map((r) => r.metin), ["bellekte", "7.6B", "4.7 GB", "araç ✓", "Q4_K_M"]);
  const g = yerelKart(KATALOG.modeller[1]!);
  assert.equal(g.rozetler.find((r) => r.metin === "araçsız")?.ton, "uyari");
  // Yetenek bilinmiyorsa araç rozeti HİÇ yok — "var" da "yok" da demez.
  const b = yerelKart(m("eski:1b", null));
  assert.ok(!b.rozetler.some((r) => /araç/.test(r.metin)));
});

const bm = (providerID: string, modelID: string, o: Partial<OpenCodeModeli> = {}): OpenCodeModeli => ({
  providerID, modelID, ad: modelID, saglayiciAdi: providerID, aile: "", baglamPenceresi: 0,
  gorurMu: false, dusunurMu: false, ...o,
});
const BULUT: OpenCodeKatalogu = {
  adres: "http://127.0.0.1:4096", ulasildi: true, an: 0,
  saglayicilar: ["openrouter", "nvidia"],
  modeller: [
    bm("openrouter", "google/gemma-4-31b-it:free", { ad: "Gemma 4 31B (free)", saglayiciAdi: "OpenRouter", baglamPenceresi: 128000 }),
    bm("nvidia", "meta/llama-3.2-11b-vision-instruct", { ad: "Llama 3.2 11B Vision", saglayiciAdi: "Nvidia", gorurMu: true }),
  ],
};

test("bulut ad gidiş-dönüş: providerID/modelID sabit `opencode` seçeneğiyle çakışmaz", () => {
  assert.equal(bulutAd("nvidia", "meta/llama-3.2-11b-vision-instruct"), "opencode:nvidia/meta/llama-3.2-11b-vision-instruct");
  assert.notEqual(bulutAd("nvidia", "x"), "opencode");
});

test("bulut seçenekler: her model OpenCodeBeyni kurar, providerID/modelID doğru geçer", async () => {
  const s = bulutSecenekler(BULUT);
  assert.deepEqual(s.map((x) => x.ad), [
    "opencode:openrouter/google/gemma-4-31b-it:free",
    "opencode:nvidia/meta/llama-3.2-11b-vision-instruct",
  ]);
  const b = s[1]!.kur();
  assert.ok(b instanceof OpenCodeBeyni);
  assert.match(b.ad, /llama-3\.2-11b-vision-instruct/);

  // Kurulan beynin GERÇEKTEN nvidia'ya konuştuğunu ağa giden gövdeden doğrula —
  // `bulutSecenekler` yanlış sağlayıcıyı iletse `.ad` (yalnız modelID'den
  // türer) bunu YAKALAMAZ; istek gövdesi tek güvenilir tanık.
  let govde: Record<string, unknown> | null = null;
  const eski = globalThis.fetch;
  globalThis.fetch = (async (u: string | URL, o?: RequestInit) => {
    const yol = String(u);
    if (!yol.endsWith("/session")) govde = JSON.parse(String(o?.body ?? "{}"));
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify(yol.endsWith("/session")
        ? { id: "s1" } : { parts: [{ type: "text", text: "tamam" }] }),
    } as Response;
  }) as typeof fetch;
  try {
    await b.dusun({ ozetler: [], dunya: "oda", gecmis: [], araclar: [] });
    const m = (govde as unknown as { model?: { providerID?: string; modelID?: string } } | null)?.model;
    assert.equal(m?.providerID, "nvidia");
    assert.equal(m?.modelID, "meta/llama-3.2-11b-vision-instruct");
  } finally { globalThis.fetch = eski; }
});

test("bulut kart: sağlayıcı, ücretsiz, araç rozetleri; görme/düşünme koşullu", () => {
  const k = bulutKart(BULUT.modeller[1]!);
  assert.equal(k.grup, "bulut");
  assert.deepEqual(k.rozetler.map((r) => r.metin), ["Nvidia", "ücretsiz", "araç ✓", "görür"]);
  const g = bulutKart(BULUT.modeller[0]!);
  assert.deepEqual(g.rozetler.map((r) => r.metin), ["OpenRouter", "ücretsiz", "araç ✓", "128K bağlam"]);
});

test("kartlariKur: yerel + bulut birlikte, seçenekteki adla eşleşir", () => {
  const secenekAdlari = ["claude:haiku", "yerel:qwen2.5:7b", ...BULUT.modeller.map((m) => bulutAd(m.providerID, m.modelID))];
  const k = kartlariKur(secenekAdlari, KATALOG, BULUT);
  assert.deepEqual(k.map((x) => x.ad), [
    "yerel:qwen2.5:7b", "yerel:gemma3:1b", "yerel:nomic-embed-text:latest",
    "opencode:openrouter/google/gemma-4-31b-it:free", "opencode:nvidia/meta/llama-3.2-11b-vision-instruct",
    "claude:haiku",
  ]);
  assert.equal(k.find((x) => x.ad.startsWith("opencode:nvidia"))!.grup, "bulut");
});

test("kartlariKur: bulut verilmezse (null/atlanmış) eski davranış korunur", () => {
  const eski = kartlariKur(["claude:haiku", "yerel:qwen2.5:7b"], KATALOG);
  assert.equal(eski.length, 4);
});

test("katalogda OLMAYAN yerel seçenek (ör. ?beyin=yerel:x) yine kart alır", () => {
  const k = kartlariKur(["claude:haiku", "yerel:silinmis:3b"], { ...KATALOG, modeller: [] });
  const s = k.find((x) => x.ad === "yerel:silinmis:3b")!;
  assert.equal(s.grup, "yerel");
  assert.match(s.aciklama, /kurulu görünmüyor/);
  const kapali = kartlariKur(["yerel:x"], null);
  assert.match(kapali[0]!.aciklama, /taranamadı/);
});
