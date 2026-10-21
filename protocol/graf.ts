// protocol/graf.ts — DÜĞÜM GRAFİĞİ biçimi (Blueprint benzeri; spec 35). Orion'un ve Ozyn'in yazdığı "program = veri".
//
// NEDEN PROTOKOLDE: grafik, beyin (Orion'un `dunya_oner`i) ile dünya (yorumlayıcı + düğüm kütüphanesi) arasındaki sözleşmedir; `niyet.ts` gibi
// bağımlılıksız ve elle doğrulanır. Burası YALNIZ BİÇİMİ bilir (alanlar, kimlikler, bağların gösterdiği düğümler, tavanlar). Hangi düğüm türünün hangi
// pinleri olduğunu, tür uyumunu ve çalıştırmayı düğüm kütüphanesi bilir (`uygulama/graf/`). Editör kütüphanesi (LiteGraph ya da kendi editörümüz) yalnız
// GÖRÜNÜMDÜR: biçim bizimdir, LLM bizim şemamızı yazar.
//
// Kavramlar (UE5 Blueprint karşılıkları):
//   • düğüm (`dugumler`): tür adı (`tip`, örn. "akis.tekrar"), sabit ayarlar (`ayar`), editördeki yeri (`konum`);
//   • bağ (`baglar`): bir düğümün ÇIKIŞ pininden ötekinin GİRİŞ pinine. `akis` pinleri yürütme sırasını (beyaz ok), öteki pinler veriyi taşır;
//   • grafik türü: `olay` (▶ Başla ile çalışan program) ya da `fonksiyon` (girişli/çıkışlı DESEN: kaydedilir, sonra tek düğüm olarak çağrılır).
// Ozyn'in kuralı: grafiği Orion da Ozyn da yazar, ÇALIŞTIRMA yalnız Ozyn'in ▶ tuşuyla (spec 35 §1).
"use strict";
import type { Sonuc } from "./dogrula.ts";

export const GRAF_SURUMU = 1;

/** Pin türleri. `akis` yürütme sırası; `herhangi` her veri türüyle bağlanır (genel düğümler için, örn. "yaz"). */
export const PIN_TIPLERI = ["akis", "nesne", "ajan", "konum", "sayi", "metin", "bool", "herhangi"] as const;
export type PinTipi = (typeof PIN_TIPLERI)[number];

export interface PinTanimi {
  ad: string;
  tip: PinTipi;
}

/** Düğüm ayarlarında yalnız düz değerler: grafik JSON'dan JSON'a kayıpsız gider gelir. */
export type GrafDegeri = string | number | boolean | null;

export interface GrafDugumu {
  /** Grafikte tekil kimlik ("n1", "git_agac"). */
  id: string;
  /** Düğüm türü: noktalı küçük harf ("akis.tekrar", "ajan.git"). Kütüphanede kayıtlı olmalı (yorumlayıcı denetler). */
  tip: string;
  /** Sabit ayarlar; bağlanmamış veri girişinin değeri de buradan okunur (pin adıyla). */
  ayar?: Record<string, GrafDegeri>;
  /** Editördeki yeri; davranışı etkilemez. */
  konum?: [number, number];
}

/** [düğüm kimliği, pin adı]. */
export type PinUcu = [string, string];

export interface GrafBagi {
  kaynak: PinUcu;
  hedef: PinUcu;
}

export interface Graf {
  surum: typeof GRAF_SURUMU;
  ad: string;
  tur: "olay" | "fonksiyon";
  aciklama?: string;
  /** Fonksiyon (desen) grafiklerinin giriş/çıkış pinleri: çağıran düğümün pinleri bunlardır. Olay grafiğinde boş. */
  girisler: PinTanimi[];
  cikislar: PinTanimi[];
  dugumler: GrafDugumu[];
  baglar: GrafBagi[];
}

/** Tavanlar: LLM'in ya da bozuk bir dosyanın dünyayı boğmasın diye (çalışma tavanları yorumlayıcıda: adım, süre, derinlik). */
export const GRAF_SINIRLARI = { dugum: 200, bag: 400, pin: 16, ad: 48, metin: 500, aciklama: 1000 } as const;

const AD_DESENI = /^[\p{L}\p{N}_-]+$/u;
const TIP_DESENI = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

