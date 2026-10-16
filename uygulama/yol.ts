// uygulama/yol.ts — kompozisyon kökünün YOLU: tipli olay yayını + tipli canlı servis kaydı. Saf (DOM ve Babylon yok).
//
// Neden: kökteki iletişim dağınıktı (ölçüm 2026-10-16, `tools/kablo-haritasi.ts`): 23 `…Dinle` aboneliği her yayıcının kendi `dinle`si
// üzerinden, 21 sonradan atanan canlı nesne (`orion`, `kopru` …) modül kapsamlı `let` + `() => ad` getter'ı olarak. Kim kimi dinliyor, kim neyi
// okuyor tek yerde yazılı değildi. Yol bunu iki tabloya indirir: OLAYLAR (konu → yük) ve SERVİSLER (ad → canlı nesne).
//
// Bu dosya TABLOLARI tanımlamaz: konu ve servis adları `yolKur<O, S>()`e tip olarak verilir (kökte, `uygulama/yolTipleri.ts`). Yol genel, tablo ürüne özel.
//
// Kurallar (testli, `yol.test.ts`):
//   • Aboneler KAYIT SIRASIYLA çağrılır: mantık döngüsü tekrarlanabilir kalmalı (K1/K2).
//   • Bir abone fırlatırsa diğerleri yine çalışır ve hata konu adıyla bildirilir (yayıncı, aboneden habersizdir). Takas: 20Hz döngüde bir abonenin hatası
//     döngüyü durdurmaz, loga düşer.
//   • Yayın sırasında eklenen abone O yayında çağrılmaz; çağrılmadan önce bırakılan abone atlanır.
//   • Servis ikinci kez kaydedilirse FIRLATIR (sessiz üzerine yazma yok); `birak` sonrası yeniden kaydedilebilir (ofis ↔ ova gibi).
//   • `al` kayıtsız servis için null döner; tüketici null'u kendi durumuna göre ele alır (bugünkü `kopru?.` desenleriyle aynı).
"use strict";

export type Birak = () => void;

export interface Yol<O extends object, S extends object> {
  /** Konuya abone ol. Dönen işlev aboneliği bırakır. */
  dinle<K extends keyof O>(konu: K, isleyici: (yuk: O[K]) => void): Birak;
  /** Konunun bütün abonelerini kayıt sırasıyla çağırır. Abonesiz konu sessizce geçer. */
  yayinla<K extends keyof O>(konu: K, yuk: O[K]): void;
  /** Canlı servisi kaydet. Aynı ad ikinci kez kaydedilirse fırlatır. */
  kaydet<A extends keyof S>(ad: A, deger: S[A]): void;
  /** Servisi bırak (kayıt kalkar; sonra yeniden kaydedilebilir). */
  birak<A extends keyof S>(ad: A): void;
  /** Şu anki servis; kurulmadıysa ya da bırakıldıysa null. */
  al<A extends keyof S>(ad: A): S[A] | null;
}

export interface YolAyari {
  /** Abone hatası bildirimi (varsayılan: console.error). */
  hata?: (konu: string, hata: unknown) => void;
}

interface Kayit { readonly isleyici: (yuk: unknown) => void; canli: boolean }

export function yolKur<O extends object, S extends object>(ayar: YolAyari = {}): Yol<O, S> {
  const hata = ayar.hata ?? ((konu, e) => console.error(`[YOL] '${konu}' abonesi düştü:`, e));
  const aboneler = new Map<keyof O, Kayit[]>();
  const servisler = new Map<keyof S, unknown>();

  return {
    dinle(konu, isleyici) {
      const kayit: Kayit = { isleyici: isleyici as (yuk: unknown) => void, canli: true };
      const liste = aboneler.get(konu) ?? [];
      liste.push(kayit);
      aboneler.set(konu, liste);
      return () => {
        kayit.canli = false;
        const l = aboneler.get(konu);
        const i = l ? l.indexOf(kayit) : -1;
        if (l && i >= 0) l.splice(i, 1);
      };
    },
    yayinla(konu, yuk) {
      const liste = aboneler.get(konu);
      if (!liste) return;
      for (const k of [...liste]) {   // kopya: yayın sırasında eklenen bu yayında çağrılmaz
        if (!k.canli) continue;        // çağrılmadan önce bırakıldı
        try { k.isleyici(yuk); } catch (e) { hata(String(konu), e); }
      }
    },
    kaydet(ad, deger) {
      if (servisler.has(ad)) throw new Error(`yol: '${String(ad)}' servisi zaten kayıtlı (önce birak)`);
      servisler.set(ad, deger);
    },
    birak(ad) { servisler.delete(ad); },
    al(ad) { const v = servisler.get(ad); return v === undefined ? null : (v as S[typeof ad]); },
  };
}
