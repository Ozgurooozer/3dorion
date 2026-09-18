// mind/hafizaGocu.ts — hafızayı nereden yükleyeceğine karar verir (spec 07 K5).
//
// Hafıza `localStorage`'dan host'un JSON dosyasına taşınıyor. Bu dosya
// YALNIZCA kararı verir; G/Ç'yi dışarıdan alır (tarayıcı, IPC ya da test).
// Böylece geri alınamaz bir veri işlemi Electron açmadan sınanabiliyor.
//
// KURALLAR — her biri bir düşman testiyle sabit (hafizaGocu.test.ts):
//   • Dosya VARSA o kazanır; eski depoya bakılmaz bile. İki hafıza yarışmaz.
//   • Dosya YOKSA eski depodan göç: yaz → YENİDEN OKU → say. Doğrulanmayan
//     göç "taşındı" sayılmaz; eski veri döner.
//   • Dosya BOZUKSA boş hafıza sayılmaz; eski depodan göç denenir.
//   • Eski depo SİLİNMEZ — G/Ç arayüzünde silme yeteneği bile yok. Geri
//     dönüş yolu yapısal olarak garanti.
//
// SAF: bağımlılık yok.
"use strict";

export type DosyaDurumu =
  | { durum: "yok" }
  | { durum: "var"; kayitlar: unknown[] }
  | { durum: "bozuk"; tasindi: string }
  /**
   * Dosya OKUNAMADI (izin, kilit). "yok" DEĞİL: yok sanılsaydı göç eski
   * veriyi gerçek dosyanın üstüne yazardı — geçici bir okuma hatası kalıcı
   * veri kaybına dönüşürdü.
   */
  | { durum: "hata"; mesaj: string };

/** Göçün ihtiyaç duyduğu G/Ç. Bilerek SİLME yok (K5). */
export interface HafizaGc {
  dosyaOku(): DosyaDurumu;
  /** Senkron: göç, sonucu bilmeden "taşındı" diyemez. */
  dosyaYazSenkron(kayitlar: unknown[]): boolean;
  eskiOku(): unknown[];
}

export interface YuklemeSonucu {
  kayitlar: unknown[];
  /** dosya: normal yol · goc: şimdi taşındı · eski-yedek: taşınamadı, eski kullanıldı · bos: hiç hafıza yok */
  kaynak: "dosya" | "goc" | "eski-yedek" | "bos";
  /** Olağan dışı durumun insan-okur açıklaması — günlüğe gider. */
  not?: string;
}

export function depoYukle(io: HafizaGc): YuklemeSonucu {
  const d = io.dosyaOku();
  if (d.durum === "var") return { kayitlar: d.kayitlar, kaynak: "dosya" };

  // OKUNAMADI: dosyaya DOKUNMA. Eski veriyle salt-okunur devam et; bir
  // sonraki açılışta dosya okunabilirse o kazanır, hiçbir şey kaybolmaz.
  if (d.durum === "hata") {
    return { kayitlar: io.eskiOku(), kaynak: "eski-yedek", not: `dosya okunamadı (${d.mesaj}); dosyaya dokunulmadı` };
  }

  const not = d.durum === "bozuk" ? `dosya bozuktu, korundu: ${d.tasindi}` : undefined;
  const eski = io.eskiOku();
  if (eski.length === 0) return { kayitlar: [], kaynak: "bos", not };

  // Göç: yaz, sonra GERÇEKTEN yazıldığını doğrula. Yazım "başarılı" dönüp
  // eksik yazmış olabilir; doğrulanmayan dosya asıl kaynak olamaz.
  if (!io.dosyaYazSenkron(eski)) {
    return { kayitlar: eski, kaynak: "eski-yedek", not: ek(not, "göç yazımı başarısız") };
  }
  const kontrol = io.dosyaOku();
  if (kontrol.durum !== "var" || kontrol.kayitlar.length !== eski.length) {
    return { kayitlar: eski, kaynak: "eski-yedek", not: ek(not, "göç doğrulanamadı (kayıt sayısı tutmadı)") };
  }
  return { kayitlar: eski, kaynak: "goc", not };
}

function ek(a: string | undefined, b: string): string {
  return a ? `${a}; ${b}` : b;
}
