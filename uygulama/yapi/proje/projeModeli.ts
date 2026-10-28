// uygulama/yapi/proje/projeModeli.ts — PROJE TARAYICISININ SAF MODELİ (spec 39 D2): kartlar, şablon listesi, hata metni, "yeniden başlatma" uyarısı. DOM yok.
//
// Ad kuralı BURADA YOK (host `projeAdiGecerli` tek kaynak): geçersiz ad host'tan `gecersiz-ad` koduyla döner ve `hataMetni` onu söyler; renderer'da
// ikinci bir kural kopyası ayrışırdı.
"use strict";
import type { ProjeDurumu, SablonAdi } from "../../../host/kopru.ts";

export interface SablonSecenegi { id: SablonAdi; ad: string; aciklama: string }
/** Yeni proje şablonları (host `SABLON_ADLARI` ile aynı kimlikler; `projeModeli.test.ts` ayrışmayı yakalar). */
export const SABLONLAR: readonly SablonSecenegi[] = [
  { id: "ofis", ad: "Ofis + Ova", aciklama: "Ofis ve Ozyn'in ovası (başlangıç şablonu), Orion'un bedeni" },
  { id: "bos", ad: "Ofis + boş ova", aciklama: "Ofis ve düz, boş bir ova" },
];

export interface ProjeKarti {
  ad: string;
  /** Kartın alt satırı: "açık proje", "son açılan", "bozuk: …". */
  durum: string;
  acilabilir: boolean;
  acik: boolean;
  bozuk: boolean;
}

/** Host sırasını korur (son açılanlar önde); bozuk proje listede KALIR ama açılamaz ve nedeni görünür. */
export function projeKartlari(d: ProjeDurumu): ProjeKarti[] {
  return d.projeler.map((p) => {
    const bozuk = !!p.hata;
    const durum = bozuk ? `bozuk: ${p.hata}` : p.acik ? "açık proje" : p.son === 0 ? "son açılan" : p.son !== null ? "yakın zamanda açıldı" : "";
    return { ad: p.ad, durum, acilabilir: !bozuk && !p.acik, acik: p.acik, bozuk };
  });
}

/** IPC hata kodu → Ozyn'in okuyacağı metin (bilinmeyen kod ham mesajla). */
export function hataMetni(kod: string, mesaj: string): string {
  switch (kod) {
    case "gecersiz-ad": return "Geçersiz proje adı: harf ya da rakamla başlamalı; harf, rakam, boşluk, _ ve - olabilir (en çok 48), Windows'un ayrılmış adları (CON, NUL…) olmaz.";
    case "var": return "Bu adda bir proje zaten var.";
    case "yok": return "Proje bulunamadı (silinmiş ya da taşınmış olabilir).";
    case "bozuk": return `Proje tanımı bozuk: ${mesaj}`;
    case "gecersiz-sablon": return "Bilinmeyen şablon.";
    default: return mesaj || kod;
  }
}

/**
 * Proje AÇMAK uygulamayı yeniden başlatır: kaydedilmemiş sekmeler gider. Kirli sekme varsa uyarı metni (ikinci tıklama gerekir), yoksa null.
 * `kirli`: kaynak adlarıyla "sekans 'a'", "grafik 'b'".
 */
export function acmaUyarisi(kirli: readonly string[]): string | null {
  if (!kirli.length) return null;
  return `Kaydedilmemiş değişiklik var (${kirli.join(", ")}). Proje açılırken uygulama yeniden başlar ve bunlar KAYBOLUR. Yine de açmak için tekrar bas.`;
}
