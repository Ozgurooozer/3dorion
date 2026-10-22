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
  /** Sıkıştırma yedeği (spec 26 F3-C): hafıza dosyasının yanına tarih damgalı kopya; sonuç senkron (yedeksiz silme yok). */
  hafizaYedekYaz:    "hafiza:yedek-yaz",
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
  /**
   * Durum defteri (spec 16 F2): konum, son iş, son konuşma. Okuma SENKRON (köprü kurucuda okur),
   * yazma tek yönlü ve atomik — hafıza dosyasıyla aynı desen, ayrı dosya (`orion-durum.json`).
   */
  durumOku:          "durum:oku",
  durumYaz:          "durum:yaz",
  /** Orion'un kulağı (host/dinleme.js): "baslat" | "kayit" | "dur" | "kapat". */
  dinleKomut:        "dinle:komut",
  /** Ofisteki 3. monitör (groma haritası, host/webMonitor.js): "ac" (adres) | "kapat" | "fare" (olay). */
  webmonKomut:       "webmon:komut",
  /**
   * Orion'un md dosyaları (Yapı çubuğu · Hafıza sekmesi, spec 32). Hepsi yanıt bekleyen çağrı; yanıt `{ ok: true, deger }` ya da
   * `{ ok: false, kod, mesaj }` (invoke hata nesnesinin `kod` alanını taşımaz, o yüzden sonuç nesnesi).
   */
  mdListe:           "md:liste",
  mdOku:             "md:oku",
  mdYaz:             "md:yaz",
  mdYeni:            "md:yeni",
  mdAktif:           "md:aktif",
  /**
   * Düğüm grafikleri (spec 35 dilim 1, host/grafDosyalari.js): ad = grafın adı (uzantısız). Sonuç biçimi md'ninkiyle aynı. Biçimi renderer doğrular
   * (protocol/graf.ts); kabuk yalnız dosyayı tutar. ÇALIŞTIRMA kanalı YOK: grafik renderer'da, yalnız Ozyn'in ▶'siyle çalışır.
   */
  grafListe:         "graf:liste",
  grafOku:           "graf:oku",
  grafYaz:           "graf:yaz",
  grafYeni:          "graf:yeni",
  grafSil:           "graf:sil",
  /**
   * NPC kayıtları (spec 35 dilim 3, host/npcDosyalari.js): ad = kaydın adı (uzantısız). Sonuç biçimi grafiklerinkiyle aynı; biçimi renderer doğrular
   * (protocol/npc.ts). DİNLEME/ÇALIŞTIRMA kanalı YOK: NPC'yi dinlemeye almak yalnız Ozyn'in renderer'daki gerçek tıklaması.
   */
  npcListe:          "npc:liste",
  npcOku:            "npc:oku",
  npcYaz:            "npc:yaz",
  npcYeni:           "npc:yeni",
  npcSil:            "npc:sil",
  /**
   * Sekanslar (spec 36, host/sekansDosyalari.js): ad = sekansın adı (uzantısız). Sonuç biçimi grafiklerinkiyle aynı; biçimi renderer doğrular
   * (protocol/sekans.ts). OYNATMA kanalı YOK: sekans renderer'da, yalnız Ozyn'in gerçek ▶ tıklamasıyla oynar.
   */
  sekansListe:       "sekans:liste",
  sekansOku:         "sekans:oku",
  sekansYaz:         "sekans:yaz",
  sekansYeni:        "sekans:yeni",
  sekansSil:         "sekans:sil",
  /**
   * Orion'un sesi (spec 34, host/sesler.js): kurulu/katalog sesleri, seçim (bir SONRAKİ cümleden geçerli), katalogdan indirme, yalnız indirileni silme.
   * Sonuç biçimi md'ninkiyle aynı (`{ ok, deger: SesDurumu }` | `{ ok: false, kod, mesaj }`); deneme cümlesi mevcut `sesUret` yolundan çalar.
   */
  sesListe:          "ses:liste",
  sesSec:            "ses:sec",
  sesIndir:          "ses:indir",
  sesSil:            "ses:sil",
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
  /** 3. monitör: {olay:"durum", d} | {olay:"kare", jpeg, g, y} (host/webMonitor.js). */
  webmonOlay: "webmon:olay",
  /** Ses indirme ilerlemesi: { ad, dosya: "json" | "onnx", alinan, toplam } (host/sesIndir.js; en çok ~4/sn). */
  sesIndirme: "ses:indirme",
};

module.exports = { CAGRI, OLAY };
