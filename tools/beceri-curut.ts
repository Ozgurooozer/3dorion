// tools/beceri-curut.ts — BECERİ REFLEKSİ ÇÜRÜTME BATARYASI (spec 10).
//
// Atlas kuralı (Themis 1.6): "çalışıyor" iddiası bir çürütme denemesinden önce yazılmaz. Görev kartı
// ve öngörüler koşmadan önce defterde: brain-lab/LAB-DEFTERI.md, 2026-09-28 "Atlas çürütme bataryası:
// spec 10 iddiaları".
//
// DÜZENEK: GERÇEK köprü (bridge/kopru.ts), gerçek kayıt, gerçek kapı süzgeci (kural refleksi); sahte beyin
// ve sahte dünya, tohumlu. Olaylar sırayla gelir, aralarında `sakin` ms beklenir:
//   - bir olayın kısa gecikmeli sonuçları sonraki olaydan önce biter;
//   - "geç" sonuçlar bilerek sonraki olayın başına bırakılır (araya giren söz, geç gelen sonuç);
//   - "uzun düşünme" bilerek sonraki olayın üstüne taşar (LLM düşünürken gelen söz);
//   - refleksin zaman aşımı `sakin`dan kısa: sonucu geç kalan adım zaman aşımına düşer.
//
// SANAL SAAT: bütün zamanlayıcılar (köprü, sahte beyin, sahte dünya, bekleme) node:test'in sahte
// zamanlayıcısıyla çalışır; saat milisaniye milisaniye elle ilerletilir. Gerçek saatle ilk sürüm yük
// altında tekrarlanamadı (2026-09-28, taban bekçisi yakaladı): uzun düşünme sonraki olayla çakışınca kısa
// zamanlayıcıların (toplama, sonuç) bitiş anı gerçek geçen süreye bağlıydı ve bir sonucun bir turdan önce mi
// sonra mı geleceği koşudan koşuya değişiyordu. Sanal saatle aynı tohum her zaman aynı akışı verir.
// Rastgele üreteçler oturum başınadır: bir oturumun geç işi sonrakinin çekişlerini kaydıramaz.
//
// BATARYA (ön-kayıttaki R1–R6; R7 canlıdır: 3dorion.bat becerdene):
//   R1 canlı = kayıt: gölge denetimi ve canlı hafıza = satırlardan kurulan (yetki kapalı ve açık)
//   R2 gölge davranışı değiştirmez: geçmişli ve geçmişsiz aynı akış → aynı niyetler, aynı uyanışlar
//   R3 yetki `false` = anahtar hiç verilmemiş: aynı niyetler ve uyanışlar
//   R4 yetki açık: (a) refleks niyetleri bedensel (b) adımlar sırayla (c) adım sonucu beyne gitmez
//      (d) hata ya da zaman aşımında LLM devralır, başarı ya da kesilmede devralmaz
//      (e) kapıdan geçen kesin sözde gölge dolu ⇔ tam bir refleks (f) yapılan, yazılanın öneki
//   R5 sızıntı: LLM'in adım listeleri görevler arasında karıştırılınca uyum düşer
//   R6 lezyon: bir tarifin kanıtı silinince o tarif önerilmez; canlıyla her fark ondandır
//
// Kullanım:
//   node --experimental-strip-types tools/beceri-curut.ts [--tohumlar=1-40] [--olay=20] [--oturum=3]
"use strict";
import fs from "node:fs";
import path from "node:path";
import { mock } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { Kopru, REFLEKS_ONEKI } from "../bridge/kopru.ts";
import type { AracCagrisi, Beyin, BeyinCikti, BeyinGirdisi } from "../bridge/beyin.ts";
import { araclariUret, turCoz } from "../bridge/araclar.ts";
import { OZET_ONEKI, type Algi } from "../protocol/algi.ts";
import type { Niyet, NiyetSonucu, NiyetTur } from "../protocol/niyet.ts";
import type { CapaAdi } from "../protocol/temel.ts";
import { BeceriHafizasi, beceriHafizasiKur } from "../mind/beceriHafizasi.ts";
import { gorevler, gorevSonucu, niyetSinifi } from "../mind/gorev.ts";
import { KARAR_ONEKI, KararKaydi, type AlgiSatiri, type BeceriGolgesi, type KararSatiri, type RefleksSatiri, type UyanisSatiri } from "../mind/kararKaydi.ts";
import { kayitOku, zincirKur } from "../mind/kararZinciri.ts";
import { niyetKaynagi } from "../mind/durumKodu.ts";
import { KuralRefleksi, refleksGirdisi } from "../mind/refleks.ts";
import { golgeDenetimi, olc, type GolgeDenetimi } from "./beceri-deney.ts";
import { rastgele, tohumlar } from "./kapi-deney.ts";

