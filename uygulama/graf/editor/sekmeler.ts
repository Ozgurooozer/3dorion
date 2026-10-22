// uygulama/graf/editor/sekmeler.ts — EDİTÖR SEKMELERİ ("farklı canvas'lar", spec 35 dilim 2b): açık grafik/desen sekmeleri, etkin sekme, KAPATMA ONAYI.
// SAF; sekmenin içeriği (geçmiş, görünüm, seçim) türden bağımsız `S` olarak tutulur.
//
// Unreal'in Event Graph / Fonksiyon sekmeleri gibi: aynı anda birden çok grafik açık; aynı grafik ikinci kez açılırsa yeni sekme DOĞMAZ, var olan etkin
// olur. KAPATMA KURALI: kaydedilmemiş değişikliği olan sekme ONAYSIZ kapanmaz — ilk istek "onay gerek" döner (arayüz "Kaydedilmemiş değişiklik:
// tekrar tıkla" der), yalnız onaylı ikinci istek kapatır ve değişiklik gider. Kirli değilse hemen kapanır. Etkin sekme kapanınca sağdaki (yoksa soldaki) olur.
// Editörü GİZLEMEK (Esc) sekmeleri kapatmaz: yazılmış değişiklik bellekte kalır, editör yeniden açılınca geri gelir (editorPenceresi'nin kuralı).
"use strict";

export interface SekmeDurumu<S> { ad: string; icerik: S }

export type KapatmaSonucu = "kapandi" | "onay-gerek" | "yok";

export interface SekmeListesi<S> {
  /** Açıksa etkin yapar (içerik değişmez); değilse `kur()` ile açar. Etkin sekmeyi döner. */
  ac(ad: string, kur: () => S): SekmeDurumu<S>;
  /** Kapatma isteği: kirliyse ve `onaylandi` değilse kapanmaz ("onay-gerek"). */
  kapat(ad: string, onaylandi: boolean): KapatmaSonucu;
  etkin(): SekmeDurumu<S> | null;
  etkinYap(ad: string): boolean;
  hepsi(): readonly SekmeDurumu<S>[];
  al(ad: string): SekmeDurumu<S> | null;
  /** Sekmenin adı değişti (grafik yeniden adlandırıldı): içerik korunur. */
  adDegistir(eski: string, yeni: string): boolean;
  /** Kirli sekmelerin adları (editörü gizlerken uyarı). */
  kirliler(): string[];
}

export function sekmeListesiKur<S>(kirliMi: (s: S) => boolean): SekmeListesi<S> {
  let sekmeler: SekmeDurumu<S>[] = [];
  let etkinAd: string | null = null;
  const bul = (ad: string) => sekmeler.find((s) => s.ad === ad) ?? null;
  return {
    ac(ad, kur) {
      let s = bul(ad);
      if (!s) { s = { ad, icerik: kur() }; sekmeler = [...sekmeler, s]; }
      etkinAd = ad;
      return s;
    },
    kapat(ad, onaylandi) {
      const i = sekmeler.findIndex((s) => s.ad === ad);
      if (i < 0) return "yok";
      if (kirliMi(sekmeler[i]!.icerik) && !onaylandi) return "onay-gerek";
      sekmeler = sekmeler.filter((_, j) => j !== i);
      if (etkinAd === ad) etkinAd = (sekmeler[i] ?? sekmeler[i - 1])?.ad ?? null;
      return "kapandi";
    },
    etkin: () => (etkinAd ? bul(etkinAd) : null),
    etkinYap(ad) { if (!bul(ad)) return false; etkinAd = ad; return true; },
    hepsi: () => sekmeler,
    al: bul,
    adDegistir(eski, yeni) {
      const s = bul(eski);
      if (!s || bul(yeni)) return false;
      sekmeler = sekmeler.map((x) => (x === s ? { ad: yeni, icerik: x.icerik } : x));
      if (etkinAd === eski) etkinAd = yeni;
      return true;
    },
    kirliler: () => sekmeler.filter((s) => kirliMi(s.icerik)).map((s) => s.ad),
  };
}
