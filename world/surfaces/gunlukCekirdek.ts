// world/surfaces/gunlukCekirdek.ts — Zihin duvarı günlüğünün SAF çekirdeği.
//
// Neden ayrı dosya: Babylon'suz test edilebilsin. Çizim (gunluk.ts) yalnızca
// buradaki satırları boyar; hangi satırın tutulduğu, nasıl sarıldığı ve neyin
// düştüğü kararı burada ve sınanabilir.
//
// NEDEN VAR: beynin ne yaptığı şimdiye kadar yalnızca tarayıcı konsolundaydı —
// yani dünyanın DIŞINDA. Kota arızasında Orion 75 sn hiçbir şey yapmadı ve
// odada sebebi görünmedi. Günlük o körlüğü kapatır.
//
// SAF: bağımlılık yok (satır sarma dışında), yan etki yok.
"use strict";
import { satirlaraBol } from "./tahtaYazisi.ts";

export type Seviye = "bilgi" | "iyi" | "uyari" | "hata";

export interface Olay {
  /** Ne zaman (epoch ms). Çizim bunu saat:dakika:saniyeye çevirir. */
  ts: number;
  seviye: Seviye;
  /** Kim yazdı: "algi", "beyin", "niyet", "onay", "ariza"... */
  kaynak: string;
  metin: string;
}

/** Ekrana düşen tek bir görsel satır (sarma sonrası). */
export interface GorselSatir {
  seviye: Seviye;
  /** Yalnızca olayın İLK satırında dolu; devam satırlarında boş. */
  baslik: string;
  metin: string;
}

export interface GunlukCekirdegi {
  ekle(o: Olay): void;
  /** En yeni SONDA — terminal gibi okunur. */
  olaylar(): readonly Olay[];
  /**
   * Sütun genişliğine göre sarılmış, en fazla `satirSayisi` görsel satır.
   * En yeni olay en ALTTA; taşan ESKİ satırlar düşer.
   */
  gorunum(sutun: number, satirSayisi: number): GorselSatir[];
  /** Kaç olay düştü — sessiz kayıp olmasın diye sayılır. */
  readonly dusen: number;
  temizle(): void;
}

/** `hh:mm:ss` — günlük tek oturumluk, tarih gereksiz. */
export function saatBicimle(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * @param kapasite Bellekte tutulan azami olay sayısı. Ekrandan taşan eski
 *   olaylar hemen atılmaz: pencere daraldığında geri gelebilmeli, ayrıca
 *   ileride "günlüğü dök" gibi bir işlem için tarihçe gerekir.
 */
export function gunlukCekirdegiKur(kapasite = 300): GunlukCekirdegi {
  const halka: Olay[] = [];
  let dusen = 0;

  return {
    ekle(o) {
      halka.push(o);
      // Halka tamponu: en eski düşer ve SAYILIR. Sessiz kayıp yok — aynı
      // ilkeyi tahta da uyguluyor (bkz. tahta.ts).
      while (halka.length > kapasite) { halka.shift(); dusen++; }
    },
    olaylar: () => halka,
    get dusen() { return dusen; },
    temizle() { halka.length = 0; dusen = 0; },

    gorunum(sutun, satirSayisi) {
      if (sutun < 4 || satirSayisi < 1) return [];
      const cikti: GorselSatir[] = [];

      // SONDAN başa doğru gidilir: ekrana en yeni olaylar girsin. Baştan
      // gidip sonunu kesmek, 300 olay birikince ekranı tarihe kilitlerdi.
      for (let i = halka.length - 1; i >= 0 && cikti.length < satirSayisi; i--) {
        const o = halka[i]!;
        const baslik = `${saatBicimle(o.ts)} ${o.kaynak}`;
        // Başlık satırın solunda durur; metin kalan genişliğe sarılır.
        const govdeSutun = Math.max(4, sutun - baslik.length - 1);
        const parcalar = satirlaraBol(o.metin, govdeSutun);

        // Bu olayın satırları kendi içinde sırayla; blok olarak öne eklenir.
        const blok: GorselSatir[] = parcalar.map((p, k) => ({
          seviye: o.seviye,
          baslik: k === 0 ? baslik : "",
          metin: p,
        }));
        // Yer kalmadıysa olayın BAŞI kırpılır, sonu (en yeni bilgi) kalır.
        const yer = satirSayisi - cikti.length;
        cikti.unshift(...(blok.length > yer ? blok.slice(blok.length - yer) : blok));
      }
      return cikti;
    },
  };
}
