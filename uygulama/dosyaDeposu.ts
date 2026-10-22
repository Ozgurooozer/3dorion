// uygulama/dosyaDeposu.ts — KULLANICI DOSYASI DEPOSUNUN ORTAK ÇEKİRDEĞİ (renderer tarafı; spec 35 dilim 1'de md deposundan genelleştirildi).
//
// İki kullanıcısı var: Orion'un md dosyaları (`mdDeposu.ts`, spec 32) ve düğüm grafikleri (`graf/grafDeposu.ts`, spec 35). Ortak olan:
//   • kaynak arayüzü (liste / oku / yaz / yeni) ve host IPC'sinin `{ok, deger}` sonucunu açan sarmal;
//   • Electron'suz geliştirme (`npm run dev`) için localStorage kaynağı — kurallar host'unkiyle aynı (yok/var, ad);
//   • hiçbir kaynak yokken NEDENLE hata veren kaynak (sessiz boş liste değil);
//   • yazan işlerin SIRASI (okuma-değiştirme-yazma yarışmasın; bir işin hatası sırayı kesmez, çağırana gider).
// Türe özgü olan (md'nin aktif/pasif bayrağı, grafiğin biçim doğrulaması) kullanıcıda kalır. KOPYA YOK: ikinci deponun kendi localStorage kaynağını ya da
// sırasını yeniden yazması, kuralların sessizce ayrışması demekti (CLAUDE.md "kopya kod: kural değil bekçi").
"use strict";
import type { IpcSonuc } from "../host/kopru.ts";
import type { DosyaBilgisi } from "../host/dosyaKlasoru.js";
import { ipcAc } from "./ipcSonuc.ts";
import type { Depo } from "./yerlestirmeKaydi.ts";

export type { DosyaBilgisi, Depo };

/** Dosya işlemi hatası: `kod` host'un kodudur (yok | var | gecersiz-ad | gecersiz-icerik | cok-buyuk | bozuk-ayar | hata). */
export class DosyaHatasi extends Error {
  readonly kod: string;
  constructor(kod: string, mesaj: string) { super(mesaj); this.name = "DosyaHatasi"; this.kod = kod; }
}

export interface DosyaKaynagi<B extends DosyaBilgisi = DosyaBilgisi> {
  liste(): Promise<B[]>;
  oku(ad: string): Promise<string>;
  yaz(ad: string, metin: string): Promise<void>;
  yeni(ad: string, metin: string): Promise<void>;
  /** Dosyayı kaldırır (host'ta `.silinenler/`e taşır). Her tür sunmaz: md deposu sistem dosyalarını silmez, bu yüzden isteğe bağlı. */
  sil?(ad: string): Promise<void>;
}

/** Host IPC'sinin dört işlemi (preload `window.kopru.<tür>*`). */
export interface DosyaIpcYuzu<B> {
  liste(): Promise<IpcSonuc<B[]>>;
  oku(ad: string): Promise<IpcSonuc<string>>;
  yaz(ad: string, metin: string): Promise<IpcSonuc<true>>;
  yeni(ad: string, metin: string): Promise<IpcSonuc<true>>;
  sil?(ad: string): Promise<IpcSonuc<true>>;
}

type HataYap = (kod: string, mesaj: string) => Error;

/** IPC kaynağı: `{ok, deger}` açılır, `{ok:false}` türün hata sınıfına (`hata`) çevrilir (kod korunur). */
export function ipcDosyaKaynagi<B extends DosyaBilgisi>(y: DosyaIpcYuzu<B>, hata: HataYap): DosyaKaynagi<B> {
  const ac = <T>(s: IpcSonuc<T>): T => ipcAc(s, hata);
  return {
    liste: async () => ac(await y.liste()),
    oku: async (ad) => ac(await y.oku(ad)),
    yaz: async (ad, metin) => { ac(await y.yaz(ad, metin)); },
    yeni: async (ad, metin) => { ac(await y.yeni(ad, metin)); },
    ...(y.sil ? { sil: async (ad: string) => { ac(await y.sil!(ad)); } } : {}),
  };
}

// ── localStorage kaynağı (Electron'suz geliştirme) ──

