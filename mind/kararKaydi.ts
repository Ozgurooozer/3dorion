// mind/kararKaydi.ts — KARAR KAYDI: Orion'un her kararı ve sonucu, tek zincir.
//
// İÇGÜDÜ `kayit` (mind/icgudu.ts): doğuştan gelir, davranışı değiştirmez,
// yazılamazsa Orion yine çalışır. Köprü kendi kaydını kendisi kurar; kimse
// açmak zorunda değildir (Ozyn, 2026-09-27: "kaydı içgüdü kuralları olarak,
// doğuştan gelen kurallar olarak ekle").
//
// NEDEN VAR (brain-lab/BUYUK-RESIM.md, KT1). Hedef, Orion'un LLM'inin
// etrafında deneyimden öğrenen bir karar mekanizması. Öğrenmenin verisi
// yoktu: `ORION_KAYIT` yalnızca LLM'in girdisini ve çıktısını tutuyor. Hangi
// algının kapıda düştüğü, hangi kuralın düşürdüğü, LLM uyandığında ne yaptığı
// ve yaptığının nasıl bittiği hiçbir yerde BİRLİKTE durmuyordu. Orion'un kendi
// dersi de bu yönde: kural süzgeci elle yazılmış sınavda %100 aldı, gerçek
// terminalde tek bir `npm test` beyni 11 kez uyandırdı (spec 01). Elle
// yazılmış sınav yetmiyor; gerçek kayıt gerekiyor.
//
// ZİNCİR — her halka bir öncekine kimlikle bağlanır:
//   algı (a…)  → kapı kararı: geçti mi, hangi içgüdü karar verdi
//   uyanış (u…) → hangi algılar tetikledi, LLM ne yaptı, ne kadar sürdü
//   niyet (protokol kimliği) → uyanış satırında listelenir
//   sonuç algısı → `niyet` alanıyla geri bağlanır (onay kapısının evet/hayırı da)
//   Ozyn'in tepkisi → uyanıştan sonraki ilk `duydum` (çözümleme aracı bağlar)
//   öğretim (Ozyn) → `hedef` alanıyla bir algıya bağlanır: o kararın doğrusu
//
// ÖĞRENEN KAPI (toplantı 2026-09-27): ezilebilir bir içgüdünün karar verdiği
// algıda satır, öğrenen kapının gördüğü durum kodunu (`isaret`) ve onun
// uygulanmayan kararını (`golge`) da taşır.
//
// BİÇİM: satır başına bir JSON (JSONL), `[KARAR] ` önekiyle yazıcıya verilir.
// Renderer'ın dosya erişimi yok; varsayılan yazıcı konsoldur ve host o
// satırları günlük dosyasına ekler (host/kararDosyasi.js). `KayitBeyni` ile
// aynı desen, yeni bir IPC yüzeyi açmadan.
//
// SINIRLAR (bilerek): tam LLM girdisi yok (o `ORION_KAYIT`'ın işi); metinler
// kesilir ve kesildiği `kesik` ile söylenir; tik hiç yazılmaz.
//
// Bağımlılık: protocol/ ve mind/icgudu.ts. Babylon yok, Electron yok, dosya yok.
"use strict";
import type { Algi, AlgiTur } from "../protocol/algi.ts";
import type { NiyetSonucu, NiyetTur } from "../protocol/niyet.ts";
import { kimlik } from "../protocol/temel.ts";
import type { IcguduKimligi } from "./icgudu.ts";
import type { KapiYonu } from "./kuralHafizasi.ts";

/** Satır öneki. Host bu öneki arar — kopyası host/kararDosyasi.js'te, eşitliği testli. */
export const KARAR_ONEKI = "[KARAR]";
/** Biçim sürümü. Alan eklemek sürümü değiştirmez; alan silmek ya da anlamını değiştirmek değiştirir. */
export const KARAR_SURUMU = 1;

/** Metin sınırları (karakter). Aşan metin baştan ve sondan korunarak kesilir. */
export const SINIR = { ozet: 500, dunya: 400, metin: 300 } as const;

/** Kapının bir algı için verdiği karar ve kararı veren içgüdü. */
export interface KapiKarari {
  gecti: boolean;
  kural: IcguduKimligi;
  /** Kuralın düzyazı gerekçesi (ör. çıkış kodu). Yalnızca tanılama. */
  gerekce?: string;
}

