// protocol/niyet.ts — Beyin → Dünya. Orion'un dünyada yapabildiği her şey.
//
// Bu liste Orion'un araç yüzeyidir: bridge/tools.ts burayı okuyup LLM'e araç
// şeması üretir. Yeni bir yetenek eklemek = buraya bir varyant eklemek.
// Dünya tarafı tanımadığı bir niyeti sessizce yutmaz — `sonuc: "hata"` döner.
"use strict";
import type { Hedef, Vec3 } from "./temel.ts";

/**
 * Duruş: sürekli hal. Bir seferde tek poz geçerli.
 * Sözlük molp `core/sahne.ts` POZLAR ile birebir aynı — mevcut [POZ:x]
 * ayrıştırıcısı bu protokole çeviri yapmadan bağlanabilsin diye.
 */
export const POZLAR = [
  "duruyor", "oturuyor", "yatıyor", "eğiliyor",
  "yürüyor", "koşuyor", "bakıyor",
] as const;
export type Poz = (typeof POZLAR)[number];

/** Jest: anlık hareket. Poz'u bozmaz, üstüne biner. */
export const JESTLER = [
  "el_salliyor", "başını_sallıyor", "omuz_silkiyor",
  "işaret_ediyor", "gülümsüyor", "kaş_çatıyor",
  "el_açıyor", "bekliyor",
] as const;
export type Jest = (typeof JESTLER)[number];

export type Niyet =
  /** Duruşu değiştir. */
  | { tur: "poz";      poz: Poz }
  /**
   * Anlık jest oynat. `hedef` verilirse jest ona yönelir (ör. işaret_ediyor).
   * `klip` (spec 35 Dilim 5a) verilirse beden jestin yerine o ANİMASYON KLİBİNİ oynatır (`protocol/animasyon.ts`; ad = `assets/animasyon/<ad>.json`):
   * niyet SÜRELİ olur — `basladi`, klip bitince `bitti` (döngülü klip bitmez; `dur` ya da yeni jest keser → `iptal`). `jest` yine zorunludur: klibin
   * anlamıdır (günlük, uzvu olmayan gövde onu gösterir). Alan eklemek kırıcı değil (SOZLESME.md); Orion'un araç şeması bu alanı SUNMAZ
   * (bridge/araclar.ts değişmedi: token bütçesi), klip bugün yalnız Ozyn'in grafiğinden gelir.
   */
  | { tur: "jest";     jest: Jest; hedef?: Hedef; klip?: string }
  /** Başı/gövdeyi hedefe çevir. `birak` = serbest bakışa dön. */
  | { tur: "bak";      hedef: Hedef | null }
  /** Hedefe yürü. `mesafe` = hedefin kaç metre yakınında duracağı. */
  | { tur: "git";      hedef: Hedef; mesafe?: number }
  /** Belirtilen çapaya otur (varsayılan: sandalye). */
  | { tur: "otur";     capa?: string }
  | { tur: "kalk" }
  /**
   * Konuş. Dünya bunu altyazıya ve TTS'e verir, ağız senkronunu tetikler.
   * `ses: false` → yalnızca altyazı (sessiz mod / TTS yoksa).
   */
  | { tur: "soyle";    metin: string; ses?: boolean }
  /** Tahtaya yaz. `temizle` önce siler. */
  | { tur: "yaz";      metin: string; temizle?: boolean }
  /** Nesneyi eline al / bırak. */
  | { tur: "al";       nesne: string }
  | { tur: "birak" }
  /** Dikkatini bir yüzeye ver (monitör, tahta) — kamera ipucu da üretir. */
  | { tur: "odaklan";  capa: string }
  /** Yürüyen/oynayan her şeyi kes. Acil durdurma. */
  | { tur: "dur" }
  /**
   * Terminale bir komut ÖNER. ÇALIŞTIRMAZ.
   *
   * Bu protokoldeki tek tehlikeli yetenek, o yüzden tasarımı bilinçli olarak
   * asimetrik: Orion yalnızca öneri üretebilir; komutu çalıştıran şey Ozyn'in
   * TUŞUDUR. Zaman aşımıyla "evet" yok, varsayılan onay yok.
   *
   * `gerekce` zorunlu: neden bu komut? Onaylayan insan bilgilendirilmeden
   * karar vermemeli. Gerekçesiz öneri reddedilir.
   */
  | { tur: "komut";    metin: string; gerekce: string }
  /** Salt-okunur sorgu: dünya durumunu istemek. Yanıt `algi: "gordum"`. */
  | { tur: "sor";      ne: SorKonusu }
  /**
   * Kalıcı bir OLGU hatırla (spec 26 F3): Ozyn'in araçları, tercihleri, kararları. `anahtar` konuyu adlandırır
   * ("favori_renk"); AYNI anahtarla yeni olgu eskisini GÜNCELLER (çelişki çözümü: yenisi kazanır).
   */
  | { tur: "hatirla";  anahtar: string; deger: string }
  /**
   * Dünyanın ORTAMINI değiştir (ova): ışık, renk düzeni, stil, zaman, sis, ışık sonrası efektler. Serbest metin yok:
   * `ne` bir enum, `deger` o konunun kısa adı ("toon", "kis", "bloom:kapat"), `sayi` saat/adım gibi sayısal girdi.
   * Değerin geçerliliğini dünya bilir (`world/level/stil/ortamKomutu.ts`); orası bilinmeyen değeri açık hatayla
   * reddeder ve metin modele döner. Beden niyeti DEĞİL: yürümez, bekleme sırasına girmez.
   */
  | { tur: "ortam";    ne: OrtamNe; deger?: string; sayi?: number }
  /**
   * ORION DOKTOR: kendi bedenini/dünyasını muayene et (WebGL hataları, görünmez mesh'ler, kare hızı, köprü sayaçları). Beden niyeti DEĞİL:
   * yürümez. `hizli` pasiftir (hiçbir şeye dokunmaz, ~2 sn); `tam` her ışık efektini ve önayarı gündüz/gece çalışma anında açıp kapatır ve
   * ESKİ hâle döner (~35 sn, yalnız ova'da). Sağlıklıysa sonuç sessizdir (`bitti` beyni uyandırmaz = token yok); hastaysa `hata` metni
   * modele gider. Söz yolu LLM'siz (`mind/doktorKomutlari.ts`): "doktor", "kendini kontrol et" — oturmak kadar kolay.
   */
  | { tur: "doktor";   kapsam?: DoktorKapsam }
  /**
   * BAŞKA BİR AJANA emir ver (Orion → Flash, spec 33; Ozyn 2026-10-21: "orion da orion lite'a emir verebilsin, takip et, otur gibi"). `kime` ajan kimliği
   * ("flash"), `soz` o ajanın anlayacağı KISA komut ("otur", "kalk", "bana gel", "beni takip et"). Hedef LLM'siz bir NPC'dir: yalnız sabit komutları tanır,
   * yani `soz` serbest metin değil komuttur; anlamazsa Flash kendi cevabını verir (Orion'a değil). Beden niyeti DEĞİL: Orion yürümez, sırada beklemez. Sonuç
   * "teslim edildi"dir, "yapıldı" değil (NPC'nin işi asenkron); Orion yapıldığını bilmek isterse `sor` ile bakar. Orion kendine emredemez.
   */
  | { tur: "emret";    kime: string; soz: string };