// ── Akış ─────────────────────────────────────────────────────────────────────

export type Sablon = "git" | "git_otur" | "bak" | "odaklan" | "merhaba" | "listele";
const SABLONLAR: readonly Sablon[] = ["git", "git_otur", "bak", "odaklan", "merhaba", "listele"];
/** Sözde anılabilen altı çapa ve yönelme halleri (sözün doğal biçimi). */
const YONELME: Record<string, string> = {
  pencere: "pencereye", sandalye: "sandalyeye", masa: "masaya", kapi: "kapıya", tahta: "tahtaya", monitor: "monitöre",
};
const CAPALAR = Object.keys(YONELME) as CapaAdi[];

export interface SozOlayi { tur: "soz"; metin: string; kesin: boolean; sablon: Sablon; capa: CapaAdi }
export interface AlgiOlayi { tur: "algi"; algi: Algi }
export type Olay = SozOlayi | AlgiOlayi;

function sozMetni(s: Sablon, c: CapaAdi): string {
  switch (s) {
    case "git": return `${YONELME[c]} git`;
    case "git_otur": return `${YONELME[c]} git otur`;
    case "bak": return `${YONELME[c]} bak`;
    case "odaklan": return `${YONELME[c]} odaklan`;
    case "merhaba": return "merhaba";
    case "listele": return "dizini listele";
  }
}

/** Tohumlu akış: oturumlar × olaylar. Olayların %70'i söz (%10'u ara tanıma), %30'u başka algı. */
export function akisKur(tohum: number, oturum = 3, olay = 20): Olay[][] {
  const r = rastgele(tohum);
  const sec = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  return Array.from({ length: oturum }, () => Array.from({ length: olay }, (): Olay => {
    if (r() < 0.7) {
      const sablon = sec(SABLONLAR), capa = sec(CAPALAR);
      return { tur: "soz", metin: sozMetni(sablon, capa), kesin: r() >= 0.1, sablon, capa };
    }
    const algi: Algi = r() < 0.5
      ? { tur: "terminal", kuyruk: sec(["build ok", "npm ERR! missing script", "3 passing", "error: file not found"]), kesildi: false, kod: r() < 0.5 ? 0 : 1 }
      : { tur: "olay", ad: sec(["oyuncu_odaya_girdi", "monitor_acildi", "oyuncu_masaya_oturdu"]) };
    return { tur: "algi", algi };
  }));
}

// ── Sahte beyin ──────────────────────────────────────────────────────────────

const capaHedefi = (ad: string) => ({ tip: "capa" as const, ad });

/** Sözün doğru tarifi (sahte LLM'in %80'i). */
function dogruTarif(s: Sablon, c: string): Niyet[] {
  switch (s) {
    case "git": return [{ tur: "git", hedef: capaHedefi(c) }];
    case "git_otur": return [{ tur: "git", hedef: capaHedefi(c) }, { tur: "otur" }];
    case "bak": return [{ tur: "bak", hedef: capaHedefi(c) }];
    case "odaklan": return [{ tur: "odaklan", capa: c }];
    case "merhaba": return [{ tur: "soyle", metin: "Merhaba!" }];
    case "listele": return [{ tur: "komut", metin: "dir", gerekce: "Ozyn dizini görmek istedi" }];
  }
}

/** Başka ama makul bir tarif (sahte LLM'in %10'u). */
function baskaTarif(s: Sablon, c: string): Niyet[] {
  switch (s) {
    case "git": return [{ tur: "bak", hedef: capaHedefi(c) }, { tur: "git", hedef: capaHedefi(c) }];
    case "git_otur": return [{ tur: "git", hedef: capaHedefi(c) }];
    case "bak": return [{ tur: "odaklan", capa: c }];
    case "odaklan": return [{ tur: "bak", hedef: capaHedefi(c) }];
    default: return dogruTarif(s, c);
  }
}

