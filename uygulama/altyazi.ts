// uygulama/altyazi.ts — Ekranın altındaki geçici altyazı (kullanıcıya geri bildirim; protokol mesajı ÜRETMEZ).
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2). Zamanlayıcı bu kapanışın içinde: her
// çağrı öncekinin gizleme sayacını iptal eder, son çağrı kazanır.
//
// AJAN CEVAPLARI (`ekle`, spec 33): iki ajan neredeyse aynı anda konuşursa ("İkisi birden" hedefi) son çağrı kazanır kuralı birinin cevabını
// görünmeden ezerdi. `ekle` yakın zamanda yazılmış ajan satırlarını ALT ALTA yığar; yığılınca her satır adını taşır (kim dedi belli olsun).
// Düz `altyazi(...)` çağrısı (seçim, "sen: …", uyarılar) eskisi gibi her şeyi ezer ve yığını sıfırlar.
"use strict";

/** Yığındaki bir ajan satırı. `adHep`: tek başına görünürken de ad yazılsın mı (Flash hep, Orion yalnız yığılınca: eskiden adsızdı). */
export interface AjanSatiri { ad: string; metin: string; adHep: boolean; an: number }

/** Bu süreden (ms) yeni yazılmış ajan satırı yığında kalır; daha eskisi artık "ayrı bir an" sayılır ve yeni satır onu ezer. */
export const YIGMA_PENCERESI_MS = 2500;
/** Aynı anda ekranda en çok bu kadar ajan satırı (en eskisi düşer). */
export const EN_FAZLA_SATIR = 3;

/** Yeni satırı yığına ekler: pencere dışındakiler ve aynı ajanın eski satırı atılır, en fazla `EN_FAZLA_SATIR` kalır. Saf. */
export function satirEkle(oncekiler: readonly AjanSatiri[], yeni: AjanSatiri): AjanSatiri[] {
  const taze = oncekiler.filter((s) => yeni.an - s.an <= YIGMA_PENCERESI_MS && s.ad !== yeni.ad);
  return [...taze, yeni].slice(-EN_FAZLA_SATIR);
}

/** Satırları ekran metnine çevirir: tek satırda ad yalnız `adHep` ise; birden çoksa her satır adıyla, satır sonlarıyla. Saf. */
export function satirlariBicimle(satirlar: readonly AjanSatiri[]): string {
  if (satirlar.length === 1) { const s = satirlar[0]!; return s.adHep ? `${s.ad}: ${s.metin}` : s.metin; }
  return satirlar.map((s) => `${s.ad}: ${s.metin}`).join("\n");
}

export interface AltyaziGosterici {
  (metin: string, ms?: number): void;
  /** Ajan cevabı: yakın zamanda başka bir ajan konuştuysa alt alta yığılır (bkz. dosya başı). */
  ekle(ad: string, metin: string, ms?: number, adHep?: boolean): void;
}

export function altyaziKur(el: HTMLElement, simdi: () => number = Date.now): AltyaziGosterici {
  let zaman: ReturnType<typeof setTimeout>;
  let yigin: AjanSatiri[] = [];
  /** Ekranın kapanacağı an (ms, `simdi` ekseni): yığındaki en uzun satırın süresi; kısa süreli yeni satır uzun olanı erken kapatmasın. */
  let kapanis = 0;
  const goster = (metin: string, ms: number): void => {
    el.textContent = metin;
    el.dataset.gorunur = "1";
    clearTimeout(zaman);
    zaman = setTimeout(() => { el.dataset.gorunur = "0"; }, ms);
  };
  const duz = ((metin: string, ms = 2200) => { yigin = []; kapanis = simdi() + ms; goster(metin, ms); }) as AltyaziGosterici;
  duz.ekle = (ad, metin, ms = 2200, adHep = false) => {
    const an = simdi();
    const yiginli = yigin.some((x) => an - x.an <= YIGMA_PENCERESI_MS && x.ad !== ad);
    yigin = satirEkle(yigin, { ad, metin, adHep, an });
    kapanis = Math.max(yiginli ? kapanis : 0, an + ms);
    goster(satirlariBicimle(yigin), kapanis - an);
  };
  return duz;
}
