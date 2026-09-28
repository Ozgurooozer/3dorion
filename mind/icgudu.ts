// mind/icgudu.ts — Orion'un DOĞUŞTAN kuralları: tek liste, kalıcı kimlikler.
//
// NEDEN VAR (Ozyn, 2026-09-26): "Ana bir bölge var, bu kurallar hiç
// değişmiyor. Etrafında diğer bölgeler gelişiyor; ana bölgeye uygunsa giderek
// yeni kurallar ekleniyor." Ve 2026-09-27: "kayıt ekleyeceksen bunu içgüdü
// kuralları olarak, doğuştan gelen kurallar olarak ekleyebilirsin."
//
// Orion'un kapısında bugün çalışan kuralların hepsi elle yazılmış: dikkat
// (mekanik sınırlar), refleks (içerik yargısı), köprü (zincir bütçesi, konuşma
// asla süzülmez), onay kapısı (komutu çalıştıran Ozyn'in tuşu). Bunlar Orion'un
// İÇGÜDÜLERİDİR. Buraya kadar hiçbirinin adı yoktu: bir algının neden düştüğü
// yalnızca düzyazı `gerekce`de duruyordu. Kalıcı kimlik iki şey sağlar:
//   1. KAYIT: her karar, onu hangi içgüdünün verdiğini taşır
//      (mind/kararKaydi.ts). "Bu kararı kim verdi" sorusunun cevabı düzyazı
//      değil, kimlik olur — sayılabilir, kıyaslanabilir.
//   2. BÜYÜME: öğrenilen kurallar (öğrenen kapı, brain-lab/BUYUK-RESIM.md KT2)
//      bu içgüdülerin etrafında büyür ve aynı kayda kendi kimlikleriyle
//      yazılır. `ezilebilir: false` olan içgüdüyü hiçbir öğrenilmiş kural
//      ezemez: maliyet tavanı ve insan denetimi deneyimle gevşemez.
//
// Kimlikler KALICIDIR: kayıtlar diskte yıllarca durabilir; bir kimliği yeniden
// adlandırmak eski kayıtları yetim bırakır. Kural değişirse YENİ kimlik alır.
//
// Bu dosya kural UYGULAMAZ, yalnızca adlandırır. Kurallar yerlerinde kalır
// (dikkat.ts, refleks.ts, bridge/kopru.ts, onayKapisi.ts). Bekçi testleri
// (icgudu.test.ts) iki yönü de zorlar: kodun döndürdüğü her kimlik burada
// var, buradaki her kapı kimliği kodda en az bir girdiyle üretiliyor.
//
// Bağımlılık: yok. Saf veri.
"use strict";

export interface Icgudu {
  /** Kuralı uygulayan katman. */
  katman: "kayit" | "kopru" | "dikkat" | "refleks" | "onay";
  /**
   * Öğrenilmiş bir kural bu içgüdünün kararını ezebilir mi?
   *
   * `false` = güvenlik içgüdüsü: maliyet tavanı (tik, bütçe, kısma, tekrar),
   * sözleşme (kanal, konuşma, sorunun cevabı) ya da insan denetimi (onay).
   * `true` = içerik yargısı: "bu terminal çıktısı Ozyn'i ilgilendirir mi"
   * gibi, deneyimin daha iyi bilebileceği kararlar.
   */
  ezilebilir: boolean;
  /** Ne yapar, tek cümle. */
  aciklama: string;
}

