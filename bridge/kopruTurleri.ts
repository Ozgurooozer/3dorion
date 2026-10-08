// bridge/kopruTurleri.ts — Köprünün ayarları, sayaçları, sabitleri ve yardımcı tipleri
// (spec 14 R2: bridge/kopru.ts'ten taşındı — yalnız yer değişti, anlam aynı).
// Dışarıya açık olanlar bridge/kopru.ts'ten de yeniden dışa aktarılır (eski importlar kırılmaz).
"use strict";
import type { Algi } from "../protocol/algi.ts";
import type { Niyet, NiyetTur } from "../protocol/niyet.ts";
import type { DikkatAyari } from "../mind/dikkat.ts";
import type { KararKaydi, KararSatiri, OgretimSatiri } from "../mind/kararKaydi.ts";
import type { IcguduKimligi } from "../mind/icgudu.ts";
import type { KapiBaglami } from "../mind/durumKodu.ts";
import type { BedenOkumasi } from "../mind/benlik.ts";
import type { Beyin } from "./beyin.ts";

export interface KopruAyari {
  beyin: Beyin;
  /** Doğrulanmış niyeti dünyaya iletir. Dünya tipi BİLİNMEZ — sadece bu imza. */
  niyetGonder: (n: Niyet, id: string) => void;
  /** Dünyanın sıkıştırılmış durumunu ister (her düşünmede bir kez çağrılır). */
  dunyaDurumu: () => string;
  /** Değişmeyen dünya bilgisi — sistem mesajına gider, her tur tekrarlanmaz. */
  sabitBilgi?: () => string;
  dikkat?: DikkatAyari;
  /**
   * İçerik süzgeci (mind/refleks.ts). `false` dönen özet beyne gitmez.
   *
   * Dikkat MEKANİK sınırları uygular (tik yasağı, bütçe, tekrar, kısma);
   * bu ise İÇERİK yargısıdır — "npm bağımlılık ağacı" ile "Segmentation
   * fault" arasındaki farkı dikkat göremez, çünkü ikisi de aynı sıklıkta
   * ve aynı kanaldan gelir.
   *
   * Senkron olması bilinçli: `algi()` dünyadan yüksek frekansla çağrılıyor;
   * burada `await` etmek algı sırasını bozardı. Model tabanlı (async) bir
   * refleks istenirse hattın bu noktasına değil, toplama adımına girmeli.
   *
   * Nesne dönerse kararı veren İÇGÜDÜNÜN kimliği de karar kaydına yazılır
   * (spec 08). Düz `boolean` hâlâ geçerli: eski çağıranlar kırılmaz, kayıtta
   * kural `kopru.suzgec` görünür.
   */
  suzgec?: (a: Algi, ozet: string) => boolean | SuzgecKarari;
  /**
   * KARAR KAYDI (mind/kararKaydi.ts, spec 08). İÇGÜDÜDÜR: verilmezse köprü
   * kendi kaydını kurar ve satırları konsola yazar; canlıda host onları
   * günlük dosyasına ekler. Testler ve araçlar kendi yazıcısını verir.
   */
  kararKaydi?: KararKaydi;
  /**
   * ÖĞRENEN KAPI (toplantı 2026-09-27): kayıttaki öğretim satırları. Köprü kural
   * hafızasını açılışta bunlardan kurar (K5, mind/ogretim.ts); verilmezse boş
   * doğar. Hafıza GÖLGEDE çalışır (K3): her öğrenilebilir algı için kararını
   * kayda yazar, kapının kararını DEĞİŞTİRMEZ.
   */
  ogretimler?: readonly OgretimSatiri[];
  /**
   * BECERİ REFLEKSİ (spec 10): kayıttaki GEÇMİŞ oturumların görev satırları (host
   * okur, seçim mind/gorev.ts `GOREV_SATIRLARI`). Köprü beceri hafızasını bunlardan
   * ve kendi kaydının satırlarından kurar (defter ilkesi, mind/beceriDefteri.ts).
   * Faz C: GÖLGEDE — kesin sözde hafızanın ne yapacağı söz satırına yazılır
   * (`beceriGolge`); kapı, uyanış ve niyetler değişmez. Verilmezse geçmişsiz başlar.
   */
  gorevSatirlari?: readonly KararSatiri[];
  /**
   * BECERİ YETKİSİ (spec 10, Faz D) — ANAHTAR, varsayılan KAPALI. Açıkken parametre
   * içinde eşleşen kesin sözde LLM uyanmaz: önce onay jesti, sonra becerinin adımları
   * SIRAYLA, her birinin sonucu beklenerek, doğrulanıp `niyetGonder` ile gider (tek yol).
   * Kapalıyken köprü Faz C'dekiyle birebir aynıdır (B12). Açılması ön-kayıtlı barı
   * geçmeye bağlı (spec 10); canlıda `?beceri=1`.
   */
  beceriYetkisi?: boolean;
  /**
   * DOĞUŞTAN KOMUT PROGRAMLARI (spec 13 Faz 2b, mind/komutSozlugu.ts). Kesin söz bir programa
   * TAMAMEN uyuyorsa LLM uyanmaz; adımlar eylem sırasıyla yürür. Varsayılan AÇIK (Ozyn,
   * 2026-10-02: "ölçüm geçince açık" — karar kaydındaki 62 gerçek sözde yanlış eşleşme 0,
   * tools/komut-tara.ts). `false` iken köprü bu fazdan önceki haliyle birebir aynıdır.
   */
  komutYetkisi?: boolean;
  /**
   * ANLIK BENLİK için gövdenin anlık okuması (spec 12 §4.2): karar anında ÇEKİLİR,
   * 20 Hz yazılmaz. Verilmezse benliğin `beden` alanı boş kalır.
   */
  bedenDurumu?: () => BedenOkumasi | null;
  /**
   * SÜZGEÇ MERCEĞİNİN YETKİSİ (spec 12 Faz 5) — ANAHTAR, varsayılan KAPALI. Kapalıyken mercek
   * yalnız kayda yazar (gölge). Açıkken: onaylanmış kendi komutunun sonucu geçer
   * (`benlik.beklenen_cevap`), kendi yürüyüşünün "Ozyn yaklaştı"sı süzülür (`benlik.yan_urun`).
   * Yalnız ezilebilir bir içerik kuralını değiştirir; dikkat her zaman sonra gelir. Açılması
   * spec 12 Faz 4'ün gölge ölçüsüne bağlı (≥ 3 gerçek oturum, yanlış eşleşme 0) — Ozyn'in kararı.
   */
  benlikSuzgecYetkisi?: boolean;
  /** Refleksin bir adımının sonucunu en çok ne kadar beklediği (ms). Varsayılan REFLEKS_ZAMAN_ASIMI_MS. */
  refleksZamanAsimiMs?: number;
  /**
   * BAĞLAM (toplantı 2026-09-27 K4): algı anında Ozyn'in durumu — mesafe, bakış,
   * yüzey. Öğrenen kapının durum koduna girer. YAPISAL: düzyazı dünya metni
   * ayrıştırılmaz. Hatası yutulur; bağlamsız kod yazılır.
   */
  baglam?: () => KapiBaglami | null;
  /**
   * Modelin araç çağırmadan ürettiği DÜZ METİN. Bu metin kullanıcıya
   * ULAŞMAZ (protokolde konuşmak bir eylemdir) — ama davranış ölçümü için
   * görülebilmesi gerekir: model sohbet edip araç çağırmıyorsa, kullanıcı
   * Orion'u susmuş sanır ve sebebi görünmez kalır.
   */
  metinDinle?: (metin: string, aracVarMi: boolean) => void;
  /**
   * İŞLEM HATTI kancası — hangi durak ne zaman çalıştı.
   *
   * Yalnızca gözlem içindir (zihin duvarındaki şema paneli): köprünün
   * davranışını DEĞİŞTİRMEZ ve hatası yutulur. Karar yolu buna bağlanmamalı.
   */
  asamaDinle?: (asama: string, not?: string) => void;
  /** Konuşma dışı algılar bu kadar beklenip toplanır (ms). */
  toplamaMs?: number;
  /** Bellekte tutulacak konuşma turu sayısı (KISA vadeli pencere). */
  gecmisSiniri?: number;
  /**
   * Uzun vadeli hafıza açık mı ve kaç anı getirilsin.
   *
   * Kısa pencere (gecmisSiniri) yerine GEÇMEZ, YANINA gelir: pencere
   * "az önce ne konuştuk", hafıza "daha önce ne yaşandı" sorusunu yanıtlar.
   * 0 = kapalı.
   */
  hafizaGetirme?: number;
  /**
   * Uzun vadeli hafızanın kapasitesi (anı). Fonksiyon verilirse her budamada okunur — devre
   * panosunun teli (`PANO_TELLERI.hafiza.kapasite`) buraya bağlanır. Verilmezse 300. Eskiden
   * panodaki tel yalnız paneli besliyordu, köprü hep 300'le budardı (spec 16 F1'de bağlandı).
   */
  hafizaKapasite?: number | (() => number);
  /**
   * Anıların OTURUMLAR ARASI saklanacağı depo.
   *
   * Verilmezse hafıza yalnızca bellekte kalır ve her açılışta sıfırlanır —
   * yani Orion her seferinde sizi ilk kez görür. Odada YAŞAYAN biri iddiası
   * için süreklilik şart.
   *
   * Depo arayüzü bilerek dar: köprü ne localStorage ne dosya sistemi bilir.
   * Hatası yutulur — depo bozuksa Orion hafızasız çalışır ama ÇALIŞIR.
   */
  hafizaDeposu?: { oku(): unknown[]; yaz(aniler: unknown[]): void };
  simdi?: () => number;
  /**
   * İÇ SES (spec 13): sesli okunmayan söz ve düz metin — hareket zincirinde susturulan
   * söz, araçla birlikte gelen düz metin. Yalnız gözlem (zihin duvarı); hatası yutulur.
   */
  icSesDinle?: (metin: string) => void;
  /**
   * "Söyledi ama yapmadı" (mind/sozEylem.ts): sözde iddia edilip aynı turda niyeti
   * gitmeyen eylemler. Yalnız gözlem; davranışı değiştirmez, hatası yutulur.
   */
  sozEylemDinle?: (eksik: NiyetTur[], soz: string) => void;
}

