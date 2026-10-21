// uygulama/graf/kutuphane.ts — DÜĞÜM KÜTÜPHANESİ v1 (spec 35 dilim 1) ve "Yeni" şablonları.
//
// Kütüphane = çekirdek (olay, akış, desen, sabit veri) + ajan düğümleri. Grafik YALNIZ bunları dizebilir; burada olmayan bir yetenek grafikten çağrılamaz.
// Şablonlar "＋ Yeni"nin ilk içeriğidir: boş sayfa yerine ÇALIŞAN bir örnek (Ozyn önce ▶'ye basıp ne olduğunu görsün, sonra değiştirsin; spec 35 §4).
"use strict";
import { GRAF_SURUMU, type Graf } from "../../protocol/graf.ts";
import { DugumKaydi } from "./dugumKaydi.ts";
import { cekirdekDugumler } from "./cekirdekDugumler.ts";
import { ajanDugumleri } from "./ajanDugumleri.ts";
import type { GrafYetenegi } from "./grafYetenegi.ts";

export function grafKutuphanesi(): DugumKaydi<GrafYetenegi> {
  const k = new DugumKaydi<GrafYetenegi>();
  for (const t of cekirdekDugumler<GrafYetenegi>()) k.kaydet(t);
  for (const t of ajanDugumleri()) k.kaydet(t);
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
