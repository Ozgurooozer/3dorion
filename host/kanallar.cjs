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
  /** MCP rölesi (spec 05 Aşama 1): renderer'ın `tools/*` cevabı main'e. */
  mcpYanit:          "mcp:yanit",
  /**
   * Öğrenen kapı (spec 08, toplantı 2026-09-27 K5): kayıttaki öğretim satırları.
   * SENKRON — köprü kural hafızasını kurucuda kurar.
   */
  ogretimOku:        "ogretim:oku",
  /**
   * Beceri refleksi (spec 10): kayıttan seçilen satırlar — geçmiş oturumların görev
   * satırları. SENKRON — köprü beceri defterini kurucuda kurar.
   */
  kayitSatirlariOku: "kayit:satirlar",
  /**
   * API anahtarlı beyin (spec 13 Faz 3). Anahtar YALNIZ `apiKaydet` ile main'e gider ve
   * bir daha renderer'a dönmez; istekler main'den atılır (host/apiIstek.js).
   */
  apiDurum:          "api:durum",
  apiKaydet:         "api:kaydet",
  apiSil:            "api:sil",
  apiModeller:       "api:modeller",
  apiSohbet:         "api:sohbet",
  /** Orion'un kulağı (host/dinleme.js): "baslat" | "kayit" | "dur" | "kapat". */
  dinleKomut:        "dinle:komut",
};

/** Main → renderer (tek yönlü olay). */
const OLAY = {
  ptyCikti: "pty:cikti",
  ptyBitti: "pty:bitti",
  /** MCP rölesi: main'deki HTTP ucuna gelen `tools/*` isteği renderer'a. */
  mcpIstek: "mcp:istek",
  /** Öğretim dosyasına yeni satır düştü (ör. tools/ogret.ts): canlı hafızaya. */
  ogretim:  "ogretim:yeni",
  /** Kulak süreci: hazir / tanima / bos / hata / kapandi (host/dinleme.d.ts). */
  dinleme:  "dinle:olay",
};

module.exports = { CAGRI, OLAY };
