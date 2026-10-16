// world/level/cekirdek/anlam.ts — Level nesnelerinin ORION İÇİN anlamı (spec 23 B). Saf.
//
// Editörle konan bir nesne Orion için yalnız bir şekildi: adı, ne olduğu, onunla ne yapılabileceği yoktu. Anlam
// üç katmandan gelir, öncelik sırasıyla:
//   1. yerleşimin kendisi  — `NesneYeri.ad` ve `NesneYeri.anlam` (editörde "Orion için" bölümü)
//   2. varlık             — assets/sehir/anlam.json `varliklar[<varlık adı>]` (Türkçe ad, tür, eylemler)
//   3. kategori           — aynı dosyada `kategoriler[<kategori>]` (bina → yapı, detay → algılanmaz …)
// Eksik alan bir alttakinden gelir; hiçbirinde yoksa varsayılan (kısa ad, "eşya", yalnız bakılır).
//
// Eylem sözlüğü PROTOKOLDEN (`NESNE_EYLEMLERI`): Orion'un niyetleriyle aynı adlar — algıda (`YakinNesne.eylemler`)
// ne yazıyorsa onu yapabilir. `algilanir: false` = Orion'un dünya bilgisine girmez (boru, havalandırma ızgarası:
// bağlamı doldurur, bilgi taşımaz — spec 15'te odanın kabuğu da bu yüzden kayıtta yok).
//
// `levelNesneleri` level'dan spec 15 nesne kaydıyla AYNI biçimi (`Nesne`) üretir: görünürlük (world/player/
// gorunurluk.ts) ve yakınlık algısı oda ile level'ı ayırt etmez. Orion'un level'a taşınması spec 24.
"use strict";
import { NESNE_EYLEMLERI, type NesneEylemi } from "../../../protocol/temel.ts";
import type { NesneYeri } from "./levelTanimi.ts";
import type { Nesne } from "./nesneTipi.ts";

/** Orion'un nesneleri gördüğü türler (spec 15'in yuzey/mobilya/aydinlatma'sı dahil). */
export const NESNE_TURLERI = ["yapi", "mobilya", "esya", "aydinlatma", "yuzey", "tabela", "yol", "bitki", "altyapi", "arac", "detay"] as const;
export type NesneTuru = (typeof NESNE_TURLERI)[number];

export interface Anlam {
  /** Orion'un kullandığı ad (yerleşimde `NesneYeri.ad` önceliklidir). */
  ad?: string;
  tur?: NesneTuru;
  eylemler?: NesneEylemi[];
  /** false: Orion'un dünya bilgisine girmez (görsel kalabalık). */
  algilanir?: boolean;
  /** Orion'a kısa not ("kapısı kilitli", "Ozyn'in sevdiği bank"). */
  not?: string;
}

export interface AnlamSozlugu {
  surum: 1;
  kategoriler: Readonly<Record<string, Anlam>>;
  varliklar: Readonly<Record<string, Anlam>>;
}

/** Bir anlam alanının hatası (alan adı + neden); geçerliyse null. `NesneYeri.anlam` doğrulaması da bunu kullanır. */
export function anlamHatasi(v: unknown): { alan: string; neden: string } | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return { alan: "", neden: "nesne değil" };
  const a = v as Record<string, unknown>;
  for (const k of Object.keys(a)) if (!["ad", "tur", "eylemler", "algilanir", "not"].includes(k)) return { alan: k, neden: "bilinmeyen alan" };
  if (a["ad"] !== undefined && (typeof a["ad"] !== "string" || !a["ad"].trim())) return { alan: "ad", neden: "boş olmayan metin olmalı" };
  if (a["tur"] !== undefined && !(NESNE_TURLERI as readonly unknown[]).includes(a["tur"])) return { alan: "tur", neden: `şunlardan biri: ${NESNE_TURLERI.join(", ")}` };
  const e = a["eylemler"];
  if (e !== undefined && (!Array.isArray(e) || e.some((x) => !(NESNE_EYLEMLERI as readonly unknown[]).includes(x)))) return { alan: "eylemler", neden: `şunlardan: ${NESNE_EYLEMLERI.join(", ")}` };
  if (a["algilanir"] !== undefined && typeof a["algilanir"] !== "boolean") return { alan: "algilanir", neden: "mantıksal olmalı" };
  if (a["not"] !== undefined && typeof a["not"] !== "string") return { alan: "not", neden: "metin olmalı" };
  return null;
}

/** Sözlük dosyasını okur; bozuksa yolu ve nedeniyle FIRLATIR (sessizce boş sözlük olmaz). */
export function anlamSozluguOku(v: unknown): AnlamSozlugu {
  if (typeof v !== "object" || v === null) throw new Error("anlam sözlüğü: nesne değil");
  const s = v as Record<string, unknown>;
  if (s["surum"] !== 1) throw new Error("anlam sözlüğü: surum 1 olmalı");
  for (const bolum of ["kategoriler", "varliklar"] as const) {
    const b = s[bolum];
    if (typeof b !== "object" || b === null || Array.isArray(b)) throw new Error(`anlam sözlüğü: ${bolum} nesne değil`);
    for (const [ad, a] of Object.entries(b)) {
      const h = anlamHatasi(a);
      if (h) throw new Error(`anlam sözlüğü: ${bolum}.${ad}${h.alan ? `.${h.alan}` : ""}: ${h.neden}`);
    }
  }
  return { surum: 1, kategoriler: s["kategoriler"] as Record<string, Anlam>, varliklar: s["varliklar"] as Record<string, Anlam> };
}