/** Niyetin araç çağrısı: araç adı protokolün tablosundan (bridge/araclar.ts), önek kopyalanmaz. */
function niyettenCagri(n: Niyet): AracCagrisi {
  const { tur, ...girdi } = n;
  const ad = araclariUret().find((a) => turCoz(a.ad) === (tur as NiyetTur))!.ad;
  return { ad, girdi };
}

/** Tampondaki SON sözün metni (özet biçimi protokolden: `Ozyn said: "…"`). */
function sonSoz(ozetler: readonly string[], sozler: ReadonlyMap<string, SozOlayi>): SozOlayi | null {
  for (let i = ozetler.length - 1; i >= 0; i--) {
    const o = ozetler[i]!;
    if (!o.startsWith(OZET_ONEKI.duydum)) continue;
    const metin = o.slice(OZET_ONEKI.duydum.length).trim().replace(/^"|"$/g, "");
    return sozler.get(metin) ?? null;
  }
  return null;
}

class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  uyanis = 0;
  private _r: () => number;
  private _sozler: ReadonlyMap<string, SozOlayi>;
  private _uzunMs: number;
  constructor(r: () => number, sozler: ReadonlyMap<string, SozOlayi>, uzunMs: number) {
    this._r = r;
    this._sozler = sozler;
    this._uzunMs = uzunMs;
  }
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> {
    this.uyanis++;
    const uzun = this._r() < 0.15;
    const cikti = this._cevap(g);
    if (uzun) await new Promise((r) => setTimeout(r, this._uzunMs));
    return cikti;
  }
  private _cevap(g: BeyinGirdisi): BeyinCikti {
    const soz = sonSoz(g.ozetler, this._sozler);
    const x = this._r();
    let tarif: Niyet[];
    if (!soz) tarif = x < 0.3 ? [{ tur: "soyle", metin: "Anladım." }] : [];
    else if (x < 0.80) tarif = dogruTarif(soz.sablon, soz.capa);
    else if (x < 0.90) tarif = baskaTarif(soz.sablon, soz.capa);
    else if (x < 0.95) {
      const diger = CAPALAR.filter((c) => c !== soz.capa);
      tarif = dogruTarif(soz.sablon, diger[Math.floor(this._r() * diger.length)]!);
    } else tarif = [];
    if (tarif.length && niyetSinifi(tarif[0]!.tur) === "bedensel" && this._r() < 0.5) tarif = [...tarif, { tur: "soyle", metin: "Tamam." }];
    return { metin: "", cagrilar: tarif.map(niyettenCagri) };
  }
}

// ── Sahte dünya ──────────────────────────────────────────────────────────────

export type DunyaOlayi =
  | { tur: "gonder"; id: string; n: Niyet }
  | { tur: "sonuc"; id: string; durum: NiyetSonucu["durum"] };

interface Planli { id: string; durum: "bitti" | "hata" | "bekle" | "hic"; not?: string; basladi: boolean; gec: boolean; teslim: boolean }

/**
 * Sonuçlar: bedensel adımın %85'i `bitti` (%30'unda önce `basladi`), %7'si `hata`, %3'ü sonraki bedensel
 * emirle `iptal`, %5'i hiç. %10'u sonraki olayın başında gelir. Dünyadaki kural: en son emir kazanır —
 * sonucu henüz gelmemiş önceki bedensel adım yeni emirle `iptal` olur. Söz sonuç yaymaz (canlıdaki gibi);
 * komut onay kapısında reddedilir; jest yürüyüşü kesmez.
 */
class SahteDunya {
  readonly gunluk: DunyaOlayi[] = [];
  private _gec: (() => void)[] = [];
  private _aktif: Planli | null = null;
  private _r: () => number;
  private _ilet: (s: NiyetSonucu) => void;
  constructor(r: () => number, ilet: (s: NiyetSonucu) => void) {
    this._r = r;
    this._ilet = ilet;
  }

