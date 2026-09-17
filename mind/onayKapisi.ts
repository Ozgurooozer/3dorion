// mind/onayKapisi.ts — Önerilen komut ile çalışan komut arasındaki KAPI.
//
// Projedeki tek tehlikeli yetenek buradan geçer. Tasarım ilkeleri, bilerek
// katı:
//
//   1. Orion komutu ÇALIŞTIRAMAZ. Yalnızca öneri kuyruğuna koyar.
//   2. Onay AÇIK bir insan eylemidir. Zaman aşımıyla "evet" YOKTUR —
//      bekleyen öneri zamanla onaylanmaz, zamanla DÜŞER.
//   3. Aynı anda tek bekleyen öneri olur. İkincisi birinciyi EZEMEZ; model
//      üst üste öneri yağdırarak kullanıcıyı yanlış tuşa bastıramaz.
//   4. Her karar kayda geçer (öneri / onay / ret / düşme).
//
// Risk sınıflandırması (mind/komutRiski.ts) BİLGİLENDİRİR, engellemez.
// Gerçek sınır insanın tuşudur — bu dosya o tuşun tek yol olmasını sağlar.
//
// SAF: zaman dışarıdan verilir, yan etki yok, çalıştırma yok.
"use strict";
import { komutRiski, type RiskKarari } from "./komutRiski.ts";

export interface Oneri {
  id: string;
  komut: string;
  gerekce: string;
  risk: RiskKarari;
  /** Öneri anı (ms). */
  an: number;
  /**
   * DONDURULMUŞ son tarih (ms). Öneri anında hesaplanır ve BİR DAHA DEĞİŞMEZ.
   *
   * Neden saklanıyor: eskiden kontrol `simdi - an < zamanAsimi` idi, yani
   * ÖZGÜN damga GÜNCEL süreyle karşılaştırılıyordu. Süre canlı değişebilir
   * hale gelince (devre panosu) bu, bekleyen öneriyi Ozyn hiçbir şey
   * yapmadan düşürüyor ve denetim izine "dustu" diye yazıyordu — iz yalan
   * söylüyordu. Ozyn'e gösterilen son tarih bir SÖZLEŞMEDİR; geriye dönük
   * değiştirmek, basmak üzere olduğu tuşun anlamını değiştirir.
   */
  sonTarih: number;
}

export type KapiDurumu = "bos" | "bekliyor";

export interface OneriSonucu {
  kabul: boolean;
  /** Kabul edilmediyse sebep — model bunu geri besleme olarak görür. */
  sebep?: string;
}

export interface KarardanSonra {
  oneri: Oneri;
  /**
   * `elle_dusuruldu`: Ozyn öneriyi panodan iptal etti. ASLA "onay" değildir —
   * panodan onaya giden bir yol YOKTUR.
   */
  karar: "onay" | "ret" | "dustu" | "elle_dusuruldu";
  /** Öneriden karara kadar geçen süre (ms). */
  sureMs: number;
}

export interface OnayKapisiAyari {
  /**
   * Bekleyen öneri bu süre içinde karara bağlanmazsa DÜŞER (onaylanmaz).
   *
   * Fonksiyon da verilebilir: devre panosu bu ayarı CANLI değiştirecek ve
   * "düğme = tel, değer değil" ilkesi gereği karar yolu ile panel AYNI
   * fonksiyonu okumalı — kopya tutulursa ikisi sessizce ayrışır.
   */
  zamanAsimiMs?: number | (() => number);
  simdi?: () => number;
}

export class OnayKapisi {
  private _bekleyen: Oneri | null = null;
  private _zamanAsimi: () => number;
  private _simdi: () => number;
  private _gecmis: KarardanSonra[] = [];
  private _sayac = { onerilen: 0, onaylanan: 0, reddedilen: 0, dusen: 0, elleDusurulen: 0, ezilmeyeCalisan: 0 };

  constructor(ayar: OnayKapisiAyari = {}) {
    // 90 sn: kullanıcı ekrana bakmıyor olabilir. Süre dolunca öneri DÜŞER,
    // asla onaylanmaz — "beklerken kabul edildi" diye bir şey yok.
    const za = ayar.zamanAsimiMs ?? 90_000;
    this._zamanAsimi = typeof za === "function" ? za : () => za;
    this._simdi = ayar.simdi ?? (() => Date.now());
  }

