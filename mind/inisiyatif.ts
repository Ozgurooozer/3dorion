// mind/inisiyatif.ts — Orion'un KENDİ gündemi: güç bütçesi + fayda kararı.
//
// NEYİ ÇÖZÜYOR. Orion bugüne kadar yalnızca TEPKİ veriyordu: Ozyn konuşunca,
// terminal hata verince, bir olay olunca düşünüyordu. Boşta ise `ajanda.ts`
// zamanlayıcıyla rastgele bir yere bakıyordu — heykel gibi durmasın diye,
// hiçbir duruma bakmadan. "Kendi gündemi" yoktu (spec 06 K1: önce sadakat).
//
// İŞ BÖLÜMÜ — bilinçli:
//   Bu dosya NE ZAMAN'a karar verir: beyne kendiliğinden düşünme fırsatı
//     verilmeli mi? (oyun yapay zekâsındaki fayda puanlaması / utility AI)
//   NE yapılacağına BEYİN karar verir: konuşmak, bakmak, tahtaya yazmak ya da
//     susmak. Eylem seçimini yine sadakati ölçülmüş olan yapıyor.
//
// BİLEREK YOK — "merak" (boştayken `sor(onumde)` ile bakma): `sor`'un cevabı
// `gordum` olarak döner ve refleks onu HER ZAMAN beyne terfi ettirir ("beyin
// cevabı kendisi istedi"). Yani "ucuz yerel bakış" her seferinde bir LLM
// çağrısı olurdu. Doğru çözüm protokole bir köken alanı eklemek — ayrı iş.
//
// MALİYET TAVANI. `tik` yasağının inisiyatif karşılığı test ediliyor:
// 1 saat boşta en fazla 4 uyanma. Bir eşik hatası sessizce saatte binlerce
// LLM çağrısına dönüşebilirdi.
//
// SAF: bağımlılık yalnızca protokol künyesi.
"use strict";
import { BEDEN } from "../protocol/bedenTanimi.ts";

/** Hareket de düşünce de aynı bataryadan harcar (künye: `BEDEN.guc`). */
export class GucButcesi {
  private _seviye = 1;

  /**
   * Her tik. `hiz` (m/s) gövdenin GERÇEK hızı — Faz 2'den beri komut
   * edilen değil, gerçekleşen. Hareket halindeyken dolmaz.
   */
  tikle(dt: number, hiz: number): void {
    if (hiz > 0.05) this._seviye -= hiz * dt * BEDEN.guc.hareketMaliyeti;
    else this._seviye += dt * BEDEN.guc.dinlenmeHizi;
    this._kis();
  }

  /** Bir beyin turu tamamlandı. */
  dusundu(): void {
    this._seviye -= BEDEN.guc.dusunceMaliyeti;
    this._kis();
  }

  get seviye(): number { return this._seviye; }

  private _kis(): void {
    if (this._seviye < 0) this._seviye = 0;
    else if (this._seviye > 1) this._seviye = 1;
  }
}

/** Kararın okuduğu anlık durum. Tamamı çağıranın elinde — saf ve test edilebilir. */
export interface InisiyatifDurumu {
  simdiMs: number;
  /** Beyin düşünüyor ya da gövde bir iş yürütüyor. */
  mesgul: boolean;
  /** Ozyn monitörde çalışıyor — odak işi, bölünmez. */
  ozynMonitorde: boolean;
  ozynOdada: boolean;
  /** Ozyn en son ne kadar önce konuştu (hiç konuşmadıysa açılıştan beri). */
  sessizlikMs: number;
  /** Güç seviyesi 0..1. */
  guc: number;
}

export interface InisiyatifAyari {
  /** Bu kadar sessizlik olmadan söze girilmez. Tel de olabilir. */
  sessizlikEsigiMs?: number | (() => number);
  /** Bir kez söze girdikten sonra bu süre geçmeden bir daha girilmez. */
  refrakterMs?: number | (() => number);
  /** Güç bunun altındaysa söze girilmez. */
  gucEsigi?: number;
}

export interface InisiyatifKarari {
  tur: "soze_gir";
  /** Sessizlik, tam dakika — beyne bu söylenir. */
  dakika: number;
  /** 0..1 — günlük ve zihin duvarı için. Eşik kararı yukarıda verildi. */
  fayda: number;
}

export class Inisiyatif {
  private _esik: () => number;
  private _refrakter: () => number;
  private _gucEsigi: number;
  private _sonKararMs = -Infinity;

  constructor(ayar: InisiyatifAyari = {}) {
    const tel = (a: number | (() => number) | undefined, v: number) =>
      a === undefined ? () => v : typeof a === "function" ? a : () => a;
    this._esik = tel(ayar.sessizlikEsigiMs, 10 * 60_000);
    this._refrakter = tel(ayar.refrakterMs, 15 * 60_000);
    this._gucEsigi = ayar.gucEsigi ?? 0.5;
  }

  karar(d: InisiyatifDurumu): InisiyatifKarari | null {
    // KAPILAR — biri kapalıysa fayda hesaplanmaz bile.
    if (d.mesgul) return null;                 // ikinci tur yok
    if (d.ozynMonitorde) return null;          // odak işi bölünmez
    if (!d.ozynOdada) return null;             // kime konuşsun
    if (d.guc < this._gucEsigi) return null;   // bütçe süs değil
    if (d.simdiMs - this._sonKararMs < this._refrakter()) return null;

    const esik = this._esik();
    if (d.sessizlikMs < esik) return null;

    // FAYDA: sessizlik uzadıkça artar (eşiğin iki katında doyar), güçle ölçeklenir.
    const fayda = Math.min(1, d.sessizlikMs / (2 * esik)) * d.guc;
    this._sonKararMs = d.simdiMs;
    return { tur: "soze_gir", dakika: Math.floor(d.sessizlikMs / 60_000), fayda };
  }

  /** Zihin duvarı / günlük için. */
  get sessizlikEsigiMs(): number { return this._esik(); }
  get refrakterMs(): number { return this._refrakter(); }
}