/** İçerik süzgecinin kararı ve onu veren içgüdü (mind/icgudu.ts). */
export interface SuzgecKarari {
  gecsin: boolean;
  kural?: IcguduKimligi;
  gerekce?: string;
}

export interface KopruSayaci {
  dusunme: number;
  niyet: number;
  reddedilenCagri: number;
  hata: number;
  /** İçerik süzgecinin düşürdüğü algı sayısı — süzgeç çalışıyor mu, görünür olsun. */
  suzulen: number;
  /** Araç çağrılmadığı için konuşmaya çevrilen düz metin sayısı. */
  kurtarilanMetin: number;
  /** Düz metin İÇİNDEN kurtarılıp gerçek niyete çevrilen araç çağrısı. */
  kurtarilanCagri: number;
  /** Konuşulmayıp yutulan araç çöpü — kullanıcı JSON dinlemesin. */
  yutulanCop: number;
  /**
   * Zincir bütçesi bittiği için beyni UYANDIRMAYAN bakış cevabı. Cevap
   * kaybolmaz, çalışma belleğine yazılır. Bu sayı büyüyorsa beyin her turda
   * bakıyor demektir — bütçe olmasa her biri bir LLM turu olurdu.
   */
  zincirKesilen: number;
  /** İnisiyatif zincirinde yutulan susma ilanı ("Sessiz kalıyorum…"). */
  yutulanSusma: number;
  /** Beceriyle, LLM'e sormadan yürütülmeye başlanan söz (spec 10, Faz D). Yetki kapalıyken hep 0. */
  refleks: number;
  /** Doğuştan komut programıyla, LLM'e sormadan yürütülen söz (spec 13 Faz 2b). */
  komut: number;
}

