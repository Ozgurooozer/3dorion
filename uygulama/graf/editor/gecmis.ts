// uygulama/graf/editor/gecmis.ts — GERİ AL / YİNELE YIĞINI ve KİRLİ İŞARETİ (spec 35 dilim 2b). SAF, genel (değer türünden bağımsız).
//
// Anlık görüntü (snapshot) yığını: her değişiklik grafiğin YENİ bir kopyasıdır (grafIslemleri.ts değiştirilemez), yığın onları olduğu gibi tutar —
// "ters işlem" yazmak yerine eski hâle dönülür (hata payı yok: ne kaydedildiyse o döner). Kurallar:
//   • TAVANLI: en çok `tavan` görüntü; aşılınca EN ESKİ düşer (200 düğümlük grafiğin yüz kopyası bile birkaç MB; sınırsız yığın uzun oturumda büyürdü);
//   • yeni değişiklik "yinele" dalını siler (klasik davranış);
//   • aynı değer (işlem hiçbir şey değiştirmedi) yığına girmez;
//   • KİRLİ = şu anki görüntü kaydedilen görüntü değil. Geri alıp kaydedilmiş hâle dönünce kirli DEĞİLDİR; kaydedilen görüntü tavandan düşerse ona
//     bir daha dönülemez, kirli kalır (doğru: diskteki hâl artık yığında yok).
"use strict";

export const GECMIS_TAVANI = 100;

export interface Gecmis<T> {
  simdiki(): T;
  /** Yeni hâl (öncekiyle aynı nesneyse yok sayılır). */
  kaydet(yeni: T): void;
  /** Bir adım geri; geri alınacak yoksa null. */
  geriAl(): T | null;
  yinele(): T | null;
  geriAlinabilir(): boolean;
  yinelenebilir(): boolean;
  /**
   * Şu anki hâl (ya da `deger` verildiyse YIĞINDAKİ o hâl) diske yazıldı. Kaydetme eşzamansızdır: yazarken bir değişiklik daha yapıldıysa kaydedilen
   * görüntü şu anki değildir — o zaman yalnız yazılan işaretlenir, sekme kirli kalır. Yazılan yığından düştüyse hiçbir şey temiz sayılmaz.
   */
  kaydedildi(deger?: T): void;
  kirli(): boolean;
  /** Dışarıdan yeniden yüklendi (diskteki hâl): yığın sıfırlanır, kirli değil. */
  sifirla(t: T): void;
  /** Yığındaki görüntü sayısı (testler, tavan). */
  boyut(): number;
}

export function gecmisKur<T>(ilk: T, tavan = GECMIS_TAVANI, esit: (a: T, b: T) => boolean = Object.is): Gecmis<T> {
  if (!(tavan >= 1)) throw new Error("geçmiş tavanı en az 1 olmalı");
  let sayac = 0;
  let yigin: { deger: T; no: number }[] = [{ deger: ilk, no: sayac }];
  let i = 0;
  let kayitli = 0;
  return {
    simdiki: () => yigin[i]!.deger,
    kaydet(yeni) {
      if (esit(yeni, yigin[i]!.deger)) return;
      yigin = yigin.slice(0, i + 1);
      yigin.push({ deger: yeni, no: ++sayac });
      if (yigin.length > tavan) yigin = yigin.slice(yigin.length - tavan);
      i = yigin.length - 1;
    },
    geriAl() { if (i === 0) return null; i--; return yigin[i]!.deger; },
    yinele() { if (i >= yigin.length - 1) return null; i++; return yigin[i]!.deger; },
    geriAlinabilir: () => i > 0,
    yinelenebilir: () => i < yigin.length - 1,
    kaydedildi(deger) {
      if (deger === undefined) { kayitli = yigin[i]!.no; return; }
      kayitli = yigin.find((x) => esit(x.deger, deger))?.no ?? -1;
    },
    kirli: () => yigin[i]!.no !== kayitli,
    sifirla(t) { yigin = [{ deger: t, no: ++sayac }]; i = 0; kayitli = sayac; },
    boyut: () => yigin.length,
  };
}