/** `emret`in sınırları: kısa komut, kısa ad (roman değil). */
export const EMIR_SOZ_SINIRI = 60;
export const EMIR_KIME_SINIRI = 24;

/** `ortam`ın konuları — araç şeması ve doğrulayıcı BURADAN türer (`sor`un SORULAR'ı gibi). */
export const ORTAM_KONULARI = [
  "stil", "renk", "saat", "saat_kaydir", "isik", "sis", "efekt", "shader", "akis", "dunya", "sifirla",
] as const;
export type OrtamNe = (typeof ORTAM_KONULARI)[number];
/** `doktor`un kapsamları: hızlı (pasif, dokunmaz) ya da tam (her efekti açıp kapatır, geri yükler). */
export const DOKTOR_KAPSAMLARI = ["hizli", "tam"] as const;
export type DoktorKapsam = (typeof DOKTOR_KAPSAMLARI)[number];

/** `deger` metni sınırı: kısa bir ad ("toon", "bloom:kapat"); roman değil. */
export const ORTAM_DEGER_SINIRI = 40;

/** Olgu sınırları: kısa ve damıtılmış kalsın (ham söz torbası geri dönmesin). */
export const OLGU_ANAHTAR_SINIRI = 40;
export const OLGU_DEGER_SINIRI = 200;

/**
 * `sor`un konuları — araç şeması, satır sözleşmesi (`BAK:`) ve doğrulayıcı BURADAN türer (önce dört dosyada ayrı
 * yazılıydı). İlk dördü ALGI: koddan, anında, kesin (NPC gibi; spec 25 Faz 1). `gor` GÖRME: Orion'un gözünden kare +
 * o anki algı → yerel görme modeli, 1–3 sn, yalnız istenince (spec 25 Faz 2). Algının yerine geçmez, üstüne eklenir.
 */
export const SORULAR = ["onumde", "yakin", "oyuncu", "dunya", "gor"] as const;
export type SorKonusu = (typeof SORULAR)[number];

export type NiyetTur = Niyet["tur"];

/** Dünya durumunu DEĞİŞTİREN niyetler. Yetki kapısı bunları ayırt eder. */
export const YAZAN_NIYETLER: readonly NiyetTur[] = [
  "poz", "jest", "bak", "git", "otur", "kalk", "soyle", "yaz", "al", "birak", "odaklan", "dur",
  // `ortam` dünyanın görünümünü değiştirir (ışık, stil, zaman): yazan niyettir.
  "ortam",
  // `doktor` (tam kapsam) efektleri geçici açıp geri yükler: yazan niyet sayılır (özerk turda sunulmaz).
  "doktor",
  // `emret` başka bir ajanın (Flash) bedenini hareket ettirir: dünyayı değiştirir, yazan niyettir (özerk turda sunulmaz).
  "emret",
  // `komut` BİLEREK BURADA YOK: dünyayı kendisi değiştirmez, yalnızca öneri
  // kuyruğuna girer. Dünyayı değiştiren şey Ozyn'in onayıdır.
];

export function okunurMu(n: Niyet): boolean {
  return n.tur === "sor";
}

/** Bir niyetin tamamlanması beklenir mi (asenkron), yoksa anında biter mi? */
export const SURELI_NIYETLER: readonly NiyetTur[] = ["git", "soyle", "yaz", "otur", "kalk"];

export interface NiyetSonucu {
  niyet_id: string;
  durum: "basladi" | "bitti" | "iptal" | "hata";
  /** durum "hata" ise zorunlu: neden. */
  not?: string;
  /**
   * Makinenin okuyacağı neden; `not` insan/model içindir ve metni değişebilir. `onay_dustu`: komut önerisi Ozyn karar
   * vermeden onay kapısında düştü (Orion bunu bir kez hatırlatabilir). Metinde anahtar kelime aranmaz.
   */
  kod?: "onay_dustu";
  /** "git" için varış noktası gibi ek bilgi. */
  veri?: Vec3 | Record<string, unknown>;
}
