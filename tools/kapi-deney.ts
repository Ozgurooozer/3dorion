// tools/kapi-deney.ts — ÖĞRENEN KAPI ÇEVRİMDIŞI KIYASI (toplantı 2026-09-27 K6).
//
// Soru: büyüyen kural hafızası (B) tutarlı bir öğretmenin kapı tercihlerini tek
// denemede öğreniyor, benzer durumlara genelliyor, unutmuyor ve küçük kalıyor mu?
// Kıyas: sinek mantar gövdesi (A), tam anı hafızası (D), çevrimiçi lojistik (C),
// içgüdü ikizi (öğrenmesiz). Karar kuralı toplantıda: B, A'ya belirgin biçimde
// yenilirse motor kararı yeniden açılır.
//
// DÜZENEK
//   Havuz   — öğrenilebilir durumlar: etiketli küme (refleksKumesi), GERÇEK terminal
//             çıktıları (tools/kapi-yakala.ts), canlı olay adları (world/olayUretici.ts),
//             gerçek niyet sonuçlarının metinleri. Her durumun kapı kararı ve durum
//             kodu GERÇEK köprüden geçirilerek alınır (kopya kapı yok).
//   Öğretmen — "Ozyn yerine geçen" tutarlı etiketçiler: hakem (qwen, Haiku) iki
//             bağlamda, kümenin insan etiketleri. Doğru değiller; tutarlılar. Soru
//             motorun ne öğretildiyse onu öğrenip öğrenmediği.
//   Akış    — tekrarlı: sık durumlar sık gelir. Durumların %20'si YENİ: yalnız ikinci
//             yarıda görünür (genelleme ölçüsü).
//   Ölçüm   — sıralı: her olayda önce karar (motor emin değilse içgüdü), sonra ders.
//   Kontrol — karıştırılmış öğretmen: etiketler durumlar arasında karıştırılır.
//             Tutarlı ama yapısız; yeni durumlarda genelleme şansa inmeli.
//
// Kullanım:
//   node --experimental-strip-types tools/kapi-deney.ts havuz
//   node --experimental-strip-types tools/kapi-deney.ts etiketle --ogretmen=qwen|haiku --baglam=masada|uzakta
//   node --experimental-strip-types tools/kapi-deney.ts kos [--tohumlar=1,2,3,4,5] [--olay=400]
"use strict";
import fs from "node:fs";
import { Kopru } from "../bridge/kopru.ts";
import type { Beyin, BeyinCikti } from "../bridge/beyin.ts";
import { KARAR_ONEKI, KararKaydi, type AlgiSatiri, type KapiKarari } from "../mind/kararKaydi.ts";
import { KuralRefleksi } from "../mind/refleks.ts";
import { KUME } from "../mind/refleksKumesi.ts";
import { KuralHafizasi, type KapiYonu } from "../mind/kuralHafizasi.ts";
import type { Algi } from "../protocol/algi.ts";
import { durumdanAlgi, BAGLAMLAR } from "./ogretmen.ts";
import type { YakalananKomut } from "./kapi-yakala.ts";

const VERI = "brain-lab/data/kapi";

// ── Durum havuzu ─────────────────────────────────────────────────────────────

export interface Durum {
  id: string;
  kaynak: "kume" | "terminal" | "olay" | "sonuc";
  aile: string;
  algi: Algi;
  /** Kümenin insan etiketi (yalnız kümeden gelenlerde). */
  insan?: boolean;
  /** Gerçek köprünün kapı kararı. */
  kapi: KapiKarari;
  /** Gerçek köprünün yazdığı durum kodu. */
  isaret: string[];
}

class SessizBeyin implements Beyin {
  readonly ad = "sessiz";
  async hazirMi() { return true; }
  async dusun(): Promise<BeyinCikti> { return { metin: "", cagrilar: [] }; }
}

/**
 * Bir algının kapı kararı ve durum kodu — GERÇEK köprüden. Her algı için yeni
 * köprü: dikkatin tekrar/kısma/bütçe pencereleri durumlar arasında karışmasın.
 * Öğrenilemezse (güvenlik içgüdüsü ya da kapalı kanal) null.
 */
