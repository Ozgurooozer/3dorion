// bridge/beyinKatalogu.ts — seçilebilir beyinlerin TANITIMI.
//
// Seçici (`secilebilirBeyin.ts`) yalnızca ad → kurucu bilir; Ozyn'e "bu ne,
// ne kadar büyük, araç çağırabilir mi, şu an yüklü mü" demez. Eskiden panelde
// yalnızca çıplak adlar (`yerel:qwen3`) −/+ ile tek tek dönüyordu ve hangi
// seçeneğin ne olduğunu bilmek kodu okumayı gerektiriyordu.
//
// Bu dosya iki şey üretir, ikisi de Ollama kataloğundan (TEK KAYNAK):
//   1. yerel beyin SEÇENEKLERİ — kurulu ve sohbet edebilen her model için
//   2. seçici KARTLARI — her seçenek için okunur bir tanıtım
//
// Kart tipi burada tanımlı; `world/arayuz/modelSecici.ts` AYNI BİÇİMİ kendi
// tarafında yeniden tanımlar (yapısal tip). K4: `world/` `bridge/`i import
// etmez; bağlantıyı kompozisyon kökü kurar.
//
// Bağımlılık: ollama.ts, ollamaKatalog.ts, secilebilirBeyin.ts (yalnızca tip).
"use strict";
import { OllamaBeyni } from "./ollama.ts";
import {
  aracDestekler, boyutYaz, sohbetEdebilir, type OllamaKatalogu, type OllamaModeli,
} from "./ollamaKatalog.ts";
import type { BeyinSecenegi } from "./secilebilirBeyin.ts";

export const YEREL_ONEK = "yerel:";

export type KartGrubu = "yerel" | "bulut" | "dis";
export type RozetTonu = "iyi" | "uyari" | "kotu" | "notr";

export interface ModelKarti {
  /** Seçici anahtarı (`yerel:qwen2.5:7b`, `claude:haiku`). */
  ad: string;
  /** Kartın büyük yazısı. */
  baslik: string;
  grup: KartGrubu;
  /** Tek cümle: ne olduğu. */
  aciklama: string;
  rozetler: readonly { metin: string; ton: RozetTonu }[];
  /** Seçilebilir mi. `false` → `sebep` kartta okunur. */
  uygun: boolean;
  sebep?: string;
}

/** `qwen2.5:7b` → `yerel:qwen2.5:7b`. Model adı olduğu gibi korunur. */
export function yerelAd(model: string): string {
  return `${YEREL_ONEK}${model}`;
}

/** `yerel:qwen2.5:7b` → `qwen2.5:7b`; yerel değilse `null`. */
export function yereldenModel(ad: string): string | null {
  return ad.startsWith(YEREL_ONEK) ? ad.slice(YEREL_ONEK.length) : null;
}

/**
 * Kataloktaki sohbet edebilen her model için bir seçenek.
 *
 * Yetenekler beyne TAŞINIR: araçsız modele `tools`, düşünmeyene `think`
 * gönderilmez (`OllamaBeyni` yorumu). Gömme modelleri seçenek OLMAZ — kartta
 * görünürler ama seçilemezler.
 */
export function yerelSecenekler(
  katalog: OllamaKatalogu, ayar: { zamanAsimiMs?: number } = {},
): BeyinSecenegi[] {
  return katalog.modeller.filter(sohbetEdebilir).map((m) => ({
    ad: yerelAd(m.ad),
    kur: () => new OllamaBeyni({
      model: m.ad, adres: katalog.adres, yetenekler: m.yetenekler,
      zamanAsimiMs: ayar.zamanAsimiMs,
    }),
  }));
}

/**
 * Sabit (Ollama dışı) seçeneklerin tanıtımı. Sayılar ÖLÇÜLMÜŞ olanlardır;
 * kaynakları `world/giris.ts`teki seçenek yorumlarında.
 */
