// voice/tip.ts — Ses hattının takılabilir arayüzleri.
//
// TASARIM GEREKÇESİ: bu makinede (2026-09-11 ölçümü) mikrofon YOK — yalnızca
// çıkış aygıtları var, Electron'da Web Speech `not-allowed` dönüyor. Donanım
// gelene kadar konuşma girdisi yazılamaz. Bu yüzden girdi bir ARAYÜZ:
// bugün metin ve sahte-mikrofon uygulamaları çalışır, mikrofon takıldığında
// üçüncü bir uygulama eklenir ve hattın geri kalanı değişmez.
//
// Ölçülmemiş bir şeyi yazmıyoruz: `web-speech.ts` mikrofon gelince, canlı
// doğrulanabilir olduğunda yazılacak.
"use strict";

/** Bir konuşma girdisinden gelen tanıma sonucu. */
export interface Tanima {
  metin: string;
  /** false = ara sonuç (kullanıcı hâlâ konuşuyor), true = nihai. */
  kesin: boolean;
  /** 0..1 arası, kaynak sağlıyorsa. */
  guven?: number;
}

/**
 * Konuşma girdisi kaynağı. Mikrofon, metin kutusu veya kayıttan oynatma —
 * hat için hepsi aynıdır.
 */
export interface KonusmaKaynagi {
  readonly ad: string;
  /** Kaynak bu ortamda gerçekten çalışabilir mi? */
  kullanilabilir(): boolean;
  baslat(): Promise<void>;
  durdur(): void;
  /** Abonelikten çıkma fonksiyonu döner. */
  dinle(cb: (t: Tanima) => void): () => void;
  /** Kaynak hatası — sessiz düşmez, üst katman kullanıcıya gösterir. */
  hataDinle(cb: (hata: string) => void): () => void;
}

/** Orion'un sesi: metni sese çevirip çalar, ağız senkronu için nabız yayar. */
export interface SesCikisi {
  kullanilabilir(): boolean;
  /** Konuşmayı başlatır; ses bitince çözülür. Hata durumunda reddetmez, false döner. */
  soyle(metin: string): Promise<boolean>;
  /** Konuşmayı anında kes (niyet: "dur"). */
  kes(): void;
  konusuyorMu(): boolean;
  /**
   * Ağız açıklığı 0..1, ses çalarken ~60Hz güncellenir.
   * Avatar (T2) bunu `setBlend("agiz", deger)` için okur.
   */
  agizAcikligi(): number;
}