export interface AlgiSatiri {
  tur: "algi";
  o: string; id: string; t: number;
  algi: AlgiTur;
  ozet: string;
  kesik?: true;
  /** terminal: çıkış kodu. */
  kod?: number;
  /** olay: olay adı. */
  olay?: string;
  /** olay: kaynağı (ör. "inisiyatif") — kendiliğinden düşünme fırsatı dış tetikten ayrılsın. */
  kaynak?: string;
  /** sonuc: hangi niyetin akıbeti — uyanışın `niyetler` listesine geri bağ. */
  niyet?: string;
  durum?: NiyetSonucu["durum"];
  kapi: KapiKarari;
  /**
   * Öğrenen kapının gördüğü DURUM KODU (mind/durumKodu.ts). Yalnızca kararı
   * ezilebilir bir içgüdünün verdiği algılarda: öğrenilecek olanlar bunlar.
   * Öğretim satırı bunu kopyalar; hafıza kayıttan birebir yeniden kurulur.
   */
  isaret?: string[];
  /**
   * GÖLGE KARAR (toplantı 2026-09-27 K3): öğrenen kapı ne derdi? Uygulanmaz.
   * null = hafızada emin bir kural yok. Alan yoksa algı öğrenilebilir değil.
   */
  golge?: GolgeKarari | null;
}

/** Kural hafızasının bir algı için verdiği (uygulanmayan) karar. */
export interface GolgeKarari {
  yon: KapiYonu;
  /** Kararı veren hafıza nöronu ("K3"). */
  noron: string;
  /** Nöronun sayacındaki çoğunluk payı. */
  pay: number;
}

/**
 * ÖĞRETİM: bir kapı kararının doğrusu, öğretmenden (toplantı 2026-09-27 K1).
 *
 * Kendi başına yeter: hedef algının durum kodunu taşır. Kural hafızası yalnızca
 * öğretim satırlarından, sırayla, birebir yeniden kurulur (K5) — algı satırının
 * bulunduğu dosya silinse bile.
 */
export interface OgretimSatiri {
  tur: "ogretim";
  /** Öğretimin yazıldığı oturum (araç ya da Orion). */
  o: string;
  t: number;
  /** Düzeltilen algı: oturumu ve kimliği. */
  hedef: { o: string; id: string };
  /** Doğru karar. */
  yon: KapiYonu;
  kaynak: "ozyn";
  /** Hedef algının durum kodu (algı satırındaki `isaret`in kopyası). */
  isaret: string[];
}

export interface UyanisSatiri {
  tur: "uyanis";
  o: string; id: string; t: number;
  /** Bu turu tetikleyen algıların kimlikleri (tampondaki sırayla). */
  algilar: string[];
  /** Tampondaki algı olmayan geri beslemeler (ör. reddedilen araç çağrısı). */
  geriBesleme: number;
  beyin: string;
  sureMs: number;
  /** Zincirin kökeni: dış tetik mi, kendiliğinden düşünme mi. */
  koken: "dis" | "inisiyatif";
  /** Yalnızca bakış cevaplarından oluşan takip turu mu. */
  takip: boolean;
  /** Getirilen anı sayısı. */
  anilar: number;
  /** Beynin zemini: dünya durumu + çalışma belleği (kesilmiş). */
  dunya: string;
  /** LLM'in düz metni (varsa, kesilmiş). */
  metin?: string;
  /** LLM'in çağırdığı araçların adları (geçersizler dahil). */
  cagrilar: string[];
  /** Dünyaya giden niyetler: protokol kimliği ve türü. */
  niyetler: { id: string; tur: NiyetTur }[];
  /** Protokol doğrulamasından geçemeyen çağrı sayısı. */
  reddedilen: number;
  /** Düz metnin içinden kurtarılıp niyete çevrilen çağrı sayısı. */
  kurtarilan: number;
  /** Araç çağrılmadığı için konuşmaya çevrilen temiz metin oldu mu. */
  konusulanMetin: boolean;
  /** Söz geçidinin yuttuğu `soyle` sayısı (ör. inisiyatifte susma ilanı). */
  yutulanSoz: number;
  /** Beyin hatası (varsa). */
  hata?: string;
}

export interface OturumSatiri {
  tur: "oturum";
  surum: number;
  o: string; t: number;
  beyin: string;
}

export type KararSatiri = OturumSatiri | AlgiSatiri | UyanisSatiri | OgretimSatiri;

/** Algı satırına öğrenen kapıdan gelen ekler. */
export interface AlgiEki {
  isaret?: string[];
  golge?: GolgeKarari | null;
}

/** Uyanış satırında köprünün doldurduğu alanlar (kimlik ve zaman kayıttan gelir). */
export type UyanisBilgisi = Omit<UyanisSatiri, "tur" | "o" | "id" | "t">;

