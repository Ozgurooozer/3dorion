// world/level/cekirdek/aktorOlayYolu.ts — AKTÖR OLAY YOLU (spec 45 B2; Unreal Event Dispatcher). SAF: Babylon, DOM, zaman ve rastgelelik YOK.
//
// Aktörler (level nesneleri/ışıkları/bedenler) birbirine ve graflara OLAYLA haber verir: `<aktör>.<olay>` adresi, JSON verisi. Bileşenler yerleşik olayları yayınlar (`tetik.girdi`,
// `soket.takildi`… bkz. `bilesenKaydi.ts`), graflar özel olay yayınlar/dinler (B3). Bu dosya yalnız dağıtımdır: kimin yayınlayacağı ve neyin dinleyeceği başka katmanın işi.
//
// KORUMA (olay olayı doğurur, fırtına bir kareyi yer): iç içe dağıtım derinliği ≤ `OLAY_DERINLIK_TAVANI`; kare başına dağıtım ≤ `KARE_OLAY_TAVANI` (çağıran her karede `kareBasi()` der).
// Aşılan olay ATLANIR ve SAYILIR (`sayim()`), sessiz değil: sonuç `ok: false` + neden döner. Dinleyici hatası öteki dinleyicileri durdurmaz ve sayılır.
// Veri yalnız metin/sayı/mantıksal (nesne sızdırılmaz): dinleyici Babylon nesnesi tutup aktörün dışına taşıyamaz.
// Hiyerarşi (`ust`) dışarıdan verilir (`aktorHiyerarsisi`): üst/alt yayını onu izler, döngüye karşı gezilenleri hatırlar.
"use strict";
import { kodlu } from "./aktorHatalari.ts";

export const OLAY_DERINLIK_TAVANI = 8;
export const KARE_OLAY_TAVANI = 256;
/** Olay verisi: en çok bu kadar anahtar, metin en çok bu uzunlukta. */
export const OLAY_VERI_SINIRI = { anahtar: 8, metin: 200 } as const;
/** Aktör adresi ve olay adı uzunluk tavanı. */
const AD_TAVANI = 64;

export type OlayDegeri = string | number | boolean;
export type OlayVerisi = Readonly<Record<string, OlayDegeri>>;

/** Dinleyiciye giden olay. `aktor` = olayın ULAŞTIĞI adres; `kaynak` = yayınlayan (üst/alt yayında ikisi farklıdır). */
export interface AktorOlayi {
  readonly aktor: string;
  readonly kaynak: string;
  readonly ad: string;
  readonly veri: OlayVerisi;
  /** İç içe dağıtım derinliği (ilk dağıtım 0). */
  readonly derinlik: number;
}

export type YayinSonucu = { ok: true; iletilen: number } | { ok: false; neden: string; atlandi?: "derinlik" | "kare" };

export interface AktorOlayYolu {
  /** Aktörün olayını yayınlar (aktöre, `*` ve bu adı dinleyenlere). Geçersiz ad/veri, derinlik ya da kare tavanı `ok: false` döner. */
  yayinla(aktor: string, ad: string, veri?: OlayVerisi): YayinSonucu;
  /** Üst zincirdeki her aktöre (yakından uzağa; `beden:` üstler dahil) yayınlar. Dönen: toplam iletilen; tavan aşılırsa kalan atlanır. */
  ustuneYayinla(aktor: string, ad: string, veri?: OlayVerisi): YayinSonucu;
  /** Alt ağaçtaki her aktöre (genişlik sırası) yayınlar. */
  altlaraYayinla(aktor: string, ad: string, veri?: OlayVerisi): YayinSonucu;
  /** `aktor`: tam adres ya da `*`; `ad`: tam olay adı ya da `*`. Dönen fonksiyon aboneliği kaldırır. */
  dinle(aktor: string, ad: string, f: (o: AktorOlayi) => void): () => void;
  /** Kare sayacını sıfırlar (çalışma zamanı her karede çağırır). */
  kareBasi(): void;
  sayim(): OlaySayimi;
  /** Dinleyici sayısı (test ve hata ayıklama). */
  abone(): number;
}

