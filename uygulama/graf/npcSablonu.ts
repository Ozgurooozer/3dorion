// uygulama/graf/npcSablonu.ts — "NÖBETÇİ (NPC'li)" şablonu (spec 35 dilim 3): dilim 2'nin nöbetçisinin NPC SINIFI hâli. Eski şablon (kutuphane.ts
// `nobetciSablonu`) değişmedi ve çalışır; bu ayrı bir seçenektir ("＋ Yeni grafik" → şablon).
//
// Farklar (Unreal: Blueprint Class + Instance Editable + üye değişkeni):
//   • olay ve ajan `@ben`: grafik hiçbir ajanın adını bilmez; NPC kaydı (`protocol/npc.ts`) onu bir ajana bağlar. Aynı grafik, iki NPC, iki beden.
//   • ziyaret sayacı AJAN kapsamlı: iki NPC iki ayrı sayaç ("Ziyaret: 1" ikisinde de ilk ziyarette).
//   • doğru parola NPC'nin PARAMETRESİ (`npc.parametre` "parola"; kayıtta yoksa "Ay ışığı"): diyalog üç cevap gösterir, seçilen metin parolayla
//     karşılaştırılır (Metin eşit mi) → "Geç." / "Geçemezsin.". Parola bilerek düz metin: oyun içi sır, güvenlik değil.
// ▶ Başla YOK: `@ben` ▶'de çözülmez (nedenli hata); bu grafik yalnız NPC şeridinden "⚡ NPC'yi dinlemeye al" ile çalışır.
"use strict";
import { GRAF_SURUMU, type Graf } from "../../protocol/graf.ts";
import { BEN } from "./benAjani.ts";

const bag = (k: string, kp: string, h: string, hp: string) => ({ kaynak: [k, kp] as [string, string], hedef: [h, hp] as [string, string] });

/** Şablonun parametresi ve cevapları: NPC kaydı "parola"yı bunlardan biri yapar (ikisi farklı NPC'de farklı doğru cevap). */
export const NOBETCI_CEVAPLARI = ["Ay ışığı", "Kırmızı", "Bilmiyorum"] as const;

export function nobetciNpcSablonu(ad: string): Graf {
  return {
    surum: GRAF_SURUMU, ad, tur: "olay",
    aciklama: "NPC sınıfı: Ozyn bu NPC'ye yaklaşınca parolasını sorar (parola NPC kaydının 'parola' parametresi; sayaç NPC başına). NPC şeridinden ⚡ dinlemeye al.",
    girisler: [], cikislar: [],
    dugumler: [
      { id: "yaklasti", tip: "olay.ozyn_yaklasti", ayar: { ajan: BEN }, konum: [0, 0] },
      { id: "ben", tip: "ajan.sec", ayar: { ajan: BEN }, konum: [0, 260] },
      { id: "don", tip: "ajan.bak", ayar: { hedef: "ozyn" }, konum: [220, 60] },
      { id: "ziyaret", tip: "degisken.artir", ayar: { ad: "ziyaret", miktar: 1, kapsam: "ajan" }, konum: [440, 60] },
      { id: "gece", tip: "saat.gun_vakti", ayar: { vakit: "gece" }, konum: [440, 260] },
      { id: "vardiya", tip: "akis.eger", konum: [660, 60] },
      { id: "gece_soz", tip: "ajan.soyle", ayar: { metin: "Gece vardiyası. Fenerini indir, yüzünü göreyim!" }, konum: [880, -20] },
      { id: "sayac_metni", tip: "metin.birlestir", ayar: { a: "Hoş geldin yolcu. Ziyaret: " }, konum: [660, 260] },
      { id: "gun_soz", tip: "ajan.soyle", konum: [880, 140] },
      {
        id: "parola", tip: "diyalog.sec", konum: [1100, 60],
        ayar: { metin: "Dur! Parola?", secenek1: NOBETCI_CEVAPLARI[0], secenek2: NOBETCI_CEVAPLARI[1], secenek3: NOBETCI_CEVAPLARI[2], sure: 30 },
      },
      { id: "parola_param", tip: "npc.parametre", ayar: { ad: "parola", tip: "metin", varsayilan: NOBETCI_CEVAPLARI[0] }, konum: [1100, 300] },
      { id: "dogru_mu", tip: "metin.esit", konum: [1320, 260] },
      { id: "kontrol", tip: "akis.eger", konum: [1320, 60] },
      { id: "gec", tip: "ajan.soyle", ayar: { metin: "Geç." }, konum: [1540, -20] },
      { id: "gecemez", tip: "ajan.soyle", ayar: { metin: "Geçemezsin." }, konum: [1540, 100] },
      { id: "sessiz", tip: "ajan.soyle", ayar: { metin: "Cevap yok mu? Geçemezsin." }, konum: [1320, 400] },
    ],
    baglar: [
      bag("yaklasti", "sonra", "don", "giris"),
      bag("don", "sonra", "ziyaret", "giris"),
      bag("ziyaret", "sonra", "vardiya", "giris"),
      bag("gece", "sonuc", "vardiya", "kosul"),
      bag("vardiya", "dogru", "gece_soz", "giris"),
      bag("vardiya", "yanlis", "gun_soz", "giris"),
      bag("ziyaret", "deger", "sayac_metni", "b"),
      bag("sayac_metni", "metin", "gun_soz", "metin"),
      bag("gece_soz", "sonra", "parola", "giris"),
      bag("gun_soz", "sonra", "parola", "giris"),
      // Üç cevabın üçü de AYNI denetime gider (akış girişine birden çok bağ serbest): doğru olan NPC'nin parolasıdır, düğüm numarası değil.
      bag("parola", "1", "kontrol", "giris"),
      bag("parola", "2", "kontrol", "giris"),
      bag("parola", "3", "kontrol", "giris"),
      bag("parola_param", "deger", "dogru_mu", "a"),
      bag("parola", "secilenMetin", "dogru_mu", "b"),
      bag("dogru_mu", "sonuc", "kontrol", "kosul"),
      bag("kontrol", "dogru", "gec", "giris"),
      bag("kontrol", "yanlis", "gecemez", "giris"),
      bag("parola", "zamanAsimi", "sessiz", "giris"),
      ...["don", "ziyaret", "gece_soz", "gun_soz", "parola", "gec", "gecemez", "sessiz"].map((id) => bag("ben", "ajan", id, "kim")),
    ],
  };
}