/** Birden çok anlam sözlüğünü katar (kit başına bir dosya); aynı kategori/varlık iki dosyada FARKLI tanımlıysa HATA. Saf. */
export function anlamBirlestir(parcalar: readonly AnlamSozlugu[]): AnlamSozlugu {
  const kategoriler: Record<string, Anlam> = {}, varliklar: Record<string, Anlam> = {};
  for (const p of parcalar) {
    for (const [bolum, hedef, kaynak] of [["kategori", kategoriler, p.kategoriler], ["varlık", varliklar, p.varliklar]] as const) {
      for (const [ad, a] of Object.entries(kaynak)) {
        // Aynı tanım iki kitte olabilir (ortak "detay" kategorisi); FARKLI tanım sessizce ezilmez.
        if (ad in hedef && JSON.stringify(hedef[ad]) !== JSON.stringify(a)) throw new Error(`anlam sözlüğü: ${bolum} ${ad} iki dosyada farklı tanımlı`);
        hedef[ad] = a;
      }
    }
  }
  return { surum: 1, kategoriler, varliklar };
}

/** Bir yerleşimin ETKİN anlamı (bütün alanlar dolu) ve her alanın nereden geldiği (editör gri gösterir). */
export interface EtkinAnlam {
  ad: string;
  tur: NesneTuru;
  eylemler: NesneEylemi[];
  algilanir: boolean;
  not: string;
  /** Alan → kaynak katman. */
  kaynak: Readonly<Record<"ad" | "tur" | "eylemler" | "algilanir", "yerlesim" | "varlik" | "kategori" | "varsayilan">>;
}

const VARSAYILAN: Required<Omit<Anlam, "ad" | "not">> = { tur: "esya", eylemler: ["bak"], algilanir: true };

/**
 * Yerleşim > varlık > kategori > varsayılan. `kisaAd`: hiçbir katmanda ad yoksa varlığın okunur kısa adı.
 * `kategori`: varlığın katalog kategorisi (bilinmiyorsa undefined).
 */
export function etkinAnlam(n: Pick<NesneYeri, "varlik" | "ad" | "anlam">, kategori: string | undefined, s: AnlamSozlugu | null, kisaAd: (ad: string) => string): EtkinAnlam {
  const katmanlar: ["yerlesim" | "varlik" | "kategori", Anlam | undefined][] = [
    ["yerlesim", { ...n.anlam, ...(n.ad ? { ad: n.ad } : {}) }],
    ["varlik", s?.varliklar[n.varlik]],
    ["kategori", kategori ? s?.kategoriler[kategori] : undefined],
  ];
  const bul = <K extends keyof Anlam>(alan: K): [Anlam[K] | undefined, "yerlesim" | "varlik" | "kategori" | "varsayilan"] => {
    for (const [k, a] of katmanlar) if (a?.[alan] !== undefined) return [a[alan], k];
    return [undefined, "varsayilan"];
  };
  const [ad, adK] = bul("ad"), [tur, turK] = bul("tur"), [eylemler, eK] = bul("eylemler"), [algilanir, alK] = bul("algilanir"), [not] = bul("not");
  return {
    ad: ad ?? kisaAd(n.varlik),
    tur: tur ?? VARSAYILAN.tur,
    eylemler: [...(eylemler ?? VARSAYILAN.eylemler)],
    algilanir: algilanir ?? VARSAYILAN.algilanir,
    not: not ?? "",
    kaynak: { ad: adK, tur: turK, eylemler: eK, algilanir: alK },
  };
}

/** Orion'un level'daki nesne kaydı satırı: spec 15 `Nesne` (aynı biçim — görünürlük ayırt etmez) + eylemler, not. */
export interface LevelNesnesi extends Nesne {
  capa: null;
  eylemler: NesneEylemi[];
  not: string;
}

/**
 * Level'ın Orion için nesne kaydı: algılanan, gizli olmayan ve kutusu bilinen yerleşimler. `kutular`: dünya
 * kutusu (min/max; editör/sahne ölçer — yüklenmemiş nesne kayda girmez, "bilinmiyor"dur, spec 15 K2).
 * `anlamOf`: yerleşimin etkin anlamı (çağıran sözlüğünü bağlar: `n => etkinAnlam(n, kategori, sozluk, kisaAd)`).
 */
export function levelNesneleri(
  nesneler: readonly NesneYeri[], kutular: ReadonlyMap<string, { min: readonly number[]; max: readonly number[] }>,
  anlamOf: (n: NesneYeri) => EtkinAnlam,
): LevelNesnesi[] {
  const l: LevelNesnesi[] = [];
  for (const n of nesneler) {
    if (!n.id || n.gizli) continue;
    const k = kutular.get(n.id);
    if (!k) continue;
    const a = anlamOf(n);
    if (!a.algilanir) continue;
    const [x0, y0, z0] = k.min as [number, number, number], [x1, y1, z1] = k.max as [number, number, number];
    l.push({
      id: n.id, ad: a.ad, tur: a.tur, capa: null, eylemler: a.eylemler, not: a.not,
      kutu: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, g: x1 - x0, yuk: y1 - y0, d: z1 - z0 },
    });
  }
  return l;
}
