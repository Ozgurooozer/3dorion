// world/surfaces/ciktiFarki.ts — Terminal kuyruğundan YALNIZCA yeni satırlar.
//
// `Monitor.kuyruk()` kayan bir pencere döndürür: her çağrıda son N satır.
// İki çağrı arasındaki farkı almadan beyne yollamak, aynı 24 satırı saniyede
// bir tekrar tekrar göndermek demektir — bağlamı çöpe çevirir.
//
// SAF: Babylon yok, durum yok, zaman yok. Girdi iki metin, çıktı bir metin.
//
// Kayıp olması KABUL: Orion masasındaki ekrana göz atan biri, akan her satırı
// okuyan bir log toplayıcı değil. İki örnekleme arasında kayıp giden çıktı
// bilinçli olarak kaybedilir.
"use strict";

/** Beyne tek seferde gidebilecek azami satır — bağlam freni. */
export const AZAMI_SATIR = 40;
/** Beyne tek seferde gidebilecek azami karakter. */
export const AZAMI_KARAKTER = 1600;

/** Sondaki boş satırları atar: 24 satırlık tampon boşlukla dolu gelir. */
function sagiKirp(satirlar: string[]): string[] {
  let son = satirlar.length;
  while (son > 0 && (satirlar[son - 1] ?? "").trim() === "") son--;
  return satirlar.slice(0, son);
}

/**
 * `onceki` ve `yeni` kuyruk anlık görüntüleri arasındaki YENİ içerik.
 *
 * Örtüşme araması satır tabanlıdır: `onceki`nin sonu ile `yeni`nin başı
 * arasındaki EN UZUN örtüşme bulunur, yeni içerik onun ardından gelendir.
 * Ekran temizlenirse örtüşme sıfır çıkar ve her şey yeni sayılır — doğrusu bu.
 */
export function ciktiFarki(onceki: string, yeni: string): string {
  const eski = sagiKirp(onceki.split("\n"));
  const taze = sagiKirp(yeni.split("\n"));
  if (taze.length === 0) return "";
  if (eski.length === 0) return kirp(taze);

  const azami = Math.min(eski.length, taze.length);
  for (let k = azami; k > 0; k--) {
    let uydu = true;
    for (let i = 0; i < k; i++) {
      if (eski[eski.length - k + i] !== taze[i]) { uydu = false; break; }
    }
    if (uydu) return kirp(taze.slice(k));
  }
  // Hiç örtüşme yok: ekran tamamen değişmiş (temizlenmiş, yeni komut).
  return kirp(taze);
}

/** Satır ve karakter tavanını uygular; kesilirse bunu GÖRÜNÜR yapar. */
function kirp(satirlar: string[]): string {
  if (satirlar.length === 0) return "";
  let kesildi = false;
  let s = satirlar;
  if (s.length > AZAMI_SATIR) { s = s.slice(s.length - AZAMI_SATIR); kesildi = true; }
  let metin = s.join("\n");
  if (metin.length > AZAMI_KARAKTER) { metin = metin.slice(metin.length - AZAMI_KARAKTER); kesildi = true; }
  return kesildi ? `…\n${metin}` : metin;
}

/** Kesilme olup olmadığı — protokolün `terminal.kesildi` alanı için. */
export function kesildiMi(metin: string): boolean {
  return metin.startsWith("…\n");
}
