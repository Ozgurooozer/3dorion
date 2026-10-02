// tools/sahte-api.mjs — `apidene` için sahte OpenAI uyumlu sunucu (spec 13 Faz 3).
//
// Yalnız 127.0.0.1'de dinler, 90 sn sonra kendiliğinden kapanır. Gerçek bir
// sağlayıcıya ve gerçek anahtara gerek kalmadan zinciri uçtan uca sınar:
// seçici → ana süreç (şifreli depo) → Authorization başlığı → bu sunucu → beyin.
//
//   GET  /v1/models           → tek model: sahte/orion-test
//   POST /v1/chat/completions → dunya_soyle("API beyni duyuyor.") araç çağrısı
//
// Her istekte başlığın beklenen sahte anahtarı taşıyıp taşımadığını basar.
import http from "node:http";

const PORT = Number(process.env.SAHTE_API_PORT ?? 8799);
const BEKLENEN = "Bearer apidene-sahte-anahtar";

const sunucu = http.createServer((ist, cev) => {
  let govde = "";
  ist.on("data", (p) => { govde += p; });
  ist.on("end", () => {
    const yetki = ist.headers.authorization === BEKLENEN ? "ok" : "YANLIS";
    console.log(`[SAHTE-API] ${ist.method} ${ist.url} yetki=${yetki}`);
    cev.setHeader("Content-Type", "application/json");
    if (yetki !== "ok") { cev.statusCode = 401; cev.end('{"error":"invalid key"}'); return; }
    if (ist.method === "GET" && ist.url === "/v1/models") {
      cev.end(JSON.stringify({ data: [{ id: "sahte/orion-test", owned_by: "apidene" }] }));
      return;
    }
    if (ist.method === "POST" && ist.url === "/v1/chat/completions") {
      let araclar = 0;
      try { araclar = JSON.parse(govde).tools?.length ?? 0; } catch { /* sayım yalnız bilgi */ }
      console.log(`[SAHTE-API] sohbet: ${araclar} araç geldi`);
      cev.end(JSON.stringify({ choices: [{ message: { content: "", tool_calls: [
        { id: "c1", type: "function", function: { name: "dunya_soyle", arguments: '{"metin":"API beyni duyuyor."}' } },
      ] } }], usage: { total_tokens: 42 } }));
      return;
    }
    cev.statusCode = 404;
    cev.end("{}");
  });
});
sunucu.listen(PORT, "127.0.0.1", () => console.log(`[SAHTE-API] 127.0.0.1:${PORT} dinliyor (90 sn)`));
setTimeout(() => { sunucu.close(); process.exit(0); }, 90_000).unref?.();