/** Grafik/pin/düğüm adı: harf, rakam, _ ve -; boş değil, en çok GRAF_SINIRLARI.ad karakter (dosya adı olarak da güvenli). */
export function grafAdiGecerli(ad: unknown): ad is string {
  return typeof ad === "string" && ad.length > 0 && ad.length <= GRAF_SINIRLARI.ad && AD_DESENI.test(ad);
}

const nesneMi = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hata = (m: string): Sonuc<never> => ({ ok: false, hata: m });

function pinlerDogrula(v: unknown, alan: string): Sonuc<PinTanimi[]> {
  if (v === undefined) return { ok: true, deger: [] };
  if (!Array.isArray(v)) return hata(`${alan}: dizi olmalı`);
  if (v.length > GRAF_SINIRLARI.pin) return hata(`${alan}: en çok ${GRAF_SINIRLARI.pin} pin`);
  const cikti: PinTanimi[] = [];
  const adlar = new Set<string>();
  for (const [i, p] of v.entries()) {
    if (!nesneMi(p)) return hata(`${alan}[${i}]: nesne olmalı`);
    if (!grafAdiGecerli(p.ad)) return hata(`${alan}[${i}].ad geçersiz: ${JSON.stringify(p.ad)}`);
    if (!PIN_TIPLERI.includes(p.tip as PinTipi) || p.tip === "akis") return hata(`${alan}[${i}].tip geçersiz: ${String(p.tip)} (veri türü olmalı: ${PIN_TIPLERI.filter((t) => t !== "akis").join(", ")})`);
    if (adlar.has(p.ad)) return hata(`${alan}: '${p.ad}' iki kez`);
    adlar.add(p.ad);
    cikti.push({ ad: p.ad, tip: p.tip as PinTipi });
  }
  return { ok: true, deger: cikti };
}

function ayarDogrula(v: unknown, alan: string): Sonuc<Record<string, GrafDegeri> | undefined> {
  if (v === undefined) return { ok: true, deger: undefined };
  if (!nesneMi(v)) return hata(`${alan}: nesne olmalı`);
  const cikti: Record<string, GrafDegeri> = {};
  for (const [k, d] of Object.entries(v)) {
    if (!grafAdiGecerli(k)) return hata(`${alan}: geçersiz anahtar ${JSON.stringify(k)}`);
    if (d === null || typeof d === "boolean") { cikti[k] = d; continue; }
    if (typeof d === "number") { if (!Number.isFinite(d)) return hata(`${alan}.${k}: sonlu sayı olmalı`); cikti[k] = d; continue; }
    if (typeof d === "string") { if (d.length > GRAF_SINIRLARI.metin) return hata(`${alan}.${k}: çok uzun (> ${GRAF_SINIRLARI.metin})`); cikti[k] = d; continue; }
    return hata(`${alan}.${k}: yalnız metin, sayı, bool ya da null olabilir`);
  }
  return { ok: true, deger: cikti };
}

function ucDogrula(v: unknown, alan: string, kimlikler: ReadonlySet<string>): Sonuc<PinUcu> {
  if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== "string" || typeof v[1] !== "string") return hata(`${alan}: [düğüm, pin] olmalı`);
  if (!kimlikler.has(v[0])) return hata(`${alan}: '${v[0]}' adlı düğüm yok`);
  if (!grafAdiGecerli(v[1])) return hata(`${alan}: pin adı geçersiz: ${JSON.stringify(v[1])}`);
  return { ok: true, deger: [v[0], v[1]] };
}

/**
 * Gelen grafik GÜVENİLMEZ girdidir (LLM çıktısı ya da elle düzenlenmiş dosya): biçimi doğrular ve TEMİZ bir kopya döner (bilinmeyen alanlar atılır).
 * Hata metni modele/editöre döner: neyin, nerede bozuk olduğunu söyler. Tür uyumu ve düğüm türleri burada DEĞİL (kütüphane bilir).
 */
