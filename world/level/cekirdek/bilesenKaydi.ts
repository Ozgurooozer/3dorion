// world/level/cekirdek/bilesenKaydi.ts — AKTÖR BİLEŞEN KAYDI + hiyerarşi kuralları (spec 45 B1; Unreal Actor Component + Attach). SAF: Babylon ve DOM yok.
//
// Bir aktör (level nesnesi ya da ışığı) `bilesenler` listesiyle istediği kadar (tavana dek) bileşen taşır; her bileşen BİR TÜR + ayar'dır, türün alanları spec 43'ün alan şemasıyla
// (`alanSemasi.ts`) tanımlıdır: Details, doğrulama ve graf aynı kuralı paylaşır. Yeni bileşen türü = `BILESEN_TURLERI`'ne bir satır + test; çekirdek koda dokunulmaz.
// Bu dosya VERİYİ tanımlar ve doğrular; çalışma zamanı (Babylon örnekleri, olay yayını) ayrı katmanda (B4). `fizik` türü REZERVE: Havok en sona (spec 45 §10), şimdi nedenle reddedilir.
//
// `ust`/`soket`: aktör hiyerarşisi. `ust` = level'daki başka bir aktörün kimliği YA DA bir bedenin soket sahibi (`beden:orion`; bedenin varlığı çalışma anında denetlenir, level dosyası
// bedenleri bilmez). Döngü ve derinlik kuralı level doğrulamasında (`hiyerarsiHatasi`).
"use strict";
import { grafAdiGecerli } from "../../../protocol/graf.ts";
import { alanDegeriHatasi, type AlanDegeri, type AlanSemasi } from "./alanSemasi.ts";

/** Aktör başına en çok bileşen (veri koruması; aşılırsa nedenle reddedilir). */
export const BILESEN_TAVANI = 8;
/** `ust` zincirinin en çok uzunluğu (beden üstleri sayılmaz). */
export const HIYERARSI_DERINLIGI = 4;
/** `ust` değeri bu önekle başlıyorsa üst bir BEDENDİR (`beden:orion`, `beden:flash1`). */
export const BEDEN_ONEKI = "beden:";

export interface BilesenKaydi {
  /** Aktör içinde benzersiz kimlik (graf düğümleri ve olaylar bununla anar). */
  id: string;
  tur: string;
  /** Details'te görünen ad; yoksa türün etiketi. */
  ad?: string;
  /** Türün alanları (şemaya göre doğrulanır; eksik alan = şemanın varsayılanı). */
  ayar?: Record<string, AlanDegeri>;
}

export interface BilesenTuru {
  tur: string;
  etiket: string;
  alanlar: readonly AlanSemasi[];
  /** Bu türün yayınladığı yerleşik olay adları (spec 45 §5). */
  olaylar: readonly string[];
  /** Ayarda bulunması ZORUNLU alanlar (varsayılanı olmayan kimlik gibi: iki soket aynı varsayılan adı almasın). */
  zorunlu?: readonly string[];
  /** Doluysa tür henüz yok: doğrulama bu nedenle reddeder. */
  rezerve?: string;
}

const VEC0 = [0, 0, 0] as [number, number, number];

/** Nokta ışığın alanları: TEK kaynak. `bilesen.ts` `ISIK_BILESENI` (ışık aktörünün Details'i) bunu kullanır, iki ışık şeması ayrışmasın (bekçi: bilesenKaydi.test.ts). */
export const ISIK_ALANLARI: readonly AlanSemasi[] = [
  { ad: "konum", etiket: "Konum", tip: "vec3", varsayilan: [0, 1.5, 0], adim: 0.1, birim: "m" },
  { ad: "renk", etiket: "Renk", tip: "renk", varsayilan: "#ffd9a0", grafta: true },
  { ad: "siddet", etiket: "Şiddet", tip: "sayi", varsayilan: 1.5, en: 0, cok: 100, adim: 0.1, grafta: true },
  { ad: "menzil", etiket: "Menzil", tip: "sayi", varsayilan: 8, en: 0.1, cok: 1000, adim: 0.5, birim: "m", grafta: true },
  { ad: "gizli", etiket: "Gizli", tip: "bool", varsayilan: false, grafta: true },
];

