// protocol/niyet.ts — Beyin → Dünya. Orion'un dünyada yapabildiği her şey.
//
// Bu liste Orion'un araç yüzeyidir: bridge/tools.ts burayı okuyup LLM'e araç
// şeması üretir. Yeni bir yetenek eklemek = buraya bir varyant eklemek.
// Dünya tarafı tanımadığı bir niyeti sessizce yutmaz — `sonuc: "hata"` döner.
"use strict";
import type { Hedef, Vec3 } from "./temel.ts";

/**
 * Duruş: sürekli hal. Bir seferde tek poz geçerli.
 * Sözlük molp `core/sahne.ts` POZLAR ile birebir aynı — mevcut [POZ:x]
 * ayrıştırıcısı bu protokole çeviri yapmadan bağlanabilsin diye.
 */
export const POZLAR = [
  "duruyor", "oturuyor", "yatıyor", "eğiliyor",
  "yürüyor", "koşuyor", "bakıyor",
] as const;
export type Poz = (typeof POZLAR)[number];

/** Jest: anlık hareket. Poz'u bozmaz, üstüne biner. */
export const JESTLER = [
  "el_salliyor", "başını_sallıyor", "omuz_silkiyor",
  "işaret_ediyor", "gülümsüyor", "kaş_çatıyor",
  "el_açıyor", "bekliyor",
] as const;
export type Jest = (typeof JESTLER)[number];

export type Niyet =
  /** Duruşu değiştir. */
  | { tur: "poz";      poz: Poz }
  /** Anlık jest oynat. `hedef` verilirse jest ona yönelir (ör. işaret_ediyor). */
  | { tur: "jest";     jest: Jest; hedef?: Hedef }
  /** Başı/gövdeyi hedefe çevir. `birak` = serbest bakışa dön. */
  | { tur: "bak";      hedef: Hedef | null }
  /** Hedefe yürü. `mesafe` = hedefin kaç metre yakınında duracağı. */
  | { tur: "git";      hedef: Hedef; mesafe?: number }
  /** Belirtilen çapaya otur (varsayılan: sandalye). */
  | { tur: "otur";     capa?: string }
  | { tur: "kalk" }
  /**
   * Konuş. Dünya bunu altyazıya ve TTS'e verir, ağız senkronunu tetikler.
   * `ses: false` → yalnızca altyazı (sessiz mod / TTS yoksa).
   */
  | { tur: "soyle";    metin: string; ses?: boolean }
  /** Tahtaya yaz. `temizle` önce siler. */
  | { tur: "yaz";      metin: string; temizle?: boolean }
  /** Nesneyi eline al / bırak. */
  | { tur: "al";       nesne: string }
  | { tur: "birak" }
  /** Dikkatini bir yüzeye ver (monitör, tahta) — kamera ipucu da üretir. */
  | { tur: "odaklan";  capa: string }
  /** Yürüyen/oynayan her şeyi kes. Acil durdurma. */
  | { tur: "dur" }
  /** Salt-okunur sorgu: dünya durumunu istemek. Yanıt `algi: "dunya"`. */
  | { tur: "sor";      ne: "dunya" | "yakin" | "oyuncu" };

export type NiyetTur = Niyet["tur"];

/** Dünya durumunu DEĞİŞTİREN niyetler. Yetki kapısı bunları ayırt eder. */
export const YAZAN_NIYETLER: readonly NiyetTur[] = [
  "poz", "jest", "bak", "git", "otur", "kalk", "soyle", "yaz", "al", "birak", "odaklan", "dur",
];

export function okunurMu(n: Niyet): boolean {
  return n.tur === "sor";
}

/** Bir niyetin tamamlanması beklenir mi (asenkron), yoksa anında biter mi? */
export const SURELI_NIYETLER: readonly NiyetTur[] = ["git", "soyle", "yaz", "otur", "kalk"];

export interface NiyetSonucu {
  niyet_id: string;
  durum: "basladi" | "bitti" | "iptal" | "hata";
  /** durum "hata" ise zorunlu: neden. */
  not?: string;
  /** "git" için varış noktası gibi ek bilgi. */
  veri?: Vec3 | Record<string, unknown>;
}