export function grafDogrula(ham: unknown): Sonuc<Graf> {
  if (!nesneMi(ham)) return hata("grafik nesne olmalı");
  if (ham.surum !== GRAF_SURUMU) return hata(`surum ${GRAF_SURUMU} olmalı (gelen: ${String(ham.surum)})`);
  if (!grafAdiGecerli(ham.ad)) return hata(`ad geçersiz: ${JSON.stringify(ham.ad)} (harf, rakam, _ ve -; en çok ${GRAF_SINIRLARI.ad})`);
  if (ham.tur !== "olay" && ham.tur !== "fonksiyon") return hata(`tur 'olay' ya da 'fonksiyon' olmalı (gelen: ${String(ham.tur)})`);
  if (ham.aciklama !== undefined && (typeof ham.aciklama !== "string" || ham.aciklama.length > GRAF_SINIRLARI.aciklama)) return hata(`aciklama metin olmalı (en çok ${GRAF_SINIRLARI.aciklama})`);
  const girisler = pinlerDogrula(ham.girisler, "girisler");
  if (!girisler.ok) return girisler;
  const cikislar = pinlerDogrula(ham.cikislar, "cikislar");
  if (!cikislar.ok) return cikislar;
  if (ham.tur === "olay" && (girisler.deger.length || cikislar.deger.length)) return hata("olay grafiğinin giriş/çıkış pini olmaz (yalnız fonksiyon/desen grafiklerinin olur)");

  if (!Array.isArray(ham.dugumler)) return hata("dugumler dizi olmalı");
  if (ham.dugumler.length > GRAF_SINIRLARI.dugum) return hata(`en çok ${GRAF_SINIRLARI.dugum} düğüm`);
  const dugumler: GrafDugumu[] = [];
  const kimlikler = new Set<string>();
  for (const [i, d] of ham.dugumler.entries()) {
    const alan = `dugumler[${i}]`;
    if (!nesneMi(d)) return hata(`${alan}: nesne olmalı`);
    if (!grafAdiGecerli(d.id)) return hata(`${alan}.id geçersiz: ${JSON.stringify(d.id)}`);
    if (kimlikler.has(d.id)) return hata(`${alan}.id '${d.id}' iki kez`);
    if (typeof d.tip !== "string" || d.tip.length > GRAF_SINIRLARI.ad * 2 || !TIP_DESENI.test(d.tip)) return hata(`${alan}.tip geçersiz: ${JSON.stringify(d.tip)} (örn. "akis.tekrar")`);
    const ayar = ayarDogrula(d.ayar, `${alan}.ayar`);
    if (!ayar.ok) return ayar;
    let konum: [number, number] | undefined;
    if (d.konum !== undefined) {
      if (!Array.isArray(d.konum) || d.konum.length !== 2 || !d.konum.every((x) => typeof x === "number" && Number.isFinite(x))) return hata(`${alan}.konum: [x, y] sayı olmalı`);
      konum = [d.konum[0] as number, d.konum[1] as number];
    }
    kimlikler.add(d.id);
    dugumler.push({ id: d.id, tip: d.tip, ...(ayar.deger ? { ayar: ayar.deger } : {}), ...(konum ? { konum } : {}) });
  }

  if (!Array.isArray(ham.baglar)) return hata("baglar dizi olmalı");
  if (ham.baglar.length > GRAF_SINIRLARI.bag) return hata(`en çok ${GRAF_SINIRLARI.bag} bağ`);
  const baglar: GrafBagi[] = [];
  const gorulen = new Set<string>();
  for (const [i, b] of ham.baglar.entries()) {
    const alan = `baglar[${i}]`;
    if (!nesneMi(b)) return hata(`${alan}: nesne olmalı`);
    const kaynak = ucDogrula(b.kaynak, `${alan}.kaynak`, kimlikler);
    if (!kaynak.ok) return kaynak;
    const hedef = ucDogrula(b.hedef, `${alan}.hedef`, kimlikler);
    if (!hedef.ok) return hedef;
    const anahtar = `${kaynak.deger.join("\u0000")}\u0001${hedef.deger.join("\u0000")}`;
    if (gorulen.has(anahtar)) return hata(`${alan}: aynı bağ iki kez`);
    gorulen.add(anahtar);
    baglar.push({ kaynak: kaynak.deger, hedef: hedef.deger });
  }

  return {
    ok: true,
    deger: {
      surum: GRAF_SURUMU, ad: ham.ad, tur: ham.tur,
      ...(typeof ham.aciklama === "string" ? { aciklama: ham.aciklama } : {}),
      girisler: girisler.deger, cikislar: cikislar.deger, dugumler, baglar,
    },
  };
}
