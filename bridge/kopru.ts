// bridge/kopru.ts — Beyin ile dünya arasındaki döngü.
//
// Köprü ne Babylon'u ne Electron'u ne de beynin kim olduğunu bilir. Dışarıdan
// iki şey alır: niyeti gönderecek bir fonksiyon ve bir `Beyin`. Bu yüzden
// tamamen sahte bir beyinle, sahnesiz test edilebilir.
//
// Akış:
//   algi() → Dikkat süzer → tampon → (tetik) → Beyin.dusun()
//     → araç çağrıları → protokol doğrulaması → niyetGonder()
//
// Tetikleme "her algıda düşün" DEĞİL: konuşma anında uyandırır, geri kalanı
// kısa bir sessizlik penceresiyle toplanır. Amaç, beyni gereksiz uyandırmamak.
"use strict";
import type { Algi } from "../protocol/algi.ts";
import { ozetle } from "../protocol/algi.ts";
import type { Niyet, NiyetSonucu, NiyetTur } from "../protocol/niyet.ts";
import { kimlik } from "../protocol/temel.ts";
import { Dikkat, kanalAcikMi, type DikkatAyari } from "../mind/dikkat.ts";
import { KararKaydi, niyetKaydi, type AlgiEki, type BeceriGolgesi, type KapiKarari, type KararSatiri, type NiyetKaydi, type OgretimSatiri, type RefleksBitisi, type UyanisBilgisi } from "../mind/kararKaydi.ts";
import { niyetDogrula } from "../protocol/dogrula.ts";
import { BeceriDefteri } from "../mind/beceriDefteri.ts";
import type { BeceriHafizasi } from "../mind/beceriHafizasi.ts";
import { ICGUDULER, dikkatKurali, type IcguduKimligi } from "../mind/icgudu.ts";
import { durumKodu, niyetKaynagi, type KapiBaglami } from "../mind/durumKodu.ts";
import type { KuralHafizasi, KapiYonu } from "../mind/kuralHafizasi.ts";
import { deneyimKimligi, kuralHafizasiKur, ogretimAnahtari } from "../mind/ogretim.ts";
import { Hafiza, kuralOnemi, type AniTuru } from "../mind/hafiza.ts";
import { calismaBellegiKur, type CalismaBellegi } from "../mind/calismaBellegi.ts";
import { oncesiSozu } from "../mind/zaman.ts";
import { sozEylemUcurumu } from "../mind/sozEylem.ts";
import { komutCoz, type KomutEslesmesi } from "../mind/komutSozlugu.ts";
import { araclariUret, cagriyiNiyete } from "./araclar.ts";
import type { Beyin, BeyinGirdisi } from "./beyin.ts";
import { talimatUret } from "./talimat.ts";
import { ornekUret } from "./ornekler.ts";
import { metinKurtar } from "./metinKurtarma.ts";

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

/** Süren bir refleks turu (spec 10, Faz D). */
interface SurenRefleks {
  /** Tetikleyen söz: kayıttaki kimliği, metni ve özeti (başarısızlıkta LLM'e bunlar döner). */
  algi: string;
  soz: string;
  ozet: string;
  beceri: string;
  adimlar: Niyet[];
  /** Sıradaki adımın indeksi. */
  sira: number;
  /** Sonucu beklenen adımın niyet kimliği. */
  bekleyen: string | null;
  onay?: NiyetKaydi;
  /** Gönderilen adımlar (doğrulanmış halleriyle), sırayla. */
  gonderilen: NiyetKaydi[];
  baslangic: number;
  zamanlayici: ReturnType<typeof setTimeout> | null;
}

/**
 * Ozyn'in HAREKET olayları (world/olayUretici.ts). Yalnız bunlarla uyanan zincirde söz
 * sesli okunmaz (içgüdü `kopru.hareket_sessiz`, Ozyn 2026-10-02: "uyansın, sesli
 * konuşmasın"). Ortak testte bu olaylar 10+ kez "Ozyn yaklaştı. Bekliyorum.",
 * 4 kez "Uzaklaştın Ozyn.", 3 kez "gece yarısı mı bu?" konuşturdu. Kapı DEĞİŞMEZ:
 * olay yine beyni uyandırır (ölçüm haftası verisi bozulmasın), Orion bakabilir,
 * el sallayabilir, yürüyebilir — yalnız sesi iç seste kalır.
 */
const HAREKET_OLAYLARI: ReadonlySet<string> = new Set([
  "ozyn_yaklasti", "ozyn_uzaklasti", "ozyn_sana_bakti", "ozyn_yuzeye_gecti", "ozyn_yuzeyden_cikti",
]);

/** Bedeni hareket ettirmeyen niyetler: eylem sırasına girmez, hemen gider. */
const SOZ_NIYETLERI: ReadonlySet<NiyetTur> = new Set(["soyle", "sor"]);

/**
 * EYLEM SIRASI (spec 13): bir turdaki birden çok beden niyeti sırayla yürür.
 *
 * Taban ölçüsü (2026-10-02): "masaya git ve otur", "tahtaya yaz" hep yalnız `git` ile
 * bitti. Varış sonucu rutin olduğu için beyni uyandırmaz (`refleks.sonuc.rutin`) ve
 * ikinci adım hiç gelmez; aynı turda `git + yaz` gönderilse `yaz` varıştan önce
 * yürüyüp "uzaktan yazamazsın" ile reddedilirdi. Beceri refleksinin adım yürütücüsüyle
 * aynı desen: sıradaki adım öncekinin `bitti` sonucunu bekler; `hata`/`iptal` sırayı
 * keser (hata yine beyne gider), zaman aşımı kalanı düşürür. Tek beden niyeti bugünkü
 * gibi hemen gider.
 */
interface EylemSirasi {
  kalan: { niyet: Niyet; id: string }[];
  bekleyen: string | null;
  zamanlayici: ReturnType<typeof setTimeout> | null;
}

