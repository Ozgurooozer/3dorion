// host/preload.cjs — contextIsolation köprüsü. Yüzey host/kopru.ts ile aynı.
// CJS bilerek: preload ESM'de sandbox:false ile güvenilir değil.
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

const { CAGRI, OLAY } = require("./kanallar.cjs");

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
  // Hafıza dosyası (spec 07). Okuma SENKRON: köprü depoyu kurucuda okuyor.
  hafizaOku:        () => ipcRenderer.sendSync(CAGRI.hafizaOku),
  hafizaYaz:        (kayitlar) => ipcRenderer.send(CAGRI.hafizaYaz, kayitlar),
  hafizaYazSenkron: (kayitlar) => ipcRenderer.sendSync(CAGRI.hafizaYazSenkron, kayitlar),
});
