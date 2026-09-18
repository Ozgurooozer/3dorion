// host/kanallar.cjs — IPC kanal adlarının TEK KAYNAĞI.
//
// Neden .cjs: main.js ESM, preload.cjs CJS, kopru.ts TypeScript. Üçü de bunu
// okuyabilsin diye en küçük ortak payda seçildi (ESM, CJS'i import edebilir).
//
// Bu dosya var çünkü kanal adları bir kez kopyalandı ve sonuç şu oldu:
// main.js'e `sesVarMi` eklenmedi, `ipcMain.handle(undefined, ...)` sessizce
// hiçbir şey kaydetmedi, renderer "TTS kurulu değil" sandı. Kopya yok artık.
"use strict";

/** Renderer → main (yanıt bekleyen çağrı veya tek yönlü gönderim). */
const CAGRI = {
  ptyAc:    "pty:ac",
  ptiYaz:   "pty:yaz",
  ptyBoyut: "pty:boyut",
  ptyKapat: "pty:kapat",
  sesUret:  "ses:uret",
  sesVarMi: "ses:var",
  varlik:   "varlik:yol",
  // Hafıza dosyası (spec 07 K4). Okuma SENKRON: `bridge/kopru.ts` depoyu
  // kurucuda senkron okuyor ve K7 arayüzü değiştirmeyi yasaklıyor. Açılışta
  // tek sefer, küçük bir dosya — renderer'ı bloklaması kabul edilebilir.
  hafizaOku:         "hafiza:oku",
  /** Tek yönlü; main sıralı ve atomik yazar. */
  hafizaYaz:         "hafiza:yaz",
  /** Göç için senkron yazım: göç, sonucu bilmeden "taşındı" diyemez. */
  hafizaYazSenkron:  "hafiza:yaz-senkron",
};

/** Main → renderer (tek yönlü olay). */
const OLAY = {
  ptyCikti: "pty:cikti",
  ptyBitti: "pty:bitti",
};

module.exports = { CAGRI, OLAY };