/** Refleks niyetlerinin kimlik öneki (`kimlik(REFLEKS_ONEKI)`); sonuçları `niyetKaynagi` ile tanınır. */
export const REFLEKS_ONEKI = "refleks";

/**
 * Refleksin söz yerine verdiği onay (spec 10 açık soru 1): uydurma söz sessizlikten
 * kötüdür (sağ lob ilkesi, mind/yerelTepki.ts). Adım değildir; sonucu beklenmez.
 */
export const REFLEKS_ONAYI: Niyet = { tur: "jest", jest: "başını_sallıyor" };

/** Bir adımın sonucu en çok bu kadar beklenir (ms): odanın bir ucundan öbürüne yürümek ~10 sn. */
export const REFLEKS_ZAMAN_ASIMI_MS = 30_000;

/**
 * Ozyn'in HAREKET olayları (world/olayUretici.ts). Yalnız bunlarla uyanan zincirde söz
 * sesli okunmaz (içgüdü `kopru.hareket_sessiz`, Ozyn 2026-10-02: "uyansın, sesli
 * konuşmasın"). Ortak testte bu olaylar 10+ kez "Ozyn yaklaştı. Bekliyorum.",
 * 4 kez "Uzaklaştın Ozyn.", 3 kez "gece yarısı mı bu?" konuşturdu. Kapı DEĞİŞMEZ:
 * olay yine beyni uyandırır (ölçüm haftası verisi bozulmasın), Orion bakabilir,
 * el sallayabilir, yürüyebilir — yalnız sesi iç seste kalır.
 */