export interface OlaySayimi {
  yayinlanan: number;
  iletilen: number;
  atlananDerinlik: number;
  atlananKare: number;
  dinleyiciHatasi: number;
}

export interface AktorOlayYoluAyari {
  /** Aktörün üstü (yoksa undefined). `beden:orion` gibi adresler de üst olabilir. */
  ustu(aktor: string): string | undefined;
  /** Aktörün DOĞRUDAN altları. */
  altlari(aktor: string): readonly string[];
  derinlikTavani?: number;
  kareTavani?: number;
  /** Dinleyici hatası (varsayılan: konsola yazar). */
  hata?: (e: unknown) => void;
}

const AD_DESENI = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

/** Olay adının hatası (geçerliyse null). Yerleşik olaylar nokta taşır (`tetik.girdi`); özel olay adlarını daraltmak graf düğümlerinin işi (B3). */
export function olayAdiHatasi(ad: unknown): string | null {
  if (typeof ad !== "string" || !ad) return kodlu("AKT-OLY-001", "olay adı boş olmayan metin olmalı");
  if (ad.length > AD_TAVANI) return kodlu("AKT-OLY-001", `olay adı en çok ${AD_TAVANI} karakter`);
  return AD_DESENI.test(ad) ? null : kodlu("AKT-OLY-001", "olay adı yalnız harf, rakam, _, - ve . içerebilir");
}

/** Olay verisinin hatası (geçerliyse null). */
export function olayVerisiHatasi(v: unknown): string | null {
  if (v === undefined) return null;
  if (typeof v !== "object" || v === null || Array.isArray(v)) return kodlu("AKT-OLY-002", "olay verisi nesne olmalı");
  const k = Object.keys(v);
  if (k.length > OLAY_VERI_SINIRI.anahtar) return kodlu("AKT-OLY-002", `olay verisi en çok ${OLAY_VERI_SINIRI.anahtar} alan (${k.length} var)`);
  for (const [ad, d] of Object.entries(v)) {
    if (typeof d === "number" ? !Number.isFinite(d) : typeof d === "string" ? d.length > OLAY_VERI_SINIRI.metin : typeof d !== "boolean") {
      return kodlu("AKT-OLY-002", `olay verisi '${ad}': sayı, ${OLAY_VERI_SINIRI.metin} karakteri aşmayan metin ya da mantıksal olmalı`);
    }
  }
  return null;
}

/** Aktör listesinden üst/alt sağlayıcısı (SAF). Kimliksiz ya da `ust`u metin olmayan aktör hiyerarşiye girmez. */
export function aktorHiyerarsisi(aktorler: readonly { id?: unknown; ust?: unknown }[]): Pick<AktorOlayYoluAyari, "ustu" | "altlari"> {
  const ust = new Map<string, string>();
  const alt = new Map<string, string[]>();
  for (const a of aktorler) {
    if (typeof a.id !== "string" || typeof a.ust !== "string") continue;
    ust.set(a.id, a.ust);
    const l = alt.get(a.ust);
    if (l) l.push(a.id); else alt.set(a.ust, [a.id]);
  }
  return { ustu: (id) => ust.get(id), altlari: (id) => alt.get(id) ?? [] };
}

interface Abonelik { aktor: string; ad: string; f: (o: AktorOlayi) => void }

