// tools/beceri-deney.ts — BECERİ REFLEKSİ ÇEVRİMDIŞI ÖLÇÜMÜ (spec 10 Faz B, ölçüt B9).
//
// Soru: Ozyn'in gerçek kullanımında, bir kez başarılan görevden doğan beceri sonraki
// görevlerin kaçını karşılardı (KAPSAM), karşıladığında LLM'in yaptığıyla aynı adımları
// mı verirdi (UYUM), refleks açık olsaydı kaç uyanış ve ne kadar düşünme süresi
// kazanılırdı (KAZANÇ)? Davranış değişmez: araç yalnız kaydı okur.
//
// SIRALI ÖLÇÜM: görevler zaman sırasıyla; her görevde önce karar (o ana kadarki
// hafızayla), sonra öğrenme. Hafıza kendi cevabını görmeden karar verir; bir görevin
// ilk söylenişi hiçbir zaman eşleşmez.
//
// UYUM KATI: becerinin yeni çapalarla doldurulmuş adımları, LLM'in bedensel adımlarıyla
// birebir aynı olmalı (gövde eşitliği). Başka ama yine başarılı bir plan uyumsuz sayılır:
// v1 eşleşmesi katı, ölçüsü de katı.
//
// ÖLÇÜYE GİREN: yalnız LLM'in planladığı görevler. Refleksin kendi yürütümü (Faz D)
// hafızayı besler ama ölçülmez: bir beceri kendini doğrulayamaz.
//
// KALİBRASYON (Themis 1.1, tools/beceri-deney.test.ts): ölçü, cevabı bilinen
// politikalarda sınanır — taban "hic" (hiç eşleşmez), tavan "kahin" (her görevde LLM'in
// adımları), alışkanlık (her görevde aynı sabit adımlar).
//
// Kullanım:
//   node --experimental-strip-types tools/beceri-deney.ts [dosya|klasör …] [--json]
// Argüman yoksa gerçek kullanımın kaydı okunur: %APPDATA%/3dorion/karar-kaydi.
"use strict";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { BeceriHafizasi } from "../mind/beceriHafizasi.ts";
import { gorevler, niyetSinifi, zamanSirali, type GorevOrnegi, type GorevSonucu } from "../mind/gorev.ts";
import { zincirKur } from "../mind/kararZinciri.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { dosyalardanOku } from "./karar-ozet.ts";

/** Ölçülen politika: gerçek beceri hafızası ya da kalibrasyon için cevabı bilinen sahteler. */
export type Politika = BeceriHafizasi | "hic" | "kahin" | { aliskanlik: Niyet[] };

export interface Eslesme {
  /** Görevin kayıttaki kimliği (`oturum/uyanış`). */
  gorev: string;
  soz: string;
  /** Eşleşen becerinin kimliği; sahte politikada yok. */
  beceri?: string;
  /** Becerinin adımları LLM'inkilerle birebir aynı mı. */
  uyum: boolean;
  /** LLM'in o görevde verdiği eşlik niyetleri (söz, sorgu): refleks bunları yapmazdı. */
  eslik: number;
  /** LLM'in o görevdeki yürütümü nasıl bitti. */
  sonuc: GorevSonucu;
}

export interface BeceriOlcumu {
  /** Ölçülen görev (LLM'in planladığı): kapsamın paydası. */
  gorev: number;
  /** Karar anında parametre içinde eşleşen beceri vardı. */
  eslesen: number;
  /** Eşleşenlerden adımları LLM'in adımlarıyla birebir aynı olanlar: uyumun payı. */
  uyumlu: number;
  /** Eşleşen görevlerde LLM'in düşünme süresi toplamı (ms): refleks bu kadar kazandırırdı. */
  kazancMs: number;
  /** Eşleşmelerin önerdiği adımlardan bedensel olmayanlar. Faz D barı: 0. */
  guvensizAdim: number;
  /**
   * Eşleşen görevlerden LLM'in ayrıca konuştuğu ya da sorduğu: uyum yalnız bedensel
   * adımlara bakar, refleks ise sessizdir. Bu sayı, uyumun göremediği farkı gösterir.
   */
  eslikli: number;
  /** Eşleşen görevlerde LLM'in kendi yürütümünün sonucu. */
  eslesenSonuc: Record<GorevSonucu, number>;
  /** Ölçü sonunda hafızadaki beceri sayısı (sahte politikada 0). */
  beceri: number;
  eslesmeler: Eslesme[];
}

/** Politikanın bu görev için önerdiği adımlar; eşleşme yoksa null. */
function oneri(p: Politika, g: GorevOrnegi): { adimlar: Niyet[]; beceri?: string } | null {
  if (p === "hic") return null;
  if (p === "kahin") return { adimlar: g.adimlar.map((a) => a.govde) };
  if ("aliskanlik" in p) return { adimlar: p.aliskanlik };
  // Gerçek hafıza görevin yalnız sözünü görür: cevabı (adımlar) ona hiç verilmez.
  const e = p.karar(g.soz);
  return e && { adimlar: e.adimlar, beceri: e.beceri.id };
}