export const HAREKET_OLAYLARI: ReadonlySet<string> = new Set([
  "ozyn_yaklasti", "ozyn_uzaklasti", "ozyn_sana_bakti", "ozyn_yuzeye_gecti", "ozyn_yuzeyden_cikti",
]);

/** Bedeni hareket ettirmeyen niyetler: eylem sırasına girmez, hemen gider. */
export const SOZ_NIYETLERI: ReadonlySet<NiyetTur> = new Set(["soyle", "sor"]);

/** Bir beyin turunun çıktısı işlenirken biriken parçalar. */
export interface TurCiktisi {
  /** Hareket zinciri: söz iç seste kalır. */
  sessiz: boolean;
  /** Gerçekten konuşulan sözler (söz-eylem bekçisi için). */
  sozler: string[];
  /** Sesli okunmayan söz ve düz metin. */
  icSes: string[];
  /** Tur sonunda sıraya girecek beden niyetleri. */
  beden: { niyet: Niyet; id: string }[];
}

/**
 * Susma İLANI — model susmayı seçmiş ama bunu söylüyor.
 *
 * ÖLÇÜLDÜ (2026-09-19, Haiku, n=10, gerçek inisiyatif girdisi): kendiliğinden
 * düşünme turunda 3/10 "Sessiz kalıyorum…" SESLİ söylendi. Olay metnine
 * "susacağını söyleme, hiçbir araç çağırma" diye açıkça yazmak sonucu
 * DEĞİŞTİRMEDİ (yine 3/10) — istem yaması işe yaramadı, bu yüzden yapısal.
 *
 * DAR tutuldu: yalnızca sözün BAŞINDA ve yalnızca ölçülen kalıplar. Ve
 * yalnızca İNİSİYATİF zincirinde uygulanır — Ozyn "neden konuşmuyorsun"
 * derse aynı cümle bir cevaptır ve dokunulmaz.
 */
export const SUSMA_ILANI = /^\s*(sessiz kal|susuyorum|susacağım|susmayı)/;

/** Olay inisiyatiften mi geldi — metinden DEĞİL, yapısal alandan okunur. */
export function inisiyatifOlayiMi(a: Algi): boolean {
  return a.tur === "olay" && a.ayrinti?.kaynak === "inisiyatif";
}

/**
 * Bir dış tetiğin (Ozyn'in sözü, terminal hatası, olay, inisiyatif) beyne
 * verdiği TAKİP turu hakkı.
 *
 * NEDEN VAR — canlıda bulundu (2026-09-19, inisiyatif denemesi): `gordum`
 * her zaman terfi ediyor ("beyin cevabı kendisi istedi") ve Haiku her turda
 * hem bakıp hem konuşuyordu. Her bakışın cevabı beyni yeniden uyandırdı:
 * tek tetik → 5 tur, Orion 4 kez "Bakıyorum" dedi.
 *
 * NEDEN 1: soru-cevap tam olarak bir takip turu ister (soru turu → bakış →
 * cevap turu). Fazlası ölçülmüş bir ihtiyaç değil, ölçülmüş bir maliyet.
 * Model ne yaparsa yapsın bir tetik en fazla 1 + ZINCIR_AZAMI tur doğurur.
 */
export const ZINCIR_AZAMI = 1;