export function aktorOlayYoluKur(ayar: AktorOlayYoluAyari): AktorOlayYolu {
  const derinlikTavani = ayar.derinlikTavani ?? OLAY_DERINLIK_TAVANI;
  const kareTavani = ayar.kareTavani ?? KARE_OLAY_TAVANI;
  const hata = ayar.hata ?? ((e: unknown) => console.error(kodlu("AKT-OLY-006", "olay dinleyicisi hata verdi"), e));
  const aboneler = new Set<Abonelik>();
  const s: OlaySayimi = { yayinlanan: 0, iletilen: 0, atlananDerinlik: 0, atlananKare: 0, dinleyiciHatasi: 0 };
  let derinlik = 0, kare = 0;

  const dogrula = (aktor: string, ad: string, veri: OlayVerisi | undefined): string | null => {
    if (typeof aktor !== "string" || !aktor || aktor.length > AD_TAVANI) return kodlu("AKT-OLY-003", "aktör adresi boş olmayan metin olmalı");
    return olayAdiHatasi(ad) ?? olayVerisiHatasi(veri);
  };

  function ilet(hedef: string, kaynak: string, ad: string, veri: OlayVerisi): YayinSonucu {
    if (derinlik >= derinlikTavani) { s.atlananDerinlik++; return { ok: false, atlandi: "derinlik", neden: kodlu("AKT-OLY-004", `olay zinciri en çok ${derinlikTavani} derinlikte (${hedef}.${ad} atlandı)`) }; }
    if (kare >= kareTavani) { s.atlananKare++; return { ok: false, atlandi: "kare", neden: kodlu("AKT-OLY-005", `kare başına en çok ${kareTavani} olay (${hedef}.${ad} atlandı)`) }; }
    kare++; s.yayinlanan++;
    const olay: AktorOlayi = { aktor: hedef, kaynak, ad, veri, derinlik };
    let n = 0;
    derinlik++;
    try {
      for (const ab of [...aboneler]) {
        if (!aboneler.has(ab)) continue;   // dağıtım sırasında kaldırılan abone bu olayı almaz
        if ((ab.aktor !== "*" && ab.aktor !== hedef) || (ab.ad !== "*" && ab.ad !== ad)) continue;
        try { ab.f(olay); n++; } catch (e) { s.dinleyiciHatasi++; hata(e); }
      }
    } finally { derinlik--; }
    s.iletilen += n;
    return { ok: true, iletilen: n };
  }

  /** Hedef listesine sırayla yayınlar; ilk atlanan tavan kalanları da keser (aynı tavan, boşuna denemeyiz). */
  function toplu(hedefler: readonly string[], kaynak: string, ad: string, veri: OlayVerisi): YayinSonucu {
    let toplam = 0;
    for (const h of hedefler) {
      const r = ilet(h, kaynak, ad, veri);
      if (!r.ok) return r;
      toplam += r.iletilen;
    }
    return { ok: true, iletilen: toplam };
  }

  return {
    yayinla(aktor, ad, veri) {
      const h = dogrula(aktor, ad, veri);
      if (h) return { ok: false, neden: h };
      return ilet(aktor, aktor, ad, veri ?? {});
    },
    ustuneYayinla(aktor, ad, veri) {
      const h = dogrula(aktor, ad, veri);
      if (h) return { ok: false, neden: h };
      const zincir: string[] = [];
      const gorulen = new Set([aktor]);
      for (let u = ayar.ustu(aktor); u !== undefined && !gorulen.has(u); u = ayar.ustu(u)) { zincir.push(u); gorulen.add(u); }
      return toplu(zincir, aktor, ad, veri ?? {});
    },
    altlaraYayinla(aktor, ad, veri) {
      const h = dogrula(aktor, ad, veri);
      if (h) return { ok: false, neden: h };
      const sira: string[] = [];
      const gorulen = new Set([aktor]);
      for (let kuyruk = [aktor]; kuyruk.length; ) {
        const simdiki = kuyruk.shift()!;
        for (const c of ayar.altlari(simdiki)) if (!gorulen.has(c)) { gorulen.add(c); sira.push(c); kuyruk.push(c); }
      }
      return toplu(sira, aktor, ad, veri ?? {});
    },
    dinle(aktor, ad, f) {
      const ab: Abonelik = { aktor, ad, f };
      aboneler.add(ab);
      return () => { aboneler.delete(ab); };
    },
    kareBasi() { kare = 0; },
    sayim: () => ({ ...s }),
    abone: () => aboneler.size,
  };
}