/** Saklanan kayıt: metin + değişme zamanı + türe özgü ek alanlar (md: `aktif`). Biçim md'nin eski yerel kaydıyla aynı (`orion.md.v1` geriye uyumlu). */
export type YerelKayit<E> = { metin: string; degisti: number } & E;

export interface YerelKaynak<E> extends DosyaKaynagi<DosyaBilgisi & E> {
  /** Ek alanları güncelle (dosya var olmalı). */
  ekGuncelle(ad: string, ek: Partial<E>): Promise<void>;
}

export interface YerelKaynakAyari<E> {
  /** localStorage anahtarı (tek anahtar, bütün dosyalar bir JSON nesnesinde). */
  anahtar: string;
  adGecerli: (ad: string) => boolean;
  hata: HataYap;
  /** Hata metinlerinde dosyanın adı ("md dosyası", "grafik") — host'un metinleriyle aynı. */
  etiket: string;
  adEtiketi: string;
  /** Yeni dosyanın ek alanları. */
  yeniEk: (ad: string) => E;
  /** Kayıttan ek alanlar (listeye girer; metin girmez). */
  ekAl: (x: YerelKayit<E>) => E;
}

export function yerelDosyaKaynagi<E extends object>(depo: Depo, a: YerelKaynakAyari<E>, simdi: () => number = Date.now): YerelKaynak<E> {
  const oku = (): Record<string, YerelKayit<E>> => {
    const ham = depo.getItem(a.anahtar);
    if (!ham) return {};
    const v: unknown = JSON.parse(ham);
    if (typeof v !== "object" || v === null || Array.isArray(v)) throw a.hata("bozuk-ayar", `yerel ${a.etiket} kaydı bozuk`);
    return v as Record<string, YerelKayit<E>>;
  };
  const yaz = (d: Record<string, YerelKayit<E>>) => depo.setItem(a.anahtar, JSON.stringify(d));
  const dene = (ad: string) => { if (!a.adGecerli(ad)) throw a.hata("gecersiz-ad", `geçersiz ${a.adEtiketi}: ${JSON.stringify(ad)}`); };
  const var_ = (d: Record<string, YerelKayit<E>>, ad: string): YerelKayit<E> => { const x = d[ad]; if (!x) throw a.hata("yok", `${a.etiket} yok: ${ad}`); return x; };
  return {
    async liste() {
      return Object.entries(oku()).map(([ad, x]) => ({ ...a.ekAl(x), ad, boyut: new TextEncoder().encode(x.metin).length, degisti: x.degisti }));
    },
    async oku(ad) { dene(ad); return var_(oku(), ad).metin; },
    async yaz(ad, metin) { dene(ad); const d = oku(); const x = var_(d, ad); d[ad] = { ...x, metin, degisti: simdi() }; yaz(d); },
    async yeni(ad, metin) {
      dene(ad); const d = oku();
      if (d[ad]) throw a.hata("var", `zaten var: ${ad}`);
      d[ad] = { ...a.yeniEk(ad), metin, degisti: simdi() }; yaz(d);
    },
    async sil(ad) { dene(ad); const d = oku(); var_(d, ad); delete d[ad]; yaz(d); },
    async ekGuncelle(ad, ek) { dene(ad); const d = oku(); d[ad] = { ...var_(d, ad), ...ek }; yaz(d); },
  };
}

/** Hiçbir kaynak yokken: liste boş, her işlem NEDENLE hata (arayüz nedeni söyler). */
export function calismayanDosyaKaynagi(neden: string, hata: HataYap): DosyaKaynagi<never> {
  const h = async (): Promise<never> => { throw hata("hata", neden); };
  return { liste: async () => [], oku: h, yaz: h, yeni: h };
}

/** Tarayıcı deposu (yoksa ya da erişim reddedilirse null). */
export function tarayiciDeposu(): Depo | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Yazan işlerin sırası: önceki iş hata verse de sıra devam eder, bu işin hatası çağırana gider. */
export function isSirasi(): { sirala<T>(is: () => Promise<T>): Promise<T>; bitti(): Promise<void> } {
  let kuyruk: Promise<unknown> = Promise.resolve();
  return {
    sirala<T>(is: () => Promise<T>): Promise<T> {
      const s = kuyruk.then(is, is);
      kuyruk = s.catch(() => undefined);
      return s;
    },
    bitti: async () => { await kuyruk; },
  };
}
