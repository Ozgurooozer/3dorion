// tools/altSistemler.ts — ALT-SİSTEM TABLOSU: hangi dosya hangi alt-sisteme ait, dışarıya ne açık,
// kime bağımlı olabilir. Bekçisi `tools/altSistem.test.ts`.
//
// Mimari raporu (docs/arastirma/kod-mimarisi-konteyner-onerisi-2026-10-14.md §3.2, §3.4, A3):
// klasörler YERİNDE kalır; sınırı klasör taşıması değil bu tablo + bekçi çizer ("taşımasız yol").
// Katman bekçisi (`tools/mimari.test.ts`) katmanlar arası yönü sınar (world → mind yasak);
// bu tablo bir kat aşağı iner: world/ içindeki Sahne, Level, Editör, Avatar, Yüzeyler de ayrı
// alt-sistemdir ve birbirine yalnız izinli yönde, yalnız KAMU dosyalarından bağlanır.
//
// Bugün kuralı çiğneyen kenarlar `ISTISNALAR`'da gerekçesiyle durur. Liste YALNIZ KÜÇÜLÜR:
// yeni kenar gerekçe yazılmadan geçemez; düzelen kenar listeden silinmezse bekçi onu da yakalar
// (`tools/tipKacisi.test.ts`'in "izin listesinde artık kaçışı olmayan dosya yok" kalıbı).
//
// Yol kalıpları (depo köküne göre, POSIX): "a/b/" = klasör ve altı; "a/b/*" = yalnız klasörün
// doğrudan dosyaları; başka her şey tam dosya yolu. Bir dosya EN UZUN eşleşen kalıbın alt-sistemine
// aittir (ör. "world/varlik.ts" tam yolu "world/*" kalıbını yener).
"use strict";

export interface AltSistem {
  /** Kısa ad (kural ve istisna metinlerinde bu geçer). */
  ad: string;
  /** Tek cümlelik sorumluluk (rapor §3.2). */
  sorumluluk: string;
  /** Üye dosya kalıpları. */
  yollar: readonly string[];
  /**
   * Başka alt-sistemlerin import edebileceği dosyalar (tam yol). `null` = yüzey bugün sınırlanmıyor
   * (gerekçe `kamuNotu`nda); `[]` = kimse import edemez.
   */
  kamu: readonly string[] | null;
  kamuNotu?: string;
  /** Değer olarak import edebileceği alt-sistemler; "*" = bütün ÜRÜN alt-sistemleri. */
  izinli: readonly string[];
  /** Yalnız `import type` ile alabileceği alt-sistemler. */
  tipIzinli?: readonly string[];
  /**
   * Ürün kodu mu? Ürün, ürün olmayanı (Araçlar, Beyin-Lab) hiç import etmez — istisnasız.
   * Ürün dışı alt-sistemlerin kendi importları taranmaz (ölçüm araçları içeriye bilerek uzanır;
   * brain-lab'in kendi bekçileri var); oradaki `izinli` değerleri belgedir.
   */
  urun: boolean;
}

