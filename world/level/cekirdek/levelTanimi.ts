// world/level/cekirdek/levelTanimi.ts — Bir level'in VERİ tanımı ve doğrulaması (spec 17 düzeni). Saf.
//
// LEVEL = VERİ. Işık, ortam, palet ve katmanlar (gök, zemin, bulut, çim…) bir JSON dosyasında durur
// (ör. world/level/ova/ova.level.json). Kod yalnız modülleri tanır (world/level/moduller/); hangi modülün
// hangi ayarla, hangi sırayla kurulacağı tanımdadır. Level paneli bu tanımı canlı düzenler ve dosyaya geri
// yazar — elle kod düzenlemek gerekmez.
//
// Ortak çekirdek: ova bugün kullanıyor; Orion'un odası ileride aynı tanıma taşınacak (ayrı adım).
"use strict";
import { hex } from "./renk.ts";

export const LEVEL_SURUMU = 1;

export type Vec3 = [number, number, number];

export interface GolgeAyari {
  acik: boolean;
  /** Gölge haritası çözünürlüğü (kare kenarı, piksel). */
  boyut: number;
  /** Kademeli gölge haritası kademe sayısı (1–4). */
  kademe: number;
  /** Gölgenin çizildiği en uzak mesafe (m). */
  uzaklik: number;
  /** 0 = sert kenar; büyüdükçe yumuşar (PCF). */
  yumusaklik: number;
  /** Gölgenin koyuluğu (0 = siyah, 1 = görünmez). */
  koyuluk: number;
}

export interface IsikAyari {
  gunes: { yon: Vec3; renk: string; siddet: number; golge: GolgeAyari };
  /** Gökten gelen dolgu: üstten `ust`, alttan `alt`. Güneşin belirgin altında kalmalı (gölge yıkanmasın). */
  dolgu: { ust: string; alt: string; siddet: number };
}

export interface OrtamAyari {
  arkaPlan: string;
  sis: { acik: boolean; renk: string; yogunluk: number };
  /** Görüntü işleme: ton eşleme (ACES), pozlama, kontrast. */
  tonlama: { acik: boolean; pozlama: number; kontrast: number };
  kamera: { uzak: number };
}

/** Bir katman = bir modül örneği. `tur` modül kaydındaki ad (world/level/moduller/). */
export interface KatmanTanimi {
  tur: string;
  /** Aynı türden birden çok katman olursa ayırt etmek için. */
  ad: string;
  acik: boolean;
  ayar: Record<string, unknown>;
}

export interface LevelTanimi {
  surum: number;
  ad: string;
  /** Ad → "#rrggbb". Modüller renkleri adla ister. */
  palet: Record<string, string>;
  isik: IsikAyari;
  ortam: OrtamAyari;
  katmanlar: KatmanTanimi[];
}

export type Dogrulama = { ok: true; deger: LevelTanimi } | { ok: false; hata: string };

const nesneMi = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const sayiMi = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Tanımı doğrular. Bozuk tanım SESSİZCE düzeltilmez: hata yolu ve nedeniyle döner (panel kaydetmeyi reddeder,
 * sayfa hatayı gösterir). Katman ayarlarının içi modülün işidir (modül varsayılanla birleştirir).
 */
export function levelTanimiDogrula(v: unknown): Dogrulama {
  return levelMi(v) ? { ok: true, deger: v } : { ok: false, hata: hataBul(v) ?? "bilinmeyen" };
}

/** Tip koruyucu: tanım geçerli mi. */
export function levelMi(v: unknown): v is LevelTanimi { return hataBul(v) === null; }

/** İlk hatanın yolu ve nedeni; geçerliyse `null`. */
function hataBul(v: unknown): string | null {
  const h = (yol: string, neden: string): string => `${yol}: ${neden}`;
  if (!nesneMi(v)) return h("kök", "nesne değil");
  if (v["surum"] !== LEVEL_SURUMU) return h("surum", `${LEVEL_SURUMU} olmalı`);
  if (typeof v["ad"] !== "string" || !v["ad"]) return h("ad", "boş");
  const palet = v["palet"];
  if (!nesneMi(palet)) return h("palet", "nesne değil");
  for (const [ad, r] of Object.entries(palet)) {
    if (typeof r !== "string") return h(`palet.${ad}`, "metin değil");
    try { hex(r); } catch { return h(`palet.${ad}`, `"#rrggbb" değil: ${r}`); }
  }
  const renkMi = (r: unknown) => typeof r === "string" && (r.startsWith("#") ? /^#[0-9a-fA-F]{6}$/.test(r) : r in palet);
  const isik = v["isik"], ortam = v["ortam"];
  if (!nesneMi(isik) || !nesneMi(isik["gunes"]) || !nesneMi(isik["dolgu"])) return h("isik", "gunes ve dolgu gerekli");
  const g = isik["gunes"], d = isik["dolgu"];
  if (!Array.isArray(g["yon"]) || g["yon"].length !== 3 || !g["yon"].every(sayiMi)) return h("isik.gunes.yon", "3 sayı olmalı");
  if (!renkMi(g["renk"])) return h("isik.gunes.renk", "renk ya da palet adı değil");
  if (!sayiMi(g["siddet"]) || g["siddet"] < 0) return h("isik.gunes.siddet", "≥ 0 sayı olmalı");
  const go = g["golge"];
  if (!nesneMi(go) || typeof go["acik"] !== "boolean" || !["boyut", "kademe", "uzaklik", "yumusaklik", "koyuluk"].every((k) => sayiMi(go[k]))) {
    return h("isik.gunes.golge", "acik + boyut/kademe/uzaklik/yumusaklik/koyuluk gerekli");
  }
  if (!Number.isInteger(go["kademe"]) || (go["kademe"] as number) < 1 || (go["kademe"] as number) > 4) return h("isik.gunes.golge.kademe", "1–4 tamsayı");
  if (!renkMi(d["ust"]) || !renkMi(d["alt"]) || !sayiMi(d["siddet"])) return h("isik.dolgu", "ust/alt renk + siddet gerekli");
  if (!nesneMi(ortam) || !renkMi(ortam["arkaPlan"])) return h("ortam.arkaPlan", "renk gerekli");
  const sis = ortam["sis"], ton = ortam["tonlama"], kam = ortam["kamera"];
  if (!nesneMi(sis) || typeof sis["acik"] !== "boolean" || !renkMi(sis["renk"]) || !sayiMi(sis["yogunluk"])) return h("ortam.sis", "acik/renk/yogunluk gerekli");
  if (!nesneMi(ton) || typeof ton["acik"] !== "boolean" || !sayiMi(ton["pozlama"]) || !sayiMi(ton["kontrast"])) return h("ortam.tonlama", "acik/pozlama/kontrast gerekli");
  if (!nesneMi(kam) || !sayiMi(kam["uzak"]) || kam["uzak"] <= 0) return h("ortam.kamera.uzak", "> 0 sayı");
  const katmanlar = v["katmanlar"];
  if (!Array.isArray(katmanlar)) return h("katmanlar", "dizi değil");
  const adlar = new Set<string>();
  for (const [i, k] of katmanlar.entries()) {
    if (!nesneMi(k) || typeof k["tur"] !== "string" || typeof k["ad"] !== "string" || typeof k["acik"] !== "boolean" || !nesneMi(k["ayar"])) {
      return h(`katmanlar[${i}]`, "tur/ad/acik/ayar gerekli");
    }
    if (adlar.has(k["ad"])) return h(`katmanlar[${i}].ad`, `yinelenen ad "${k["ad"]}"`);
    adlar.add(k["ad"]);
  }
  return null;
}
