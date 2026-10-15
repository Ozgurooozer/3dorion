// uygulama/altyazi.ts — Ekranın altındaki geçici altyazı (kullanıcıya geri bildirim; protokol mesajı ÜRETMEZ).
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2). Zamanlayıcı bu kapanışın içinde: her
// çağrı öncekinin gizleme sayacını iptal eder, son çağrı kazanır.
"use strict";

export function altyaziKur(el: HTMLElement): (metin: string, ms?: number) => void {
  let zaman: ReturnType<typeof setTimeout>;
  return (metin, ms = 2200) => {
    el.textContent = metin;
    el.dataset.gorunur = "1";
    clearTimeout(zaman);
    zaman = setTimeout(() => { el.dataset.gorunur = "0"; }, ms);
  };
}