export function kapiVeKod(a: Algi): { kapi: KapiKarari; isaret: string[] } | null {
  const satirlar: AlgiSatiri[] = [];
  const refleks = new KuralRefleksi();
  const k = new Kopru({
    beyin: new SessizBeyin(), niyetGonder: () => {}, dunyaDurumu: () => "", toplamaMs: 60_000,
    dikkat: { simdi: () => 1_000_000_000 },
    suzgec: (x, ozet) => {
      const r = refleks.karar({ ozet, tur: x.tur, kod: x.tur === "terminal" ? x.kod : undefined });
      return { gecsin: r.terfi, kural: r.kural, gerekce: r.gerekce };
    },
    kararKaydi: new KararKaydi({ yaz: (s) => { const j = JSON.parse(s.slice(KARAR_ONEKI.length + 1)); if (j.tur === "algi") satirlar.push(j); } }),
  });
  k.algi(a);
  k.durdur();
  const s = satirlar[0];
  return s?.isaret ? { kapi: s.kapi, isaret: s.isaret } : null;
}

/** Canlı dünyanın olay adları (world/olayUretici.ts) ve inisiyatifin gerçek cümlesi. */
const OLAYLAR: { aile: string; algi: Algi }[] = [
  { aile: "yaklasma", algi: { tur: "olay", ad: "ozyn_yaklasti", ayrinti: { mesafe: 1.1 } } },
  { aile: "yaklasma", algi: { tur: "olay", ad: "ozyn_yaklasti", ayrinti: { mesafe: 2.6 } } },
  { aile: "yaklasma", algi: { tur: "olay", ad: "ozyn_uzaklasti", ayrinti: { mesafe: 4.8 } } },
  { aile: "bakis", algi: { tur: "olay", ad: "ozyn_sana_bakti" } },
  { aile: "yuzey", algi: { tur: "olay", ad: "ozyn_yuzeye_gecti", ayrinti: { yuzey: "monitor" } } },
  { aile: "yuzey", algi: { tur: "olay", ad: "ozyn_yuzeye_gecti", ayrinti: { yuzey: "tahta" } } },
  { aile: "yuzey", algi: { tur: "olay", ad: "ozyn_yuzeye_gecti", ayrinti: { yuzey: "admin" } } },
  { aile: "yuzey", algi: { tur: "olay", ad: "ozyn_yuzeyden_cikti", ayrinti: { yuzey: "monitor" } } },
  { aile: "inisiyatif", algi: { tur: "olay", ad: "nobody has spoken for 10 minutes — this is your own initiative: say something only if it is useful, otherwise stay silent", ayrinti: { kaynak: "inisiyatif" } } },
  { aile: "inisiyatif", algi: { tur: "olay", ad: "nobody has spoken for 30 minutes — this is your own initiative: say something only if it is useful, otherwise stay silent", ayrinti: { kaynak: "inisiyatif" } } },
];

/** Gerçek niyet sonucu metinleri: world/avatar/yurutucu.ts, world/giris.ts (onay kapısı), gerçek kayıt. */
const SONUCLAR: { aile: string; algi: Algi }[] = [
  { aile: "elle", algi: { tur: "sonuc", sonuc: { niyet_id: "elle_mujgw1q1", durum: "hata", not: "zaten ayaktasın; `kalk` yapacak bir şey yok" } } },
  { aile: "elle", algi: { tur: "sonuc", sonuc: { niyet_id: "elle_mujgx7a2", durum: "hata", not: "zaten oturuyorsun. Önce `kalk` niyeti gönder." } } },
  { aile: "llm", algi: { tur: "sonuc", sonuc: { niyet_id: "n_mujtafb3_3", durum: "hata", not: "bilinmeyen çapa/nesne: 'beyaz tahta'." } } },
  { aile: "llm", algi: { tur: "sonuc", sonuc: { niyet_id: "n_mujtb2k4_1", durum: "hata", not: "bilinmeyen çapa: 'koltuk'. Oturulabilir: sandalye." } } },
  { aile: "llm", algi: { tur: "sonuc", sonuc: { niyet_id: "n_mujtc9d1_2", durum: "hata", not: "zaten oturuyorsun. Önce `kalk` niyeti gönder." } } },
  { aile: "onay", algi: { tur: "sonuc", sonuc: { niyet_id: "n_mujtd0e1_4", durum: "hata", not: "Ozyn komutu reddetti. Israr etme; baska bir yol oner ya da sor." } } },
  { aile: "onay", algi: { tur: "sonuc", sonuc: { niyet_id: "n_mujte1f2_5", durum: "hata", not: "oneri zaman asimina ugradi; Ozyn karar vermedi" } } },
  { aile: "ajanda", algi: { tur: "sonuc", sonuc: { niyet_id: "ajanda_mujtf2g3_2", durum: "hata", not: "zaten oturuyorsun. Önce `kalk` niyeti gönder." } } },
];

