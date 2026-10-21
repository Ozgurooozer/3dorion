// uygulama/graf/kutuphane.ts — DÜĞÜM KÜTÜPHANESİ v1 (spec 35 dilim 1) ve "Yeni" şablonları.
//
// Kütüphane = çekirdek (olay, akış, desen, sabit veri) + ajan düğümleri + (dilim 2) dünya olayları, değişkenler, mantık, gün vakti. Grafik YALNIZ bunları
// dizebilir; burada olmayan bir yetenek grafikten çağrılamaz.
// Şablonlar "＋ Yeni"nin ilk içeriğidir: boş sayfa yerine ÇALIŞAN bir örnek (Ozyn önce ▶'ye basıp ne olduğunu görsün, sonra değiştirsin; spec 35 §4).
"use strict";
import { GRAF_SURUMU, type Graf } from "../../protocol/graf.ts";
import { DugumKaydi } from "./dugumKaydi.ts";
import { cekirdekDugumler } from "./cekirdekDugumler.ts";
import { ajanDugumleri } from "./ajanDugumleri.ts";
import type { GrafYetenegi } from "./grafYetenegi.ts";
import { olayDugumleri } from "./olayDugumleri.ts";
import { durumDugumleri } from "./durumDugumleri.ts";

export function grafKutuphanesi(): DugumKaydi<GrafYetenegi> {
  const k = new DugumKaydi<GrafYetenegi>();
  for (const t of cekirdekDugumler<GrafYetenegi>()) k.kaydet(t);
  for (const t of ajanDugumleri()) k.kaydet(t);
  // Dilim 2 (NPC davranışı): dünya olayları (dinlemedeki grafiğin girişi), değişkenler, mantık, gün vakti.
  for (const t of olayDugumleri<GrafYetenegi>()) k.kaydet(t);
  for (const t of durumDugumleri<GrafYetenegi>()) k.kaydet(t);
  return k;
}

const bag = (k: string, kp: string, h: string, hp: string) => ({ kaynak: [k, kp] as [string, string], hedef: [h, hp] as [string, string] });

/**
 * Örnek program: ▶ Başla → Ajan seç (Flash) → Git (Ozyn) → El salla ×3 (her biri arasında Bekle: jest anında biter) → Söyle.
 * Flash yoksa (senaryo koşusu, `?flashsiz`) "Kontrol et" bunu söyler: ajan bilinmiyor (sessiz geçiş yok).
 */
export function yeniGrafSablonu(ad: string): Graf {
  return {
    surum: GRAF_SURUMU, ad, tur: "olay", aciklama: "Örnek: Flash yanına gelir, üç kez el sallar ve selam verir.",
    girisler: [], cikislar: [],
    dugumler: [
      { id: "basla", tip: "olay.basla", konum: [0, 0] },
      { id: "flash", tip: "ajan.sec", ayar: { ajan: "flash" }, konum: [0, 160] },
      { id: "gel", tip: "ajan.git", ayar: { hedef: "ozyn" }, konum: [220, 0] },
      { id: "uc_kez", tip: "akis.tekrar", ayar: { sayi: 3 }, konum: [440, 0] },
      { id: "salla", tip: "ajan.jest", ayar: { jest: "el_salliyor" }, konum: [660, -80] },
      { id: "ara", tip: "akis.bekle", ayar: { ms: 1200 }, konum: [880, -80] },
      { id: "selam", tip: "ajan.soyle", ayar: { metin: "Merhaba Ozyn!" }, konum: [660, 80] },
    ],
    baglar: [
      bag("basla", "sonra", "gel", "giris"),
      bag("gel", "sonra", "uc_kez", "giris"),
      bag("uc_kez", "govde", "salla", "giris"),
      bag("salla", "sonra", "ara", "giris"),
      bag("uc_kez", "bitti", "selam", "giris"),
      bag("flash", "ajan", "gel", "kim"),
      bag("flash", "ajan", "salla", "kim"),
      bag("flash", "ajan", "selam", "kim"),
    ],
  };
}

/**
 * NÖBETÇİ (dilim 2'nin çalışan örneği; kuzey yıldızı demo, spec 33): Ozyn Flash'a yaklaşınca (⚡ dinlemede) ya da ▶ ile:
 *   Flash Ozyn'e döner → ziyaret sayacı artar → gece vardiyasıysa (21–05) "Gece vardiyası…", değilse "Hoş geldin yolcu. Ziyaret: N" →
 *   "Dur! Parola?" seçimli diyaloğu (3 seçenek): doğru parola "Geç.", yanlışlar "Geçemezsin.", süre dolarsa "Cevap yok mu? Geçemezsin."
 * ▶ Başla da bulunur: Ozyn dinlemeye almadan önce ▶ ile dener (iki giriş aynı zincire bağlı; akış GİRİŞİNE birden çok bağ serbesttir).
 * Parola bilerek düz metin: oyun içi bir sır, güvenlik değil.
 */