export const ALT_SISTEMLER: readonly AltSistem[] = [
  {
    ad: "Protokol", sorumluluk: "Beyin ile beden arasındaki tek sözleşme.",
    yollar: ["protocol/"],
    kamu: ["protocol/temel.ts", "protocol/niyet.ts", "protocol/algi.ts", "protocol/dogrula.ts",
      "protocol/pano.ts", "protocol/bedenTanimi.ts", "protocol/index.ts"],
    izinli: [], urun: true,
  },
  {
    ad: "Sahne",
    sorumluluk: "Gezilebilir sahne: motor (tik, kamera), oyuncu, Yer soyutlaması ve kodla kurulan ofis.",
    yollar: ["world/engine/", "world/player/", "world/yer/", "world/*", "world/level/*"],
    kamu: ["world/engine/tik.ts", "world/engine/kamera.ts", "world/player/oyuncu.ts",
      "world/yer/yer.ts", "world/yer/birlesikYer.ts", "world/yer/birlesikDunya.ts",
      "world/level/oda.ts", "world/level/olculer.ts", "world/level/capalar.ts", "world/level/nesneKaydi.ts",
      // Dünya olayı üretici (yakınlık/bakış geçişleri → algı olayı): kompozisyon kökü tik başına çağırır (giris bölme B1).
      "world/olayUretici.ts"],
    izinli: ["Protokol", "Level"], urun: true,
  },
  {
    ad: "Level", sorumluluk: "Veri güdümlü level: tanım → sahne, modüller, shader, stil, depo.",
    // world/varlik.ts (ortama göre varlık yolu çözücü; bağımlılıksız) fiziksel olarak world/ kökünde
    // ama Level'e ait: nesne sistemi ve uzak arazi onu kullanır, Sahne/Editör/Uygulama da Level
    // üzerinden alır (A4, 2026-10-14; önce Sahne sayılıyordu ve Level/Editör'den 3 ters kenar vardı).
    yollar: ["world/level/", "world/varlik.ts"],
    kamu: ["world/varlik.ts", "world/level/cekirdek/levelTanimi.ts", "world/level/cekirdek/levelKur.ts",
      "world/level/cekirdek/nesneSistemi.ts", "world/level/cekirdek/katalog.ts",
      "world/level/cekirdek/anlam.ts", "world/level/cekirdek/modul.ts", "world/level/cekirdek/renk.ts",
      "world/level/moduller/index.ts", "world/level/shader/moduller/index.ts",
      "world/level/stil/stilSistemi.ts", "world/level/depo/levelDeposu.ts",
      // Gece ufuk katmanı (ışık dili adım 2): level tanımından bağımsız, birleşik dünya (Sahne) kurar.
      "world/level/ufuk/ufuk.ts",
      // Işık Hacmi (GI spike 1, `?gi=hacim`): birleşik dünya (Sahne) kurar, senaryo (Uygulama) tipini okur.
      "world/level/gi/isikHacmi.ts"],
    izinli: ["Protokol"], urun: true,
  },
  {
    ad: "Editör", sorumluluk: "Level'i düzenleyen araç: saf çekirdek, Babylon sahnesi, DOM arayüzü (ayrı sayfa).",
    yollar: ["world/level/editor/", "world/level/editorSayfasi.ts"],
    // Paylaşılan panel kiti (gorunum, ortak) editörün arayuz/'unda kalır ama kamudur: oyun içi stil
    // penceresi (Yüzeyler) aynı paneli kullanır (A4, 2026-10-14; taşımak 2 import satırına değmez).
    kamu: ["world/level/editor/editor.ts", "world/level/editor/arayuz/editorArayuzu.ts",
      "world/level/editor/arayuz/gorunum.ts", "world/level/editor/arayuz/ortak.ts"],
    izinli: ["Level", "Protokol"], urun: true,
  },
  {
    ad: "Avatar", sorumluluk: "Orion'un bedeni: iskelet, yürütücü, yol bulma, göz, sürücüler.",
    yollar: ["world/avatar/"],
    kamu: ["world/avatar/index.ts"],
    izinli: ["Protokol", "Sahne"], urun: true,
  },
  {
    ad: "Yüzeyler",
    sorumluluk: "Odadaki ekranlar ve oyun içi pencereler: monitör terminali, tahta, zihin duvarı, model seçici, stil penceresi.",
    yollar: ["world/surfaces/", "world/arayuz/"],
    // Alt klasörler (B4, 2026-10-14): terminal/ (monitör + xterm/pty, çıktı ayrıştırma), tahta/,
    // duvar/ (zihin duvarı: şema, günlük, hafıza bulutu); ortak altyapı (yuzey, yuzeyStil) kökte.
    kamu: ["world/surfaces/yuzey.ts", "world/surfaces/terminal/monitor.ts", "world/surfaces/tahta/tahta.ts",
      "world/surfaces/duvar/sema.ts", "world/surfaces/duvar/gunluk.ts", "world/surfaces/duvar/hafizaBulutu.ts",
      // Monitör çıktısını algıya çeviren saf ayrıştırıcılar: uygulama/terminalAlgisi.ts kullanır (giris bölme B1).
      "world/surfaces/terminal/ciktiFarki.ts", "world/surfaces/terminal/ciktiToplayici.ts",
      "world/arayuz/modelSecici.ts", "world/arayuz/stilPenceresi.ts"],
    izinli: ["Protokol", "Level", "Editör"], tipIzinli: ["Kabuk"], urun: true,
  },
  {
    ad: "Zihin", sorumluluk: "Dikkat, refleks, hafıza, benlik, karar kaydı, içgüdüler, onay kapısı.",
    yollar: ["mind/"],
    kamu: null, kamuNotu: "geniş (rapor: 39/41 dosya dışa açık); taşımadan daraltılmıyor, haritada gruplanır",
    izinli: ["Protokol"], urun: true,
  },
  {
    ad: "Köprü", sorumluluk: "Protokol ↔ beyinler (Ollama, API, OpenCode, dış, MCP) ve araç yüzeyi.",
    yollar: ["bridge/"],
    kamu: null, kamuNotu: "geniş (rapor: 21/27 dosya dışa açık, beyin uygulamaları dahil); bu turda daraltılmıyor",
    izinli: ["Protokol", "Zihin"], urun: true,
  },
  {
    ad: "Ses", sorumluluk: "STT (klavye, Nemotron) ve TTS (Piper).",
    yollar: ["voice/"],
    kamu: ["voice/tip.ts", "voice/cikis.ts", "voice/nemotron.ts", "voice/kisalt.ts"],
    izinli: ["Protokol"], urun: true,
  },
  {
    ad: "Kabuk", sorumluluk: "Electron ana süreci: pty, IPC, dosya depoları, yan süreçleri başlatma.",
    yollar: ["host/"],
    kamu: ["host/kopru.ts", "host/kanallar.cjs", "host/levelDosyasi.js"],
    izinli: [], tipIzinli: ["Zihin"], urun: true,
  },
  {
    ad: "Uygulama", sorumluluk: "Ön ile arkayı bağlayan kompozisyon kökü: oda döngüsü, niyet yürütücü, onay, beyin seçimi, senaryolar.",
    yollar: ["uygulama/"],
    kamu: [], izinli: ["*"], urun: true,
  },
  {
    ad: "Araçlar", sorumluluk: "Ölçüm, deney, bekçi, derleme kancaları, Blender hatları (ürün dışı).",
    yollar: ["tools/"],
    kamu: [], izinli: ["*"], urun: false,
  },
  {
    ad: "Beyin-Lab", sorumluluk: "Ayrı araştırma alt projesi (ürün dışı; kendi CLAUDE.md'si ve bekçileri).",
    yollar: ["brain-lab/"],
    kamu: null, kamuNotu: "yalnız Araçlar okur; iç yüzeyini brain-lab'in kendi bekçileri tutar",
    izinli: ["Zihin", "Köprü"], urun: false,
  },
];

