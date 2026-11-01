// uygulama/aktor/taslak/taslakKapisi.ts — ORION TASLAK KAPISI, SAF ÇEKİRDEK (spec 45 B8). Babylon, DOM ve dosya YOK.
//
// Orion aktör/graf JSON'unu YAZAMAZ (araç yüzeyine level/graf/aktör düzenleme eklenmez: CLAUDE.md). Önerisini `Content/Drafts/<ad>.taslak.json` dosyası olarak BIRAKIR (kendi terminalinden;
// komutu çalıştıran yine Ozyn'in tuşudur). Taslak ZARFTIR: { taslak: 1, ad, gerekce, sablon: AktorSablonu, graflar?: Graf[] }. Bu dosya YALNIZ dışarıdan gelen metni doğrular ve Ozyn'in okuyacağı özeti çıkarır;
// ONAY (diske yazma) `taslakIslemleri.ts` + panel düğmesinde, YALNIZ gerçek tıklamayla (`isTrusted`). Taslak hiçbir şeyi kendiliğinden çalıştırmaz: onay şablonu/grafı dosyaya yazar, yerleştirme ve ⚡ dinleme
// ayrı tıklamalardır. Kapı iki şeyi garanti eder: bozuk taslak kapıya girmez (nedenli ret), Ozyn neye onay verdiğini görür (özet).
//
// SINIR (dürüst): graf DÜĞÜM TÜRLERİNİN kütüphanede var olup olmadığı burada denetlenmez (kütüphane `uygulama/graf/` altında, çalışma anında bilinir); bilinmeyen tür graf çalışınca nedenle durur.
"use strict";
import { grafAdiGecerli, grafDogrula, type Graf } from "../../../protocol/graf.ts";
import { kodlu } from "../../../world/level/cekirdek/aktorHatalari.ts";
import { sablonHatasi, type AktorSablonu } from "../sablon/aktorSablonu.ts";

export const TASLAK_SURUMU = 1;
/** Taslak dosyasının en büyük boyutu (bayt): kapı bellek şişirmesin. */
export const TASLAK_TAVANI = 64 * 1024;
export const TASLAK_GRAF_TAVANI = 4;
export const TASLAK_GEREKCE_TAVANI = 300;
export const TASLAK_UZANTISI = ".taslak.json";
export const TASLAK_KLASORU = "Content/Drafts/";

export interface Taslak {
  ad: string;
  /** Orion'un NEDEN önerdiği (Ozyn onaydan önce okur). */
  gerekce: string;
  sablon: AktorSablonu;
  graflar: Graf[];
}
export type TaslakSonucu<T> = { ok: true; deger: T } | { ok: false; neden: string };

const ZARF_ALANLARI = ["taslak", "ad", "gerekce", "sablon", "graflar"];
const nesneMi = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const ret = (kod: "AKT-TSL-001" | "AKT-TSL-002" | "AKT-TSL-003", m: string): { ok: false; neden: string } => ({ ok: false, neden: kodlu(kod, m) });