const SABIT: Record<string, Omit<ModelKarti, "ad" | "uygun">> = {
  "claude:haiku": {
    baslik: "Claude Haiku", grup: "bulut",
    aciklama: "Varsayılan düşünce. Adaptörünü Electron başlatır; ölçülen tur 2,8–3,6 sn.",
    rozetler: [{ metin: "varsayılan", ton: "iyi" }, { metin: "araç ✓", ton: "iyi" }],
  },
  opencode: {
    baslik: "OpenCode", grup: "bulut",
    aciklama: "OpenCode sunucusu üzerinden bulut modeli (sağlayıcı/model ?saglayici= ?model= ile).",
    rozetler: [{ metin: "opencode serve gerekir", ton: "notr" }],
  },
  mcp: {
    baslik: "MCP ajanı", grup: "dis",
    aciklama: "Odadaki claude dünyaya MCP ile bağlanır ve algıyı kendisi çeker (spec 05).",
    rozetler: [{ metin: "ajan bağlı olmalı", ton: "notr" }],
  },
  dis: {
    baslik: "Dış beyin", grup: "dis",
    aciklama: "Başka dilde yazılmış beyin, HTTP sözleşmesiyle (spec 04, ?beyinadres=).",
    rozetler: [{ metin: "süreç ayakta olmalı", ton: "notr" }],
  },
};

/** Tek bir Ollama modelinin kartı. */
export function yerelKart(m: OllamaModeli): ModelKarti {
  const rozetler: { metin: string; ton: RozetTonu }[] = [];
  if (m.yuklu) rozetler.push({ metin: "bellekte", ton: "iyi" });
  if (m.parametre) rozetler.push({ metin: m.parametre, ton: "notr" });
  rozetler.push({ metin: boyutYaz(m.boyutBayt), ton: m.boyutBayt > 8e9 ? "uyari" : "notr" });
  const arac = aracDestekler(m);
  // Araçsız model de konuşur (satır sözleşmesi), ama eli ayağı zayıftır:
  // bunu seçmeden ÖNCE bilmek gerek.
  if (arac === true) rozetler.push({ metin: "araç ✓", ton: "iyi" });
  else if (arac === false) rozetler.push({ metin: "araçsız", ton: "uyari" });
  if (m.yetenekler?.includes("thinking")) rozetler.push({ metin: "düşünür", ton: "notr" });
  if (m.yetenekler?.includes("vision")) rozetler.push({ metin: "görür", ton: "notr" });
  if (m.niceleme) rozetler.push({ metin: m.niceleme, ton: "notr" });

  const uygun = sohbetEdebilir(m);
  return {
    ad: yerelAd(m.ad), baslik: m.ad, grup: "yerel",
    aciklama: [m.aile && `${m.aile} ailesi`, "Ollama · yerel, ağ yok, ücret yok"].filter(Boolean).join(" · "),
    rozetler, uygun,
    ...(uygun ? {} : { sebep: "gömme modeli — sohbet edemez" }),
  };
}

/**
 * Seçicinin göstereceği TÜM kartlar: seçenek listesindeki her ad + katalogda
 * olup seçilemeyen modeller (gömme). Seçenekte olup katalogda OLMAYAN yerel ad
 * (ör. `?beyin=yerel:x` ile açılış, sonra model silindi) de kart alır —
 * gizlemek "aktif beyin listede yok" tuhaflığı yaratırdı.
 */
export function kartlariKur(
  secenekAdlari: readonly string[], katalog: OllamaKatalogu | null,
): ModelKarti[] {
  const kartlar: ModelKarti[] = [];
  const katalogAdlari = new Set<string>();
  for (const m of katalog?.modeller ?? []) {
    kartlar.push(yerelKart(m));
    katalogAdlari.add(yerelAd(m.ad));
  }
  for (const ad of secenekAdlari) {
    if (katalogAdlari.has(ad)) continue;
    const model = yereldenModel(ad);
    if (model !== null) {
      kartlar.push({
        ad, baslik: model, grup: "yerel",
        aciklama: katalog?.ulasildi ? "Ollama'da kurulu görünmüyor" : "Ollama taranamadı",
        rozetler: [{ metin: "bilinmiyor", ton: "uyari" }], uygun: true,
      });
      continue;
    }
    const s = SABIT[ad];
    kartlar.push(s ? { ad, ...s, uygun: true }
      : { ad, baslik: ad, grup: "dis", aciklama: "", rozetler: [], uygun: true });
  }
  return kartlar;
}