export const BILESEN_TURLERI: readonly BilesenTuru[] = [
  { tur: "isik", etiket: "Nokta ışık", olaylar: [], alanlar: ISIK_ALANLARI },
  {
    tur: "tetik", etiket: "Tetik alanı", olaylar: ["tetik.girdi", "tetik.cikti"],
    alanlar: [
      { ad: "sekil", etiket: "Şekil", tip: "metin", varsayilan: "kure", secenekler: ["kure", "kutu"] },
      { ad: "yaricap", etiket: "Yarıçap", tip: "sayi", varsayilan: 2, en: 0.1, cok: 100, adim: 0.1, birim: "m" },
      { ad: "boyut", etiket: "Kutu boyutu", tip: "vec3", varsayilan: [1, 1, 1], en: 0.1, adim: 0.1, birim: "m" },
      { ad: "konum", etiket: "Konum", tip: "vec3", varsayilan: VEC0, adim: 0.1, birim: "m" },
      { ad: "kim", etiket: "Kim girince", tip: "metin", varsayilan: "herkes", secenekler: ["herkes", "orion", "ozyn", "aktor"], grafta: true },
    ],
  },
  {
    tur: "soket", etiket: "Soket", olaylar: ["soket.takildi", "soket.cikarildi"], zorunlu: ["ad"],
    alanlar: [
      { ad: "ad", etiket: "Soket adı", tip: "metin", varsayilan: "soket" },
      { ad: "konum", etiket: "Konum", tip: "vec3", varsayilan: VEC0, adim: 0.05, birim: "m" },
      { ad: "donus", etiket: "Dönüş", tip: "vec3", varsayilan: VEC0, adim: 5, birim: "°" },
    ],
  },
  {
    tur: "hareket", etiket: "Hareket (kinematik)", olaylar: ["hareket.basladi", "hareket.durdu"],
    alanlar: [
      { ad: "azamiHiz", etiket: "Azami hız", tip: "sayi", varsayilan: 5, en: 0, cok: 200, adim: 0.5, birim: "m/s", grafta: true },
      { ad: "ivme", etiket: "İvme", tip: "sayi", varsayilan: 4, en: 0, cok: 200, adim: 0.5, birim: "m/s²", grafta: true },
      { ad: "donmeHizi", etiket: "Dönme hızı", tip: "sayi", varsayilan: 90, en: 0, cok: 720, adim: 5, birim: "°/s", grafta: true },
      { ad: "zemineYapis", etiket: "Zemine yapış", tip: "bool", varsayilan: true },
    ],
  },
  { tur: "fizik", etiket: "Fizik (Havok)", olaylar: [], alanlar: [], rezerve: "fizik bileşeni henüz yok (Havok en son yapılır, spec 45 §10); şimdilik 'hareket' kullanın" },
];

export const bilesenTuru = (tur: string): BilesenTuru | null => BILESEN_TURLERI.find((t) => t.tur === tur) ?? null;

/** Türün şemadaki alanı; yoksa null. */
export const bilesenAlani = (tur: string, ad: string): AlanSemasi | null => bilesenTuru(tur)?.alanlar.find((a) => a.ad === ad) ?? null;

/** Bileşenin etkin ayarı: yazılanlar + eksik alanların şema varsayılanı (kopya döner). Bilinmeyen tür boş nesne verir. */
export function bilesenAyari(b: Pick<BilesenKaydi, "tur" | "ayar">): Record<string, AlanDegeri> {
  const sonuc: Record<string, AlanDegeri> = {};
  for (const a of bilesenTuru(b.tur)?.alanlar ?? []) {
    const yazilan = b.ayar?.[a.ad];
    const v = yazilan !== undefined ? yazilan : a.varsayilan;
    sonuc[a.ad] = Array.isArray(v) ? ([...v] as [number, number, number]) : v;
  }
  return sonuc;
}