export function nobetciSablonu(ad: string): Graf {
  return {
    surum: GRAF_SURUMU, ad, tur: "olay",
    aciklama: "Örnek NPC: Ozyn Flash'a yaklaşınca parola sorar (⚡ dinlemeye al ya da ▶ ile dene). Doğru parola: Ay ışığı.",
    girisler: [], cikislar: [],
    dugumler: [
      { id: "yaklasti", tip: "olay.ozyn_yaklasti", ayar: { ajan: "flash" }, konum: [0, 0] },
      { id: "basla", tip: "olay.basla", konum: [0, 120] },
      { id: "flash", tip: "ajan.sec", ayar: { ajan: "flash" }, konum: [0, 260] },
      { id: "don", tip: "ajan.bak", ayar: { hedef: "ozyn" }, konum: [220, 60] },
      { id: "ziyaret", tip: "degisken.artir", ayar: { ad: "ziyaret", miktar: 1 }, konum: [440, 60] },
      { id: "gece", tip: "saat.gun_vakti", ayar: { vakit: "gece" }, konum: [440, 220] },
      { id: "vardiya", tip: "akis.eger", konum: [660, 60] },
      { id: "gece_soz", tip: "ajan.soyle", ayar: { metin: "Gece vardiyası. Fenerini indir, yüzünü göreyim!" }, konum: [880, -20] },
      { id: "sayac_metni", tip: "metin.birlestir", ayar: { a: "Hoş geldin yolcu. Ziyaret: " }, konum: [660, 220] },
      { id: "gun_soz", tip: "ajan.soyle", konum: [880, 140] },
      {
        id: "parola", tip: "diyalog.sec", konum: [1100, 60],
        ayar: { metin: "Dur! Parola?", secenek1: "Ay ışığı", secenek2: "Bilmiyorum", secenek3: "Sana ne!", sure: 30 },
      },
      { id: "gec", tip: "ajan.soyle", ayar: { metin: "Geç." }, konum: [1320, -40] },
      { id: "gecemez", tip: "ajan.soyle", ayar: { metin: "Geçemezsin." }, konum: [1320, 80] },
      { id: "sessiz", tip: "ajan.soyle", ayar: { metin: "Cevap yok mu? Geçemezsin." }, konum: [1320, 200] },
    ],
    baglar: [
      bag("yaklasti", "sonra", "don", "giris"),
      bag("basla", "sonra", "don", "giris"),
      bag("don", "sonra", "ziyaret", "giris"),
      bag("ziyaret", "sonra", "vardiya", "giris"),
      bag("gece", "sonuc", "vardiya", "kosul"),
      bag("vardiya", "dogru", "gece_soz", "giris"),
      bag("vardiya", "yanlis", "gun_soz", "giris"),
      bag("ziyaret", "deger", "sayac_metni", "b"),
      bag("sayac_metni", "metin", "gun_soz", "metin"),
      bag("gece_soz", "sonra", "parola", "giris"),
      bag("gun_soz", "sonra", "parola", "giris"),
      bag("parola", "1", "gec", "giris"),
      bag("parola", "2", "gecemez", "giris"),
      bag("parola", "3", "gecemez", "giris"),
      bag("parola", "zamanAsimi", "sessiz", "giris"),
      ...["don", "gece_soz", "gun_soz", "parola", "gec", "gecemez", "sessiz"].map((id) => bag("flash", "ajan", id, "kim")),
    ],
  };
}

/** "＋ Yeni grafik"in şablonları (seçim kutusu). İlki varsayılan. */
export const GRAF_SABLONLARI: readonly { id: string; ad: string; kur: (ad: string) => Graf }[] = [
  { id: "selam", ad: "Selam (▶: Flash gelir, el sallar)", kur: yeniGrafSablonu },
  { id: "nobetci", ad: "Nöbetçi (⚡ olayla: parola diyaloğu)", kur: nobetciSablonu },
];

/** Örnek desen (girişli alt-grafik): verilen ajan el sallar, bekler, selam verir. Başka grafikte `desen.cagir` ile tek düğüm olur. */
export function yeniDesenSablonu(ad: string): Graf {
  return {
    surum: GRAF_SURUMU, ad, tur: "fonksiyon", aciklama: "Örnek desen: 'kim' el sallar ve selam verir.",
    girisler: [{ ad: "kim", tip: "ajan" }], cikislar: [],
    dugumler: [
      { id: "giris", tip: "fonksiyon.giris", konum: [0, 0] },
      { id: "salla", tip: "ajan.jest", ayar: { jest: "el_salliyor" }, konum: [220, 0] },
      { id: "ara", tip: "akis.bekle", ayar: { ms: 1200 }, konum: [440, 0] },
      { id: "selam", tip: "ajan.soyle", ayar: { metin: "Selam!" }, konum: [660, 0] },
      { id: "donus", tip: "fonksiyon.donus", konum: [880, 0] },
    ],
    baglar: [
      bag("giris", "sonra", "salla", "giris"),
      bag("giris", "kim", "salla", "kim"),
      bag("salla", "sonra", "ara", "giris"),
      bag("ara", "sonra", "selam", "giris"),
      bag("giris", "kim", "selam", "kim"),
      bag("selam", "sonra", "donus", "giris"),
    ],
  };
}
