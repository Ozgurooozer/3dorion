// protocol/npc.ts — NPC KAYDI biçimi (spec 35 dilim 3, "NPC sınıfı"): bir ajan + onu süren grafikler + örnek başına parametreler. VERİDİR.
//
// NEDEN: Unreal'daki "Blueprint Class" bir türdür, örnekleri çoğalır ve her örneğin düzenlenebilir parametreleri vardır ("Instance Editable"). Bizde tür =
// olay grafiği (`protocol/graf.ts`), örnek = bu kayıt: "nöbetçi" grafiği bir kez yazılır, iki NPC kaydı onu iki ajanla ve iki ayrı parolayla çalıştırır.
// 300 NPC hedefi veriyle ölçeklenir: yeni nöbetçi = yeni bir kayıt, kod ya da grafik kopyası değil.
//
// NEDEN PROTOKOLDE: kayıt Orion'un (dilim 4'te) önereceği ve Ozyn'in elle düzenlediği güvenilmez girdidir; `graf.ts` gibi bağımlılıksız, elle doğrulanır,
// TEMİZ kopya döner (bilinmeyen alanlar atılır). Burası yalnız BİÇİMİ bilir: `ajan`ın ajan defterinde olması, grafiklerin var olması ve parametrelerin
// türü DİNLEMEYE ALIRKEN denetlenir (`uygulama/graf/grafDinleyici.ts`): defter ve grafikler çalışma anının bilgisidir, dosyanınki değil.
//
// Örnek:
//   { "surum": 1, "ad": "kapi_nobetcisi", "ajan": "flash", "graflar": ["nobetci"], "parametreler": { "parola": "Ay ışığı", "gece_basi": 21 } }
"use strict";
import type { Sonuc } from "./dogrula.ts";
import { grafAdiGecerli } from "./graf.ts";

export const NPC_SURUMU = 1;

/**
 * Tavanlar. graf 8: bir NPC'nin davranışı (nöbet, sohbet, rutin) için bol; dinleyicinin toplam tavanını (8) tek NPC'nin doldurabileceği kadar.
 * parametre 32 ve metin 200: grafik değişkeniyle aynı ölçek (`uygulama/graf/grafDurumu.ts`) — parametre kısa veridir (parola, saat), metin deposu değil.
 */
export const NPC_SINIRLARI = { graf: 8, parametre: 32, metin: 200, aciklama: 1000 } as const;

/** Parametre değerleri: düz değerler (null YOK: "yok" demek için parametre yazılmaz, düğüm varsayılanını kullanır). */
export type NpcParametresi = string | number | boolean;

export interface Npc {
  surum: typeof NPC_SURUMU;
  /** Kaydın adı = dosya adı (`<userData>/orion-npc/<ad>.json`). */
  ad: string;
  /** NPC'nin ajanı (ajan defteri kimliği: "flash"). Grafiklerdeki `@ben` buna çözülür. */
  ajan: string;
  aciklama?: string;
  /** Bu NPC'nin dinlemeye alınacak olay grafikleri (adla; sıra dinleme sırası). En az bir, tekrarsız. */
  graflar: string[];
  /** Örnek başına parametreler (`npc.parametre` düğümü okur). */
  parametreler: Record<string, NpcParametresi>;
}

/** NPC adı kuralı grafik adınınkiyle AYNI (dosya adı olarak güvenli: harf, rakam, _ ve -; en çok 48). Kopya kural yok: aynı fonksiyon. */
export const npcAdiGecerli = grafAdiGecerli;

const nesneMi = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hata = (m: string): Sonuc<never> => ({ ok: false, hata: m });

/** Tek parametre değerinin hatası (yoksa null). Dinleyici ve düğüm de aynı kuralı kullanır. */
export function npcParametreHatasi(v: unknown): string | null {
  if (typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? null : "sayı sonlu olmalı";
  if (typeof v === "string") return v.length <= NPC_SINIRLARI.metin ? null : `metin en çok ${NPC_SINIRLARI.metin} karakter (gelen: ${v.length})`;
  return `yalnız metin, sayı ya da doğru/yanlış olabilir (gelen: ${v === null ? "null" : typeof v})`;
}

/**
 * Gelen NPC kaydı GÜVENİLMEZ girdidir (elle düzenlenmiş dosya, ileride LLM çıktısı): biçimi doğrular ve TEMİZ kopya döner. Hata metni neyin nerede
 * bozuk olduğunu söyler (düzenleyici "KAYDEDİLEMEDİ: …" diye gösterir).
 */
export function npcDogrula(ham: unknown): Sonuc<Npc> {
  if (!nesneMi(ham)) return hata("NPC kaydı nesne olmalı");
  if (ham.surum !== NPC_SURUMU) return hata(`surum ${NPC_SURUMU} olmalı (gelen: ${String(ham.surum)})`);
  if (!npcAdiGecerli(ham.ad)) return hata(`ad geçersiz: ${JSON.stringify(ham.ad)} (harf, rakam, _ ve -; boşluk yok)`);
  // Ajan kimliği de ad kuralıyla: "@ben" gibi ayrılmış bir değer kayıtta ajan OLAMAZ (çözülecek olan odur).
  if (!grafAdiGecerli(ham.ajan)) return hata(`ajan geçersiz: ${JSON.stringify(ham.ajan)} (ajan defterindeki bir kimlik olmalı, örn. "flash")`);
  if (ham.aciklama !== undefined && (typeof ham.aciklama !== "string" || ham.aciklama.length > NPC_SINIRLARI.aciklama)) return hata(`aciklama metin olmalı (en çok ${NPC_SINIRLARI.aciklama})`);
  if (!Array.isArray(ham.graflar)) return hata("graflar dizi olmalı (örn. [\"nobetci\"])");
  if (ham.graflar.length === 0) return hata("graflar boş: NPC'yi süren en az bir olay grafiği olmalı");
  if (ham.graflar.length > NPC_SINIRLARI.graf) return hata(`en çok ${NPC_SINIRLARI.graf} grafik`);
  const graflar: string[] = [];
  for (const [i, g] of ham.graflar.entries()) {
    if (!grafAdiGecerli(g)) return hata(`graflar[${i}] geçersiz: ${JSON.stringify(g)}`);
    if (graflar.includes(g)) return hata(`graflar: '${g}' iki kez (aynı grafik aynı NPC'de bir kez dinlenir)`);
    graflar.push(g);
  }
  const p = ham.parametreler ?? {};
  if (!nesneMi(p)) return hata("parametreler nesne olmalı (örn. { \"parola\": \"Ay ışığı\" })");
  const girdiler = Object.entries(p);
  if (girdiler.length > NPC_SINIRLARI.parametre) return hata(`en çok ${NPC_SINIRLARI.parametre} parametre (gelen: ${girdiler.length})`);
  const parametreler: Record<string, NpcParametresi> = {};
  for (const [k, v] of girdiler) {
    if (!grafAdiGecerli(k)) return hata(`parametreler: geçersiz ad ${JSON.stringify(k)} (harf, rakam, _ ve -)`);
    const h = npcParametreHatasi(v);
    if (h) return hata(`parametreler.${k}: ${h}`);
    parametreler[k] = v as NpcParametresi;
  }
  return {
    ok: true,
    deger: { surum: NPC_SURUMU, ad: ham.ad, ajan: ham.ajan, ...(typeof ham.aciklama === "string" ? { aciklama: ham.aciklama } : {}), graflar, parametreler },
  };
}
