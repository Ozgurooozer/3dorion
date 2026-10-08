// uygulama/terminalYazici.ts — Onaylanan komutu masadaki terminale yazar; Orion NEREDE OLURSA OLSUN.
//
// Ozyn (2026-10-08): "nerede olursa olsun monitördeki terminali kullanabilsin." Komutun yolu zaten
// konumdan bağımsızdı (`dunya_komut` → onay kapısı → Ozyn'in Y'si → terminal) ve terminal çıktısı Orion'a
// her yerden ulaşıyor. Tek engel: terminal KAPALIYKEN onay `monitoreGec()`e gidiyordu — Ozyn'in
// kamerasını monitöre kilitliyor ve klavye odağını terminale veriyordu. Orion odanın öbür ucundan bir
// komut önerdiğinde Ozyn'in görüşü kaçırılıyordu (spec 13'te "bilgisayarı aç" için çözülen hatanın aynısı).
//
// Artık: kapalıysa terminal ARKA PLANDA açılır (pty), komut yazılır; kamera ve odak Ozyn'de kalır.
// ONAY KAPISI DEĞİŞMEZ: buraya yalnız Ozyn'in onayladığı komut gelir.
"use strict";

/** Monitörün bu iş için gereken yüzü (world/surfaces/monitor.ts). */
export interface YazilacakTerminal {
  acikMi(): boolean;
  ac(): Promise<void>;
  yaz(veri: string): void;
}

const ENTER = String.fromCharCode(13);

/**
 * Komutu terminale yazar; kapalıysa önce arka planda açar. Açılamazsa reddeder (çağıran Orion'a ve
 * Ozyn'e söyler) — sessizce düşmez.
 */
export async function komutuTerminaleYaz(t: YazilacakTerminal, komut: string): Promise<void> {
  if (!t.acikMi()) await t.ac();
  t.yaz(komut + ENTER);
}
