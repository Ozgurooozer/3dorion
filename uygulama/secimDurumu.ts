// uygulama/secimDurumu.ts — SEÇİLİ NESNE (spec 28): Ozyn'in fareyle gösterdiği tek nesne. Saf durum; DOM ve Babylon yok.
//
// Seçim Tab/tıklamayla yapılır ve imleç kipi KAPANINCA da kalır: Ozyn gösterir, sonra bakışını serbest bırakıp "buraya otur" der (söz sözlüğü ve Orion'un
// bağlamı seçiliyi buradan okur). Boşluğa tıklayınca ya da nesne yerden kalkınca kalkar. Değişiklik `degisti` ile bildirilir (kökte yol olayı
// `nesne.secildi`: vurgu ve HUD abone). Aynı nesneyi yeniden seçmek bir değişiklik DEĞİLDİR.
"use strict";
import type { Nesne } from "../world/level/nesneKaydi.ts";

export interface SecimDurumu {
  /** Şu an seçili nesne; yerde artık yoksa (yer değişti) temizlenir ve null döner. */
  oku(): Nesne | null;
  /** Seç (null = seçimi kaldır). Yerde olmayan nesne seçilmez. Değişiklik oldu mu. */
  sec(n: Nesne | null): boolean;
}

export interface SecimDurumuAyari {
  /** Seçilebilecek nesneler (şu anki yerin kaydı). */
  nesneler: () => readonly Nesne[];
  /** Seçim değişti (yeni seçili ya da null). */
  degisti: (n: Nesne | null) => void;
}

export function secimDurumuKur(a: SecimDurumuAyari): SecimDurumu {
  let secili: Nesne | null = null;
  const yerdeMi = (n: Nesne): boolean => a.nesneler().some((x) => x.id === n.id);
  return {
    oku() {
      if (secili && !yerdeMi(secili)) { secili = null; a.degisti(null); }
      return secili;
    },
    sec(n) {
      const yeni = n && yerdeMi(n) ? n : null;
      if ((yeni?.id ?? null) === (secili?.id ?? null)) return false;
      secili = yeni;
      a.degisti(secili);
      return true;
    },
  };
}