// ── İstisna gerekçeleri (2026-10-14 ölçümü: 67 kenar; A4 ilk turundan sonra 60) ─────────────────
const KOK =
  "kompozisyon kökü dünyanın iç dosyasına uzanıyor; dünyanın uygulamaya yüzeyi yok (rapor §1e) — giris bölme (B1–B3) daraltır";
const EDITOR_LEVEL =
  "editör level veri modelinin iç dosyalarına uzanıyor (dönüşüm/grup/kimlik/arazi, stil/shader tanımları); " +
  "Level'in kamu listesi sonraki yüzey turunda bu kullanıma göre kararlaştırılır";
const SAHNE_LEVEL = "ofis/yer level modüllerinin iç dosyalarını kullanıyor (zemin, su, arazi, grup); B5 (oda/ ayrımı) ile bakılır";
const AVATAR_SAHNE = "avatar Sahne'nin kamu listesinde olmayan dosyasını kullanıyor (görünürlük ışını, ofis Yer'i)";
const NESNE_TIPI =
  "level çekirdeği ofisin nesne kaydından tip alıyor (yanlış yön); B5'te `Nesne` tipi level/cekirdek ya da protocol/temel.ts'e alınır";
// A4'te gerekçelendi, düzeltilmedi: gorunurluk.ts saf (Babylon yok) ve tasarımcının gördüğü etiket
// Orion'un odada gördüğüyle AYNI olmalı — ikinci bir kopya bu sözü bozar. Doğru çözüm dosyayı
// Sahne ile Editör'ün ikisinin de alabileceği bir yere (Protokol değil; ortak saf algı) almak: B5'le.
const ORION_GOZU =
  "editörün 'Orion'un gözü' katmanı (spec 23 B) odadaki görünürlük kodunun AYNISINI kullanır; kopyası yazılmaz";