  gonder(n: Niyet, id: string): void {
    this.gunluk.push({ tur: "gonder", id, n: JSON.parse(JSON.stringify(n)) as Niyet });
    if (n.tur === "soyle") return;
    if (n.tur === "komut") { this._planla({ id, durum: "hata", not: "Ozyn reddetti", basladi: false, gec: false, teslim: false }); return; }
    if (n.tur === "jest") { this._planla({ id, durum: "bitti", basladi: false, gec: false, teslim: false }); return; }
    const onceki = this._aktif;
    if (onceki && !onceki.teslim && onceki.durum !== "hic") {
      onceki.teslim = true;
      setTimeout(() => this._teslim(onceki.id, "iptal"), 0);
    }
    const x = this._r();
    const p: Planli = {
      id, durum: x < 0.85 ? "bitti" : x < 0.92 ? "hata" : x < 0.95 ? "bekle" : "hic",
      basladi: this._r() < 0.3, gec: this._r() < 0.1, teslim: false,
    };
    if (p.durum === "hata") p.not = "yol kapalı";
    this._aktif = p;
    if (p.durum === "bitti" || p.durum === "hata") this._planla(p);
  }

  /** "Geç" sonuçlar: sonraki olayın başında. */
  gecleriTeslimEt(): void {
    for (const f of this._gec.splice(0)) f();
  }

  private _planla(p: Planli): void {
    const f = () => {
      if (p.teslim) return;
      p.teslim = true;
      if (p.basladi) this._teslim(p.id, "basladi");
      this._teslim(p.id, p.durum as "bitti" | "hata", p.not);
    };
    if (p.gec) this._gec.push(f);
    else setTimeout(f, 0);
  }

  private _teslim(id: string, durum: NiyetSonucu["durum"], not?: string): void {
    this.gunluk.push({ tur: "sonuc", id, durum });
    this._ilet({ niyet_id: id, durum, ...(not ? { not } : {}) } as NiyetSonucu);
  }
}

// ── Koşu ─────────────────────────────────────────────────────────────────────

export interface Zamanlama {
  /** Olaylar arası bekleme (ms). */
  sakin: number;
  /** Uzun düşünme (ms): `sakin`dan uzun, sonraki olayın üstüne taşar. */
  uzun: number;
  /** Refleksin adım zaman aşımı (ms): `sakin`dan kısa. */
  zamanAsimi: number;
  toplama: number;
}
export const ZAMANLAMA: Zamanlama = { sakin: 80, uzun: 200, zamanAsimi: 30, toplama: 5 };

/** Sanal saat: zaman yalnız `ilerle` ile akar. */
export interface Saat {
  ilerle(ms: number): Promise<void>;
}

/**
 * node:test'in sahte zamanlayıcısı üstünde sanal saat (`tik` = `mock.timers.tick`). Her milisaniyeden
 * sonra bir `setImmediate` beklenir: o ana kadar sonuçlanan söz zincirleri (microtask) tamamlansın.
 * `setImmediate` sahte değildir; yalnız `setTimeout` ve `Date` sahtedir.
 */
export function sanalSaat(tik: (ms: number) => void): Saat {
  return {
    async ilerle(ms: number): Promise<void> {
      for (let i = 0; i < ms; i++) {
        tik(1);
        await new Promise((r) => setImmediate(r));
      }
    },
  };
}

export interface KosuAyari {
  /** Beceri yetkisi: true, false ya da `null` (anahtar hiç verilmez). */
  yetki: boolean | null;
  /** Her oturum önceki oturumların satırlarıyla mı açılır (host'un yaptığı gibi). */
  gecmisli: boolean;
  saat: Saat;
  zaman?: Zamanlama;
}

export interface OturumSonucu {
  satirlar: KararSatiri[];
  /** Dünyaya giden niyetler, gönderim sırasıyla (JSON hali). */
  niyetler: Niyet[];
  uyanis: number;
  /** Oturum sonunda köprünün beceri hafızası (JSON). */
  hafiza: string;
}
export interface KosuSonucu { oturumlar: OturumSonucu[]; dunya: DunyaOlayi[] }

