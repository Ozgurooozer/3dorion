// uygulama/devrePanosu.ts — Devre panosunun telleri ve kayıt defterinin kurulumu.
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2). Sözleşme `protocol/`ta, tanımlar `mind/tanim/`da;
// bu iki import K4'ün belgelenmiş istisnası olan kompozisyon katmanında (uygulama/) birleşir.
"use strict";
import { panoKur, tel } from "../protocol/pano.ts";
import type { Pano } from "../protocol/pano.ts";
import {
  dikkatTanimi, hafizaTanimi, onayTanimi, ajandaTanimi, refleksTanimi, beyinTanimi,
} from "../mind/tanim/index.ts";
import type { Kopru } from "../bridge/kopru.ts";
import type { Beyin } from "../bridge/beyin.ts";
import type { Ajanda } from "../mind/ajanda.ts";
import type { OnayKapisi } from "../mind/onayKapisi.ts";
import type { SemaPaneli } from "../world/surfaces/duvar/sema.ts";
import type { beyinSeciminiKur } from "./beyinSecimi.ts";
import { hafizaUnutTeli } from "./hafizaDeposu.ts";
import { OTO_ARALIK_MS, OTO_ESIK } from "../mind/sikistir.ts";
import { MD_SINIRLARI } from "../mind/mdBaglami.ts";

/**
 * DEVRE PANOSU TELLERİ — yazılabilir ayarların tek doğruluk kaynağı.
 *
 * Değer modülün içinde değil BURADA duruyor. Modül teli okur, pano aynı
 * teli okur ve yazar; ikisinin ayrışması yapısal olarak imkânsız.
 *
 * Başlangıç değerleri modüllerin kendi varsayılanlarıyla AYNI — telin
 * takılması davranışı değiştirmemeli, yalnızca değiştirilebilir kılmalı.
 */
export const PANO_TELLERI = {
  dikkat: { tekrar: tel(4000), terminalKis: tel(2500), azami: tel(20) },
  ajanda: { asgari: tel(15_000), sapma: tel(15_000) },
  hafiza: {
    kapasite: tel(300),
    // Bağlamı şişirmeme ayarları: başlangıç değerleri eski sabitler (davranış değişmez); kalıcılığı `uygulama/hafizaAyari.ts`.
    otoEsik: tel(OTO_ESIK), otoAralikDk: tel(OTO_ARALIK_MS / 60_000),
    mdToplam: tel(MD_SINIRLARI.toplam), mdDosya: tel(MD_SINIRLARI.dosyaBasina),
  },
  onay: { zamanAsimi: tel(90_000) },
  // Doğuştan komut programları (spec 13 Faz 2b) açık mı: başlangıç değerini köprü kurulumu açılış kuralından yazar (`yetkiAnahtarlari`: elle açılışta
  // açık, senaryoda kapalı); ayar paneli/duvar çalışma anında değiştirir (spec 34). Kalıcı değil.
  refleks: { komut: tel<boolean>(true) },
} as const;

export interface DevrePanosuGirdisi {
  kopru: Kopru;
  onayKapisi: OnayKapisi;
  ajanda: Ajanda;
  beyin: Beyin;
  secici: ReturnType<typeof beyinSeciminiKur>["secici"];
  kesikSn: () => number;
  sema: SemaPaneli;
}

/**
 * DEVRE PANOSU kayıt defteri.
 *
 * Kompozisyon kökü kurar (K4'ün belgelenmiş tek istisnası): `world/`
 * içindeki hiçbir dosya `mind/`i görmez, yalnızca `protocol/pano.ts`
 * tipini bilir. Kayıt defteri burada doğar ve panele TAKILIR.
 *
 * Beyin tanımı bir sınıf örneği değil üç okuyucu alıyor: koşan beynin
 * durumu (ad, devre kesici) tek bir nesnede toplanmış değil ve sahte bir
 * nesne uydurmak, panonun tam da kaçındığı kopya-durum olurdu.
 */
export function devrePanosuKur(d: DevrePanosuGirdisi): Pano {
  const { kopru, onayKapisi, ajanda, beyin, secici, kesikSn, sema } = d;
  const panoKaydi = panoKur([
    dikkatTanimi(kopru.dikkat, PANO_TELLERI.dikkat),
    hafizaTanimi(kopru.hafiza, { ...PANO_TELLERI.hafiza, ...hafizaUnutTeli(kopru) }),
    onayTanimi(onayKapisi, PANO_TELLERI.onay),
    ajandaTanimi(ajanda, PANO_TELLERI.ajanda),
    refleksTanimi(PANO_TELLERI.refleks),
    beyinTanimi({
      ad: () => beyin.ad,
      kesikSaniye: () => kesikSn(),
      yakinlikKurali: () => true,
      secim: {
        istenen: () => secici.istenen,
        iste: (ad) => secici.iste(ad),
        secenekler: () => secici.secenekAdlari(),
        durum: () => {
          const g = secici.gecis;
          if (g.tur === "kontrol") return `${secici.aktif} → ${g.hedef} (kontrol)`;
          if (g.tur === "reddedildi") return `${secici.aktif} (${g.hedef} reddedildi)`;
          return beyin.ad;
        },
      },
    }),
  ]);
  sema.panoBagla(panoKaydi);
  return panoKaydi;
}

/**
 * ── ÖLÇÜM KİLİDİ: panelden AÇILMAZ, bilerek ─────────────────────────
 *
 * Kilidi açmak GEREKÇE ister ve gerekçe yazmak metin girişi gerektirir;
 * odadaki panelin klavyesi yok. Panele "aç" düğmesi koyup gerekçeyi
 * uydurmak, kilidin tek işlevini — sürtünmeyi — ortadan kaldırırdı.
 * Bu yüzden açma yolu yönetim terminalinden geçer ve yazılı bir cümle
 * ister. Kapatmak damgayı KALDIRMAZ.
 */
export function olcumKilidiKancasiKur(panoKaydi: Pano): void {
  window.orionPano = {
    kilitAc: (gerekce: string) => panoKaydi.kilitAc(gerekce),
    kilitKapat: () => panoKaydi.kilitKapat(),
    durum: () => ({
      kilitAcik: panoKaydi.kilitAcikMi(),
      olcumDisi: panoKaydi.olcumDisi(),
      gerekce: panoKaydi.kilitGerekcesi(),
    }),
  };
}
