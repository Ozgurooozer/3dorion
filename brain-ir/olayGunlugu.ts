// brain-ir/olayGunlugu.ts — Brain IR'ın olay kaydı ve numaralı hafıza kapısı.
//
// Kaynak kayıt olay günlüğüdür. Hafıza yalnızca bu günlüğün ilgili kayıtları
// seçen izdüşümüdür; tam olay özel numarasıyla tekrar çağrılır.
"use strict";
import { Hafiza, type Ani, type AniTuru, type HafizaAyari } from "../mind/hafiza.ts";

export type OlayTuru = "beyin_cagrisi" | "beyin_aksiyonu" | "beyin_hatasi";

export interface Olay {
  id: string;
  sira: number;
  zaman: number;
  tur: OlayTuru;
  metin: string;
  veri: Record<string, unknown>;
}

export interface OlayGirdisi {
  tur: OlayTuru;
  metin: string;
  veri?: Record<string, unknown>;
  zaman?: number;
}

export interface OlayGunlugu {
  kaydet(girdi: OlayGirdisi): Olay;
  cagir(id: string): Olay | null;
  ara(sorgu: string, limit?: number): Olay[];
  dok(): Olay[];
}

export interface OlayDefteriAyari {
  simdi?: () => number;
  kayitlar?: readonly unknown[];
}

function iddenSira(id: unknown): number {
  if (typeof id !== "string") return 0;
  const eslesme = /^OLY-(\d{8})$/.exec(id);
  return eslesme ? Number(eslesme[1]) : 0;
}

function olayiTemizle(ham: unknown, simdi: number): Olay | null {
  if (!ham || typeof ham !== "object") return null;
  const x = ham as Partial<Olay>;
  const sira = typeof x.sira === "number" && Number.isInteger(x.sira) && x.sira > 0
    ? x.sira : iddenSira(x.id);
  if (sira <= 0 || typeof x.id !== "string" || !/^OLY-\d{8}$/.test(x.id)) return null;
  if (x.tur !== "beyin_cagrisi" && x.tur !== "beyin_aksiyonu" && x.tur !== "beyin_hatasi") return null;
  if (typeof x.metin !== "string" || !x.metin.trim()) return null;
  return {
    id: x.id,
    sira,
    zaman: typeof x.zaman === "number" && Number.isFinite(x.zaman) ? x.zaman : simdi,
    tur: x.tur,
    metin: x.metin,
    veri: x.veri && typeof x.veri === "object" ? { ...x.veri } : {},
  };
}

export class OlayDefteri implements OlayGunlugu {
  private readonly simdi: () => number;
  private olaylar: Olay[] = [];
  private sonraki = 1;

  constructor(ayar: OlayDefteriAyari = {}) {
    this.simdi = ayar.simdi ?? (() => Date.now());
    for (const ham of ayar.kayitlar ?? []) {
      const olay = olayiTemizle(ham, this.simdi());
      if (!olay || this.olaylar.some((x) => x.id === olay.id)) continue;
      this.olaylar.push(olay);
      this.sonraki = Math.max(this.sonraki, olay.sira + 1);
    }
    this.olaylar.sort((a, b) => a.sira - b.sira);
  }

  kaydet(girdi: OlayGirdisi): Olay {
    const sira = this.sonraki++;
    const olay: Olay = {
      id: `OLY-${String(sira).padStart(8, "0")}`,
      sira,
      zaman: girdi.zaman ?? this.simdi(),
      tur: girdi.tur,
      metin: girdi.metin.trim(),
      veri: { ...(girdi.veri ?? {}) },
    };
    if (!olay.metin) throw new Error("olay metni boş olamaz");
    this.olaylar.push(olay);
    return { ...olay, veri: { ...olay.veri } };
  }

  cagir(id: string): Olay | null {
    const olay = this.olaylar.find((x) => x.id === id);
    return olay ? { ...olay, veri: { ...olay.veri } } : null;
  }

  ara(sorgu: string, limit = 5): Olay[] {
    const q = sorgu.trim().toLocaleLowerCase("tr-TR");
    if (!q) return [];
    return this.olaylar
      .filter((olay) => `${olay.id} ${olay.tur} ${olay.metin}`.toLocaleLowerCase("tr-TR").includes(q))
      .slice(-Math.max(0, limit))
      .reverse()
      .map((olay) => ({ ...olay, veri: { ...olay.veri } }));
  }

  dok(): Olay[] {
    return this.olaylar.map((olay) => ({ ...olay, veri: { ...olay.veri } }));
  }
}

export interface OlayHafizasiAyari extends HafizaAyari {
  gunluk?: OlayGunlugu;
}

export interface OlayHatirasi {
  id: string;
  olay: Olay;
  skor: number;
  parca: { tazelik: number; onem: number; ilgi: number };
}

/** Olay günlüğüne yazar, mevcut Hafiza skorlama motorundan ilgili olayları seçer. */
export class OlayHafizasi implements OlayGunlugu {
  readonly gunluk: OlayGunlugu;
  readonly hafiza: Hafiza;

  constructor(ayar: OlayHafizasiAyari = {}) {
    this.gunluk = ayar.gunluk ?? new OlayDefteri({ simdi: ayar.simdi });
    this.hafiza = new Hafiza(ayar);
    // Yeni oturumda olay günlüğü kalıcı kayıttan geldiyse hafıza indeksi de
    // aynı kaynaktan yeniden kurulur. Günlük kaynak gerçektir; hafıza türevdir.
    for (const olay of this.gunluk.dok()) this.hafizayaYaz(olay);
  }

  kaydet(girdi: OlayGirdisi): Olay {
    const olay = this.gunluk.kaydet(girdi);
    this.hafizayaYaz(olay);
    return olay;
  }

  private hafizayaYaz(olay: Olay): void {
    // ID metnin başında tutulur: ilgili hafıza kaydı tam olaya geri dönebilir.
    this.hafiza.ekle(`${olay.id} ${olay.metin}`, "olay" as AniTuru, 5);
  }

  cagir(id: string): Olay | null { return this.gunluk.cagir(id); }
  ara(sorgu: string, limit = 5): Olay[] { return this.gunluk.ara(sorgu, limit); }
  dok(): Olay[] { return this.gunluk.dok(); }

  ilgili(sorgu: string, adet = 5): OlayHatirasi[] {
    return this.hafiza.getir(sorgu, adet)
      .map((sonuc) => {
        const id = /^(OLY-\d{8})\b/.exec(sonuc.ani.metin)?.[1];
        const olay = id ? this.cagir(id) : null;
        return olay ? { id, olay, skor: sonuc.skor, parca: sonuc.parca } : null;
      })
      .filter((x): x is OlayHatirasi => x !== null);
  }

  /** Hafıza kaydını özel numaradan doğrudan tam olaya çözer. */
  hatirla(id: string): Olay | null { return this.cagir(id); }

  hafizaDok(): Ani[] { return this.hafiza.dok(); }
}