/** Akışı gerçek köprüyle koşar; oturumlar sırayla, her biri yeni köprü (Orion'u yeniden açmak gibi). */
export async function akisKos(tohum: number, akis: readonly Olay[][], ayar: KosuAyari): Promise<KosuSonucu> {
  const z = ayar.zaman ?? ZAMANLAMA;
  const sozler = new Map<string, SozOlayi>();
  for (const o of akis.flat()) if (o.tur === "soz") sozler.set(o.metin, o);
  const oturumlar: OturumSonucu[] = [];
  const dunyaGunlugu: DunyaOlayi[] = [];
  const tum: KararSatiri[] = [];
  for (const [i, olaylar] of akis.entries()) {
    let saat = (i + 1) * 10_000_000;
    const metin: string[] = [];
    const niyetler: Niyet[] = [];
    const beyinR = rastgele(tohum * 7919 + 1 + i * 1_000_003);
    const dunyaR = rastgele(tohum * 104729 + 2 + i * 1_000_033);
    const beyin = new SahteBeyin(beyinR, sozler, z.uzun);
    const refleks = new KuralRefleksi();
    let k: Kopru;
    const dunya = new SahteDunya(dunyaR, (s) => k.sonuc(s));
    k = new Kopru({
      // Spec 13 Faz 2b: doğuştan komut programları KAPALI — bu araç kapının ve becerinin
      // eski yolunu ölçer; sonuçları bu fazdan önceki koşularla birebir kalmalı.
      komutYetkisi: false,
      beyin,
      niyetGonder: (n, id) => { niyetler.push(JSON.parse(JSON.stringify(n)) as Niyet); dunya.gonder(n, id); },
      dunyaDurumu: () => "Oda.",
      toplamaMs: z.toplama,
      simdi: () => saat,
      dikkat: { simdi: () => (saat += 10_000) },
      suzgec: (a, ozet) => { const r = refleks.karar(refleksGirdisi(a, ozet)); return { gecsin: r.terfi, kural: r.kural, gerekce: r.gerekce }; },
      kararKaydi: new KararKaydi({ yaz: (s) => metin.push(s.slice(KARAR_ONEKI.length + 1)), simdi: () => (saat += 1), oturum: `o${tohum}_${i + 1}` }),
      ...(ayar.gecmisli ? { gorevSatirlari: [...tum] } : {}),
      ...(ayar.yetki === null ? {} : { beceriYetkisi: ayar.yetki }),
      refleksZamanAsimiMs: z.zamanAsimi,
    });
    for (const o of olaylar) {
      dunya.gecleriTeslimEt();
      if (o.tur === "soz") k.algi({ tur: "duydum", metin: o.metin, kesin: o.kesin });
      else k.algi(o.algi);
      await ayar.saat.ilerle(z.sakin);
    }
    dunya.gecleriTeslimEt();
    await ayar.saat.ilerle(z.uzun * 4);
    // Oturumu köprü düşünmüyorken kapat: yarım kalan tur sonraki oturuma ya da sonuçlara sızmasın.
    for (let n = 0; n < 20 && k.dusunuyorMu; n++) await ayar.saat.ilerle(z.uzun);
    k.durdur();
    const satirlar = kayitOku(metin.join("\n")).satirlar;
    tum.push(...satirlar);
    oturumlar.push({ satirlar, niyetler: [...niyetler], uyanis: beyin.uyanis, hafiza: JSON.stringify(k.beceriHafizasi.beceriler) });
    dunyaGunlugu.push(...dunya.gunluk);
  }
  return { oturumlar, dunya: dunyaGunlugu };
}

// ── Denetçiler ───────────────────────────────────────────────────────────────

const tumSatirlar = (k: KosuSonucu): KararSatiri[] => k.oturumlar.flatMap((o) => o.satirlar);
const json = (x: unknown): unknown => JSON.parse(JSON.stringify(x));

/** R1: gölge denetimi; son oturumun canlı hafızası = bütün satırlardan kurulan. */
export function r1(k: KosuSonucu): { golge: GolgeDenetimi; hafizaEsit: boolean } {
  const tum = tumSatirlar(k);
  const kayittan = JSON.stringify(beceriHafizasiKur(gorevler(zincirKur(tum))).beceriler);
  return { golge: golgeDenetimi(tum), hafizaEsit: k.oturumlar.at(-1)!.hafiza === kayittan };
}

/** R2, R3: dünyaya giden niyetleri ya da uyanış sayısı farklı olan oturum sayısı. */
export function fark(a: KosuSonucu, b: KosuSonucu): number {
  return a.oturumlar.filter((o, i) => {
    const p = b.oturumlar[i];
    return !p || !isDeepStrictEqual(o.niyetler, p.niyetler) || o.uyanis !== p.uyanis;
  }).length;
}

export interface R4Sonucu { refleks: number; a: number; b: number; c: number; d: number; e: number; f: number }

