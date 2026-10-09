// world/level/editor/cekirdek/gecmis.ts — Geri al / ileri al. Saf, türden bağımsız (anlık görüntü).
//
// Neden anlık görüntü (komut nesnesi değil): level tanımı değişmez veri ve her düzenleme bütün tanımı `ayarla`ya
// verir — tersini yazmak gereken komut sınıfları yerine "önceki hâl" saklamak hem basit hem HATASIZ (tersi yanlış
// yazılmış komut olamaz). Bellek: ova tanımı ~15 KB; 200 adım ~3 MB.
//
// BİRLEŞTİRME: aynı `anahtar`la art arda gelen adımlar (sürgü sürükleme, ok tuşuyla kaydırma) `birlesmeSuresi`
// içinde tek adım olur — Ctrl+Z bir sürüklemenin tamamını geri alır, her karesini değil.
"use strict";

export interface Adim<T> {
  /** Bu adımdan ÖNCEKİ hâl (geri alınca dönülecek). */
  hal: T;
  mesaj: string;
  anahtar?: string;
  zaman: number;
}

export interface Gecmis<T> {
  /** `onceki` hâlden yeni bir hâle geçildi: önceki saklanır, ileri yığını boşalır. */
  ekle(onceki: T, mesaj: string, secenek?: { anahtar?: string; zaman?: number }): void;
  /** Şu anki hâli verir, dönülecek hâli alır (yoksa null). */
  geriAl(simdiki: T): { hal: T; mesaj: string } | null;
  ileriAl(simdiki: T): { hal: T; mesaj: string } | null;
  geriSayisi(): number;
  ileriSayisi(): number;
  /** Geri yığınındaki mesajlar (eskiden yeniye) — geçmiş listesi. */
  mesajlar(): string[];
  temizle(): void;
}

export function gecmisKur<T>(sinir = 200, birlesmeSuresi = 1000): Gecmis<T> {
  const geri: Adim<T>[] = [];
  const ileri: Adim<T>[] = [];
  // Geri/ileri alındıktan sonraki ilk düzenleme eski adıma KAYNAŞMAZ (geri alınan sürüklemenin öncesine yapışmasın).
  let birlesebilir = true;
  return {
    ekle(onceki, mesaj, s = {}) {
      const zaman = s.zaman ?? Date.now();
      const son = geri[geri.length - 1];
      ileri.length = 0;
      const birles = birlesebilir && s.anahtar && son && son.anahtar === s.anahtar && zaman - son.zaman <= birlesmeSuresi;
      birlesebilir = true;
      if (birles) {
        // Aynı işin devamı: en eski "önceki" kalır, zaman ve mesaj tazelenir.
        son.zaman = zaman;
        son.mesaj = mesaj;
        return;
      }
      geri.push({ hal: onceki, mesaj, ...(s.anahtar ? { anahtar: s.anahtar } : {}), zaman });
      if (geri.length > sinir) geri.shift();
    },
    geriAl(simdiki) {
      const a = geri.pop();
      if (!a) return null;
      birlesebilir = false;
      ileri.push({ hal: simdiki, mesaj: a.mesaj, zaman: a.zaman });
      return { hal: a.hal, mesaj: a.mesaj };
    },
    ileriAl(simdiki) {
      const a = ileri.pop();
      if (!a) return null;
      birlesebilir = false;
      geri.push({ hal: simdiki, mesaj: a.mesaj, zaman: a.zaman });
      return { hal: a.hal, mesaj: a.mesaj };
    },
    geriSayisi: () => geri.length,
    ileriSayisi: () => ileri.length,
    mesajlar: () => geri.map((a) => a.mesaj),
    temizle() { geri.length = 0; ileri.length = 0; },
  };
}
