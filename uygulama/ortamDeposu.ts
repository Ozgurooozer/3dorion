// uygulama/ortamDeposu.ts — Ortam ayarlarının hatırlanması: MODÜLER kalıcılık (Ozyn, 2026-10-13).
//
// İki kip, ikisi de seçilebilir:
//   oturum  — ayarlar yalnız bellekte; uygulama kapanınca gider (ova'ya her çıkışta yeniden oynatılır, yani kapıdan
//             çıkıp girmek ayarı SIFIRLAMAZ ama uygulamayı yeniden açmak sıfırlar). Varsayılan: güvenli.
//   kalici  — aynı günlük tarayıcı deposuna (localStorage) da yazılır; sonraki açılışta ova ayarlarla gelir.
// Dosyaya (ova.level.json) HİÇBİR kipte yazılmaz.
//
// SAKLANAN ŞEY tüm tanım DEĞİL, KOMUT GÜNLÜĞÜ: ova her kuruluşta dosyadan taze okunur, günlük onun ÜSTÜNE aynı
// `ortamUygula` ile yeniden oynatılır; dosya değişse de (yeni palet adı, yeni katman) eski bir anlık görüntü onu
// bozmaz. Günlük küçük kalır: mutlak komutlar aynı konudaki eskisini ezer, `sifirla` her şeyi siler, üst sınır var.
"use strict";
import type { OrtamKomutu } from "../world/level/stil/ortamKomutu.ts";
import type { OgrenilenDeposu, OgrenilenKayit } from "../mind/ortamSozlugu.ts";

export interface OrtamKaydi {
  surum: 1;
  komutlar: OrtamKomutu[];
}

export const GUNLUK_SINIRI = 60;
const BOS = (): OrtamKaydi => ({ surum: 1, komutlar: [] });

/**
 * Günlüğe bir komut ekler (SAF; yeni liste döner). Kurallar:
 *  - `sifirla` günlüğü boşaltır (ve kendisi girmez: açılış zaten sıfır noktası).
 *  - MUTLAK komut aynı konudaki eskilerini düşürür: saat, akis, dunya, renk, sis ac/kapat, efekt:<grup>, shader:<ad>.
 *  - `stil` önayarı bütün stili (ışık sonrası efektler ve renk eğrisi dahil) ezer: önceki stil, efekt ve sıcak/soğuk
 *    komutları anlamsızlaşır, düşer. Pozlama (kıs/aç), sis, zaman ve shader'lara dokunmaz.
 *  - GÖRELİ komutlar (kıs/aç, sıcak/soğuk, saat_kaydir, sis yoğun/hafif) birikir; günlük sınırında en eskisi düşer.
 */
export function gunluguEkle(liste: readonly OrtamKomutu[], k: OrtamKomutu): OrtamKomutu[] {
  if (k.ne === "sifirla") return [];
  const aynisi = (a: OrtamKomutu): boolean => {
    switch (k.ne) {
      case "saat": return a.ne === "saat" || a.ne === "saat_kaydir";
      case "akis": case "dunya": case "renk": return a.ne === k.ne;
      case "sis": return (k.deger === "ac" || k.deger === "kapat") && a.ne === "sis";
      case "efekt": case "shader": return a.ne === k.ne && (a.deger ?? "").split(":")[0] === (k.deger ?? "").split(":")[0];
      case "stil": return a.ne === "stil" || a.ne === "efekt" || (a.ne === "isik" && (a.deger === "sicak" || a.deger === "soguk"));
      default: return false;
    }
  };
  const yeni = [...liste.filter((a) => !aynisi(a)), structuredClone(k)];
  return yeni.length > GUNLUK_SINIRI ? yeni.slice(yeni.length - GUNLUK_SINIRI) : yeni;
}

export interface OrtamDeposu {
  oku(): OrtamKaydi;
  yaz(k: OrtamKaydi): void;
  sil(): void;
}

/** Yalnız oturum: bellek. */
export function bellekDeposu(): OrtamDeposu {
  let kayit = BOS();
  return { oku: () => structuredClone(kayit), yaz: (k) => { kayit = structuredClone(k); }, sil: () => { kayit = BOS(); } };
}

export type DepoYuzeyi = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const TURLER = new Set(["stil", "renk", "saat", "saat_kaydir", "isik", "sis", "efekt", "shader", "akis", "dunya"]);

/** Bozuk/eski kayıt oturumu bozmaz: tanınmayan her şey düşer, boş günlükle başlanır. */
function kayitCoz(ham: string | null): OrtamKaydi {
  if (!ham) return BOS();
  try {
    const v = JSON.parse(ham) as { surum?: unknown; komutlar?: unknown };
    if (v.surum !== 1 || !Array.isArray(v.komutlar)) return BOS();
    const komutlar = v.komutlar.filter((k): k is OrtamKomutu =>
      typeof k === "object" && k !== null && (k as OrtamKomutu).tur === "ortam" && TURLER.has((k as OrtamKomutu).ne)
      && ((k as OrtamKomutu).deger === undefined || typeof (k as OrtamKomutu).deger === "string")
      && ((k as OrtamKomutu).sayi === undefined || Number.isFinite((k as OrtamKomutu).sayi)));
    return { surum: 1, komutlar: komutlar.slice(-GUNLUK_SINIRI) };
  } catch { return BOS(); }
}

/** Oturumlar arası: tarayıcı deposu (özel pencerede/engelli depoda sessizce bellek gibi davranır). */
export function yerelDepo(anahtar: string, depo?: DepoYuzeyi): OrtamDeposu {
  const d = (): DepoYuzeyi | null => { try { return depo ?? localStorage; } catch { return null; } };
  return {
    oku: () => { try { return kayitCoz(d()?.getItem(anahtar) ?? null); } catch { return BOS(); } },
    yaz: (k) => { try { d()?.setItem(anahtar, JSON.stringify(k)); } catch { /* özel pencere: önemsiz */ } },
    sil: () => { try { d()?.removeItem(anahtar); } catch { /* önemsiz */ }},
  };
}

