// host/mcpSunucu.js — Orion'un dünyasının MCP ucu (spec 05 Aşama 1).
//
// Odadaki `claude` (ya da herhangi bir MCP istemcisi) buraya bağlanır ve
// Orion'un bedenini araçlarla sürer. Taşıma: MCP "Streamable HTTP",
// durumsuz, yalnızca JSON yanıt (sunucu akışı yok — ihtiyaç da yok:
// `dunya_bekle` uzun yoklama ile çalışıyor).
//
// NEDEN SDK YOK. `@modelcontextprotocol/sdk` kurulu değil ve burada gereken
// yüzey dört yöntem: initialize, ping, tools/list, tools/call. JSON-RPC 2.0
// üzerine ~80 satır. Yeni bir bağımlılık bunu küçültmez, büyütür.
// Daha fazla yöntem gerekirse (resources, prompts, sunucu bildirimi) SDK'ya geç.
//
// NEDEN RÖLE. Dünya renderer'da yaşıyor (spec 07 K2: süreç ayrımı yok) ama
// renderer port dinleyemez. `tools/*` çağrıları IPC ile renderer'daki
// `bridge/mcpBeyin.ts`'e gider; araç listesi de oradan gelir — protokolden
// üretilir, burada ikinci bir liste YOK.
//
// GÜVENLİK:
//   • yalnızca 127.0.0.1 — ağdan erişilemez
//   • tarayıcıdan gelen istek (localhost olmayan `Origin`) 403: kötü niyetli bir
//     web sayfası yerel porta POST atıp araç çağıramasın (DNS rebinding)
//   • araç çağrıları burada ÇALIŞMAZ; köprüye gider ve orada onay kapısı dahil
//     bütün korumalardan geçer. Bu uç en kötü ihtimalle Orion'a ÖNERİ yaptırır.
import http from "node:http";

const SURUMLER = new Set(["2025-06-18", "2025-03-26", "2024-11-05"]);
const VARSAYILAN_SURUM = "2025-06-18";

function yerelOriginMi(origin) {
  if (!origin || origin === "null") return true;          // tarayıcı dışı istemci
  try {
    const h = new URL(origin).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
  } catch { return false; }
}

/**
 * @param {{ port: number, role: (yontem: string, param: unknown, sinyal?: AbortSignal) => Promise<unknown>, releSiniriMs?: number, oturumBasladi?: () => void }} ayar
 */
export function mcpSunucuKur(ayar) {
  const releSiniri = ayar.releSiniriMs ?? 30_000;

  const cevap = (res, durum, govde) => {
    if (govde === undefined) { res.writeHead(durum); return res.end(); }
    res.writeHead(durum, { "Content-Type": "application/json" });
    res.end(JSON.stringify(govde));
  };
  const hata = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

  /** Röle cevap vermezse HTTP isteği sonsuza kadar açık kalmasın. */
  function sinirli(p) {
    return new Promise((coz, reddet) => {
      const z = setTimeout(() => reddet(new Error(`role ${releSiniri} ms icinde cevap vermedi`)), releSiniri);
      p.then((v) => { clearTimeout(z); coz(v); }, (e) => { clearTimeout(z); reddet(e); });
    });
  }

  async function isle(m, sinyal) {
    if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return hata(m?.id, -32600, "gecersiz istek");
    const bildirim = m.id === undefined || m.id === null;
    if (bildirim) return undefined;                        // notifications/* — cevap yok

    switch (m.method) {
      case "initialize": {
        // Her MCP oturumu initialize ile başlar: talimat yeniden gitsin.
        try { ayar.oturumBasladi?.(); } catch { /* bildirim hatası cevabı bozmasın */ }
        const istenen = m.params?.protocolVersion;
        return { jsonrpc: "2.0", id: m.id, result: {
          protocolVersion: SURUMLER.has(istenen) ? istenen : VARSAYILAN_SURUM,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "orion-dunya", version: "1.0.0" },
          instructions: "Orion'un odadaki bedeni. dunya_bekle ile döngüye gir.",
        } };
      }
      case "ping":
        return { jsonrpc: "2.0", id: m.id, result: {} };
      case "tools/list":
      case "tools/call":
        try { return { jsonrpc: "2.0", id: m.id, result: await sinirli(ayar.role(m.method, m.params, sinyal)) }; }
        catch (e) { return hata(m.id, -32603, String(e?.message ?? e)); }
      default:
        return hata(m.id, -32601, `bilinmeyen yontem: ${m.method}`);
    }
  }

  const sunucu = http.createServer((req, res) => {
    if (req.url !== "/mcp") return cevap(res, 404, hata(null, -32601, "yol yok"));
    if (!yerelOriginMi(req.headers.origin)) return cevap(res, 403, hata(null, -32600, "Origin reddedildi"));
    if (req.method !== "POST") return cevap(res, 405, hata(null, -32600, "yalnizca POST (sunucu akisi yok)"));

    // İSTEMCİ BAĞLANTIYI KOPARIRSA (ajan öldü) röle bilsin: bekleyen
    // `dunya_bekle` ölü ajan için açık kalmasın, temas HEMEN kopsun (R1).
    const iptal = new AbortController();
    res.on("close", () => { if (!res.writableEnded) iptal.abort(); });

    let ham = "";
    req.setEncoding("utf8");
    req.on("data", (p) => { ham += p; if (ham.length > 1_000_000) req.destroy(); });
    req.on("end", async () => {
      let m;
      try { m = JSON.parse(ham); } catch { return cevap(res, 400, hata(null, -32700, "bozuk JSON")); }
      if (Array.isArray(m)) {                              // toplu istek
        const sonuclar = (await Promise.all(m.map((x) => isle(x, iptal.signal)))).filter((x) => x !== undefined);
        return sonuclar.length ? cevap(res, 200, sonuclar) : cevap(res, 202);
      }
      const s = await isle(m, iptal.signal);
      return s === undefined ? cevap(res, 202) : cevap(res, 200, s);
    });
  });

  let coz;
  const hazir = new Promise((r) => { coz = r; });
  const nesne = { port: 0, hazir, kapat: () => sunucu.close() };
  sunucu.listen(ayar.port, "127.0.0.1", () => { nesne.port = sunucu.address().port; coz(); });
  sunucu.on("error", (e) => console.error(`[mcp] sunucu hatasi: ${e.message}`));
  return nesne;
}