/** R4: yetki açık koşunun ihlalleri (her alan ihlal sayısı; `refleks` sınanan refleks turu sayısı). */
export function r4(k: KosuSonucu): R4Sonucu {
  const o: R4Sonucu = { refleks: 0, a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };
  const gonderSira = new Map<string, number>();
  const bittiSira = new Map<string, number>();
  k.dunya.forEach((x, i) => {
    if (x.tur === "gonder") {
      gonderSira.set(x.id, i);
      // (a) refleks kimlikli her niyet bedensel
      if (niyetKaynagi(x.id) === REFLEKS_ONEKI && niyetSinifi(x.n.tur) !== "bedensel") o.a++;
    } else if (x.durum === "bitti") bittiSira.set(x.id, i);
  });
  for (const { satirlar } of k.oturumlar) {
    const refleksler = satirlar.filter((s): s is RefleksSatiri => s.tur === "refleks");
    const uyanislar = satirlar.filter((s): s is UyanisSatiri => s.tur === "uyanis");
    const algilar = satirlar.filter((s): s is AlgiSatiri => s.tur === "algi");
    const tetikler = new Set(uyanislar.flatMap((u) => u.algilar));
    o.refleks += refleksler.length;
    for (const r of refleksler) {
      // (b) k+1. adım ancak k. adımın `bitti`sinden sonra
      for (let j = 1; j < r.niyetler.length; j++) {
        const bitti = bittiSira.get(r.niyetler[j - 1]!.id);
        const gonder = gonderSira.get(r.niyetler[j]!.id);
        if (bitti === undefined || gonder === undefined || gonder < bitti) o.b++;
      }
      // (d) hata ve zaman aşımında LLM devralır (söz bir uyanışın tetiğinde); başarı ve kesilmede devralmaz
      if ((r.bitis === "hata" || r.bitis === "zaman_asimi") !== tetikler.has(r.algi)) o.d++;
    }
    // (c) refleks sonucu `kopru.refleks` ile yazılır, geçmez, hiçbir uyanışın tetiği değildir
    for (const a of algilar) {
      if (a.algi !== "sonuc" || !a.niyet || niyetKaynagi(a.niyet) !== REFLEKS_ONEKI) continue;
      if (a.kapi.kural !== "kopru.refleks" || a.kapi.gecti || tetikler.has(a.id)) o.c++;
    }
    // (e) kapıdan geçen kesin sözde gölge dolu ⇔ tam bir refleks; kapının düşürdüğü sözde refleks yok
    const refleksSayisi = new Map<string, number>();
    for (const r of refleksler) refleksSayisi.set(r.algi, (refleksSayisi.get(r.algi) ?? 0) + 1);
    for (const a of algilar) {
      if (a.algi !== "duydum" || a.beceriGolge === undefined) continue;
      const beklenen = a.kapi.gecti && a.beceriGolge ? 1 : 0;
      if ((refleksSayisi.get(a.id) ?? 0) !== beklenen) o.e++;
    }
    // (f) refleksin gönderdiği adımlar gölgenin adımlarının öneki (yazılan ile yapılan aynı)
    const golgeler = new Map(algilar.filter((a) => a.algi === "duydum").map((a) => [a.id, a.beceriGolge]));
    for (const r of refleksler) {
      const g = golgeler.get(r.algi);
      const yapilan = json(r.niyetler.map((n) => n.govde));
      if (!g || !isDeepStrictEqual(yapilan, json(g.adimlar.slice(0, r.niyetler.length)))) o.f++;
    }
  }
  return o;
}

/**
 * R5 sızıntı denetimi: gerçek uyum ile LLM'in adım listeleri görevler arasında karıştırılmış (tohumlu)
 * akışın uyumu. Karıştırılmış görevin sonucu kendi adımlarından yeniden hesaplanır. `karistir: false`
 * kalibrasyon içindir (karıştırmasız, ikisi eşit çıkmalı).
 */
export function r5(k: KosuSonucu, tohum: number, karistir = true): { gercek: [number, number]; karisik: [number, number] } {
  const gs = gorevler(zincirKur(tumSatirlar(k)));
  const g = olc(new BeceriHafizasi(), gs);
  const adimlar = gs.map((x) => x.adimlar);
  if (karistir) {
    const r = rastgele(tohum * 31 + 7);
    for (let i = adimlar.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [adimlar[i], adimlar[j]] = [adimlar[j]!, adimlar[i]!];
    }
  }
  const c = olc(new BeceriHafizasi(), gs.map((x, i) => ({ ...x, adimlar: adimlar[i]!, sonuc: gorevSonucu(adimlar[i]!) })));
  return { gercek: [g.uyumlu, g.eslesen], karisik: [c.uyumlu, c.eslesen] };
}