export type KaliciKip = "oturum" | "kalici";
const KIP_ANAHTARI = "orion.ortam.kalicilik";
const GUNLUK_ANAHTARI = "orion.ortam.gunluk";

/**
 * Günlüğün sahibi: bellek HER ZAMAN güncel; `kalici` kipte aynısı yerel depoya da yazılır. Kip değişince:
 * kalıcıya geçiş günlüğü hemen yazar, oturuma geçiş yerel kaydı SİLER ("hatırlama" kapandı = unutuldu).
 */
export class OrtamGunlugu {
  private _kip: KaliciKip;
  private _bellek: OrtamKomutu[];
  private _yerel: OrtamDeposu;
  private _kipDeposu: DepoYuzeyi | undefined;
  private _kipDinleyicileri: ((k: KaliciKip) => void)[] = [];

  constructor(ayar: { yerel?: OrtamDeposu; depo?: DepoYuzeyi; kip?: KaliciKip } = {}) {
    this._kipDeposu = ayar.depo;
    this._yerel = ayar.yerel ?? yerelDepo(GUNLUK_ANAHTARI, ayar.depo);
    this._kip = ayar.kip ?? OrtamGunlugu.kayitliKip(ayar.depo);
    // Kalıcı kipte önceki oturumun günlüğüyle başlanır; oturum kipinde boş (eski kayıt okunmaz, silinmez: kip değişince karar verilir).
    this._bellek = this._kip === "kalici" ? this._yerel.oku().komutlar : [];
  }

  /** Tarayıcıda saklı kip (yoksa oturum). `?ortam=kalici|oturum` bunu o açılış için ezer (çağıran verir). */
  static kayitliKip(depo?: DepoYuzeyi): KaliciKip {
    try { return (depo ?? localStorage).getItem(KIP_ANAHTARI) === "kalici" ? "kalici" : "oturum"; } catch { return "oturum"; }
  }

  get kip(): KaliciKip { return this._kip; }

  /** Kip değişince haber al (öğrenen sözlük deposu kendini yeni kipe göre eşitler). */
  kipDinle(f: (k: KaliciKip) => void): void { this._kipDinleyicileri.push(f); }
  komutlar(): readonly OrtamKomutu[] { return this._bellek; }

  kipAyarla(kip: KaliciKip): void {
    this._kip = kip;
    try { (this._kipDeposu ?? localStorage).setItem(KIP_ANAHTARI, kip); } catch { /* önemsiz */ }
    if (kip === "kalici") this._yerel.yaz({ surum: 1, komutlar: [...this._bellek] });
    else this._yerel.sil();
    for (const f of this._kipDinleyicileri) f(kip);
  }

  /** Başarıyla uygulanan komutu günlüğe işler. */
  kaydet(k: OrtamKomutu): void {
    this._bellek = gunluguEkle(this._bellek, k);
    if (this._kip === "kalici") this._yerel.yaz({ surum: 1, komutlar: [...this._bellek] });
  }

  /** Her şeyi unut (bellek + kalıcı kayıt). */
  unut(): void {
    this._bellek = [];
    this._yerel.sil();
  }
}

// ── Öğrenen sözlük deposu (mind/ortamSozlugu.ts) ───────────────────────────────────────────────────────

const OGRENILEN_ANAHTARI = "orion.ortam.ogrenilen";

function ogrenilenCoz(ham: string | null): OgrenilenKayit[] {
  if (!ham) return [];
  try {
    const v = JSON.parse(ham) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((k): k is OgrenilenKayit => {
      const x = k as Partial<OgrenilenKayit> | null;
      return !!x && typeof x.soz === "string" && typeof x.ham === "string" && Array.isArray(x.komutlar)
        && x.komutlar.every((n) => n && n.tur === "ortam" && TURLER.has(n.ne))
        && Number.isFinite(x.basari) && Number.isFinite(x.hata) && Number.isFinite(x.t);
    });
  } catch { return []; }
}

/**
 * Öğrenilen sözlüğün deposu: bellek HER ZAMAN güncel; `kalici()` doğruysa tarayıcı deposuna da yazılır. Günlükle aynı
 * kip (OrtamGunlugu) belirler; kip değişince `esitle()` çağrılır: kalıcıya geçişte hemen yazar, oturuma dönüşte siler.
 */
export function ogrenilenDeposu(kalici: () => boolean, depo?: DepoYuzeyi): OgrenilenDeposu & { esitle(): void } {
  const d = (): DepoYuzeyi | null => { try { return depo ?? localStorage; } catch { return null; } };
  const yerelOku = (): OgrenilenKayit[] => { try { return ogrenilenCoz(d()?.getItem(OGRENILEN_ANAHTARI) ?? null); } catch { return []; } };
  const yerelYaz = (k: readonly OgrenilenKayit[]) => { try { d()?.setItem(OGRENILEN_ANAHTARI, JSON.stringify(k)); } catch { /* önemsiz */ } };
  let bellek: OgrenilenKayit[] = kalici() ? yerelOku() : [];
  return {
    oku: () => structuredClone(bellek),
    yaz(k) { bellek = structuredClone([...k]); if (kalici()) yerelYaz(bellek); },
    esitle() {
      if (kalici()) yerelYaz(bellek);
      else { try { d()?.removeItem(OGRENILEN_ANAHTARI); } catch { /* önemsiz */ } }
    },
  };
}
