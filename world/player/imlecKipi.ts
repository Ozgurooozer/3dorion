// world/player/imlecKipi.ts — İMLEÇ KİPİ (Tab, spec 28): gezinirken imleç SERBEST, tıklama nesne seçer. Durum makinesi; DOM ve Babylon yok.
//
// Üç fare durumu var (`world/engine/fareKipi.ts`): gezinirken kilitli imleç kamerayı sürer, odakta (ekran/panel) imleç serbest, ve bu kip: gezinirken
// ama imleç serbest, tıklama kilide GİTMEZ. Burası yalnız "açık mı" kararını ve kilidin ne zaman bırakılıp alınacağını tutar; farenin ne yapacağını
// `fareKipi.ts` (rig imleç kaynağını `acik`a bağlar), seçimi `uygulama/nesneSecimi.ts` bilir.
//
// Esc ile kapanırken kilit İSTENMEZ: tarayıcı Esc'ten hemen sonra kilit istemeyi reddeder ("Pointer lock cannot be acquired immediately after the user
// has exited the lock", canlı log 2026-10-16); kullanıcı tuvale tıklayınca kilit zaten alınır. Tab ile kapanırken istenir (tuş bir kullanıcı hareketidir).
"use strict";

export interface ImlecKipiAyari {
  /** Fare kilidini bırak (kip açılırken). */
  kilidiBirak: () => void;
  /** Fare kilidini geri iste (Tab ile kapanırken). */
  kilidiIste: () => void;
  /** Kip şimdi AÇILAMAZ mı: odak (terminal/panel), yazan sohbet, bekleyen onay. Yalnız açmayı engeller; açık kip her zaman kapatılabilir. */
  engelli: () => boolean;
  /** Durum değişti (HUD, seçim vurgusu temizliği). */
  degisti?: (acik: boolean) => void;
}

export interface ImlecKipi {
  readonly acik: boolean;
  /** Açıksa kapatır (kilit alınır), kapalıysa açar. Değişiklik oldu mu. */
  degistir(): boolean;
  /** Engelli değilse açar. Değişiklik oldu mu. */
  ac(): boolean;
  /** Açıksa kapatır. `kilitle`: kilit yeniden istensin mi (Esc'te false). Değişiklik oldu mu. */
  kapat(kilitle?: boolean): boolean;
}

export function imlecKipiKur(a: ImlecKipiAyari): ImlecKipi {
  let acik = false;
  const kip: ImlecKipi = {
    get acik() { return acik; },
    ac() {
      if (acik || a.engelli()) return false;
      acik = true;
      a.kilidiBirak();
      a.degisti?.(true);
      return true;
    },
    kapat(kilitle = true) {
      if (!acik) return false;
      acik = false;
      if (kilitle) a.kilidiIste();
      a.degisti?.(false);
      return true;
    },
    degistir() { return acik ? kip.kapat(true) : kip.ac(); },
  };
  return kip;
}