export interface R6Sonucu {
  /** Kanıtı silinen beceri. */
  beceri: string;
  /** Silinen görev satırı sayısı. */
  silinen: number;
  /** Yeniden hesaplanan gölgelerden silinen beceriyi önerenler: 0 olmalı. */
  oneren: number;
  /** Canlı ile yeniden hesaplanan arasındaki farklar. */
  fark: number;
  /** Farklardan canlıda silinen beceriyi önermeyenler: 0 olmalı. */
  yabanciFark: number;
}

/**
 * R6 lezyon: en çok başarılı tarifin bütün kanıt görevleri (uyanış ve refleks satırları) silinir, gölgeler
 * kayıttan yeniden hesaplanır. `sil: false` kalibrasyon içindir (silmeden: öneren > 0, fark 0).
 */
export function r6(k: KosuSonucu, sil = true): R6Sonucu | null {
  const tum = tumSatirlar(k);
  const h = beceriHafizasiKur(gorevler(zincirKur(tum)));
  const hedef = [...h.beceriler].sort((a, b) => b.sayac.basari - a.sayac.basari || a.dogum - b.dogum)[0];
  if (!hedef) return null;
  const kanit = new Set(hedef.kanit);
  const kalan = sil ? tum.filter((s) => !((s.tur === "uyanis" || s.tur === "refleks") && kanit.has(`${s.o}/${s.id}`))) : tum;
  let oneren = 0;
  const d = golgeDenetimi(kalan, (_satir, _canli, kayittan) => { if (kayittan?.beceri === hedef.id) oneren++; });
  return {
    beceri: hedef.id, silinen: tum.length - kalan.length, oneren,
    fark: d.farkli.length, yabanciFark: d.farkli.filter((f) => f.canli?.beceri !== hedef.id).length,
  };
}

// ── Tohum başına batarya ─────────────────────────────────────────────────────

export interface TohumSonucu {
  tohum: number;
  r1Kapali: { golgeli: number; ayni: number; hafizaEsit: boolean };
  r1Acik: { golgeli: number; ayni: number; hafizaEsit: boolean };
  r2Fark: number;
  r3Fark: number;
  r4: R4Sonucu;
  r5: { gercek: [number, number]; karisik: [number, number] };
  r6: R6Sonucu | null;
}

const ozetR1 = (x: ReturnType<typeof r1>) => ({ golgeli: x.golge.golgeli, ayni: x.golge.ayni, hafizaEsit: x.hafizaEsit });

/** Bir tohumun dört koşusu (kapalı geçmişli, kapalı geçmişsiz, anahtarsız, açık) ve altı denetimi. */
export async function tohumKos(tohum: number, saat: Saat, oturum = 3, olay = 20, zaman: Zamanlama = ZAMANLAMA): Promise<TohumSonucu> {
  const akis = akisKur(tohum, oturum, olay);
  const kapali = await akisKos(tohum, akis, { yetki: false, gecmisli: true, saat, zaman });
  const gecmissiz = await akisKos(tohum, akis, { yetki: false, gecmisli: false, saat, zaman });
  const anahtarsiz = await akisKos(tohum, akis, { yetki: null, gecmisli: true, saat, zaman });
  const acik = await akisKos(tohum, akis, { yetki: true, gecmisli: true, saat, zaman });
  return {
    tohum,
    r1Kapali: ozetR1(r1(kapali)), r1Acik: ozetR1(r1(acik)),
    r2Fark: fark(kapali, gecmissiz), r3Fark: fark(kapali, anahtarsiz),
    r4: r4(acik), r5: r5(kapali, tohum), r6: r6(kapali),
  };
}

// ── Komut satırı ─────────────────────────────────────────────────────────────

function arg(ad: string, varsayilan: string): string {
  const p = process.argv.find((a) => a.startsWith(`--${ad}=`));
  return p ? p.slice(ad.length + 3) : varsayilan;
}

const yuzde = (p: number, q: number) => (q === 0 ? "—" : `%${((100 * p) / q).toFixed(1).replace(".", ",")}`);