export interface KararKaydiAyari {
  /** Tam satırı (önek dahil) nereye yazalım. Varsayılan: `console.log`. */
  yaz?: (satir: string) => void;
  simdi?: () => number;
  /** Oturum kimliği. Varsayılan: yeni bir `kimlik("o")`. */
  oturum?: string;
}

/**
 * Metni sınıra indirir; baş ve son korunur.
 *
 * Neden ikisi: terminal kuyruğunda asıl bilgi SONDA (hata satırı, test
 * özeti), özetin anlamı ise BAŞTA (kimin terminali, çıkış kodu). Yalnızca
 * baştan kesmek hatayı, yalnızca sondan kesmek bağlamı kaybeder.
 */
export function kisalt(metin: string, sinir: number): { metin: string; kesik: boolean } {
  if (metin.length <= sinir) return { metin, kesik: false };
  const bas = Math.floor(sinir * 0.3);
  const son = sinir - bas - 1;
  return { metin: `${metin.slice(0, bas)}…${metin.slice(metin.length - son)}`, kesik: true };
}

export class KararKaydi {
  readonly oturum: string;
  private _yaz: (s: string) => void;
  private _simdi: () => number;
  private _algiSira = 0;
  private _uyanisSira = 0;
  private _yazilamayan = 0;

  constructor(ayar: KararKaydiAyari = {}) {
    this.oturum = ayar.oturum ?? kimlik("o");
    this._yaz = ayar.yaz ?? ((s) => console.log(s));
    this._simdi = ayar.simdi ?? (() => Date.now());
  }

  /** Kaydın yazılamadığı satır sayısı — kayıp sessiz olmasın. */
  get yazilamayan(): number { return this._yazilamayan; }

  /** Oturumun ilk satırı: biçim sürümü ve beyin. */
  oturumBasi(beyin: string): void {
    this._dus({ tur: "oturum", surum: KARAR_SURUMU, o: this.oturum, t: this._simdi(), beyin });
  }

  /** Bir algıyı ve kapının onun için verdiği kararı yazar. Algı kimliğini döner. */
  algi(a: Algi, ozet: string, kapi: KapiKarari, ek: AlgiEki = {}): string {
    const id = `a${++this._algiSira}`;
    const k = kisalt(ozet, SINIR.ozet);
    const satir: AlgiSatiri = { tur: "algi", o: this.oturum, id, t: this._simdi(), algi: a.tur, ozet: k.metin, kapi };
    if (k.kesik) satir.kesik = true;
    if (ek.isaret) satir.isaret = ek.isaret;
    if (ek.golge !== undefined) satir.golge = ek.golge;
    switch (a.tur) {
      case "terminal":
        if (a.kod !== undefined) satir.kod = a.kod;
        break;
      case "olay": {
        satir.olay = a.ad;
        const kaynak = a.ayrinti?.kaynak;
        if (typeof kaynak === "string") satir.kaynak = kaynak;
        break;
      }
      case "sonuc":
        satir.niyet = a.sonuc.niyet_id;
        satir.durum = a.sonuc.durum;
        break;
    }
    this._dus(satir);
    return id;
  }

  /** Öğretmenin bir kapı kararını düzeltmesini yazar (toplantı 2026-09-27 K1). */
  ogretim(hedef: { o: string; id: string }, yon: KapiYonu, isaret: string[]): OgretimSatiri {
    const satir: OgretimSatiri = { tur: "ogretim", o: this.oturum, t: this._simdi(), hedef, yon, kaynak: "ozyn", isaret };
    this._dus(satir);
    return satir;
  }

  /** Bir beyin turunu (uyanışı) ve LLM'in ne yaptığını yazar. Uyanış kimliğini döner. */
  uyanis(b: UyanisBilgisi): string {
    const id = `u${++this._uyanisSira}`;
    const { metin, dunya, ...geri } = b;
    const satir: UyanisSatiri = {
      tur: "uyanis", o: this.oturum, id, t: this._simdi(),
      ...geri,
      dunya: kisalt(dunya, SINIR.dunya).metin,
    };
    if (metin) satir.metin = kisalt(metin, SINIR.metin).metin;
    this._dus(satir);
    return id;
  }

  private _dus(satir: KararSatiri): void {
    let json: string;
    try {
      json = JSON.stringify(satir);
    } catch {
      this._yazilamayan++;
      return;
    }
    // Kayıt kararı ASLA bozmaz: yazıcı patlarsa satır kaybolur ama sayılır.
    try { this._yaz(`${KARAR_ONEKI} ${json}`); }
    catch { this._yazilamayan++; }
  }
}
