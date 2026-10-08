// bridge/apiBeyni.test.ts — API beyni (spec 13 Faz 3): ne GÖNDERİR, cevabı nasıl OKUR.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiBeyni, apiMesajlari, apiCevabiniCoz, type ApiIstemcisi } from "./apiBeyni.ts";
import { modelleriCoz, apiTara, apiAd } from "./apiKatalog.ts";
import { araclariUret } from "./araclar.ts";
import { ornekUret } from "./ornekler.ts";
import { ollamaMesajlari } from "./ollama.ts";

const GIRDI = {
  ozetler: ['Ozyn said: "otur"'], dunya: "oda", araclar: araclariUret(),
  gecmis: [
    { rol: "kullanici" as const, metin: "bana gel" },
    { rol: "orion" as const, metin: "", arac: true, cagri: { ad: "dunya_git", girdi: { hedef: { tip: "oyuncu" } } } },
  ],
  ornekler: ornekUret({ terminal: false, konusma: true }),
};

function istemci(cevap: unknown = { choices: [{ message: { content: "", tool_calls: [] } }] }) {
  const gonderilen: unknown[] = [];
  const i: ApiIstemcisi = {
    durum: async () => [{ ad: "nvidia", anahtarVar: true }],
    sohbet: async (_s, govde) => { gonderilen.push(govde); return { ok: true, veri: cevap }; },
  };
  return { i, gonderilen };
}

test("her araç çağrısının id'si var ve her tool mesajı kendi çağrısına bağlı", () => {
  const m = apiMesajlari(ollamaMesajlari(GIRDI));
  const ids = m.flatMap((x) => x.tool_calls?.map((c) => c.id) ?? []);
  const baglar = m.filter((x) => x.role === "tool").map((x) => x.tool_call_id);
  assert.deepEqual(baglar, ids);
});

test("argümanlar JSON METNİ olarak gider (OpenAI biçimi)", () => {
  const m = apiMesajlari(ollamaMesajlari(GIRDI));
  // Sonuncusu geçmişteki çağrı (öncekiler örneklerden).
  const git = m.flatMap((x) => x.tool_calls ?? []).filter((c) => c.function.name === "dunya_git").at(-1)!;
  assert.equal(git.function.arguments, '{"hedef":{"tip":"oyuncu"}}');
});

test("bağlam Ollama beyniyle AYNI kaynaktan: mesaj sayısı ve rolleri aynı", () => {
  const o = ollamaMesajlari(GIRDI), a = apiMesajlari(o);
  assert.deepEqual(a.map((x) => x.role), o.map((x) => x.role));
});

test("istek: model, araçlar function biçiminde", async () => {
  const { i, gonderilen } = istemci();
  await new ApiBeyni({ saglayici: "nvidia", model: "m/x", istemci: i }).dusun(GIRDI);
  const g = gonderilen[0] as { model: string; tools: { type: string; function: { name: string } }[] };
  assert.deepEqual({ model: g.model, tip: g.tools[0]?.type, ad: g.tools[0]?.function.name.startsWith("dunya_") },
    { model: "m/x", tip: "function", ad: true });
});

test("cevap: metin JSON argümanlı araç çağrısıyla okunur", () => {
  const c = apiCevabiniCoz({ choices: [{ message: { content: " Tamam ", tool_calls: [
    { function: { name: "dunya_otur", arguments: "{}" } },
    { function: { name: "dunya_git", arguments: '{"hedef":{"tip":"oyuncu"},"mesafe":1.2}' } },
  ] } }] });
  assert.deepEqual({ metin: c.metin, cagrilar: c.cagrilar }, { metin: "Tamam", cagrilar: [
    { ad: "dunya_otur", girdi: {} }, { ad: "dunya_git", girdi: { hedef: { tip: "oyuncu" }, mesafe: 1.2 } }] });
});

test("girdi token sayısı usage.prompt_tokens'tan okunur (spec 16 F0)", () => {
  assert.equal(apiCevabiniCoz({ choices: [{ message: { content: "x" } }], usage: { prompt_tokens: 812, total_tokens: 840 } }).girdiToken, 812);
});

test("usage yoksa girdi token alanı yoktur", () => {
  assert.equal("girdiToken" in apiCevabiniCoz({ choices: [{ message: { content: "x" } }] }), false);
});

test("bozuk argümanlı çağrı atlanır, diğeri kalır", () => {
  const c = apiCevabiniCoz({ choices: [{ message: { tool_calls: [
    { function: { name: "dunya_bak", arguments: "{bozuk" } }, { function: { name: "dunya_kalk", arguments: "" } }] } }] });
  assert.deepEqual(c.cagrilar, [{ ad: "dunya_kalk", girdi: {} }]);
});

test("düşünen modelin reasoning_content'i ayrı tutulur (iç ses için), söze karışmaz", () => {
  const c = apiCevabiniCoz({ choices: [{ message: { content: "", reasoning_content: "önce oturmalıyım" } }] });
  assert.deepEqual({ metin: c.metin, dusunce: c.dusunce }, { metin: "", dusunce: "önce oturmalıyım" });
});

test("ana süreç hata dönerse beyin fırlatır (köprü arıza olarak gösterir)", async () => {
  const i: ApiIstemcisi = { durum: async () => [], sohbet: async () => ({ ok: false, hata: "nvidia 401: ***" }) };
  await assert.rejects(new ApiBeyni({ saglayici: "nvidia", model: "x", istemci: i }).dusun(GIRDI), /nvidia 401/);
});

test("hazirMi istek atmaz, yalnız anahtara bakar", async () => {
  const { i, gonderilen } = istemci();
  const sonuc = [await new ApiBeyni({ saglayici: "nvidia", model: "x", istemci: i }).hazirMi(),
    await new ApiBeyni({ saglayici: "openrouter", model: "x", istemci: i }).hazirMi()];
  assert.deepEqual({ sonuc, istek: gonderilen.length }, { sonuc: [true, false], istek: 0 });
});

test("beynin adı seçici adıyla aynı: api:<sağlayıcı>/<model>", () => {
  const { i } = istemci();
  assert.equal(new ApiBeyni({ saglayici: "nvidia", model: "meta/llama", istemci: i }).ad, apiAd("nvidia", "meta/llama"));
});

test("katalog: gömme ve güvenlik modelleri seçenek olmaz, liste sıralı", () => {
  const m = modelleriCoz("nvidia", { data: [
    { id: "nvidia/nv-embedqa-e5-v5" }, { id: "meta/llama-3.3-70b-instruct", owned_by: "meta" },
    { id: "nvidia/llama-3.1-nemoguard-8b-content-safety" }, { id: "deepseek-ai/deepseek-r1" }] });
  assert.deepEqual(m.map((x) => x.model), ["deepseek-ai/deepseek-r1", "meta/llama-3.3-70b-instruct"]);
});

test("tarama: anahtarı olmayan sağlayıcıya istek atılmaz, hata taramayı durdurmaz", async () => {
  const istenen: string[] = [];
  const k = await apiTara({
    durum: async () => [{ ad: "nvidia", anahtarVar: true }, { ad: "openrouter", anahtarVar: true }],
    sohbet: async () => ({ ok: false, hata: "-" }),
    modeller: async (s) => { istenen.push(s); return s === "nvidia" ? { ok: true, veri: { data: [{ id: "a/b" }] } } : { ok: false, hata: "401" }; },
  });
  assert.deepEqual({ istenen, modeller: k.modeller.map((x) => x.model), hata: k.hatalar }, {
    istenen: ["nvidia", "openrouter"], modeller: ["a/b"], hata: [{ saglayici: "openrouter", hata: "401" }] });
});
