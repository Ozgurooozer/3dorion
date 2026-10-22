// uygulama/graf/editor/renkler.ts — GÖRSEL EDİTÖRÜN RENKLERİ (spec 35 dilim 2b): kategori başlıkları ve pin türleri. SAF (yalnız sabit).
//
// Blueprint'in renk dili (akış beyaz, bool kırmızımsı, sayı yeşil, metin pembe, nesne mavi…) koyu temamıza uyarlandı. Kayıt tipleri `Record` olduğu için
// yeni bir pin türü ya da kategori eklenince renk vermeden derlenmez (unutulamaz). Panel zemini, çizgi ve vurgu Yapı ailesinin jetonları
// (world/arayuz/arayuzJetonlari.ts); burada yalnız editöre özgü renkler.
"use strict";
import type { PinTipi } from "../../../protocol/graf.ts";
import type { DugumKategorisi } from "../dugumKaydi.ts";

export const KATEGORI_RENGI: Readonly<Record<DugumKategorisi, string>> = {
  olay: "#8a2c2c",
  akis: "#3a4560",
  ajan: "#1f5d8a",
  dunya: "#1f6b5a",
  veri: "#2c5a33",
  desen: "#6a3d8a",
};

export const PIN_RENGI: Readonly<Record<PinTipi, string>> = {
  akis: "#f2f4fa",
  nesne: "#4aa3ff",
  ajan: "#ffb454",
  konum: "#e6d35a",
  sayi: "#6fdc8c",
  metin: "#f58fd0",
  bool: "#ff6b6b",
  herhangi: "#aab4d0",
};