export function havuzKur(terminal: YakalananKomut[]): Durum[] {
  const aday: Omit<Durum, "kapi" | "isaret">[] = [];
  for (const [i, d] of KUME.entries()) {
    const a = durumdanAlgi(d);
    if (a) aday.push({ id: `kume${i}`, kaynak: "kume", aile: d.grup, algi: a, insan: d.beklenen });
  }
  for (const [i, t] of terminal.entries()) {
    aday.push({ id: `term${i}`, kaynak: "terminal", aile: t.aile, algi: { tur: "terminal", kuyruk: t.kuyruk, kesildi: false, kod: t.kod } });
  }
  for (const [i, o] of OLAYLAR.entries()) aday.push({ id: `olay${i}`, kaynak: "olay", aile: o.aile, algi: o.algi });
  for (const [i, s] of SONUCLAR.entries()) aday.push({ id: `sonuc${i}`, kaynak: "sonuc", aile: s.aile, algi: s.algi });
  const havuz: Durum[] = [];
  for (const d of aday) {
    const k = kapiVeKod(d.algi);
    if (k) havuz.push({ ...d, ...k });
  }
  return havuz;
}

// ── Motorlar ─────────────────────────────────────────────────────────────────

export interface Motor {
  readonly ad: string;
  /** Emin değilse null: kapı içgüdüye bırakır. */
  karar(isaret: readonly string[]): KapiYonu | null;
  ogren(isaret: readonly string[], yon: KapiYonu, deneyim: string): void;
  /** Hafıza boyutu: nöron, anı ya da sıfırdan farklı ağırlık sayısı. */
  boyut(): number;
}

/** Ortak güven eşiği: her motor aynı çoğunluk payıyla karar verir (adil kıyas). */
export const GUVEN = 0.75;

/** B — büyüyen kural hafızası (mind/kuralHafizasi.ts), varsayılan ayarlar. */
export class KuralMotoru implements Motor {
  readonly ad = "B kural";
  private h = new KuralHafizasi({ guvenPayi: GUVEN });
  karar(i: readonly string[]) { return this.h.karar(i)?.yon ?? null; }
  ogren(i: readonly string[], y: KapiYonu, d: string) { this.h.ogren(i, y, d); }
  boyut() { return this.h.noronlar.length; }
}