export const ICGUDULER = {
  // ── Kayıt ────────────────────────────────────────────────────────────────
  "kayit": { katman: "kayit", ezilebilir: false,
    aciklama: "Her karar ve sonucu kaydedilir; kayıt davranışı değiştirmez, yazılamazsa Orion yine çalışır." },

  // ── Köprü ────────────────────────────────────────────────────────────────
  "kopru.konusma": { katman: "kopru", ezilebilir: false,
    aciklama: "Ozyn'in sözü içerik süzgecine hiç girmez ve beyni hemen uyandırır." },
  "kopru.zincir": { katman: "kopru", ezilebilir: false,
    aciklama: "Bir tetik en fazla bir takip turu doğurur; hakkı biten bakış cevabı beyni uyandırmaz, çalışma belleğine yazılır." },
  "kopru.guvenli_taraf": { katman: "kopru", ezilebilir: false,
    aciklama: "İçerik süzgeci çökerse algı geçirilir: gereksiz uyandırmak, sessizce atlamaktan iyidir." },
  "kopru.suzgec": { katman: "kopru", ezilebilir: true,
    aciklama: "Kimlik vermeyen bir içerik süzgecinin kararı (eski imza: yalnızca evet/hayır)." },

  // ── Dikkat (mekanik sınırlar, mind/dikkat.ts) ─────────────────────────────
  "dikkat.tik_yasak": { katman: "dikkat", ezilebilir: false,
    aciklama: "20 Hz tik algısı beyne asla gitmez: projenin maliyet tavanı." },
  "dikkat.yerel_kanal": { katman: "dikkat", ezilebilir: false,
    aciklama: "Varsayılan kanalı yerel olan algı beyne yükseltilemez (başarısız niyet sonucu hariç)." },
  "dikkat.onemsiz": { katman: "dikkat", ezilebilir: true,
    aciklama: "Gürültü olaylar (kamera değişti, ipucu, fare kilidi) beyne gitmez." },
  "dikkat.kisildi": { katman: "dikkat", ezilebilir: false,
    aciklama: "Terminal çıktısı kısma süresinden sık gelirse düşer: akan çıktı her satırda beyni uyandırmasın." },
  "dikkat.tekrar": { katman: "dikkat", ezilebilir: false,
    aciklama: "Aynı algı tekrar penceresi içinde yeniden gelirse düşer." },
  "dikkat.butce": { katman: "dikkat", ezilebilir: false,
    aciklama: "Dakikadaki azami mesaj sayısı dolduysa algı düşer: bütçe freni." },
  "dikkat.gecti": { katman: "dikkat", ezilebilir: true,
    aciklama: "İçerik süzgeci yokken dikkatin sınırlarından geçen algı beyne gider." },

  // ── Refleks (içerik yargısı, mind/refleks.ts KuralRefleksi) ───────────────
  "refleks.konusma": { katman: "refleks", ezilebilir: false,
    aciklama: "Konuşma her zaman terfi eder: kullanıcı bekletilemez." },
  "refleks.terminal.kod_hata": { katman: "refleks", ezilebilir: true,
    aciklama: "Komut sıfırdan farklı çıkış koduyla bittiyse terfi eder; metne bakılmaz." },
  "refleks.terminal.kod_bitis": { katman: "refleks", ezilebilir: true,
    aciklama: "Komut başarılı bitti ve çıktısı bir iş sonucu (test, derleme): terfi eder." },
  "refleks.terminal.kod_uzun": { katman: "refleks", ezilebilir: true,
    aciklama: "Komut başarılı bitti ve uzun sürdü (Ozyn bekledi): terfi eder." },
  "refleks.terminal.kod_rutin": { katman: "refleks", ezilebilir: true,
    aciklama: "Komut başarılı bitti, çıktı rutin: süzülür." },
  "refleks.terminal.yigin_izi": { katman: "refleks", ezilebilir: true,
    aciklama: "Çıkış kodu yok; yalnızca yığın izi gürültüsü: süzülür." },
  "refleks.terminal.hata_deseni": { katman: "refleks", ezilebilir: true,
    aciklama: "Çıkış kodu yok; çıktıda hata deseni var: terfi eder." },
  "refleks.terminal.kabuk": { katman: "refleks", ezilebilir: true,
    aciklama: "Çıkış kodu yok; kabuk başarısızlığı (tanınmayan komut, izin): terfi eder." },
  "refleks.terminal.bitis_deseni": { katman: "refleks", ezilebilir: true,
    aciklama: "Çıkış kodu yok; iş bitiş deseni (test sonucu, derleme bitti): terfi eder." },
  "refleks.terminal.gurultu": { katman: "refleks", ezilebilir: true,
    aciklama: "Çıkış kodu yok; rutin terminal gürültüsü: süzülür." },
  "refleks.olay.gurultu": { katman: "refleks", ezilebilir: true,
    aciklama: "Gürültü olay: süzülür." },
  "refleks.olay.dunya": { katman: "refleks", ezilebilir: true,
    aciklama: "Dünya olayı (Ozyn odaya girdi, oturdu, monitörü açtı): terfi eder." },
  "refleks.gordum.cevap": { katman: "refleks", ezilebilir: false,
    aciklama: "Beynin kendi sorduğu sorunun cevabı her zaman terfi eder." },
  "refleks.sonuc.hata": { katman: "refleks", ezilebilir: true,
    aciklama: "Niyet başarısız oldu: terfi eder, Orion yapamadığını öğrensin." },
  "refleks.sonuc.elle_hata": { katman: "refleks", ezilebilir: true,
    aciklama: "Elle verilen niyet (Ozyn'in tuşu ya da konsolu) başarısız oldu: süzülür; o niyeti LLM vermedi." },
  "refleks.sonuc.rutin": { katman: "refleks", ezilebilir: true,
    aciklama: "Niyet başarıyla bitti: süzülür, bağlamı şişirmesin." },
  "refleks.anlik.rutin": { katman: "refleks", ezilebilir: true,
    aciklama: "İstenmeden gelen dünya/yakın anlık görüntüsü: süzülür." },
  "refleks.taninmayan": { katman: "refleks", ezilebilir: true,
    aciklama: "Tanınmayan biçim: güvenli tarafa, terfi eder." },

  // ── Onay kapısı (mind/onayKapisi.ts) ─────────────────────────────────────
  "onay.insan": { katman: "onay", ezilebilir: false,
    aciklama: "Komut önerisi yalnızca Ozyn'in tuşuyla çalışır; zaman aşımıyla evet yoktur." },
} as const satisfies Record<string, Icgudu>;

export type IcguduKimligi = keyof typeof ICGUDULER;

/** Refleksin (içerik süzgecinin) verebileceği kararların kimlikleri. */
export type RefleksKurali = Extract<IcguduKimligi, `refleks.${string}`>;

/** `Dikkat.karar` düşürme sebebinin içgüdü kimliği. */
export function dikkatKurali(
  sebep: "tik_yasak" | "yerel_kanal" | "tekrar" | "kisildi" | "butce" | "onemsiz",
): IcguduKimligi {
  return `dikkat.${sebep}`;
}

/** Kimlik bu listede mi? Kayıt okuyan araçlar dış veriyi buna göre süzer. */
export function icguduMu(kimlik: string): kimlik is IcguduKimligi {
  return Object.hasOwn(ICGUDULER, kimlik);
}
