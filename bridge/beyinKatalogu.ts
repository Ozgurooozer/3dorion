// bridge/beyinKatalogu.ts — seçilebilir beyinlerin TANITIMI.
//
// Seçici (`secilebilirBeyin.ts`) yalnızca ad → kurucu bilir; Ozyn'e "bu ne,
// ne kadar büyük, araç çağırabilir mi, şu an yüklü mü" demez. Eskiden panelde
// yalnızca çıplak adlar (`yerel:qwen3`) −/+ ile tek tek dönüyordu ve hangi
// seçeneğin ne olduğunu bilmek kodu okumayı gerektiriyordu.
//
// Bu dosya iki şey üretir, YEREL Ollama kataloğundan VE BULUT OpenCode
// kataloğundan (ikisi de TEK KAYNAK):
//   1. beyin SEÇENEKLERİ — kurulu/uygun her model için
//   2. seçici KARTLARI — her seçenek için okunur bir tanıtım
//
// BULUT (OpenCode) yeni: `opencodeKatalog.ts` OpenCode sunucusuna BAĞLI her
// sağlayıcıyı (openrouter, nvidia, ...) tarar. Yeni sağlayıcı eklemek
// (`PUT /auth/<id>`) bu dosyayı DEĞİŞTİRMEZ — liste otomatik büyür.
//
// Kart tipi burada tanımlı; `world/arayuz/modelSecici.ts` AYNI BİÇİMİ kendi
// tarafında yeniden tanımlar (yapısal tip). K4: `world/` `bridge/`i import
// etmez; bağlantıyı kompozisyon kökü kurar.
//
// Bağımlılık: ollama.ts, ollamaKatalog.ts, opencode.ts, opencodeKatalog.ts,
// secilebilirBeyin.ts (yalnızca tip).
"use strict";
import { OllamaBeyni } from "./ollama.ts";
import {
  aracDestekler, boyutYaz, sohbetEdebilir, type OllamaKatalogu, type OllamaModeli,
} from "./ollamaKatalog.ts";
import { OpenCodeBeyni } from "./opencode.ts";
import type { OpenCodeKatalogu, OpenCodeModeli } from "./opencodeKatalog.ts";
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
 * BULUT (OpenCode) taranmış seçenek adı: sabit `opencode` seçeneğiyle
 * ÇAKIŞMAZ (o tek başına duran ad, bunlar `/` taşır). `providerID` seçici
 * anahtarına girer ki aynı `modelID`nin iki sağlayıcıda görünmesi (nadir ama
 * mümkün, ör. ileride aynı model hem openrouter hem nvidia'da) tek karta
 * çökmesin.
 */
export const BULUT_ONEKI = "opencode:";
export function bulutAd(providerID: string, modelID: string): string {
  return `${BULUT_ONEKI}${providerID}/${modelID}`;
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
 * Kataloktaki her BULUT modeli için bir seçenek (araç çağırabilir VE
 * ücretsiz — süzgeç `opencodeKatalog.ts`te). `zamanAsimiMs` uzun tutulur:
 * bulut modeli soğuk açılışta yavaş olabilir (bkz. `claude:haiku` yorumu).
 */
export function bulutSecenekler(
  katalog: OpenCodeKatalogu, ayar: { adres?: string; sifre?: string; zamanAsimiMs?: number } = {},
): BeyinSecenegi[] {
  return katalog.modeller.map((m) => ({
    ad: bulutAd(m.providerID, m.modelID),
    kur: () => new OpenCodeBeyni({
      providerID: m.providerID, modelID: m.modelID,
      adres: ayar.adres ?? katalog.adres, sifre: ayar.sifre,
      zamanAsimiMs: ayar.zamanAsimiMs ?? 30_000,
    }),
  }));
}

/** `128000` → `128K bağlam`; `0` ya da bilinmiyorsa `""` (rozet eklenmez). */
function baglamYaz(tokenSayisi: number): string {
  if (!(tokenSayisi > 0)) return "";
  return tokenSayisi >= 1000 ? `${Math.round(tokenSayisi / 1000)}K bağlam` : `${tokenSayisi} bağlam`;
}

/** Tek bir OpenCode (bulut) modelinin kartı. */
export function bulutKart(m: OpenCodeModeli): ModelKarti {
  const rozetler: { metin: string; ton: RozetTonu }[] = [
    { metin: m.saglayiciAdi, ton: "notr" },
    { metin: "ücretsiz", ton: "iyi" },
    { metin: "araç ✓", ton: "iyi" },
  ];
  if (m.dusunurMu) rozetler.push({ metin: "düşünür", ton: "notr" });
  if (m.gorurMu) rozetler.push({ metin: "görür", ton: "notr" });
  const baglam = baglamYaz(m.baglamPenceresi);
  if (baglam) rozetler.push({ metin: baglam, ton: "notr" });
  return {
    ad: bulutAd(m.providerID, m.modelID), baslik: m.ad, grup: "bulut",
    aciklama: [m.aile && `${m.aile} ailesi`, `${m.saglayiciAdi} · bulut, ağ gerekir`].filter(Boolean).join(" · "),
    rozetler, uygun: true,
  };
}

/**
 * Sabit (Ollama/OpenCode-katalog dışı) seçeneklerin tanıtımı. Sayılar
 * ÖLÇÜLMÜŞ olanlardır; kaynakları `world/giris.ts`teki seçenek yorumlarında.
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
 *
 * `bulut` isteğe bağlı (üçüncü parametre): OpenCode kataloğu henüz taranmamış
 * ya da hiç kullanılmıyorsa (ör. eski testler) `null`/atlanmış kalabilir.
 */
export function kartlariKur(
  secenekAdlari: readonly string[], katalog: OllamaKatalogu | null,
  bulut: OpenCodeKatalogu | null = null,
): ModelKarti[] {
  const kartlar: ModelKarti[] = [];
  const katalogAdlari = new Set<string>();
  for (const m of katalog?.modeller ?? []) {
    kartlar.push(yerelKart(m));
    katalogAdlari.add(yerelAd(m.ad));
  }
  for (const m of bulut?.modeller ?? []) {
    kartlar.push(bulutKart(m));
    katalogAdlari.add(bulutAd(m.providerID, m.modelID));
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
