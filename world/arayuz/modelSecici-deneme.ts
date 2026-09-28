// world/arayuz/modelSecici-deneme.ts — model seçiciyi ODASIZ açar.
//
// Kartlar `bridge/beyinKatalogu.ts`in üreteceği biçimde elle yazılmış
// (K4: `world/` `bridge/`i import edemez). Amaç tasarımı ve klavye akışını
// Electron'suz görmek:
//   npm run dev → http://localhost:5173/world/arayuz/modelSecici-deneme.html
//   ?acik=1 : sayfa açılır açılmaz pencere açık (ekran görüntüsü için)
"use strict";
import { modelSeciciKur } from "./modelSecici.ts";
import type { ModelKarti, SeciciDurumu, TaramaOzeti } from "./modelSeciciCekirdek.ts";

const r = (metin: string, ton: "iyi" | "uyari" | "kotu" | "notr" = "notr") => ({ metin, ton });
const yerel = (ad: string, aile: string, rozetler: ModelKarti["rozetler"], uygun = true): ModelKarti => ({
  ad: `yerel:${ad}`, baslik: ad, grup: "yerel", rozetler, uygun,
  aciklama: `${aile} ailesi · Ollama · yerel, ağ yok, ücret yok`,
  ...(uygun ? {} : { sebep: "gömme modeli — sohbet edemez" }),
});
const KARTLAR: ModelKarti[] = [
  yerel("qwen2.5:7b", "qwen2", [r("bellekte", "iyi"), r("7.6B"), r("4.7 GB"), r("araç ✓", "iyi"), r("Q4_K_M")]),
  yerel("llama3.2:3b", "llama", [r("3.2B"), r("2.0 GB"), r("araç ✓", "iyi"), r("Q4_K_M")]),
  yerel("qwen3:4b", "qwen3", [r("4.0B"), r("2.5 GB"), r("araç ✓", "iyi"), r("düşünür"), r("Q4_K_M")]),
  yerel("mistral:7b", "llama", [r("7.2B"), r("4.1 GB"), r("araç ✓", "iyi"), r("Q4_0")]),
  yerel("gemma3:4b", "gemma3", [r("4.3B"), r("3.3 GB"), r("araçsız", "uyari"), r("görür"), r("Q4_K_M")]),
  yerel("nomic-embed-text:latest", "nomic-bert", [r("137M"), r("274 MB")], false),
  { ad: "claude:haiku", baslik: "Claude Haiku", grup: "bulut", uygun: true,
    aciklama: "Varsayılan düşünce. Adaptörünü Electron başlatır; ölçülen tur 2,8–3,6 sn.",
    rozetler: [r("varsayılan", "iyi"), r("araç ✓", "iyi")] },
  { ad: "opencode", baslik: "OpenCode", grup: "bulut", uygun: true,
    aciklama: "OpenCode sunucusu üzerinden bulut modeli (sağlayıcı/model ?saglayici= ?model= ile).",
    rozetler: [r("opencode serve gerekir")] },
  { ad: "mcp", baslik: "MCP ajanı", grup: "dis", uygun: true,
    aciklama: "Odadaki claude dünyaya MCP ile bağlanır ve algıyı kendisi çeker (spec 05).",
    rozetler: [r("ajan bağlı olmalı")] },
  { ad: "dis", baslik: "Dış beyin", grup: "dis", uygun: true,
    aciklama: "Başka dilde yazılmış beyin, HTTP sözleşmesiyle (spec 04, ?beyinadres=).",
    rozetler: [r("süreç ayakta olmalı")] },
];

let durum: SeciciDurumu = { aktif: "claude:haiku", istenen: "claude:haiku", gecis: "sakin" };
let tarama: TaramaOzeti | null = null;

const secici = modelSeciciKur({
  kok: document.getElementById("modelSecici")!,
  rozet: document.getElementById("beyinRozet")!,
  kaynak: {
    kartlar: () => KARTLAR,
    durum: () => durum,
    sec(ad) {
      if (durum.gecis === "kontrol") return `geçiş sürüyor (${durum.hedef})`;
      durum = { ...durum, istenen: ad, gecis: "kontrol", hedef: ad };
      setTimeout(() => {
        durum = ad.includes("mistral")
          ? { aktif: durum.aktif, istenen: durum.aktif, gecis: "reddedildi", hedef: ad, sebep: "mistral:7b hazır değil" }
          : { aktif: ad, istenen: ad, gecis: "sakin" };
      }, 1200);
      return "";
    },
    async yenile() {
      await new Promise((r) => setTimeout(r, 400));
      tarama = { ulasildi: true, surum: "0.12.3", modelSayisi: 6, an: Date.now() };
    },
    tarama: () => tarama,
  },
});
if (new URLSearchParams(location.search).has("acik")) secici.ac();