/** Sıralı ölçüm: her görevde önce karar, sonra öğrenme (yalnız gerçek hafıza öğrenir). */
export function olc(p: Politika, liste: readonly GorevOrnegi[]): BeceriOlcumu {
  const hafiza = p instanceof BeceriHafizasi ? p : null;
  const o: BeceriOlcumu = {
    gorev: 0, eslesen: 0, uyumlu: 0, kazancMs: 0, guvensizAdim: 0, eslikli: 0,
    eslesenSonuc: { basari: 0, hata: 0, belirsiz: 0 }, beceri: 0, eslesmeler: [],
  };
  for (const g of zamanSirali(liste)) {
    if (g.kaynak === "uyanis") {
      o.gorev++;
      const e = oneri(p, g);
      if (e) {
        const uyum = isDeepStrictEqual(e.adimlar, g.adimlar.map((a) => a.govde));
        o.eslesen++;
        if (uyum) o.uyumlu++;
        o.kazancMs += g.sureMs;
        o.guvensizAdim += e.adimlar.filter((n) => niyetSinifi(n.tur) !== "bedensel").length;
        if (g.eslik > 0) o.eslikli++;
        o.eslesenSonuc[g.sonuc]++;
        o.eslesmeler.push({ gorev: g.kimlik, soz: g.soz, ...(e.beceri ? { beceri: e.beceri } : {}), uyum, eslik: g.eslik, sonuc: g.sonuc });
      }
    }
    hafiza?.ogren(g);
  }
  o.beceri = hafiza?.beceriler.length ?? 0;
  return o;
}

export interface KayitOlcumu {
  dosyalar: string[];
  bozuk: number;
  /** Kayıttaki bütün uyanışlar: kazancın kıyaslanacağı toplam. */
  uyanis: number;
  /** Bütün uyanışların düşünme süresi toplamı (ms). */
  uyanisMs: number;
  olcum: BeceriOlcumu;
}

/** Kayıt dosyalarından (ya da klasörlerinden) görevleri çıkarır ve gerçek hafızayla ölçer. */
export function kayittanOlc(yollar: string[]): KayitOlcumu {
  const { satirlar, bozuk, dosyalar } = dosyalardanOku(yollar);
  const z = zincirKur(satirlar, bozuk);
  return {
    dosyalar, bozuk,
    uyanis: z.uyanislar.length,
    uyanisMs: z.uyanislar.reduce((s, u) => s + u.uyanis.sureMs, 0),
    olcum: olc(new BeceriHafizasi(), gorevler(z)),
  };
}

const oran = (pay: number, payda: number): string => (payda === 0 ? "—" : `%${Math.round((100 * pay) / payda)}`);
const sn = (ms: number): string => `${(ms / 1000).toFixed(1).replace(".", ",")} sn`;

function yazdir(r: KayitOlcumu): void {
  const o = r.olcum;
  const p = (s = "") => console.log(s);
  p(`Beceri refleksi ölçümü — ${r.dosyalar.length} dosya, ${r.uyanis} uyanış, ${o.gorev} görev${r.bozuk ? `, ${r.bozuk} bozuk satır` : ""}`);
  p();
  p("| ölçü | değer | anlamı | Faz D taslak barı |");
  p("|---|---|---|---|");
  p(`| kapsam | ${o.eslesen}/${o.gorev} (${oran(o.eslesen, o.gorev)}) | görevlerin kaçında parametre içinde bir beceri eşleşirdi | en az 20 eşleşme |`);
  p(`| uyum | ${o.uyumlu}/${o.eslesen} (${oran(o.uyumlu, o.eslesen)}) | eşleşenlerde becerinin adımları LLM'in yaptığıyla birebir aynı | en az %90 |`);
  p(`| kazanç | ${o.eslesen} uyanış, ${sn(o.kazancMs)} | refleks açık olsaydı LLM'e gidilmeyecek uyanış ve düşünme süresi (bütün uyanışlar: ${r.uyanis}, ${sn(r.uyanisMs)}) | — |`);
  p(`| güvensiz adım | ${o.guvensizAdim} | eşleşmelerin önerdiği bedensel olmayan adım | 0 |`);
  p(`| LLM ayrıca konuştu | ${o.eslikli}/${o.eslesen} | eşleşen görevde LLM söz ya da sorgu da verdi; refleks orada sessiz kalırdı (uyum bunu görmez) | — |`);
  p(`| beceri | ${o.beceri} | ölçü sonunda hafızadaki beceri | — |`);
  p(`| LLM'in sonucu (eşleşenlerde) | başarı ${o.eslesenSonuc.basari}, hata ${o.eslesenSonuc.hata}, belirsiz ${o.eslesenSonuc.belirsiz} | eşleşen görevi LLM kendisi yaparken nasıl bitti | — |`);
  if (o.eslesmeler.length === 0) return;
  p();
  p("Eşleşmeler:");
  p("| görev | söz | beceri | uyum | LLM'in eşliği | LLM'in sonucu |");
  p("|---|---|---|---|---:|---|");
  for (const e of o.eslesmeler) p(`| ${e.gorev} | ${e.soz} | ${e.beceri ?? "—"} | ${e.uyum ? "evet" : "HAYIR"} | ${e.eslik} | ${e.sonuc} |`);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const yollar = argv.filter((a) => a !== "--json");
  const varsayilan = path.join(process.env.APPDATA ?? "", "3dorion", "karar-kaydi");
  const r = kayittanOlc(yollar.length ? yollar : [varsayilan]);
  if (r.dosyalar.length === 0) {
    console.error(`kayıt dosyası yok: ${(yollar.length ? yollar : [varsayilan]).join(", ")}`);
    process.exit(1);
  }
  if (json) console.log(JSON.stringify(r, null, 2));
  else yazdir(r);
}
