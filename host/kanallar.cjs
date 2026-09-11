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
};

/** Main → renderer (tek yönlü olay). */
const OLAY = {
  ptyCikti: "pty:cikti",
  ptyBitti: "pty:bitti",
};

module.exports = { CAGRI, OLAY };