const nesneMi = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Bileşen listesinin ilk hatası (alan yolu + neden); geçerliyse (ya da hiç yoksa) null. */
export function bilesenlerHatasi(liste: unknown): { alan: string; neden: string } | null {
  if (liste === undefined) return null;
  if (!Array.isArray(liste)) return { alan: "bilesenler", neden: "dizi olmalı" };
  if (liste.length > BILESEN_TAVANI) return { alan: "bilesenler", neden: `en çok ${BILESEN_TAVANI} bileşen (${liste.length} var)` };
  const idler = new Set<string>();
  const soketAdlari = new Set<string>();
  for (const [i, b] of liste.entries()) {
    const yol = `bilesenler[${i}]`;
    if (!nesneMi(b)) return { alan: yol, neden: "nesne olmalı" };
    for (const k of Object.keys(b)) if (!["id", "tur", "ad", "ayar"].includes(k)) return { alan: `${yol}.${k}`, neden: "bilinmeyen alan (id, tur, ad, ayar)" };
    if (!grafAdiGecerli(b["id"])) return { alan: `${yol}.id`, neden: "geçerli kimlik olmalı (harf, rakam, _ ve -)" };
    if (idler.has(b["id"])) return { alan: `${yol}.id`, neden: `yinelenen bileşen kimliği "${b["id"]}"` };
    idler.add(b["id"]);
    if (typeof b["tur"] !== "string") return { alan: `${yol}.tur`, neden: "metin olmalı" };
    const t = bilesenTuru(b["tur"]);
    if (!t) return { alan: `${yol}.tur`, neden: `bilinmeyen bileşen türü "${b["tur"]}" (bilinenler: ${BILESEN_TURLERI.filter((x) => !x.rezerve).map((x) => x.tur).join(", ")})` };
    if (t.rezerve) return { alan: `${yol}.tur`, neden: t.rezerve };
    if (b["ad"] !== undefined && (typeof b["ad"] !== "string" || !b["ad"].trim())) return { alan: `${yol}.ad`, neden: "boş olmayan metin olmalı" };
    const ayar = b["ayar"];
    if (ayar !== undefined && !nesneMi(ayar)) return { alan: `${yol}.ayar`, neden: "nesne olmalı" };
    for (const z of t.zorunlu ?? []) if (ayar === undefined || ayar[z] === undefined) return { alan: `${yol}.ayar.${z}`, neden: `${t.etiket} için '${z}' zorunlu` };
    for (const [ad, v] of Object.entries(ayar ?? {})) {
      const s = t.alanlar.find((a) => a.ad === ad);
      if (!s) return { alan: `${yol}.ayar.${ad}`, neden: `'${ad}' ${t.etiket} bileşeninde yok (alanlar: ${t.alanlar.map((a) => a.ad).join(", ")})` };
      const h = alanDegeriHatasi(s, v);
      if (h) return { alan: `${yol}.ayar.${ad}`, neden: h };
    }
    if (t.tur === "soket") {
      const ad = (ayar as Record<string, unknown>)["ad"] as string;
      if (!grafAdiGecerli(ad)) return { alan: `${yol}.ayar.ad`, neden: "soket adı geçerli olmalı (harf, rakam, _ ve -)" };
      if (soketAdlari.has(ad)) return { alan: `${yol}.ayar.ad`, neden: `yinelenen soket adı "${ad}" (bir aktörde her soketin adı ayrı)` };
      soketAdlari.add(ad);
    }
  }
  return null;
}

/** Bir aktörün `ust`/`soket` alanlarının kendi içindeki hatası (düğüm sayısına bakmaz); `ust`un var olup olmadığı level düzeyinde (`hiyerarsiHatasi`). */
export function ustHatasi(a: Record<string, unknown>): { alan: string; neden: string } | null {
  const u = a["ust"], s = a["soket"];
  if (u === undefined) return s === undefined ? null : { alan: "soket", neden: "soket için önce 'ust' (üst aktör) verilmeli" };
  if (typeof u !== "string" || !u.trim()) return { alan: "ust", neden: "üst aktörün kimliği (boş olmayan metin) olmalı" };
  if (u.startsWith(BEDEN_ONEKI) && !grafAdiGecerli(u.slice(BEDEN_ONEKI.length))) return { alan: "ust", neden: `'${BEDEN_ONEKI}<ad>' biçiminde olmalı (harf, rakam, _ ve -)` };
  if (s !== undefined && !grafAdiGecerli(s)) return { alan: "soket", neden: "soket adı geçerli olmalı (harf, rakam, _ ve -)" };
  return null;
}

/**
 * Level'daki bütün aktörlerin (nesne + ışık) hiyerarşi hatası: kendi üstü, olmayan üst, döngü, aşırı derinlik. Kimliksiz aktör atlanır (`levelKur` doldurur).
 * `beden:` üstler denetlenmez (bedenler level dosyasında yok; çalışma anında çözülür).
 */
export function hiyerarsiHatasi(aktorler: readonly { id?: unknown; ust?: unknown }[]): { id: string; neden: string } | null {
  const ustu = new Map<string, string>();
  const idler = new Set<string>();
  for (const a of aktorler) if (typeof a.id === "string") idler.add(a.id);
  for (const a of aktorler) {
    if (typeof a.id !== "string" || typeof a.ust !== "string") continue;
    if (a.ust.startsWith(BEDEN_ONEKI)) continue;
    if (a.ust === a.id) return { id: a.id, neden: "kendi üstü olamaz" };
    if (!idler.has(a.ust)) return { id: a.id, neden: `olmayan üst aktör "${a.ust}"` };
    ustu.set(a.id, a.ust);
  }
  for (const id of ustu.keys()) {
    const gorulen = new Set([id]);
    let derinlik = 0;
    for (let u = ustu.get(id); u !== undefined; u = ustu.get(u)) {
      if (gorulen.has(u)) return { id, neden: "üst zinciri döngü" };
      gorulen.add(u);
      if (++derinlik > HIYERARSI_DERINLIGI) return { id, neden: `üst zinciri en çok ${HIYERARSI_DERINLIGI} basamak` };
    }
  }
  return null;
}
