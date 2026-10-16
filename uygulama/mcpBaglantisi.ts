// uygulama/mcpBaglantisi.ts — MCP ajanı (spec 05 Aşama 1-2): tek McpBeyin örneği ve host'tan gelen isteklerin dinleyicisi.
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2). Tek örnek: seçicideki "mcp" girdisi ve main'deki HTTP
// ucunun rölesi AYNI nesneyle konuşur.
"use strict";
import { kabukKoprusu } from "./kabuk.ts";
import { McpBeyin } from "../bridge/mcpBeyin.ts";

// Beyin seçili değilken ajanın `dunya_bekle`si yalnızca
// "sessiz" döner ve araç çağrıları reddedilir (açık tur yok) — uç etkisizdir.
export function mcpBaglantisiKur(): McpBeyin {
  const mcpBeyin = new McpBeyin();
  kabukKoprusu()?.mcpDinle?.(async ({ id, yontem, param }) => {
    const k = kabukKoprusu()!;
    // Yeni ajan oturumu (MCP initialize): talimat yeniden gitsin. Cevap yok (id 0).
    if (yontem === "oturum") { mcpBeyin.oturumBasladi(); return; }
    // Ajanın bağlantısı koptu: YALNIZCA o isteğin beklemesini iptal et.
    if (yontem === "iptal") {
      mcpBeyin.bekleIptal((param as { id?: number })?.id);
      // Gözlemlenebilir olsun: R1 kapısı bu satırı arar.
      console.log(`[mcp] ajan baglantisi koptu → temas kesildi (hazir=${mcpBeyin.kesikSaniye === 0})`);
      return;
    }
    try {
      if (yontem === "tools/list") {
        return k.mcpYanitla!(id, {
          tools: mcpBeyin.araclar().map((a) => ({ name: a.ad, description: a.aciklama, inputSchema: a.sema })),
        });
      }
      const p = param as { name?: string; arguments?: Record<string, unknown> };
      if (p?.name === "dunya_bekle") {
        // Tavan 120 sn: main'deki röle sınırı (130 sn) bunun üstünde. Ajan ne
        // isterse istesin en az 60 sn: kısa bekleme = her "quiet" bir model turu.
        const sn = Math.min(120, Math.max(60, Number(p.arguments?.azami_sn ?? 120) || 120));
        const s = await mcpBeyin.bekle(sn * 1000, id);
        return k.mcpYanitla!(id, { content: [{ type: "text", text: "sessiz" in s ? "quiet — nothing happened. Call dunya_bekle again." : s.metin }] });
      }
      const r = mcpBeyin.cagri(String(p?.name ?? ""), p?.arguments ?? {});
      return k.mcpYanitla!(id, { content: [{ type: "text", text: r.mesaj }], isError: !r.ok });
    } catch (hata) {
      k.mcpYanitla!(id, undefined, String((hata as Error)?.message ?? hata));
    }
  });
  return mcpBeyin;
}