/** FNV-1a 32 bit. */
export function ozet32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** mulberry32: tohumlu, belirlenimci. */
export function rastgele(tohum: number): () => number {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A — sinek mantar gövdesi (Shen, Dasgupta ve Navlakha 2021; Dasgupta ve ark. 2017).
 * İşaretler PN'lere karma ile düşer; her Kenyon hücresi 6 rastgele PN'yi dinler;
 * en etkin %5 hücre kodu oluşturur. Öğretmen yalnız ETKİN hücrelerden doğru çıkış
 * nöronuna giden sinapsı güçlendirir (öbürleri donuk). Karar: çıkışların oy payı.
 */
export class MantarMotoru implements Motor {
  readonly ad = "A mantar";
  private static readonly PN = 512;
  private static readonly KC = 2000;
  private static readonly BAG = 6;
  private static readonly AKTIF = 100;
  private girdi: Int32Array;
  private sinaps: Record<KapiYonu, Float64Array>;
  constructor(tohum = 7) {
    const r = rastgele(tohum);
    this.girdi = new Int32Array(MantarMotoru.KC * MantarMotoru.BAG);
    for (let i = 0; i < this.girdi.length; i++) this.girdi[i] = Math.floor(r() * MantarMotoru.PN);
    this.sinaps = { uyan: new Float64Array(MantarMotoru.KC), sus: new Float64Array(MantarMotoru.KC) };
  }
  /** Etkin Kenyon hücreleri: en çok girdisi etkin olan AKTIF hücre (eşitlikte küçük dizin). */
  kod(isaret: readonly string[]): number[] {
    const pn = new Uint8Array(MantarMotoru.PN);
    for (const x of isaret) pn[ozet32(x) % MantarMotoru.PN] = 1;
    const puan: { k: number; p: number }[] = [];
    for (let k = 0; k < MantarMotoru.KC; k++) {
      let p = 0;
      for (let j = 0; j < MantarMotoru.BAG; j++) p += pn[this.girdi[k * MantarMotoru.BAG + j]!]!;
      if (p > 0) puan.push({ k, p });
    }
    puan.sort((a, b) => b.p - a.p || a.k - b.k);
    return puan.slice(0, MantarMotoru.AKTIF).map((x) => x.k);
  }
  karar(i: readonly string[]) {
    let u = 0, s = 0;
    for (const k of this.kod(i)) { u += this.sinaps.uyan[k]!; s += this.sinaps.sus[k]!; }
    if (u + s === 0) return null;
    const pay = Math.max(u, s) / (u + s);
    return pay >= GUVEN ? (u >= s ? "uyan" : "sus") : null;
  }
  ogren(i: readonly string[], y: KapiYonu) { for (const k of this.kod(i)) this.sinaps[y][k]! += 1; }
  boyut() {
    let n = 0;
    for (let k = 0; k < MantarMotoru.KC; k++) n += (this.sinaps.uyan[k]! > 0 ? 1 : 0) + (this.sinaps.sus[k]! > 0 ? 1 : 0);
    return n;
  }
}

/** D — tam anı hafızası: her deneyim saklanır; en benzer anı (Jaccard ≥ 0,5) karar verir. */
export class AniMotoru implements Motor {
  readonly ad = "D anı";
  private anilar: { k: Set<string>; y: KapiYonu }[] = [];
  static readonly ESIK = 0.5;
  karar(i: readonly string[]) {
    const I = new Set(i);
    let en: { j: number; y: KapiYonu } | null = null;
    // Eşitlikte en yeni anı kazanır (sondan başa tarama, yalnız büyükse değiştir).
    for (let n = this.anilar.length - 1; n >= 0; n--) {
      const a = this.anilar[n]!;
      let ortak = 0;
      for (const x of I) if (a.k.has(x)) ortak++;
      const j = ortak / (I.size + a.k.size - ortak);
      if (!en || j > en.j) en = { j, y: a.y };
    }
    return en && en.j >= AniMotoru.ESIK ? en.y : null;
  }
  ogren(i: readonly string[], y: KapiYonu) { this.anilar.push({ k: new Set(i), y }); }
  boyut() { return this.anilar.length; }
}

/** C — çevrimiçi lojistik (Online Cascade Learning'in taban modeli): karma işaretler, SGD. */
export class LojistikMotor implements Motor {
  readonly ad = "C lojistik";
  private static readonly BOYUT = 4096;
  private w = new Float64Array(LojistikMotor.BOYUT);
  private b = 0;
  private static readonly HIZ = 0.5;
  private p(i: readonly string[]): number {
    let z = this.b;
    for (const x of new Set(i.map((t) => ozet32(t) % LojistikMotor.BOYUT))) z += this.w[x]!;
    return 1 / (1 + Math.exp(-z));
  }
  karar(i: readonly string[]) {
    const p = this.p(i);
    return p >= GUVEN ? "uyan" : p <= 1 - GUVEN ? "sus" : null;
  }
  ogren(i: readonly string[], y: KapiYonu) {
    const g = (y === "uyan" ? 1 : 0) - this.p(i);
    for (const x of new Set(i.map((t) => ozet32(t) % LojistikMotor.BOYUT))) this.w[x]! += LojistikMotor.HIZ * g;
    this.b += LojistikMotor.HIZ * g;
  }
  boyut() { let n = 0; for (const v of this.w) if (v !== 0) n++; return n; }
}

/** İçgüdü ikizi: hiç öğrenmez, her kararı içgüdüye bırakır. */
export class IcguduIkizi implements Motor {
  readonly ad = "içgüdü";
  karar() { return null; }
  ogren() {}
  boyut() { return 0; }
}

// ── Akış ─────────────────────────────────────────────────────────────────────

export interface Akis {
  /** Olay sırasıyla durum kimlikleri. */
  olaylar: string[];
  /** Yalnız ikinci yarıda görünen durumlar. */
  yeniler: Set<string>;
}

/**
 * Tekrarlı akış. Durumlar tohumla karıştırılır; sıradaki r'inci durumun ağırlığı
 * 1/r^0,8 (sık olan sık gelir). Her aileden durumların ~%20'si yeni ayrılır.
 */
export function akisKur(havuz: readonly Durum[], tohum: number, n: number): Akis {
  const r = rastgele(tohum);
  const karisik = [...havuz].map((d) => ({ d, s: r() })).sort((a, b) => a.s - b.s).map((x) => x.d);
  const aileler = new Map<string, Durum[]>();
  for (const d of karisik) { const k = `${d.kaynak}/${d.aile}`; aileler.set(k, [...(aileler.get(k) ?? []), d]); }
  const yeniler = new Set<string>();
  for (const liste of aileler.values()) {
    const kac = Math.floor(liste.length * 0.2);
    for (const d of liste.slice(0, kac)) yeniler.add(d.id);
  }
  const agirlik = karisik.map((_, i) => 1 / Math.pow(i + 1, 0.8));
  const cek = (izinli: (d: Durum) => boolean): string => {
    let top = 0;
    for (const [i, d] of karisik.entries()) if (izinli(d)) top += agirlik[i]!;
    let x = r() * top;
    for (const [i, d] of karisik.entries()) {
      if (!izinli(d)) continue;
      x -= agirlik[i]!;
      if (x <= 0) return d.id;
    }
    return karisik.filter(izinli).at(-1)!.id;
  };
  const olaylar: string[] = [];
  for (let t = 0; t < n; t++) olaylar.push(t < n / 2 ? cek((d) => !yeniler.has(d.id)) : cek(() => true));
  return { olaylar, yeniler };
}

// ── Ölçüm ────────────────────────────────────────────────────────────────────

export type Etiketler = Record<string, boolean | null | undefined>;

export interface Olcum {
  motor: string;
  /** Etiketli olay sayısı. */
  n: number;
  dogru: number;
  /** Karar uyan, öğretmen sus. */
  bosa: number;
  /** Karar sus, öğretmen uyan. */
  kacir: number;
  /** İkinci görülüşte (tam bir ders almışken) doğru / toplam. */
  ikinciDogru: number;
  ikinciN: number;
  /** Yeni durumların ilk görülüşünde motorun KENDİ kararı: kaç tanesine karar verdi, kaçı doğru. */
  yeniN: number;
  yeniKarar: number;
  yeniDogru: number;
  /** Akışın ilk %25'inde görülen durumlara akış sonunda motorun kararı: karar verdi / doğru. */
  akilN: number;
  akilKarar: number;
  akilDogru: number;
  boyut: number;
}

/** Sahte motorlar yalnız ölçünün kalibrasyonu için: hep uyan, hep sus, kâhin. */
export type Politika = Motor | "hep-uyan" | "hep-sus" | "kahin";

/**
 * SIRALI ölçüm: her olayda önce karar (motor emin değilse içgüdü), sonra ders.
 * Etiketi olmayan olay ne ölçülür ne öğretilir.
 */
export function olc(politika: Politika, akis: Akis, havuz: readonly Durum[], etiket: Etiketler): Olcum {
  const bul = new Map(havuz.map((d) => [d.id, d]));
  const motor = typeof politika === "string" ? null : politika;
  const ad = typeof politika === "string" ? politika : politika.ad;
  const o: Olcum = { motor: ad, n: 0, dogru: 0, bosa: 0, kacir: 0, ikinciDogru: 0, ikinciN: 0, yeniN: 0, yeniKarar: 0, yeniDogru: 0, akilN: 0, akilKarar: 0, akilDogru: 0, boyut: 0 };
  const gorulme = new Map<string, number>();
  const ilkCeyrek = new Set<string>();
  for (const [t, id] of akis.olaylar.entries()) {
    const d = bul.get(id)!;
    const e = etiket[id];
    const kacinci = (gorulme.get(id) ?? 0) + 1;
    gorulme.set(id, kacinci);
    if (t < akis.olaylar.length / 4) ilkCeyrek.add(id);
    if (e === null || e === undefined) continue;
    const dogruYon: KapiYonu = e ? "uyan" : "sus";
    const icgudu: KapiYonu = d.kapi.gecti ? "uyan" : "sus";
    const ogrenilen = motor ? motor.karar(d.isaret) : null;
    const son: KapiYonu = politika === "hep-uyan" ? "uyan" : politika === "hep-sus" ? "sus" : politika === "kahin" ? dogruYon : (ogrenilen ?? icgudu);
    o.n++;
    if (son === dogruYon) o.dogru++;
    else if (son === "uyan") o.bosa++;
    else o.kacir++;
    if (kacinci === 2) { o.ikinciN++; if (son === dogruYon) o.ikinciDogru++; }
    if (kacinci === 1 && akis.yeniler.has(id)) {
      o.yeniN++;
      if (ogrenilen !== null) { o.yeniKarar++; if (ogrenilen === dogruYon) o.yeniDogru++; }
    }
    motor?.ogren(d.isaret, dogruYon, `${id}#${t}`);
  }
  if (motor) {
    for (const id of ilkCeyrek) {
      const e = etiket[id];
      if (e === null || e === undefined) continue;
      o.akilN++;
      const k = motor.karar(bul.get(id)!.isaret);
      if (k !== null) { o.akilKarar++; if (k === (e ? "uyan" : "sus")) o.akilDogru++; }
    }
    o.boyut = motor.boyut();
  }
  return o;
}

/** Etiketleri durumlar arasında karıştırır (tohumlu): tutarlı ama yapısız öğretmen. */
export function karistir(etiket: Etiketler, havuz: readonly Durum[], tohum: number): Etiketler {
  const idler = havuz.map((d) => d.id).filter((id) => etiket[id] !== null && etiket[id] !== undefined);
  const r = rastgele(tohum);
  const degerler = idler.map((id) => etiket[id]).map((v) => ({ v, s: r() })).sort((a, b) => a.s - b.s).map((x) => x.v);
  const out: Etiketler = {};
  idler.forEach((id, i) => { out[id] = degerler[i]; });
  return out;
}

// ── Komut satırı ─────────────────────────────────────────────────────────────

function arg(ad: string, varsayilan: string): string {
  const p = process.argv.find((a) => a.startsWith(`--${ad}=`));
  return p ? p.slice(ad.length + 3) : varsayilan;
}

function havuzYukle(): Durum[] {
  return JSON.parse(fs.readFileSync(`${VERI}/havuz.json`, "utf8")) as Durum[];
}

async function calistir(): Promise<void> {
  const komut = process.argv[2];
  if (komut === "havuz") {
    const terminal = JSON.parse(fs.readFileSync(`${VERI}/terminal.json`, "utf8")) as YakalananKomut[];
    const havuz = havuzKur(terminal);
    fs.writeFileSync(`${VERI}/havuz.json`, JSON.stringify(havuz, null, 1));
    const say = (f: (d: Durum) => boolean) => havuz.filter(f).length;
    console.log(`havuz: ${havuz.length} öğrenilebilir durum (küme ${say((d) => d.kaynak === "kume")}, terminal ${say((d) => d.kaynak === "terminal")}, olay ${say((d) => d.kaynak === "olay")}, sonuç ${say((d) => d.kaynak === "sonuc")}); içgüdü geçirdi ${say((d) => d.kapi.gecti)}`);
    return;
  }
  if (komut === "etiketle") {
    const { hakemSor } = await import("./hakem.ts");
    const ogretmen = arg("ogretmen", "qwen");
    const baglam = arg("baglam", "masada") as keyof typeof BAGLAMLAR;
    const [arka, model] = ogretmen === "haiku" ? ["claude", "haiku"] as const : ["ollama", "qwen2.5:7b"] as const;
    const havuz = havuzYukle();
    const etiket: Etiketler = {};
    for (const d of havuz) {
      const c = await hakemSor(arka, model, d.algi, BAGLAMLAR[baglam]);
      etiket[d.id] = c.karar;
      process.stdout.write(c.karar === null ? "?" : c.karar ? "E" : "h");
    }
    const dosya = `${VERI}/etiket-${ogretmen}-${baglam}.json`;
    fs.writeFileSync(dosya, JSON.stringify(etiket, null, 1));
    const v = Object.values(etiket);
    console.log(`\n${dosya}: evet ${v.filter((x) => x === true).length} · hayır ${v.filter((x) => x === false).length} · anlaşılmayan ${v.filter((x) => x === null).length}`);
    return;
  }
  if (komut === "kos") {
    const havuz = havuzYukle();
    const tohumlar = arg("tohumlar", "1,2,3,4,5").split(",").map(Number);
    const n = Number(arg("olay", "400"));
    const ogretmenler: [string, Etiketler][] = [];
    const insan: Etiketler = {};
    for (const d of havuz) if (d.insan !== undefined) insan[d.id] = d.insan;
    ogretmenler.push(["insan (küme)", insan]);
    for (const f of fs.readdirSync(VERI).filter((f) => f.startsWith("etiket-") && f.endsWith(".json")).sort()) {
      ogretmenler.push([f.slice(7, -5), JSON.parse(fs.readFileSync(`${VERI}/${f}`, "utf8")) as Etiketler]);
    }
    const motorlar = (): Politika[] => [new IcguduIkizi(), new KuralMotoru(), new MantarMotoru(), new AniMotoru(), new LojistikMotor(), "kahin"];
    const sonuc: Record<string, unknown>[] = [];
    for (const [ad, etiket] of ogretmenler) {
      for (const karisik of [false, true]) {
        const toplam = new Map<string, Olcum>();
        for (const tohum of tohumlar) {
          const akis = akisKur(havuz, tohum, n);
          const e = karisik ? karistir(etiket, havuz, 1000 + tohum) : etiket;
          for (const m of motorlar()) {
            const o = olc(m, akis, havuz, e);
            const t = toplam.get(o.motor);
            if (!t) toplam.set(o.motor, { ...o });
            else for (const k of Object.keys(o) as (keyof Olcum)[]) if (k !== "motor") (t[k] as number) += o[k] as number;
          }
        }
        console.log(`\n== öğretmen: ${ad}${karisik ? " (KARIŞTIRILMIŞ)" : ""} — ${tohumlar.length} tohum × ${n} olay`);
        console.log("motor        doğru   boşa  kaçır  ikinci  yeni(karar/doğru)  akıl(karar/doğru)  boyut");
        for (const o of toplam.values()) {
          const y = (a: number, b: number) => (b === 0 ? "  —  " : `${(100 * a / b).toFixed(0).padStart(3)}%`);
          console.log(`${o.motor.padEnd(12)} ${y(o.dogru, o.n)}  ${String(o.bosa).padStart(5)}  ${String(o.kacir).padStart(5)}  ${y(o.ikinciDogru, o.ikinciN)}   ${y(o.yeniKarar, o.yeniN)} / ${y(o.yeniDogru, o.yeniKarar)}      ${y(o.akilKarar, o.akilN)} / ${y(o.akilDogru, o.akilKarar)}   ${Math.round(o.boyut / tohumlar.length)}`);
          sonuc.push({ ogretmen: ad, karisik, ...o, tohum: tohumlar.length });
        }
      }
    }
    fs.writeFileSync(`${VERI}/sonuc.json`, JSON.stringify(sonuc, null, 1));
    console.log(`\nyazıldı: ${VERI}/sonuc.json`);
    return;
  }
  console.error("kullanım: kapi-deney.ts havuz | etiketle --ogretmen=qwen|haiku --baglam=masada|uzakta | kos [--tohumlar=1,2,3,4,5] [--olay=400]");
  process.exit(2);
}

if (import.meta.main) await calistir();
