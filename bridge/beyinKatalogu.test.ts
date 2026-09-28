// bridge/beyinKatalogu.test.ts — seçenekler ve kartlar TEK kaynaktan (katalog).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { yerelSecenekler, kartlariKur, yerelAd, yereldenModel, yerelKart } from "./beyinKatalogu.ts";
import { OllamaBeyni } from "./ollama.ts";
import type { OllamaKatalogu, OllamaModeli } from "./ollamaKatalog.ts";

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

test("katalogda OLMAYAN yerel seçenek (ör. ?beyin=yerel:x) yine kart alır", () => {
  const k = kartlariKur(["claude:haiku", "yerel:silinmis:3b"], { ...KATALOG, modeller: [] });
  const s = k.find((x) => x.ad === "yerel:silinmis:3b")!;
  assert.equal(s.grup, "yerel");
  assert.match(s.aciklama, /kurulu görünmüyor/);
  const kapali = kartlariKur(["yerel:x"], null);
  assert.match(kapali[0]!.aciklama, /taranamadı/);
});