const YUZEY_LEVEL = "stil penceresi ortam komutu tipini level stilinin iç dosyasından alıyor";

/**
 * Bugün kuralı çiğneyen kenarlar: "kaynak dosya → hedef dosya" → gerekçe. YALNIZ KÜÇÜLÜR.
 * Aynı kenarın birden çok import satırı tek anahtardır; tip/değer ayrımı anahtara girmez.
 */
export const ISTISNALAR: Readonly<Record<string, string>> = {
  "world/avatar/goz.ts → world/player/gorunurluk.ts": AVATAR_SAHNE,
  "world/avatar/yurutucu.ts → world/yer/odaYeri.ts": AVATAR_SAHNE,
  "world/level/editor/arayuz/editorArayuzu.ts → world/level/shader/shaderSistemi.ts": EDITOR_LEVEL,
  "world/level/editor/arayuz/gorunum.ts → world/level/shader/dunyaDurumu.ts": EDITOR_LEVEL,
  "world/level/editor/arayuz/gorunum.ts → world/level/shader/paletler.ts": EDITOR_LEVEL,
  "world/level/editor/arayuz/gorunum.ts → world/level/shader/shaderSistemi.ts": EDITOR_LEVEL,
  "world/level/editor/arayuz/gorunum.ts → world/level/stil/ortamKomutu.ts": EDITOR_LEVEL,
  "world/level/editor/arayuz/gorunum.ts → world/level/stil/stilTanimi.ts": EDITOR_LEVEL,
  "world/level/editor/arayuz/ozellikler.ts → world/level/cekirdek/donusum.ts": EDITOR_LEVEL,
  "world/level/editor/arayuz/sahneAgaci.ts → world/level/cekirdek/grup.ts": EDITOR_LEVEL,
  "world/level/editor/arayuz/sahneAgaci.ts → world/level/cekirdek/kimlik.ts": EDITOR_LEVEL,
  "world/level/editor/cekirdek/araziKomutu.ts → world/level/cekirdek/arazi.ts": EDITOR_LEVEL,
  "world/level/editor/cekirdek/araziKomutu.ts → world/level/cekirdek/donusum.ts": EDITOR_LEVEL,
  "world/level/editor/cekirdek/firca.ts → world/level/cekirdek/donusum.ts": EDITOR_LEVEL,
  "world/level/editor/cekirdek/komutlar.ts → world/level/cekirdek/donusum.ts": EDITOR_LEVEL,
  "world/level/editor/cekirdek/komutlar.ts → world/level/cekirdek/grup.ts": EDITOR_LEVEL,
  "world/level/editor/cekirdek/komutlar.ts → world/level/cekirdek/kimlik.ts": EDITOR_LEVEL,
  "world/level/editor/cekirdek/pano.ts → world/level/cekirdek/donusum.ts": EDITOR_LEVEL,
  "world/level/editor/cekirdek/secim.ts → world/level/cekirdek/grup.ts": EDITOR_LEVEL,
  "world/level/editor/editor.ts → world/level/cekirdek/arazi.ts": EDITOR_LEVEL,
  "world/level/editor/editor.ts → world/level/cekirdek/donusum.ts": EDITOR_LEVEL,
  "world/level/editor/editor.ts → world/level/cekirdek/rastgele.ts": EDITOR_LEVEL,
  "world/level/editor/editor.ts → world/level/moduller/zemin.ts": EDITOR_LEVEL,
  "world/level/editor/editor.ts → world/level/stil/stilTanimi.ts": EDITOR_LEVEL,
  "world/level/editor/levelPaneli.ts → world/level/shader/shaderSistemi.ts": EDITOR_LEVEL,
  "world/level/editor/levelPaneli.ts → world/level/stil/stilTanimi.ts": EDITOR_LEVEL,
  "world/level/editor/sahne/yerlestirme.ts → world/level/cekirdek/donusum.ts": EDITOR_LEVEL,
  "world/level/editorSayfasi.ts → world/level/depo/httpDeposu.ts": EDITOR_LEVEL,
  "world/level/editorSayfasi.ts → world/level/shader/dunyaDurumu.ts": EDITOR_LEVEL,
  "world/level/editorSayfasi.ts → world/level/stil/stilTanimi.ts": EDITOR_LEVEL,
  "uygulama/beyinSecimi.ts → world/arayuz/modelSeciciCekirdek.ts": KOK,
  "uygulama/niyetYurutucu.ts → world/bilgisayar.ts": KOK,
  "uygulama/ortamBaglantisi.ts → world/level/stil/ortamKomutu.ts": KOK,
  "uygulama/ortamDeposu.ts → world/level/stil/ortamKomutu.ts": KOK,
  "uygulama/pencereKancalari.ts → world/davranisDenemesi.ts": KOK,
  "uygulama/senaryolar/davranis.ts → world/davranisDenemesi.ts": KOK,
  "uygulama/senaryolar/ortamdene.ts → world/level/stil/stilTanimi.ts": KOK,
  "uygulama/senaryolar/otodene.ts → world/player/etkilesim.ts": KOK,
  "uygulama/senaryolar/zihindene.ts → world/surfaces/duvar/semaCekirdek.ts": KOK,
  "uygulama/giris.ts → voice/metin-girdi.ts": KOK,
  "uygulama/giris.ts → world/davranisDenemesi.ts": KOK,
  "uygulama/giris.ts → world/level/capaGeometri.ts": KOK,
  "uygulama/giris.ts → world/level/ova/ova.level.json": KOK,
  "uygulama/giris.ts → world/player/etkilesim.ts": KOK,
  "uygulama/giris.ts → world/player/gorunurluk.ts": KOK,
  "uygulama/giris.ts → world/player/isinTarama.ts": KOK,
  "uygulama/giris.ts → world/yer/levelSahnesi.ts": KOK,
  "uygulama/giris.ts → world/yer/levelYeri.ts": KOK,
  "uygulama/giris.ts → world/yer/odaYeri.ts": KOK,
  "world/level/cekirdek/anlam.ts → world/level/nesneKaydi.ts": NESNE_TIPI,
  "world/level/editor/arayuz/orionGozu.ts → world/player/gorunurluk.ts": ORION_GOZU,
  "world/level/ofisYeri.ts → world/level/cekirdek/arazi.ts": SAHNE_LEVEL,
  "world/level/ofisYeri.ts → world/level/moduller/su.ts": SAHNE_LEVEL,
  "world/level/ofisYeri.ts → world/level/moduller/zemin.ts": SAHNE_LEVEL,
  "world/yer/levelYeri.ts → world/level/cekirdek/grup.ts": SAHNE_LEVEL,
  "world/yer/levelYeri.ts → world/level/moduller/zemin.ts": SAHNE_LEVEL,
  "world/arayuz/stilPenceresi.ts → world/level/stil/ortamKomutu.ts": YUZEY_LEVEL,
};

function eslesmeBoyu(kalip: string, yol: string): number {
  if (kalip.endsWith("/*")) {
    const klasor = kalip.slice(0, -1);
    return yol.startsWith(klasor) && !yol.slice(klasor.length).includes("/") ? kalip.length : -1;
  }
  if (kalip.endsWith("/")) return yol.startsWith(kalip) ? kalip.length : -1;
  return yol === kalip ? kalip.length + 1 : -1; // tam yol aynı uzunluktaki kalıbı yener
}

/** Dosyanın (depo köküne göre POSIX yol) alt-sistemi; hiçbirine ait değilse (kök dosyaları) null. */
export function altSistemi(yol: string): AltSistem | null {
  let enIyi: AltSistem | null = null;
  let boy = -1;
  for (const a of ALT_SISTEMLER) {
    for (const k of a.yollar) {
      const b = eslesmeBoyu(k, yol);
      if (b > boy) { boy = b; enIyi = a; }
    }
  }
  return enIyi;
}