/** Bir beyin turunun çıktısı işlenirken biriken parçalar. */
interface TurCiktisi {
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
const SUSMA_ILANI = /^\s*(sessiz kal|susuyorum|susacağım|susmayı)/;

/** Olay inisiyatiften mi geldi — metinden DEĞİL, yapısal alandan okunur. */
function inisiyatifOlayiMi(a: Algi): boolean {
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

export class Kopru {
  private _ayar: KopruAyari;
  private _dikkat: Dikkat;
  private _hafiza: Hafiza;
  /** ŞU ANKİ durum (spec 06 K2) — anı değil, üzerine yazılır ve eskir. */
  private _calisma: CalismaBellegi;
  private _tampon: string[] = [];
  /**
   * `_tampon`un KİMLİK gölgesi: her özetin karar kaydındaki algı kimliği,
   * algı olmayan geri besleme (reddedilen çağrı) için `null`. İkisi hep
   * birlikte itilir ve birlikte boşaltılır; uyanış satırı "bu turu hangi
   * algılar tetikledi" sorusunu buradan cevaplar.
   */
  private _tamponIdleri: (string | null)[] = [];
  /** İÇGÜDÜ `kayit`: her karar ve sonucu (spec 08). */
  private _kayit: KararKaydi;
  /** Öğrenen kapı — gölgede (K3). */
  private _kuralHafizasi: KuralHafizasi;
  /**
   * Son öğrenilebilir algıların durum kodu: kimlik → işaretler. Uygulama içinden
   * öğretim (`ogret`) hangi kodu öğreteceğini buradan bilir. Sınırlı: en eski düşer.
   */
  private _ogrenilebilir = new Map<string, string[]>();
  /** Uygulanmış öğretim satırları — aynı satır iki yoldan gelirse bir kez uygulanır. */
  private _uygulanan = new Set<string>();
  /** Beceri refleksinin defteri (spec 10) — Faz C'de gölgede. */
  private _beceri: BeceriDefteri;
  /** Defterin kayıt dinlemesinden çıkış (kapanışta). */
  private _beceriDinlemesi: () => void;
  /** Bu turda hangi algi turleri geldi — talimat buna gore daralir. */
  private _turTurleri = new Set<string>();
  /** Bu turda hafızaya yazılan içerikler — sorgu ve dışlama için. */
  private _turIcerikleri: string[] = [];
  private _gecmis: BeyinGirdisi["gecmis"] = [];
  private _zamanlayici: ReturnType<typeof setTimeout> | null = null;
  private _dusunuyor = false;
  /** Düşünme sürerken yeni girdi geldiyse, bitince bir tur daha dön. */
  private _tekrarGerek = false;
  private _sayac: KopruSayaci = { dusunme: 0, niyet: 0, reddedilenCagri: 0, hata: 0, suzulen: 0, kurtarilanMetin: 0, kurtarilanCagri: 0, yutulanCop: 0, zincirKesilen: 0, yutulanSusma: 0, refleks: 0, komut: 0 };
  /** Süren refleks turu (spec 10, Faz D); yoksa null. */
  private _refleks: SurenRefleks | null = null;
  /** Kalan takip turu hakkı — bkz. ZINCIR_AZAMI. */
  private _zincirKalan = ZINCIR_AZAMI;
  /**
   * Şu anki zinciri kim başlattı. Takip turları (yalnız bakış cevabı) kökeni
   * DEVRALIR: inisiyatifle başlayan zincirin bakış sonrası turu da inisiyatiftir.
   */
  private _zincirKokeni: "dis" | "inisiyatif" = "dis";
  /** Bekleyen turda inisiyatif / dış tetik var mı — tur başında kökeni belirler. */
  private _turInisiyatif = false;
  private _turDis = false;
  /** Bekleyen turda hareket dışı bir olay var mı (bkz. HAREKET_OLAYLARI). */
  private _turHareketDisi = false;
  /** Şu anki zincir yalnız Ozyn'in hareketiyle mi başladı — söz iç seste kalır. Takip turu devralır. */
  private _zincirSessiz = false;
  /** Süren eylem sırası; yoksa null. */
  private _sira: EylemSirasi | null = null;
  /** Üst üste kaç tur yalnızca ret geri beslemesiyle döndük. Döngü kalkanı. */
  private _ardisikRet = 0;
  private _konusmaDinleyiciler = new Set<(metin: string) => void>();
  private _durduruldu = false;

  constructor(ayar: KopruAyari) {
    this._ayar = ayar;
    this._dikkat = new Dikkat(ayar.dikkat);
    this._hafiza = new Hafiza({ simdi: ayar.simdi });
    this._calisma = calismaBellegiKur({ simdi: ayar.simdi });
    // İÇGÜDÜ `kayit`: köprü kaydını DOĞUŞTAN kurar — kimse açmak zorunda değil.
    this._kayit = ayar.kararKaydi ?? new KararKaydi({ simdi: ayar.simdi });
    this._kayit.oturumBasi(ayar.beyin.ad);
    // K5: kural hafızası öğretim satırlarından, sırayla, birebir kurulur.
    const kurulum = kuralHafizasiKur(ayar.ogretimler ?? []);
    this._kuralHafizasi = kurulum.hafiza;
    for (const s of ayar.ogretimler ?? []) if (s?.tur === "ogretim") this._uygulanan.add(ogretimAnahtari(s));
    if (kurulum.uygulanan || kurulum.atlanan.length) {
      console.log(`[KAPI] kural hafizasi: ${kurulum.uygulanan} ogretim, ${this._kuralHafizasi.noronlar.length} kural${kurulum.atlanan.length ? `, ${kurulum.atlanan.length} satir atlandi` : ""}`);
    }
    // Spec 10: beceri defteri geçmiş oturumlardan kurulur, bu oturumu kendi kaydından
    // dinler (diske gidenin aynısı: canlı hafıza kayıttan kurulana eşit kalır). Geçmiş
    // okunamazsa Orion durmaz: geçmişsiz başlar, görünür biçimde.
    try { this._beceri = new BeceriDefteri(ayar.gorevSatirlari ?? []); }
    catch (err) {
      console.warn("[BECERI] gecmis gorev satirlari okunamadi, gecmissiz basliyor:", err);
      this._beceri = new BeceriDefteri();
    }
    this._beceriDinlemesi = this._kayit.dinle((s) => this._beceri.ekle(s));
    const beceriSayisi = this._beceri.hafiza.beceriler.length;
    if (beceriSayisi) console.log(`[BECERI] ${beceriSayisi} beceri gecmis oturumlardan kuruldu (${ayar.beceriYetkisi ? "YETKILI" : "golgede"})`);
    if (ayar.beceriYetkisi) console.log("[BECERI] YETKI ACIK: eslesen kesin sozde LLM uyanmaz, beceri refleksle yurur (spec 10 Faz D)");

    // Geçmiş oturumların anıları. Hata yutulur: bozuk bir kayıt yüzünden
    // dünya açılmamazlık edemez.
    if (ayar.hafizaDeposu) {
      try {
        const n = this._hafiza.yukle(ayar.hafizaDeposu.oku());
        if (n) console.log(`[hafiza] ${n} ani onceki oturumlardan yuklendi`);
      } catch (err) {
        console.warn("[hafiza] kayit okunamadi, bos baslaniyor:", err);
      }
    }
  }

  /**
   * Orion'un söylediği metni dinlemek isteyen (altyazı, TTS, ölçüm) bağlanır.
   *
   * ÇOKLU: ilk sürüm tek yuvaya yazıyordu ve ikinci `konusmaDinle` çağrısı
   * birincisini SESSİZCE siliyordu. Canlı hafıza ölçümünde tam olarak bu oldu:
   * ölçüm dinleyicisi kuruldu, sonra `beyniBagla` üretim dinleyicisini
   * bağlayınca ölçüm hiçbir şey duymadı ve "cevap boş" gibi göründü.
   */
  konusmaDinle(cb: (metin: string) => void): () => void {
    this._konusmaDinleyiciler.add(cb);
    return () => { this._konusmaDinleyiciler.delete(cb); };
  }

  /** Tüm konuşma dinleyicilerine ulaştır; birinin hatası diğerlerini kesmez. */
  /**
   * ARIZA dinleyicisi — beyin düşünemediğinde haber verir.
   *
   * Neden ayrı bir kanal: bu Orion'un SÖZÜ değil, sistemin arızası. Orion'un
   * ağzından "kotam doldu" dedirtmek varlığı bozar; ama sessiz bırakmak daha
   * kötü — ölçümde OpenRouter kotası dolunca Orion 75 sn bekleyip hiçbir şey
   * yapmadı ve odada sebebi görünmedi. Giriş bunu odadaki bildirime bağlar.
   */
  private _arizaDinleyiciler = new Set<(mesaj: string) => void>();

  arizaDinle(cb: (mesaj: string) => void): () => void {
    this._arizaDinleyiciler.add(cb);
    return () => { this._arizaDinleyiciler.delete(cb); };
  }

  private _arizaYay(mesaj: string): void {
    for (const d of this._arizaDinleyiciler) {
      try { d(mesaj); } catch (err) { console.error("[kopru] arıza dinleyicisi hatası:", err); }
    }
  }

  /**
   * Hafızayı depoya yaz — KISILMIŞ.
   *
   * Her anıda yazmak, yoğun bir terminal oturumunda saniyede onlarca
   * serileştirme demek. 3 sn'lik pencere hem ucuz hem yeterli: çökme
   * durumunda en fazla son birkaç saniye kaybolur.
   */
  private _hafizaSaat: ReturnType<typeof setTimeout> | null = null;
  private _hafizaYaz(): void {
    const depo = this._ayar.hafizaDeposu;
    if (!depo || this._hafizaSaat) return;
    this._hafizaSaat = setTimeout(() => {
      this._hafizaSaat = null;
      try { depo.yaz(this._hafiza.dok()); }
      catch (err) { console.warn("[hafiza] kayit yazilamadi:", err); }
    }, 3000);
  }

  /** Aşama kancası — gözlem amaçlı, hatası akışı kesmez. */
  private _asama(asama: string, not?: string): void {
    try { this._ayar.asamaDinle?.(asama, not); }
    catch (err) { console.error("[kopru] asama dinleyicisi hatasi:", err); }
  }

  /**
   * Söz dünyaya çıksın mı. Tek kural: inisiyatif zincirinde susma İLANI
   * düşer (bkz. SUSMA_ILANI). Üç konuşma yolunun üçü de buradan geçer.
   */
  private _sozuGecir(metin: string): boolean {
    if (this._zincirKokeni !== "inisiyatif") return true;
    if (!SUSMA_ILANI.test(metin.toLocaleLowerCase("tr-TR"))) return true;
    this._sayac.yutulanSusma++;
    console.log(`[kopru] inisiyatif: susma ilani yutuldu ("${metin.slice(0, 60)}")`);
    return false;
  }

  private _konusmaYay(metin: string): void {
    for (const d of this._konusmaDinleyiciler) {
      try { d(metin); } catch (err) { console.error("[kopru] konuşma dinleyicisi hatası:", err); }
    }
  }

  /** Dünyadan gelen algı. Yüksek frekansla çağrılabilir; süzgeç burada. */
  algi(a: Algi): void {
    if (this._durduruldu) return;

    const ozet = ozetle(a);
    // Boş özet = `tik`. Beyin kanalına asla girmez (protocol/SOZLESME.md).
    if (!ozet) return;

    // REFLEKSİN KENDİ ADIMLARININ SONUCU (spec 10, Faz D; içgüdü `kopru.refleks`):
    // refleks okur, beyne gitmez. Refleks bittikten sonra gelen geç sonuç (onay
    // jesti, kesilen adımın iptali) da beyne gitmez; yalnız kayıtta kalır.
    if (a.tur === "sonuc" && niyetKaynagi(a.sonuc.niyet_id) === REFLEKS_ONEKI) {
      this._kaydet(a, ozet, { gecti: false, kural: "kopru.refleks" });
      this._refleksSonucu(a.sonuc);
      return;
    }

    // EYLEM SIRASI (spec 13): bekleyen adımın sonucu sırayı ilerletir. Algı yoluna
    // DEVAM eder — kapı, kayıt ve hata geri beslemesi bugünkü gibi çalışır.
    if (a.tur === "sonuc") this._siraSonucu(a.sonuc);

    // BECERİ GÖLGESİ (spec 10, Faz C): kesin sözde hafızanın kararı. Söz satırına
    // yazılır; yetki açıksa (Faz D) aynı karar yürütülür — yazılanla yapılan aynıdır.
    const golge = a.tur === "duydum" && a.kesin ? this._beceriGolgesi(a.metin) : undefined;

    // ZİNCİR BÜTÇESİ (bkz. ZINCIR_AZAMI). Hakkı biten bakış cevabı beyni
    // uyandırmaz — ama KAYBOLMAZ: çalışma belleğine yazılır, bir sonraki
    // gerçek tetikte ŞİMDİ satırında yaşıyla görünür.
    if (a.tur === "gordum" && this._zincirKalan <= 0) {
      this._calisma.yaz(a.ne, a.metin);
      this._sayac.zincirKesilen++;
      this._kaydet(a, ozet, { gecti: false, kural: "kopru.zincir" });
      return;
    }

    // KAPI KARARI ve onu veren içgüdü (mind/icgudu.ts) — karar kaydı için.
    // Konuşma süzgece hiç girmez: onu geçiren köprünün kendi kuralıdır.
    // Süzgeç yoksa (testler, dış araçlar) geçiren son söz dikkattir.
    let kapi: KapiKarari = { gecti: true, kural: a.tur === "duydum" ? "kopru.konusma" : "dikkat.gecti" };

    // SIRA ÖNEMLİ — içerik süzgeci DİKKAT'TEN ÖNCE gelir.
    //
    // Eskiden sonra geliyordu ve şu sessiz hataya yol açtı: terminalin açılış
    // afişi (gürültü) önce dikkat'in terminal kısma yuvasını HARCIYOR, sonra
    // içerik süzgeci onu atıyordu. 2.5 sn içinde gelen GERÇEK hata ise dikkat
    // tarafından kısılıp düşürülüyordu. Tezin tam kalbindeki algı böyle
    // kayboldu (canlı ölçüm: `ozet=1` — beynin önünde yalnızca soru vardı).
    //
    // Dikkat yine son sözü söyler: kanal kuralı ve bütçe onda. Süzgeç yalnızca
    // "bu içerik zaten değmez" diyerek yuvayı boşa harcatmaz.
    //
    // Konuşma ASLA süzülmez; süzgeç çökerse güvenli taraf GEÇİRMEKTİR.
    if (this._ayar.suzgec && a.tur !== "duydum") {
      try {
        const s = this._ayar.suzgec(a, ozet);
        kapi = typeof s === "boolean"
          ? { gecti: s, kural: "kopru.suzgec" }
          : { gecti: s.gecsin, kural: s.kural ?? "kopru.suzgec", ...(s.gerekce ? { gerekce: s.gerekce } : {}) };
      } catch (err) {
        console.warn("[kopru] süzgeç hatası, güvenli tarafa geçiriliyor:", err);
        kapi = { gecti: true, kural: "kopru.guvenli_taraf" };
      }
      if (!kapi.gecti) { this._sayac.suzulen++; this._kaydet(a, ozet, kapi); return; }
    }

    const k = this._dikkat.karar(a);
    if (!k.gecsin) {
      // Dikkat düşürdüğünde sebebini HEP söyler (icgudu.test.ts bekçisi);
      // sebepsiz düşüş kayıtta çelişkili görünsün diye `dikkat.gecti` yazılır.
      this._kaydet(a, ozet, { gecti: false, kural: k.sebep ? dikkatKurali(k.sebep) : "dikkat.gecti" }, golge);
      return;
    }

    // Ozyn'in her sözü süren refleksi keser: yeni emir kazanır (dünyadaki kuralla aynı).
    if (a.tur === "duydum") this._refleksBitir("kesildi");

    // DOĞUŞTAN PROGRAM (spec 13 Faz 2b, içgüdü `kopru.komut`): öğrenilmiş beceriden ÖNCE —
    // doğuştan olan kesindir. Beceri gölgesi yine hesaplanır ve satıra yazılır (B9 ölçüsü).
    if (a.tur === "duydum" && a.kesin && this._ayar.komutYetkisi !== false) {
      const program = komutCoz(a.metin);
      if (program) {
        this._programYurut(a, ozet, golge, program);
        return;
      }
    }

    // YETKİ (spec 10, Faz D): eşleşen kesin söz LLM'e gitmez; beceri refleksle yürür.
    // `golge` yalnız kesin sözde vardır. Tampon, tur ve konuşma geçmişi DEĞİŞMEZ.
    if (golge && a.tur === "duydum" && this._ayar.beceriYetkisi) {
      this._refleksBaslat(a, ozet, kapi, golge);
      return;
    }

    // Bakış cevabı dışındaki her tetik (söz, terminal, olay, inisiyatif)
    // hakkı YENİLER. Tüketim turun başında olur (bkz. `_dusun`).
    if (a.tur !== "gordum") {
      this._zincirKalan = ZINCIR_AZAMI;
      if (inisiyatifOlayiMi(a)) this._turInisiyatif = true;
      else this._turDis = true;
      if (a.tur === "olay" && !HAREKET_OLAYLARI.has(a.ad) && !inisiyatifOlayiMi(a)) this._turHareketDisi = true;
    }

    this._tampon.push(ozet);
    this._tamponIdleri.push(this._kaydet(a, ozet, kapi, golge));

    // Beyne giden her algı hafızaya da yazılır. Önem KURALLA belirlenir —
    // her anı için bir LLM turu ödemek ölçülmüş bir fayda olmadan kabul
    // edilemez (bkz. mind/hafiza.ts kuralOnemi).
    // Hafızaya BİÇİM değil İÇERİK yazılır.
    //
    // İlk sürüm `ozet`i ("Ozyn dedi: \"...\"") saklıyordu. Tüm anılar aynı
    // öneki taşıdığı için kelime örtüşmesi İÇERİKTEN değil KALIPTAN geliyordu:
    // canlı ölçümde sorgu ne olursa olsun hep aynı üç alakasız anı dönüyordu.
    // Kim söyledi bilgisi zaten `tur` alanında duruyor.
    const { tur: aniTur, icerik } = this._aniIcerigi(a, ozet);
    // DURUM ≠ ANI (spec 06 K2). `gordum` o ANA ait bir gözlem: Orion iki adım
    // atınca yanlışa döner. Kalıcı hafızaya yazıldığında dünkü gözlem bugün
    // "hatırlanan bilgi" diye geri geliyordu ve Orion onu anlatıyordu.
    // [ÖLÇÜLDÜ] aynı girdi, tek fark eski gözlem anıları: sadakat %50 → %100.
    if (a.tur === "gordum") this._calisma.yaz(a.ne, a.metin);
    else {
      this._hafiza.ekle(icerik, aniTur, kuralOnemi(aniTur, icerik, a.tur === "terminal" ? a.kod : undefined));
      this._hafizaYaz();
    }
    this._turIcerikleri.push(icerik);
    this._turTurleri.add(a.tur);

    if (a.tur === "duydum") {
      // Kullanıcı konuştu: bekletme, hemen düşün.
      this._dikkat.sifirla();
      this._gecmis.push({ rol: "kullanici", metin: a.metin });
      this._kirp();
      this._hemenDusun();
    } else {
      this._gecikmeliDusun();
    }
  }

  /** Son öğrenilebilir algı sayısı — öğretim penceresi. */
  private static readonly OGRENILEBILIR_SINIR = 500;

  /**
   * Algıyı ve kapının kararını kayda yazar; algı ÖĞRENİLEBİLİRSE (kararı ezilebilir
   * bir içgüdü verdiyse) durum kodunu ve öğrenen kapının GÖLGE kararını da ekler.
   *
   * Gölge karar kapının kararını DEĞİŞTİRMEZ (K3): yalnızca kayda yazılır.
   * Güvenlik içgüdüsünün verdiği karar öğrenilebilir değildir; onlara gölge yok.
   * Kanalı beyne kapalı algı da öğrenilemez: içerik yargısı onu ezilebilir bir
   * kuralla düşürmüş olsa bile, kanal kuralı (ezilemez) onu yine düşürürdü.
   */
  private _kaydet(a: Algi, ozet: string, kapi: KapiKarari, beceriGolge?: BeceriGolgesi | null): string {
    let ek: AlgiEki = {};
    if (ICGUDULER[kapi.kural].ezilebilir && kanalAcikMi(a)) {
      let baglam: KapiBaglami | undefined;
      try { baglam = this._ayar.baglam?.() ?? undefined; }
      catch (err) { console.warn("[KAPI] baglam okunamadi, baglamsiz kod yaziliyor:", err); }
      const isaret = durumKodu(a, kapi.kural, baglam);
      if (isaret.length > 0) {
        const g = this._kuralHafizasi.karar(isaret);
        ek = { isaret, golge: g ? { yon: g.yon, noron: g.noron.id, pay: Number(g.pay.toFixed(3)) } : null };
      }
    }
    // Beceri gölgesi `algi()`de bir kez hesaplanır (kesin söz): yazılan ile yürütülen aynı nesne.
    if (beceriGolge !== undefined) ek.beceriGolge = beceriGolge;
    const id = this._kayit.algi(a, ozet, kapi, ek);
    if (ek.isaret) {
      this._ogrenilebilir.set(id, ek.isaret);
      if (this._ogrenilebilir.size > Kopru.OGRENILEBILIR_SINIR) {
        this._ogrenilebilir.delete(this._ogrenilebilir.keys().next().value!);
      }
    }
    return id;
  }

  /**
   * UYGULAMA İÇİNDEN ÖĞRETİM (K1): bu oturumun bir algısı için doğru karar.
   * Kural hafızası TEK DENEMEDE öğrenir ve öğretim kayda yazılır (K5: hafıza
   * açılışta kayıttan yeniden kurulur). Algı öğrenilebilir değilse ya da artık
   * pencerede değilse null döner — sessizce yanlış bir şey öğretilmez.
   */
  ogret(algiId: string, yon: KapiYonu): OgretimSatiri | null {
    const isaret = this._ogrenilebilir.get(algiId);
    if (!isaret) return null;
    const satir = this._kayit.ogretim({ o: this._kayit.oturum, id: algiId }, yon, isaret);
    this._uygulanan.add(ogretimAnahtari(satir));
    this._kuralHafizasi.ogren(isaret, yon, deneyimKimligi(satir));
    return satir;
  }

  /**
   * DIŞARIDAN GELEN ÖĞRETİM: başka bir yerde (ör. `tools/ogret.ts`) yazılmış ve
   * zaten kayıtta duran bir öğretimi hafızaya uygular. Kayda yeniden yazmaz.
   * Aynı satır ikinci kez gelirse (açılışta okundu, izleyici de getirdi) yok
   * sayılır. Uygulandıysa true döner.
   */
  ogretimUygula(s: OgretimSatiri): boolean {
    if (!Array.isArray(s?.isaret) || s.isaret.length === 0) return false;
    const anahtar = ogretimAnahtari(s);
    if (this._uygulanan.has(anahtar)) return false;
    this._uygulanan.add(anahtar);
    this._kuralHafizasi.ogren(s.isaret, s.yon, deneyimKimligi(s));
    return true;
  }

  /** Öğrenen kapının hafızası — panel ve araçlar okur. */
  get kuralHafizasi(): KuralHafizasi { return this._kuralHafizasi; }

  /** Beceri hafızası (spec 10) — panel, araçlar ve testler okur. */
  get beceriHafizasi(): BeceriHafizasi { return this._beceri.hafiza; }

  /**
   * BECERİ GÖLGESİ (spec 10, Faz C): hafıza bu kesin söz için ne yapardı? Yazılır,
   * UYGULANMAZ. Karar söz satırı yazılmadan önce verilir: sözün kendi görevi henüz
   * hafızada yok (sıralı; çevrimdışı ölçüm de böyle sayar). Hata yutulur: gölge kapıyı
   * ve uyanışı asla bozmaz, o zaman alan yazılmaz (undefined).
   */
  private _beceriGolgesi(soz: string): BeceriGolgesi | null | undefined {
    try {
      return this._beceri.golge(soz);
    } catch (err) {
      console.warn("[BECERI] golge hesaplanamadi:", err);
      return undefined;
    }
  }

  // ── Refleks (spec 10, Faz D) ─────────────────────────────────────────────

  /**
   * YETKİLİ REFLEKS: sözü LLM'e sormadan becerinin adımlarıyla yürütür.
   *
   * Söz kayda yazılır (gölgesiyle) ve anı olur; ama KONUŞMA GEÇMİŞİNE girmez: LLM
   * sonraki turunda cevapsız bir istek görüp onu yeniden yapmasın. Başarısızlıkta söz
   * geçmişe ve tampona döner (bkz. `_refleksBitir`). Önce onay jesti — adım değildir,
   * sonucu beklenmez — sonra adımlar sırayla.
   */
  private _refleksBaslat(a: Algi & { tur: "duydum" }, ozet: string, kapi: KapiKarari, golge: BeceriGolgesi): void {
    const algi = this._kaydet(a, ozet, kapi, golge);
    const { tur: aniTur, icerik } = this._aniIcerigi(a, ozet);
    this._hafiza.ekle(icerik, aniTur, kuralOnemi(aniTur, icerik));
    this._hafizaYaz();
    this._dikkat.sifirla();
    this._sayac.refleks++;
    console.log(`[BECERI] refleks: "${a.metin}" → ${golge.beceri} (${golge.adimlar.length} adim, pay ${golge.pay})`);
    const r: SurenRefleks = {
      algi, soz: a.metin, ozet, beceri: golge.beceri, adimlar: golge.adimlar,
      sira: 0, bekleyen: null, gonderilen: [], baslangic: Date.now(), zamanlayici: null,
    };
    this._refleks = r;
    const onay = niyetDogrula(REFLEKS_ONAYI);
    if (onay.ok) {
      const id = kimlik(REFLEKS_ONEKI);
      r.onay = niyetKaydi(id, onay.deger);
      this._ayar.niyetGonder(onay.deger, id);
      this._sayac.niyet++;
    }
    this._refleksAdimi();
  }

  /**
   * Sıradaki adımı DOĞRULAYIP gönderir (tek yol: `niyetGonder`; doğrulayıcı atlanmaz —
   * adım kayıttan geliyor). Adım kalmadıysa refleks başarıyla biter. Beklenen kimlik ve
   * zaman aşımı GÖNDERMEDEN ÖNCE kurulur: dünya sonucu senkron verirse de yakalansın.
   */
  private _refleksAdimi(): void {
    const r = this._refleks;
    if (!r) return;
    const n = r.adimlar[r.sira];
    if (!n) { this._refleksBitir("basari"); return; }
    const d = niyetDogrula(n);
    if (!d.ok) { this._refleksBitir("hata", `step "${n.tur}" is not valid: ${d.hata}`); return; }
    const id = kimlik(REFLEKS_ONEKI);
    r.bekleyen = id;
    r.gonderilen.push(niyetKaydi(id, d.deger));
    r.zamanlayici = setTimeout(() => this._refleksBitir("zaman_asimi"), this._ayar.refleksZamanAsimiMs ?? REFLEKS_ZAMAN_ASIMI_MS);
    this._ayar.niyetGonder(d.deger, id);
    this._sayac.niyet++;
  }

  /**
   * Refleks niyetinin sonucu: beklenen adımınsa refleksi ilerletir. Onay jestinin ya da
   * kesilmiş bir adımın geç gelen sonucu yalnız kayıtta kalır.
   */
  private _refleksSonucu(s: NiyetSonucu): void {
    const r = this._refleks;
    if (!r || s.niyet_id !== r.bekleyen || s.durum === "basladi") return;
    if (r.zamanlayici) { clearTimeout(r.zamanlayici); r.zamanlayici = null; }
    r.bekleyen = null;
    if (s.durum === "bitti") { r.sira++; this._refleksAdimi(); }
    else if (s.durum === "hata") this._refleksBitir("hata", s.not);
    else this._refleksBitir("kesildi");   // iptal: yeni bir emir adımı geçti
  }

  /**
   * Refleksi bitirir ve satırını yazar; süren refleks yoksa bir şey yapmaz.
   *
   * Başarı ve kesilme sessizdir. Hata ve zaman aşımında söz LLM'e döner (B13): konuşma
   * geçmişine girer, özeti tampona, sebebi geri besleme olarak yanına; LLM hemen uyanır
   * ve görevi kendisi yapar. Kalan adımlar gönderilmez.
   */
  private _refleksBitir(bitis: RefleksBitisi, sebep?: string): void {
    const r = this._refleks;
    if (!r) return;
    this._refleks = null;
    if (r.zamanlayici) clearTimeout(r.zamanlayici);
    this._kayit.refleks({
      algi: r.algi, beceri: r.beceri, ...(r.onay ? { onay: r.onay } : {}),
      niyetler: r.gonderilen, bitis, sureMs: Date.now() - r.baslangic,
    });
    console.log(`[BECERI] refleks bitti: ${bitis}${sebep ? ` (${sebep})` : ""}`);
    if (bitis === "basari" || bitis === "kesildi" || this._durduruldu) return;

    const adim = r.gonderilen.at(-1)?.tur ?? "?";
    const neden = bitis === "zaman_asimi" ? "no result in time" : (sebep ?? "failed");
    this._gecmis.push({ rol: "kullanici", metin: r.soz });
    this._kirp();
    this._tampon.push(r.ozet);
    this._tamponIdleri.push(r.algi);
    this._tampon.push(`Your automatic attempt at this request stopped at step "${adim}": ${neden}. Do it yourself.`);
    this._tamponIdleri.push(null);
    this._turTurleri.add("duydum");
    this._turIcerikleri.push(r.soz);
    this._turDis = true;
    this._zincirKalan = ZINCIR_AZAMI;
    this._hemenDusun();
  }

  /**
   * DOĞUŞTAN PROGRAMI yürütür (spec 13 Faz 2b). Söz kayda (`kopru.komut`) ve anıya yazılır;
   * onay jesti gider; adımlar Faz 1'in eylem sırasıyla, her biri öncekinin `bitti`ini
   * bekleyerek yürür. Hata sonucu her zamanki kapıdan beyne gider: Orion yapamadığını
   * öğrenir ve anlatır. Söz ve yapılan adımlar KONUŞMA GEÇMİŞİNE girer (spec 13 Faz 1:
   * geçmiş gerçekte olanı taşır) — model "otur → otur" çiftini görür, isteği tekrar yapmaz:
   * cevabı geçmişte duruyor.
   */
  private _programYurut(a: Algi & { tur: "duydum" }, ozet: string, golge: BeceriGolgesi | null | undefined, p: KomutEslesmesi): void {
    const algi = this._kaydet(a, ozet, { gecti: true, kural: "kopru.komut" }, golge);
    const { tur: aniTur, icerik } = this._aniIcerigi(a, ozet);
    this._hafiza.ekle(icerik, aniTur, kuralOnemi(aniTur, icerik));
    this._hafizaYaz();
    this._dikkat.sifirla();
    this._sayac.komut++;
    this._gecmis.push({ rol: "kullanici", metin: a.metin });
    this._kirp();

    const niyetler: NiyetKaydi[] = [];
    const adimlar: { niyet: Niyet; id: string }[] = [];
    for (const n of p.adimlar) {
      const d = niyetDogrula(n);
      // Program tablosu testli; geçersiz adım bir yazılım hatasıdır — sessiz kalmasın.
      if (!d.ok) { console.error(`[KOMUT] ${p.program}: gecersiz adim "${n.tur}": ${d.hata}`); return; }
      const id = kimlik("komut");
      niyetler.push(niyetKaydi(id, d.deger));
      adimlar.push({ niyet: d.deger, id });
      const { tur: nt, ...girdi } = d.deger;
      this._gecmis.push({ rol: "orion", metin: "", arac: true, cagri: { ad: `dunya_${nt}`, girdi } });
      this._kirp();
    }
    const onay = niyetDogrula(REFLEKS_ONAYI);
    let onayKaydi: NiyetKaydi | undefined;
    if (onay.ok) {
      const id = kimlik("komut");
      onayKaydi = niyetKaydi(id, onay.deger);
      this._ayar.niyetGonder(onay.deger, id);
      this._sayac.niyet++;
    }
    this._kayit.program({ algi, program: p.program, ...(onayKaydi ? { onay: onayKaydi } : {}), niyetler });
    console.log(`[KOMUT] "${a.metin}" → ${p.program} (${adimlar.map((x) => x.niyet.tur).join(" → ")}), LLM uyanmadi`);
    this._sayac.niyet += adimlar.length;
    this._siraBaslat(adimlar);
  }

  /** Algıdan hafızaya yazılacak SADE içeriği çıkarır (kalıp değil). */
  private _aniIcerigi(a: Algi, ozet: string): { tur: AniTuru; icerik: string } {
    switch (a.tur) {
      case "duydum":   return { tur: "konusma", icerik: a.metin };
      case "olay":     return { tur: "olay", icerik: a.ad };
      case "terminal": return { tur: "terminal", icerik: a.kuyruk };
      case "sonuc":    return { tur: "sonuc", icerik: `${a.sonuc.durum}: ${a.sonuc.not ?? a.sonuc.niyet_id}` };
      case "gordum":   return { tur: "sonuc", icerik: `${a.ne}: ${a.metin}` };
      default:         return { tur: "dusunce", icerik: ozet };
    }
  }

  /** Niyet sonucunu algı olarak geri besler — Orion yapamadığını öğrenir. */
  sonuc(s: NiyetSonucu): void { this.algi({ tur: "sonuc", sonuc: s }); }

  sayac(): KopruSayaci & { dikkat: ReturnType<Dikkat["sayac"]>; hafiza: number; kayitYazilamayan: number } {
    return { ...this._sayac, dikkat: this._dikkat.sayac(), hafiza: this._hafiza.sayi, kayitYazilamayan: this._kayit.yazilamayan };
  }

  /** Tanılama/ölçüm: hafızaya doğrudan erişim. */
  get hafiza(): Hafiza { return this._hafiza; }
  /** Devre panosu okuyucusu — dikkat ayarları ve sayaçları panelde görünsün. */
  get dikkat(): Dikkat { return this._dikkat; }

  /** Ajanda (mind/ajanda.ts) için: beyin şu an düşünüyorsa araya girme. */
  get dusunuyorMu(): boolean { return this._dusunuyor; }

  /** Bekleyen işleri iptal eder. Kapanışta çağrılır. */
  durdur(): void {
    this._durduruldu = true;
    // Süren refleks kesilir ve satırı yazılır (defter dinlerken: canlı = kayıt kalsın).
    this._refleksBitir("kesildi");
    this._siraKes("kapanış");
    this._beceriDinlemesi();
    if (this._zamanlayici) { clearTimeout(this._zamanlayici); this._zamanlayici = null; }
    // Bekleyen hafıza yazması VARSA hemen tamamla: kapanışta 3 sn'lik
    // pencereyi beklemek son anıları kaybetmek demek.
    if (this._hafizaSaat) {
      clearTimeout(this._hafizaSaat);
      this._hafizaSaat = null;
      try { this._ayar.hafizaDeposu?.yaz(this._hafiza.dok()); }
      catch (err) { console.warn("[hafiza] kapanista yazilamadi:", err); }
    }
  }

  private _gecikmeliDusun(): void {
    if (this._zamanlayici) return;
    this._zamanlayici = setTimeout(() => {
      this._zamanlayici = null;
      void this._dusun();
    }, this._ayar.toplamaMs ?? 1200);
  }

  private _hemenDusun(): void {
    if (this._zamanlayici) { clearTimeout(this._zamanlayici); this._zamanlayici = null; }
    void this._dusun();
  }

  private async _dusun(): Promise<void> {
    if (this._durduruldu) return;
    if (this._dusunuyor) { this._tekrarGerek = true; return; }
    if (this._tampon.length === 0) return;

    this._dusunuyor = true;
    const ozetler = this._tampon.splice(0);
    const algiIdleri = this._tamponIdleri.splice(0);
    this._sayac.dusunme++;

    // KARAR KAYDI: bu uyanışın satırı `finally`de yazılır — beyin hatası da
    // bir sonuçtur ve öğrenen kapı onu da görmeli. Alanlar tur ilerledikçe dolar.
    const uyanis: UyanisBilgisi = {
      algilar: algiIdleri.filter((x): x is string => x !== null),
      geriBesleme: algiIdleri.filter((x) => x === null).length,
      beyin: this._ayar.beyin.ad, sureMs: 0, koken: this._zincirKokeni, takip: false,
      anilar: 0, dunya: "", cagrilar: [], niyetler: [],
      reddedilen: 0, kurtarilan: 0, konusulanMetin: false, yutulanSoz: 0,
    };
    let beyinT0: number | undefined;

    try {
      // İlgili anılar: sorgu, bu turu tetikleyen algıların birleşimi.
      const adet = this._ayar.hafizaGetirme ?? 3;
      const simdiMs = this._ayar.simdi?.() ?? Date.now();
      // Sorgu da İÇERİK olmalı: kalıpla sorgulamak kalıpla eşleşmeye yol açar.
      const icerikler = this._turIcerikleri.splice(0);
      const anilar = adet > 0 && icerikler.length
        // Bu turun içerikleri hafızaya az önce yazıldı; anı olarak geri
        // gelmeleri "hatırlamak" değil kendini tekrar etmektir.
        // ZAMAN ETİKETİ (spec 06 K3): anı, şimdiki bilgiden ayırt edilebilsin.
        // Zamansızken canlı kayıtta günler öncesinin "Ozyn komutu reddetti"
        // anısı, model için az önce olmuş gibi duruyordu.
        ? this._hafiza.getir(icerikler.join(" "), adet, icerikler)
            .map((x) => `[${oncesiSozu(simdiMs - x.ani.olusma)}] ${x.ani.metin}`)
        : [];

      if (anilar.length) console.log(`[HAFIZA] getirilen ${anilar.length}: ${anilar.map((a) => a.slice(0, 60)).join(" | ")}`);

      const turler = new Set(this._turTurleri);
      this._turTurleri.clear();
      // Yalnızca bakış cevaplarından oluşan tur bir TAKİP turudur ve hakkı
      // TUR başına tüketir, mesaj başına değil: beyin tek turda iki soru
      // sorabilir (`onumde` + `yakin`) ve iki cevap aynı turda buluşmalı.
      // İlk sürüm mesaj başına düşürüyordu ve ikinci cevabı kesiyordu.
      uyanis.takip = turler.size > 0 && [...turler].every((t) => t === "gordum");
      if (uyanis.takip) this._zincirKalan--;
      // KÖKEN: dış tetik her zaman kazanır (Ozyn konuştuysa cevap inisiyatif
      // sayılmaz). Yalnız bakış cevabından oluşan tur kökeni devralır.
      if (this._turDis) this._zincirKokeni = "dis";
      else if (this._turInisiyatif) this._zincirKokeni = "inisiyatif";
      this._turDis = this._turInisiyatif = false;
      uyanis.koken = this._zincirKokeni;
      // HAREKET ZİNCİRİ (içgüdü `kopru.hareket_sessiz`): kök tur yalnız Ozyn'in
      // hareketiyse zincir sessizdir; takip turu (bakış cevabı, sonuç) devralır.
      if (turler.has("duydum") || turler.has("terminal") || turler.has("olay")) {
        this._zincirSessiz = this._zincirKokeni === "dis" && turler.has("olay")
          && !turler.has("duydum") && !turler.has("terminal") && !this._turHareketDisi;
      }
      this._turHareketDisi = false;
      const sessiz = this._zincirSessiz;
      uyanis.anilar = anilar.length;
      const talimat = talimatUret({
        konusma: turler.has("duydum"),
        terminal: turler.has("terminal"),
        anilar: anilar.length > 0,
        olay: turler.has("olay"),
      });

      // ŞİMDİ (spec 06 K2/K3): anlık gözlemler dünya durumunun yanında,
      // yaşlarıyla. Anılarla aynı listede değil — karışması bu spec'in
      // çözdüğü hatanın ta kendisiydi.
      const dunya = [this._ayar.dunyaDurumu(), ...this._calisma.satirlar()].join("\n");
      uyanis.dunya = dunya;
      // `dunya` da basılır: beynin ZEMİNİ o metin. Görünmezse "model neden
      // böyle cevap verdi" sorusu yanıtsız kalıyor — özetler bağlamın
      // yalnızca yarısı.
      console.log(`[BEYIN:girdi] ozet=${ozetler.length} ani=${anilar.length} gecmis=${this._gecmis.length} talimat=${talimat.length}ch | ${ozetler.map((o) => o.slice(0, 46)).join(" // ")}`);
      console.log(`[BEYIN:dunya] ${dunya}`);

      // GECMIS HER ZAMAN GONDERILIR — ve bu bir GERI ALMADIR.
      //
      // Once "gecmis arac secimini bozuyor" diye konusma disi turlarda
      // kaldirilmisti. Sonraki olcum (tools/baglam-olcum.mjs, GERCEK arac
      // listesi ve gercek talimatla) bunun YANLIS oldugunu gosterdi:
      //   gecmis YOK -> dogru araci 1/3 cagiriyor, model Cince'ye kayiyor
      //   gecmis VAR -> 3/3 dogru arac, "git status"
      // Sorun gecmisin VARLIGI degil, NASIL TEMSIL EDILDIGIYDI: duz metin
      // asistan turu "asistan duz metin yazar" ornegi veriyordu. Arac cagrisi
      // olarak temsil edilince ayni gecmis FAYDALI hale geldi (bkz. ollama.ts).
      const gecmis = this._gecmis.slice();

      const ornekler = ornekUret({
        terminal: turler.has("terminal"),
        konusma: turler.has("duydum"),
      });

      if (anilar.length) this._asama("hafiza", `${anilar.length} anı`);
      this._asama("beyin", "düşünüyor");
      beyinT0 = Date.now();
      const cikti = await this._ayar.beyin.dusun({
        talimat,
        ornekler,
        anilar,
        ozetler,
        dunya,
        sabit: this._ayar.sabitBilgi?.(),
        gecmis,
        araclar: araclariUret(),
      });
      this._asama("beyin:bitti", `${((Date.now() - beyinT0) / 1000).toFixed(1)} sn`);
      uyanis.sureMs = Date.now() - beyinT0;
      uyanis.cagrilar = cikti.cagrilar.map((c) => c.ad);
      if (cikti.metin) uyanis.metin = cikti.metin;

      // Düz metin DUYULMAZ — protokolde konuşmak bir eylemdir (dunya_soyle).
      //
      // GEÇMİŞE DE YAZILMAZ (spec 13). Eskiden "modelin kendi düşüncesi bağlamda
      // kalsın" diye `assistant` metni olarak yazılıyordu. Ölçüm (2026-10-02, taban):
      // ortak testin gerçek geçmişiyle qwen2.5:7b 40 komutun 0'ında araç çağırdı ve
      // geçmişteki kendi düz metnini taklit etti ("ortalığı kontrol ediyorum…").
      // Düz metin artık İÇ SES: kayda ve zihin duvarına gider, geçmişe gitmez.
      if (cikti.metin) {
        // Düz metin DUYULMAZ. Model araç çağırmak yerine sohbet ediyorsa bu
        // SESSİZ bir davranış hatasıdır — kullanıcı Orion'u susmuş sanır.
        // Görünür olsun ki ölçülebilsin.
        console.log(`[BEYIN:metin] ${cikti.metin.slice(0, 160)}${cikti.cagrilar.length === 0 ? "  ← ARAÇ YOK, bu duyulmayacak" : ""}`);
        this._ayar.metinDinle?.(cikti.metin, cikti.cagrilar.length > 0);
      }

      const tur: TurCiktisi = { sessiz, sozler: [], icSes: [], beden: [] };
      // Araç ÇAĞIRDIYSA düz metin eyleme eşlik eden iç düşüncedir.
      if (cikti.metin && cikti.cagrilar.length > 0) tur.icSes.push(cikti.metin);

      for (const c of cikti.cagrilar) {
        const d = cagriyiNiyete(c.ad, c.girdi);
        if (!d.ok) {
          this._sayac.reddedilenCagri++;
          uyanis.reddedilen++;
          // Reddi sessizce yutma: modele geri besle, kendini düzeltsin.
          this._tampon.push(`Araç reddedildi (${c.ad}): ${d.hata}`);
          this._tamponIdleri.push(null);
          console.warn(`[kopru] çağrı reddedildi: ${d.hata}`);
          continue;
        }
        this._ardisikRet = 0;  // geçerli çağrı geldi, düzeltme döngüsü kırıldı
        this._niyetiIsle(d.deger, uyanis, tur);
      }

      // ── Düz metin kurtarma ──────────────────────────────────────────────
      // Kural: düz metin DUYULMAZ (konuşmak bir eylemdir). Ama model HİÇ araç
      // çağırmadıysa o metin başka bir şey olamaz — söylemek istediği şeydir.
      // Sessizce yutmak, Orion'u kullanıcı gözünde bozuk gösterir.
      //
      // ÖLÇÜMDEN DOĞDU: canlı davranış denemesinde Orion gerçek bir kabuk
      // hatasını doğru teşhis etti ("Terminal'da yanlış bir komut girildi")
      // ama `dunya_soyle` çağırmadı; kullanıcı hiçbir şey duymadı.
      //
      // Araç ÇAĞIRDIYSA metin kurtarılmaz: o zaman metin eyleme eşlik eden
      // iç düşüncedir ve seslendirilmesi gürültü olur.
      if (cikti.cagrilar.length === 0 && cikti.metin) {
        // GERCEK HATA (ekran goruntusu, 2026-09-13): model arac cagrilarini
        // duz metin olarak yazdi (`orld {"name": "dunya_bak", ...}`) ve bu
        // kurtarma onu OLDUGU GIBI seslendirdi; kullanici JSON dinledi.
        //
        // Artik once ICINDEN ARAC CAGRILARI KURTARILIR (hatayi eyleme
        // cevirmek sesli okumaktan iyidir), sonra yalnizca temiz cumle
        // konusulur. Kurtarilamayan arac copu ASLA duyulmaz.
        const bilinen = araclariUret().map((a) => a.ad);
        const { cagrilar: kurtarilan, konusulabilir } = metinKurtar(cikti.metin, bilinen);

        for (const c of kurtarilan) {
          const d = cagriyiNiyete(c.ad, c.girdi);
          if (!d.ok) { console.warn(`[kopru] metinden kurtarilan cagri gecersiz: ${d.hata}`); continue; }
          this._sayac.kurtarilanCagri++;
          uyanis.kurtarilan++;
          console.warn(`[kopru] METINDEN kurtarildi: ${c.ad}`);
          this._niyetiIsle(d.deger, uyanis, tur);
        }

        if (konusulabilir && sessiz && this._sozuGecir(konusulabilir)) {
          // Hareket zinciri: kurtarılan cümle de iç seste kalır.
          tur.icSes.push(konusulabilir);
        } else if (konusulabilir && this._konusmaDinleyiciler.size && this._sozuGecir(konusulabilir)) {
          const metin = konusulabilir.slice(0, 400);
          this._sayac.kurtarilanMetin++;
          uyanis.konusulanMetin = true;
          console.warn(`[kopru] arac cagrilmadi, temiz metin konusmaya cevrildi: "${metin.slice(0, 80)}"`);
          this._konusmaYay(metin);
          // Söylendi: geçmişe SÖZ olarak girer (düz metin olarak değil — bkz. yukarı).
          this._gecmis.push({ rol: "orion", metin, arac: true });
          this._kirp();
          tur.sozler.push(metin);
        } else if (!konusulabilir && kurtarilan.length === 0) {
          this._sayac.yutulanCop++;
          console.warn(`[kopru] arac copu KONUSULMADI: "${cikti.metin.slice(0, 80)}"`);
        }
      }

      // Beden niyetleri: tek niyet hemen, birden çoğu sırayla (bkz. EylemSirasi).
      this._siraBaslat(tur.beden);

      if (tur.icSes.length) {
        uyanis.icSes = tur.icSes.join(" / ");
        if (sessiz) uyanis.susturan = "kopru.hareket_sessiz";
        console.log(`[kopru] iç ses${sessiz ? " (hareket zinciri, kopru.hareket_sessiz)" : ""}: "${uyanis.icSes.slice(0, 120)}"`);
        try { this._ayar.icSesDinle?.(uyanis.icSes); }
        catch (err) { console.error("[kopru] iç ses dinleyicisi hatası:", err); }
      }

      // SÖYLEDİ AMA YAPMADI (mind/sozEylem.ts): yalnız gözlem, davranış değişmez.
      const eksik = sozEylemUcurumu(tur.sozler, uyanis.niyetler.map((n) => n.tur));
      if (eksik.length) {
        uyanis.sozEylemUcurumu = eksik;
        const soz = tur.sozler.join(" ");
        console.warn(`[kopru] SOZ-EYLEM: "${soz.slice(0, 80)}" dedi ama ${eksik.join(", ")} niyeti yok`);
        try { this._ayar.sozEylemDinle?.(eksik, soz); }
        catch (err) { console.error("[kopru] söz-eylem dinleyicisi hatası:", err); }
      }
    } catch (err) {
      this._sayac.hata++;
      // Beyin hatası dünyayı durdurmaz ama SESSİZ de kalmaz.
      const m = err instanceof Error ? err.message : String(err);
      console.error("[kopru] beyin hatası:", m);
      this._arizaYay(m);
      uyanis.hata = m;
      if (beyinT0 !== undefined && uyanis.sureMs === 0) uyanis.sureMs = Date.now() - beyinT0;
    } finally {
      this._kayit.uyanis(uyanis);
      this._dusunuyor = false;
      if (this._tekrarGerek) {
        this._tekrarGerek = false;
        this._gecikmeliDusun();
      } else if (this._tampon.length > 0) {
        // Ret geri beslemesi tampona yazıldıysa beyni uyandırmak GEREKİR;
        // yoksa model kendi hatasını asla öğrenmez ve sessizce yanlış kalır.
        //
        // Kalkan: model ısrarla geçersiz çağrı üretiyorsa sonsuza kadar
        // dönmeyiz. İki turdan sonra geri besleme düşürülür ve sessiz değil,
        // görünür biçimde bildirilir.
        if (++this._ardisikRet > 2) {
          const dusen = this._tampon.splice(0);
          this._tamponIdleri.splice(0);
          this._ardisikRet = 0;
          console.warn(`[kopru] model üst üste geçersiz çağrı üretti, düzeltme döngüsü kesildi (${dusen.length} geri besleme düşürüldü)`);
        } else {
          this._gecikmeliDusun();
        }
      }
    }
  }

  /**
   * Doğrulanmış bir niyeti turun çıktısına işler (model çağrısı ve metinden kurtarılan
   * çağrı aynı yoldan geçer). Söz hemen konuşulur (ya da hareket zincirinde iç seste
   * kalır); `sor` hemen gider; beden niyetleri toplanır, tur sonunda sıraya girer.
   */
  private _niyetiIsle(n: Niyet, uyanis: UyanisBilgisi, tur: TurCiktisi): void {
    const id = kimlik("n");
    if (n.tur === "soyle") {
      // Düşen söz dünyaya da GİTMEZ: `niyetGonder` de atlanır.
      if (!this._sozuGecir(n.metin)) { uyanis.yutulanSoz++; return; }
      if (tur.sessiz) { tur.icSes.push(n.metin); return; }
      if (this._konusmaDinleyiciler.size) {
        this._konusmaYay(n.metin);
        this._gecmis.push({ rol: "orion", metin: n.metin, arac: true });
        this._kirp();
      }
      tur.sozler.push(n.metin);
    }
    // Gövdesiyle (spec 10, Faz A): beceri refleksi görevin nasıl yapıldığını buradan öğrenir.
    uyanis.niyetler.push(niyetKaydi(id, n));
    this._sayac.niyet++;
    if (SOZ_NIYETLERI.has(n.tur)) { this._ayar.niyetGonder(n, id); return; }
    // Beden niyeti geçmişe ARAÇ olarak girer (spec 13): model "komut → eylem" görsün.
    const { tur: nt, ...girdi } = n;
    this._gecmis.push({ rol: "orion", metin: "", arac: true, cagri: { ad: `dunya_${nt}`, girdi } });
    this._kirp();
    tur.beden.push({ niyet: n, id });
  }

  /** Yeni turun beden niyetleri: süren sırayı keser; tek niyet hemen, fazlası sırayla. */
  private _siraBaslat(adimlar: { niyet: Niyet; id: string }[]): void {
    const [ilk, ...kalan] = adimlar;
    if (!ilk) return;
    this._siraKes("yeni tur");
    if (!kalan.length) { this._ayar.niyetGonder(ilk.niyet, ilk.id); return; }
    console.log(`[kopru] eylem sirasi: ${adimlar.map((a) => a.niyet.tur).join(" → ")}`);
    this._sira = { kalan, bekleyen: null, zamanlayici: null };
    this._siraGonder(ilk);
  }

  /** Beklenen kimlik ve zaman aşımı GÖNDERMEDEN ÖNCE kurulur: sonuç senkron gelse de yakalansın. */
  private _siraGonder(adim: { niyet: Niyet; id: string }): void {
    const r = this._sira;
    if (!r) return;
    r.bekleyen = adim.id;
    r.zamanlayici = setTimeout(() => this._siraKes("zaman aşımı"), this._ayar.refleksZamanAsimiMs ?? REFLEKS_ZAMAN_ASIMI_MS);
    this._ayar.niyetGonder(adim.niyet, adim.id);
  }

  /** Bekleyen adımın sonucu: `bitti` sırayı ilerletir, `hata`/`iptal` keser. */
  private _siraSonucu(s: NiyetSonucu): void {
    const r = this._sira;
    if (!r || s.niyet_id !== r.bekleyen || s.durum === "basladi") return;
    if (r.zamanlayici) { clearTimeout(r.zamanlayici); r.zamanlayici = null; }
    r.bekleyen = null;
    if (s.durum !== "bitti") { this._siraKes(s.durum); return; }
    const sonraki = r.kalan.shift();
    if (!sonraki) { this._sira = null; return; }
    this._siraGonder(sonraki);
  }

  /** Süren sırayı bırakır; gönderilmeyen adımlar görünür biçimde söylenir. */
  private _siraKes(neden: string): void {
    const r = this._sira;
    if (!r) return;
    this._sira = null;
    if (r.zamanlayici) clearTimeout(r.zamanlayici);
    if (r.kalan.length) console.warn(`[kopru] eylem sirasi kesildi (${neden}): ${r.kalan.map((a) => a.niyet.tur).join(", ")} gonderilmedi`);
  }

  private _kirp(): void {
    const sinir = this._ayar.gecmisSiniri ?? 12;
    if (this._gecmis.length > sinir) this._gecmis.splice(0, this._gecmis.length - sinir);
  }
}
