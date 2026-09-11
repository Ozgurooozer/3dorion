// host/preload.cjs — contextIsolation köprüsü. Yüzey host/kopru.ts ile aynı.
// CJS bilerek: preload ESM'de sandbox:false ile güvenilir değil.
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

const CAGRI = { ptyAc: "pty:ac", ptiYaz: "pty:yaz", ptyBoyut: "pty:boyut", ptyKapat: "pty:kapat", sesUret: "ses:uret", sesVarMi: "ses:var", varlik: "varlik:yol" };
const OLAY  = { ptyCikti: "pty:cikti", ptyBitti: "pty:bitti" };

/** Dinleyici sarmalayıcı: abonelikten çıkma fonksiyonu döner (sızıntı önlemi). */
function dinle(kanal, cb) {
  const el = (_e, yuk) => cb(yuk);
  ipcRenderer.on(kanal, el);
  return () => ipcRenderer.removeListener(kanal, el);
}

contextBridge.exposeInMainWorld("kopru", {
  ptyAc:        (istek) => ipcRenderer.invoke(CAGRI.ptyAc, istek),
  ptyYaz:       (id, veri) => ipcRenderer.send(CAGRI.ptiYaz, id, veri),
  ptyBoyut:     (id, cols, rows) => ipcRenderer.send(CAGRI.ptyBoyut, id, cols, rows),
  ptyKapat:     (id) => ipcRenderer.send(CAGRI.ptyKapat, id),
  ptyDinle:     (cb) => dinle(OLAY.ptyCikti, cb),
  ptyBittiDinle:(cb) => dinle(OLAY.ptyBitti, cb),
  sesUret:      (metin) => ipcRenderer.invoke(CAGRI.sesUret, metin),
  sesVarMi:     () => ipcRenderer.invoke(CAGRI.sesVarMi),
  varlik:       (ad) => ipcRenderer.invoke(CAGRI.varlik, ad),
});