  get durum(): KapiDurumu { return this._bekleyen ? "bekliyor" : "bos"; }
  get bekleyen(): Oneri | null { return this._bekleyen ? { ...this._bekleyen } : null; }
  sayac(): typeof this._sayac { return { ...this._sayac }; }
  /**
   * Güncel zaman aşımı (ms) — TELDEN okunur, kopyadan değil.
   *
   * Bekleyen bir önerinin son tarihi öneri anında DONDURULDUĞU için bu sayı
   * onu geriye dönük etkilemez; yalnızca sonraki öneriye uygular.
   */
  get zamanAsimiMs(): number { return this._zamanAsimi(); }
  gecmis(): KarardanSonra[] { return [...this._gecmis]; }

  /**
   * Öneri sun. Zaten bekleyen varsa REDDEDİLİR — ezme yok.
   *
   * Neden: model arka arkaya öneri gönderirse kullanıcı bir öneriyi okurken
   * ekrandaki metin değişir ve onay tuşu BAŞKA bir komuta basmış olur.
   * Bu, onayın anlamını yok eder.
   */
  oner(id: string, komut: string, gerekce: string): OneriSonucu {
    const simdi = this._simdi();
    this._zamanAsimiKontrol(simdi);

    if (this._bekleyen) {
      this._sayac.ezilmeyeCalisan++;
      return {
        kabul: false,
        sebep: `zaten onay bekleyen bir öneri var ("${this._bekleyen.komut}"); ` +
               "Ozyn karar verene kadar yeni öneri gönderme",
      };
    }
    const k = komut.trim();
    if (!k) return { kabul: false, sebep: "boş komut önerilemez" };

    this._bekleyen = {
      id, komut: k, gerekce: gerekce.trim(), risk: komutRiski(k), an: simdi,
      sonTarih: simdi + this._zamanAsimi(),   // DONDURULDU
    };
    this._sayac.onerilen++;
    return { kabul: true };
  }

  /**
   * Ozyn onayladı. Çalıştırılacak komutu döner; bekleyen yoksa null.
   *
   * Bu fonksiyonu çağırmanın TEK meşru yolu gerçek bir kullanıcı eylemidir.
   * Zamanlayıcıdan, modelden ya da otomatik bir akıştan çağrılmamalıdır.
   */
  onayla(): Oneri | null {
    const simdi = this._simdi();
    this._zamanAsimiKontrol(simdi);
    const o = this._bekleyen;
    if (!o) return null;
    this._bekleyen = null;
    this._sayac.onaylanan++;
    this._kaydet(o, "onay", simdi);
    return o;
  }

  /** Ozyn reddetti. Model bunu geri besleme olarak görür. */
  reddet(): Oneri | null {
    const simdi = this._simdi();
    this._zamanAsimiKontrol(simdi);
    const o = this._bekleyen;
    if (!o) return null;
    this._bekleyen = null;
    this._sayac.reddedilen++;
    this._kaydet(o, "ret", simdi);
    return o;
  }

  /**
   * Zamanı geldiyse bekleyen öneriyi düşürür ve döner.
   * Dünya döngüsünden çağrılır; düşen öneri ASLA onaylanmış sayılmaz.
   */
  tikle(simdiMs?: number): Oneri | null {
    return this._zamanAsimiKontrol(simdiMs ?? this._simdi());
  }

  /**
   * Bekleyen öneriyi Ozyn elle iptal etti (panodan).
   *
   * Bu bir AYAR değil EYLEMDİR: zaman aşımını kısaltarak öneri düşürmek
   * denetim izini kirletir ("dustu" yazar, oysa insan iptal etmiştir).
   * Ayrı karar türü olması izin dürüst kalmasını sağlar.
   */
  elleDusur(gerekce = ""): Oneri | null {
    const simdi = this._simdi();
    const o = this._bekleyen;
    if (!o) return null;
    this._bekleyen = null;
    this._sayac.elleDusurulen++;
    this._kaydet(o, "elle_dusuruldu", simdi);
    if (gerekce) console.log(`[ONAY] elle dusuruldu: ${o.komut} — ${gerekce}`);
    return o;
  }

  private _zamanAsimiKontrol(simdi: number): Oneri | null {
    const o = this._bekleyen;
    if (!o) return null;
    // Dondurulmuş son tarih. Ayar sonradan değişse bile bu öneri kendi
    // sözleşmesiyle yaşar; yeni ayar SONRAKİ öneriye uygulanır.
    if (simdi < o.sonTarih) return null;
    this._bekleyen = null;
    this._sayac.dusen++;
    this._kaydet(o, "dustu", simdi);
    return o;
  }

  private _kaydet(o: Oneri, karar: KarardanSonra["karar"], simdi: number): void {
    this._gecmis.push({ oneri: o, karar, sureMs: simdi - o.an });
    // Denetim izi sınırsız büyümesin; son 200 karar yeter.
    if (this._gecmis.length > 200) this._gecmis.splice(0, this._gecmis.length - 200);
  }
}
