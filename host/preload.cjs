// host/preload.cjs — contextIsolation köprüsü. Yüzey host/kopru.ts ile aynı.
// CJS bilerek: preload ESM'de sandbox:false ile güvenilir değil.
"use strict";
const { contextBridge, ipcRenderer, webUtils } = require("electron");

const { CAGRI, OLAY } = require("./kanallar.cjs");
const { birakYollariKur } = require("./birakYollari.cjs");

// Explorer'dan bırakılan dosyaların yolu bırakma ANINDA (yakalama aşaması) burada okunur; File nesnesi köprüden geçirilmez (host/birakYollari.cjs).
const birakYollari = birakYollariKur(window, (f) => webUtils.getPathForFile(f));

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
  hafizaYedekYaz:   (kayitlar, tur) => ipcRenderer.sendSync(CAGRI.hafizaYedekYaz, kayitlar, tur),
  // MCP rölesi (spec 05 Aşama 1): main'deki uca gelen `tools/*` istekleri.
  mcpDinle:         (cb) => dinle(OLAY.mcpIstek, cb),
  mcpYanitla:       (id, sonuc, hata) => ipcRenderer.send(CAGRI.mcpYanit, { id, sonuc, hata }),
  // Öğrenen kapı (spec 08, K5): açılışta öğretimler SENKRON, sonra yenileri olay olarak.
  ogretimOku:       () => ipcRenderer.sendSync(CAGRI.ogretimOku),
  ogretimDinle:     (cb) => dinle(OLAY.ogretim, cb),
  // Beceri refleksi (spec 10): geçmiş oturumların görev satırları, açılışta SENKRON.
  kayitSatirlariOku: (secim) => ipcRenderer.sendSync(CAGRI.kayitSatirlariOku, secim),
  // API anahtarlı beyin (spec 13 Faz 3): anahtar yalnız `apiKaydet` ile GİDER, geri gelmez.
  apiDurum:         () => ipcRenderer.invoke(CAGRI.apiDurum),
  apiKaydet:        (ad, adres, anahtar) => ipcRenderer.invoke(CAGRI.apiKaydet, ad, adres, anahtar),
  apiSil:           (ad) => ipcRenderer.invoke(CAGRI.apiSil, ad),
  apiModeller:      (ad) => ipcRenderer.invoke(CAGRI.apiModeller, ad),
  apiSohbet:        (ad, govde) => ipcRenderer.invoke(CAGRI.apiSohbet, ad, govde),
  // Durum defteri (spec 16 F2): okuma SENKRON, yazma tek yönlü.
  durumOku:         () => ipcRenderer.sendSync(CAGRI.durumOku),
  durumYaz:         (kayitlar) => ipcRenderer.send(CAGRI.durumYaz, kayitlar),
  // Orion'un kulağı: bas-konuş komutu gider, çözülmüş METİN olay olarak gelir (ses renderer'a girmez).
  dinleKomut:       (komut) => ipcRenderer.invoke(CAGRI.dinleKomut, komut),
  dinleDinle:       (cb) => dinle(OLAY.dinleme, cb),
  // Ofisteki 3. monitör (groma haritası): komut gider, kareler/durum olay olarak gelir.
  webmonKomut:      (komut, yuk) => ipcRenderer.invoke(CAGRI.webmonKomut, komut, yuk),
  webmonDinle:      (cb) => dinle(OLAY.webmonOlay, cb),
  // Orion'un md dosyaları (spec 32): hepsi yanıt bekler; sonuç { ok, deger } ya da { ok:false, kod, mesaj }.
  mdListe:          () => ipcRenderer.invoke(CAGRI.mdListe),
  mdOku:            (ad) => ipcRenderer.invoke(CAGRI.mdOku, ad),
  mdYaz:            (ad, metin) => ipcRenderer.invoke(CAGRI.mdYaz, ad, metin),
  mdYeni:           (ad, metin) => ipcRenderer.invoke(CAGRI.mdYeni, ad, metin),
  mdAktif:          (ad, aktif) => ipcRenderer.invoke(CAGRI.mdAktif, ad, aktif),
  // Düğüm grafikleri (spec 35): aynı sonuç biçimi; çalıştırma kanalı yok (grafik renderer'da, Ozyn'in ▶'siyle).
  grafListe:        () => ipcRenderer.invoke(CAGRI.grafListe),
  grafOku:          (ad) => ipcRenderer.invoke(CAGRI.grafOku, ad),
  grafYaz:          (ad, metin) => ipcRenderer.invoke(CAGRI.grafYaz, ad, metin),
  grafYeni:         (ad, metin) => ipcRenderer.invoke(CAGRI.grafYeni, ad, metin),
  grafSil:          (ad) => ipcRenderer.invoke(CAGRI.grafSil, ad),
  // NPC kayıtları (spec 35 dilim 3): aynı sonuç biçimi; dinleme kanalı yok (Ozyn'in tıklaması renderer'da).
  npcListe:         () => ipcRenderer.invoke(CAGRI.npcListe),
  npcOku:           (ad) => ipcRenderer.invoke(CAGRI.npcOku, ad),
  npcYaz:           (ad, metin) => ipcRenderer.invoke(CAGRI.npcYaz, ad, metin),
  npcYeni:          (ad, metin) => ipcRenderer.invoke(CAGRI.npcYeni, ad, metin),
  npcSil:           (ad) => ipcRenderer.invoke(CAGRI.npcSil, ad),
  // Sekanslar (spec 36): aynı sonuç biçimi; oynatma kanalı yok (▶ renderer'da, Ozyn'in gerçek tıklamasıyla).
  sekansListe:      () => ipcRenderer.invoke(CAGRI.sekansListe),
  sekansOku:        (ad) => ipcRenderer.invoke(CAGRI.sekansOku, ad),
  sekansYaz:        (ad, metin) => ipcRenderer.invoke(CAGRI.sekansYaz, ad, metin),
  sekansYeni:       (ad, metin) => ipcRenderer.invoke(CAGRI.sekansYeni, ad, metin),
  sekansSil:        (ad) => ipcRenderer.invoke(CAGRI.sekansSil, ad),
  // Proje (spec 39): açık projenin özeti ve level'ı; aynı sonuç biçimi.
  projeBilgi:       () => ipcRenderer.invoke(CAGRI.projeBilgi),
  projeLevelOku:    (ad) => ipcRenderer.invoke(CAGRI.projeLevelOku, ad),
  // Proje tarayıcısı (D2): aç projeyi CANLI değiştirmez, uygulamayı yeniden başlatır.
  projeListe:       () => ipcRenderer.invoke(CAGRI.projeListe),
  projeYeni:        (ad, sablon) => ipcRenderer.invoke(CAGRI.projeYeni, ad, sablon),
  projeAc:          (ad) => ipcRenderer.invoke(CAGRI.projeAc, ad),
  projeKlasorGoster: () => ipcRenderer.invoke(CAGRI.projeKlasorGoster),
  // İçerik gezgini (D4): adresli dosya işlemleri; aynı sonuç biçimi.
  icerikListe:      (kok) => ipcRenderer.invoke(CAGRI.icerikListe, kok),
  icerikIkili:      (adres) => ipcRenderer.invoke(CAGRI.icerikIkili, adres),
  icerikMetin:      (adres) => ipcRenderer.invoke(CAGRI.icerikMetin, adres),
  icerikYeniKlasor: (adres) => ipcRenderer.invoke(CAGRI.icerikYeniKlasor, adres),
  icerikAdlandir:   (adres, yeniAd) => ipcRenderer.invoke(CAGRI.icerikAdlandir, adres, yeniAd),
  icerikCogalt:     (adres) => ipcRenderer.invoke(CAGRI.icerikCogalt, adres),
  icerikSil:        (adres) => ipcRenderer.invoke(CAGRI.icerikSil, adres),
  icerikIceAktar:   (hedefAdres) => ipcRenderer.invoke(CAGRI.icerikIceAktar, hedefAdres),
  icerikTasi:       (adres, hedefKlasor) => ipcRenderer.invoke(CAGRI.icerikTasi, adres, hedefKlasor),
  // Explorer'dan bırakılan dosyalar: yollar yalnız burada (webUtils) çözülür; ana süreç uzantı/boyut/hedef kuralını yine uygular.
  icerikBirakAktar: (hedefAdres, dosyalar) => {
    const yollar = birakYollari.al(dosyalar);
    if (!yollar.length) return Promise.resolve({ ok: false, kod: "yol-yok", mesaj: "bırakılan dosyanın yolu alınamadı (İçe aktar düğmesiyle seçici kullanılabilir)" });
    return ipcRenderer.invoke(CAGRI.icerikBirakAktar, hedefAdres, yollar);
  },
  icerikGoster:     (adres) => ipcRenderer.invoke(CAGRI.icerikGoster, adres),
  // Orion'un sesi (spec 34): hepsi yanıt bekler, sonuç { ok, deger: SesDurumu } ya da { ok:false, kod, mesaj }; indirme ilerlemesi olay olarak.
  sesListe:         () => ipcRenderer.invoke(CAGRI.sesListe),
  sesSec:           (ad) => ipcRenderer.invoke(CAGRI.sesSec, ad),
  sesIndir:         (ad) => ipcRenderer.invoke(CAGRI.sesIndir, ad),
  sesSil:           (ad) => ipcRenderer.invoke(CAGRI.sesSil, ad),
  sesIndirmeDinle:  (cb) => dinle(OLAY.sesIndirme, cb),
});