/** Ham dosya metnini doğrulanmış taslağa çevirir; ilk hatada kodlu nedenle reddeder. */
export function taslakCoz(metin: string): TaslakSonucu<Taslak> {
  if (typeof metin !== "string" || new TextEncoder().encode(metin).length > TASLAK_TAVANI) return ret("AKT-TSL-001", `taslak metin olmalı ve en çok ${TASLAK_TAVANI / 1024} KB olmalı`);
  let v: unknown;
  try { v = JSON.parse(metin); } catch { return ret("AKT-TSL-001", "taslak geçerli JSON değil"); }
  if (!nesneMi(v)) return ret("AKT-TSL-001", "taslak bir JSON nesnesi olmalı");
  for (const k of Object.keys(v)) if (!ZARF_ALANLARI.includes(k)) return ret("AKT-TSL-001", `${k}: bilinmeyen alan (${ZARF_ALANLARI.join(", ")})`);
  if (v["taslak"] !== TASLAK_SURUMU) return ret("AKT-TSL-001", `taslak ${TASLAK_SURUMU} olmalı (${JSON.stringify(v["taslak"])} bu sürümde tanınmaz)`);
  if (!grafAdiGecerli(v["ad"])) return ret("AKT-TSL-001", "ad: geçerli olmalı (harf, rakam, _ ve -; en çok 48; dosya adı olur)");
  const gerekce = v["gerekce"];
  if (typeof gerekce !== "string" || !gerekce.trim() || gerekce.length > TASLAK_GEREKCE_TAVANI) return ret("AKT-TSL-001", `gerekce: 1-${TASLAK_GEREKCE_TAVANI} karakter metin olmalı (Ozyn onaydan önce okur)`);
  const sh = sablonHatasi(v["sablon"]);
  if (sh) return ret("AKT-TSL-002", sh);
  const sablon = v["sablon"] as AktorSablonu;
  if (sablon.ad !== v["ad"]) return ret("AKT-TSL-001", `ad (${String(v["ad"])}) şablonun adıyla (${sablon.ad}) aynı olmalı`);
  const ham = v["graflar"] ?? [];
  if (!Array.isArray(ham) || ham.length > TASLAK_GRAF_TAVANI) return ret("AKT-TSL-003", `graflar: en çok ${TASLAK_GRAF_TAVANI} grafı olan dizi olmalı`);
  const graflar: Graf[] = [];
  for (const [i, g] of ham.entries()) {
    const r = grafDogrula(g);
    if (!r.ok) return ret("AKT-TSL-003", `graflar[${i}]: ${r.hata}`);
    if (graflar.some((x) => x.ad === r.deger.ad)) return ret("AKT-TSL-003", `graflar[${i}]: '${r.deger.ad}' adı yinelenen`);
    graflar.push(r.deger);
  }
  return { ok: true, deger: { ad: sablon.ad, gerekce: gerekce.trim(), sablon, graflar } };
}

/** Ozyn'in onaydan önce okuyacağı satırlar: ne yazılacak, içinde ne var, neye dikkat. */
export function taslakOzeti(t: Taslak): string[] {
  const bilesenler = new Map<string, number>();
  let nesne = 0, isik = 0;
  for (const a of t.sablon.aktorler) {
    const parca = a.nesne ?? a.isik;
    if (a.nesne) nesne++; else isik++;
    for (const b of parca?.bilesenler ?? []) bilesenler.set(b.tur, (bilesenler.get(b.tur) ?? 0) + 1);
  }
  const satirlar = [
    `Orion'un gerekçesi: ${t.gerekce}`,
    `Aktör: ${t.sablon.aktorler.length} (nesne ${nesne}, ışık ${isik}); kök ${t.sablon.kok}`,
    `Bileşenler: ${bilesenler.size ? [...bilesenler].map(([tur, n]) => `${tur}×${n}`).join(", ") : "yok"}`,
  ];
  for (const g of t.graflar) {
    const tipler = [...new Set(g.dugumler.map((d) => d.tip))];
    satirlar.push(`Graf ${g.ad} (${g.tur}): ${g.dugumler.length} düğüm — ${tipler.join(", ")}`);
    if (tipler.includes("olay.aktor_olayi")) satirlar.push(`  ⚡ ${g.ad} dinleme düğümü içerir: çalışması için onaydan sonra YİNE senin ⚡ tıklaman gerekir`);
  }
  satirlar.push(`Onay yazar: Content/Actors/${t.ad}.aktor.json${t.graflar.map((g) => `, Content/Graphs/${g.ad}.json`).join("")} (var olanın üstüne yazılmaz; yerleştirme ve çalıştırma ayrı tıklamadır)`);
  return satirlar;
}

/** Adres listesinden taslak adları (`Content/Drafts/<ad>.taslak.json`); öteki dosyalar yok sayılır. */
export function taslakAdlari(adresler: readonly string[]): string[] {
  return adresler.flatMap((a) => {
    if (!a.startsWith(TASLAK_KLASORU) || !a.endsWith(TASLAK_UZANTISI)) return [];
    const ad = a.slice(TASLAK_KLASORU.length, -TASLAK_UZANTISI.length);
    return grafAdiGecerli(ad) ? [ad] : [];
  }).sort((a, b) => a.localeCompare(b, "tr"));
}