async function calistir(): Promise<void> {
  const liste = tohumlar(arg("tohumlar", "1-40"));
  const [oturum, olay] = [Number(arg("oturum", "3")), Number(arg("olay", "20"))];
  const sonuclar: TohumSonucu[] = [];
  const t0 = performance.now();
  // Sanal saat bütün süreç için: tohumlar sırayla (paylaşılan saat eşzamanlı koşuya izin vermez).
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_790_000_000_000 });
  try {
    const saat = sanalSaat((ms) => mock.timers.tick(ms));
    for (const t of liste) {
      sonuclar.push(await tohumKos(t, saat, oturum, olay));
      process.stdout.write(".");
    }
  } finally {
    mock.timers.reset();
  }
  console.log(`\n${sonuclar.length} tohum, ${((performance.now() - t0) / 1000).toFixed(0)} sn`);

  const topla = (f: (s: TohumSonucu) => number) => sonuclar.reduce((x, s) => x + f(s), 0);
  const bozuk = (f: (s: TohumSonucu) => boolean) => sonuclar.filter(f).map((s) => s.tohum);
  const satir = (ad: string, ihlalli: number[], ek: string) => console.log(`| ${ad} | ${sonuclar.length - ihlalli.length}/${sonuclar.length} | ${ihlalli.join(", ") || "—"} | ${ek} |`);
  console.log("\n| denetim | temiz tohum | ihlalli tohumlar | sayılar |\n|---|---|---|---|");
  satir("R1 kapalı: gölge = kayıt", bozuk((s) => s.r1Kapali.ayni !== s.r1Kapali.golgeli), `${topla((s) => s.r1Kapali.ayni)}/${topla((s) => s.r1Kapali.golgeli)} gölge aynı`);
  satir("R1 kapalı: canlı hafıza = kayıttan", bozuk((s) => !s.r1Kapali.hafizaEsit), "");
  satir("R1 açık: gölge = kayıt", bozuk((s) => s.r1Acik.ayni !== s.r1Acik.golgeli), `${topla((s) => s.r1Acik.ayni)}/${topla((s) => s.r1Acik.golgeli)} gölge aynı`);
  satir("R1 açık: canlı hafıza = kayıttan", bozuk((s) => !s.r1Acik.hafizaEsit), "");
  satir("R2 geçmişli = geçmişsiz", bozuk((s) => s.r2Fark > 0), `${topla((s) => s.r2Fark)} farklı oturum`);
  satir("R3 false = anahtarsız", bozuk((s) => s.r3Fark > 0), `${topla((s) => s.r3Fark)} farklı oturum`);
  for (const h of ["a", "b", "c", "d", "e", "f"] as const) satir(`R4${h}`, bozuk((s) => s.r4[h] > 0), `${topla((s) => s.r4[h])} ihlal`);
  console.log(`| R4 sınanan refleks | — | — | ${topla((s) => s.r4.refleks)} |`);
  const [gu, ge, ku, ke] = [topla((s) => s.r5.gercek[0]), topla((s) => s.r5.gercek[1]), topla((s) => s.r5.karisik[0]), topla((s) => s.r5.karisik[1])];
  console.log(`| R5 uyum gerçek · karışık | — | — | ${yuzde(gu, ge)} (${gu}/${ge}) · ${yuzde(ku, ke)} (${ku}/${ke}) |`);
  const r6ler = sonuclar.filter((s) => s.r6);
  satir("R6 lezyon: öneren 0", bozuk((s) => (s.r6?.oneren ?? 0) > 0), `${r6ler.length} tohumda lezyon; farkı olan ${r6ler.filter((s) => s.r6!.fark > 0).length}`);
  satir("R6 lezyon: yabancı fark 0", bozuk((s) => (s.r6?.yabanciFark ?? 0) > 0), `${topla((s) => s.r6?.fark ?? 0)} fark`);

  const dosya = path.join("brain-lab", "data", "beceri", "curut.json");
  fs.mkdirSync(path.dirname(dosya), { recursive: true });
  fs.writeFileSync(dosya, JSON.stringify({ tarih: new Date().toISOString(), tohumlar: liste, oturum, olay, zaman: ZAMANLAMA, sonuclar }, null, 2));
  console.log(`\nkayıt: ${dosya}`);
}

if (import.meta.main) await calistir();
