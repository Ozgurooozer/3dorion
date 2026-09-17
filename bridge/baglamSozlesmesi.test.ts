// bridge/baglamSozlesmesi.test.ts — HER beyin aynı bağlamı görmeli (spec 06 K8).
//
// NEDEN VAR: `ollama.ts` kullanıcı mesajını kendisi kuruyordu ve `anilar`
// alanını HİÇ kullanmıyordu. Yani yerel beyinle Orion'un uzun vadeli hafızası
// yoktu; "hangi beyin" seçimi sessizce "hafıza var mı" seçimine dönüşüyordu.
// Ölçümde yakalandı: hafıza denemesinin iki kolu o beyinde birebir aynı
// girdiye dönüşüyor, aradaki fark gürültüden ibaret kalıyordu.
//
// Bu dosya sözleşmeyi beyinden bağımsız olarak sabitler: yeni bir beyin
// eklendiğinde de aynı kural geçerli.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OllamaBeyni } from "./ollama.ts";
import { OpenCodeBeyni } from "./opencode.ts";
import type { Beyin, BeyinGirdisi } from "./beyin.ts";

const GIRDI: BeyinGirdisi = {
  talimat: "TALIMAT_IZI",
  sabit: "SABIT_IZI",
  dunya: "DUNYA_IZI",
  anilar: ["ANI_IZI_BIR", "ANI_IZI_IKI"],
  ozetler: ["OZET_IZI"],
  gecmis: [],
  araclar: [],
};

/** `fetch`i tuzağa düşürür: giden gövdeyi yakalar, sahte yanıt döndürür. */
async function gidenGovde(kur: () => Beyin): Promise<string> {
  const eski = globalThis.fetch;
  const govdeler: string[] = [];
  globalThis.fetch = (async (_url: string, ayar?: { body?: string }) => {
    if (ayar?.body) govdeler.push(String(ayar.body));
    return {
      ok: true, status: 200,
      // OpenCode önce oturum açar; ikisine de yetecek bir gövde.
      text: async () => JSON.stringify({ id: "oturum1", message: { content: "", parts: [] } }),
      json: async () => ({ id: "oturum1", message: { content: "" } }),
    } as unknown as Response;
  }) as typeof fetch;
  try {
    await kur().dusun(GIRDI);
    return govdeler.join("\n");
  } finally { globalThis.fetch = eski; }
}

for (const [ad, kur] of [
  ["ollama", () => new OllamaBeyni({ model: "test" })],
  ["opencode", () => new OpenCodeBeyni({ modelID: "test" })],
] as const) {
  test(`${ad}: ANILAR bağlama girer — hafıza beyne göre kaybolmaz`, async () => {
    const govde = await gidenGovde(kur);
    assert.match(govde, /ANI_IZI_BIR/, "anı gönderilmedi");
    assert.match(govde, /ANI_IZI_IKI/, "ikinci anı gönderilmedi");
  });

  test(`${ad}: talimat, sabit, dünya ve özet de bağlamda`, async () => {
    const govde = await gidenGovde(kur);
    for (const iz of ["TALIMAT_IZI", "SABIT_IZI", "DUNYA_IZI", "OZET_IZI"]) {
      assert.match(govde, new RegExp(iz), `${iz} bağlamda yok`);
    }
  });
}
