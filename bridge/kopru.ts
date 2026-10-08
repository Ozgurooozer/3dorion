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
import type { Niyet, NiyetSonucu } from "../protocol/niyet.ts";
import { kimlik } from "../protocol/temel.ts";
import { Dikkat, kanalAcikMi } from "../mind/dikkat.ts";
import { KararKaydi, niyetKaydi, type AlgiEki, type BeceriGolgesi, type KapiKarari, type NiyetKaydi, type OgretimSatiri, type UyanisBilgisi } from "../mind/kararKaydi.ts";
import { niyetDogrula } from "../protocol/dogrula.ts";
import { BeceriDefteri } from "../mind/beceriDefteri.ts";
import type { BeceriHafizasi } from "../mind/beceriHafizasi.ts";
import { ICGUDULER, dikkatKurali } from "../mind/icgudu.ts";
import { durumKodu, niyetKaynagi, type KapiBaglami } from "../mind/durumKodu.ts";
import type { KuralHafizasi, KapiYonu } from "../mind/kuralHafizasi.ts";
import { deneyimKimligi, kuralHafizasiKur, ogretimAnahtari } from "../mind/ogretim.ts";
import { Hafiza, type AniTuru, type Ani, type GetirSonucu } from "../mind/hafiza.ts";
import { aniKaydi } from "../mind/aniSuzgeci.ts";
import { calismaBellegiKur, type CalismaBellegi } from "../mind/calismaBellegi.ts";
import { oncesiSozu } from "../mind/zaman.ts";
import { sozEylemUcurumu } from "../mind/sozEylem.ts";
import { ingilizceMi } from "../mind/dilSecimi.ts";
import { komutCoz, type KomutEslesmesi } from "../mind/komutSozlugu.ts";
import { AnlikBenlik, eden, niyetOzeti, type Eden } from "../mind/benlik.ts";
import { DurumDefteri, type DurumKaydi } from "../mind/durumDefteri.ts";
import { yonlendir, type CekmeceIstegi } from "../mind/hafizaYonlendirici.ts";
import { sohbetEylemi, sonrakiKip, SOHBET_ONAYI, type SohbetEylemi, type SohbetKipi } from "../mind/sohbetKipi.ts";
import { takipEylemi, TAKIP_ONAYI, type TakipEylemi } from "../mind/takipSozu.ts";
import { terminalAyristir } from "../mind/durumKodu.ts";
import { suzgecMercegi, type MercekOnerisi } from "../mind/mercekSuzgec.ts";
import { araclariUret, cagriyiNiyete } from "./araclar.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import { talimatUret } from "./talimat.ts";
import { baglamOlcusu } from "./baglamOlcusu.ts";
import { ornekUret } from "./ornekler.ts";
import { metinKurtar } from "./metinKurtarma.ts";
import { EylemSirasi } from "./eylemSirasi.ts";
import { BeceriRefleksi, type RefleksGeriVerme } from "./beceriRefleksi.ts";
import { programPlani } from "./komutProgrami.ts";
import { REFLEKS_ONEKI, REFLEKS_ONAYI, REFLEKS_ZAMAN_ASIMI_MS, HAREKET_OLAYLARI, SOZ_NIYETLERI, IS_NIYETLERI, SUSMA_ILANI, inisiyatifOlayiMi, ZINCIR_AZAMI } from "./kopruTurleri.ts";
import type { KopruAyari, KopruSayaci, TurCiktisi } from "./kopruTurleri.ts";
export { REFLEKS_ONEKI, REFLEKS_ONAYI, REFLEKS_ZAMAN_ASIMI_MS, ZINCIR_AZAMI } from "./kopruTurleri.ts";
export type { KopruAyari, SuzgecKarari, KopruSayaci } from "./kopruTurleri.ts";

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
  /** Bu turda Ozyn'in sözleri — söz-eylem bekçisi yalnız istenen eylemlere bakar. */
  private _turSozleri: string[] = [];
  /** Bu turdaki terminal çıktısının hâli ve niyet hatası (spec 16 F4: yönlendiricinin girdisi). */
  private _turTerminal: "basarili" | "hatali" | undefined;
  private _turNiyetHatasi = false;
  /** Geçmiş kaydının eklenme anı (yakın pencerenin yaş sınırı için; kaydın biçimi değişmez). */
  private _gecmisZamani = new WeakMap<object, number>();
  /** Sohbet kipi (spec 16 F5b). Temizde bağlama hafıza girmez, söz hafızaya yazılmaz. */
  private _sohbetKipi: SohbetKipi = "standart";
  private _sohbetDinleyicileri = new Set<(kip: SohbetKipi, eylem: SohbetEylemi) => void>();
  /** "Beni takip et" sürüyor mu (içgüdü `kopru.takip`). */
  private _takipte = false;
  private _gecmis: BeyinGirdisi["gecmis"] = [];
  private _zamanlayici: ReturnType<typeof setTimeout> | null = null;
  private _dusunuyor = false;
  /** Düşünme sürerken yeni girdi geldiyse, bitince bir tur daha dön. */
  private _tekrarGerek = false;
  private _sayac: KopruSayaci = { dusunme: 0, niyet: 0, reddedilenCagri: 0, hata: 0, suzulen: 0, kurtarilanMetin: 0, kurtarilanCagri: 0, yutulanCop: 0, zincirKesilen: 0, yutulanSusma: 0, refleks: 0, komut: 0 };
  /** Süren refleks turu (spec 10, Faz D); yoksa null. */
  // YETKİLİ BECERİ REFLEKSİ (spec 10, Faz D; spec 14 R7: bridge/beceriRefleksi.ts). Her gönderim
  // niyet sayacına girer; hata/zaman aşımında söz LLM'e döner (`_refleksiGeriAl`).
  private _refleks = new BeceriRefleksi({
    gonder: (n, id) => { this._gonder(n, id); this._sayac.niyet++; },
    zamanAsimiMs: () => this._ayar.refleksZamanAsimiMs ?? REFLEKS_ZAMAN_ASIMI_MS,
    satirYaz: (b) => { this._kayit.refleks(b); },
    geriVer: (g) => this._refleksiGeriAl(g),
  });
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
  private _sira = new EylemSirasi({
    gonder: (n, id) => this._gonder(n, id),
    zamanAsimiMs: () => this._ayar.refleksZamanAsimiMs ?? REFLEKS_ZAMAN_ASIMI_MS,
  });
  /** ANLIK BENLİK (spec 12, mind/benlik.ts): "şu an ne yapıyorum, neyi bekliyorum". Diske gitmez. */
  private _benlik: AnlikBenlik;
  /** Kalıcı "şu an" bilgisi (spec 16 F2). Bağlama yalnız yönlendirici isterse girer. */
  private _durum: DurumDefteri;
  /** Gönderilen İŞ niyetlerinin özeti, kimliğiyle: sonuç gelince "son iş" yazılır. */
  private _isler = new Map<string, string>();
  /** Son düşünme turunda hafızadan getirilenler (hafıza görünümü okur). */
  private _sonGetirilen: readonly GetirSonucu[] = [];
  /** İşlenmekte olan algıya süzgeç merceğinin önerisi — benlik güncellenmeden ÖNCE (gölge). */
  private _algiMercegi: MercekOnerisi | null = null;
  /** İşlenmekte olan algının faili — benlik güncellenmeden ÖNCE hesaplanır, `_kaydet` yazar. */
  private _algiEdeni: Eden | undefined;
  /** Üst üste kaç tur yalnızca ret geri beslemesiyle döndük. Döngü kalkanı. */
  private _ardisikRet = 0;
  private _konusmaDinleyiciler = new Set<(metin: string) => void>();
  private _durduruldu = false;

  constructor(ayar: KopruAyari) {
    this._ayar = ayar;
    this._dikkat = new Dikkat(ayar.dikkat);
    this._hafiza = new Hafiza({ simdi: ayar.simdi, ...(ayar.hafizaKapasite !== undefined ? { kapasite: ayar.hafizaKapasite } : {}) });
    this._calisma = calismaBellegiKur({ simdi: ayar.simdi });
    this._benlik = new AnlikBenlik({ simdi: ayar.simdi, beden: ayar.bedenDurumu });
    let durumKayitlari: unknown[] = [];
    try { durumKayitlari = ayar.durumDeposu?.oku() ?? []; }
    catch (err) { console.warn("[DURUM] defter okunamadi, bos baslaniyor:", err); }
    this._durum = new DurumDefteri({ ...(ayar.simdi ? { simdi: ayar.simdi } : {}), kayitlar: durumKayitlari, degisti: () => this._durumYaz() });
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

  /**
   * Dünyaya giden TEK çıkış: önce benliğe yazılır ("yapıyorum" / "onay bekliyorum"),
   * sonra niyet gider. Benlik yazımı gözlemdir; hatası gönderimi durdurmaz.
   */
  private _gonder(n: Niyet, id: string): void {
    try { this._benlik.niyetGonderildi(id, n, "ben"); }
    catch (err) { console.error("[BENLIK] niyet yazilamadi:", err); }
    if (IS_NIYETLERI.has(n.tur)) {
      // Orion kendisi başka bir İŞE girişti (LLM ya da program): takip biter — yeni iş kazanır.
      if (this._takipte) this._takibiBitir("yeni iş");
      const ozet = niyetOzeti(n);
      this._isler.set(id, ozet);
      this._durum.isBasladi(ozet);
    }
    this._ayar.niyetGonder(n, id);
  }

  private _konusmaYay(metin: string, durumaYaz = true): void {
    this._benlik.soyledi(metin);
    if (durumaYaz && this._sohbetKipi !== "temiz") this._durum.orionDedi(metin);
    for (const d of this._konusmaDinleyiciler) {
      try { d(metin); } catch (err) { console.error("[kopru] konuşma dinleyicisi hatası:", err); }
    }
  }

  /** Dünyadan gelen algı. Yüksek frekansla çağrılabilir; süzgeç burada. */
  algi(a: Algi): void {
    if (this._durduruldu) return;

    let ozet = ozetle(a);
    // Boş özet = `tik`. Beyin kanalına asla girmez (protocol/SOZLESME.md).
    if (!ozet) return;

    this._benligiGuncelle(a);

    // REFLEKSİN KENDİ ADIMLARININ SONUCU (spec 10, Faz D; içgüdü `kopru.refleks`):
    // refleks okur, beyne gitmez. Refleks bittikten sonra gelen geç sonuç (onay
    // jesti, kesilen adımın iptali) da beyne gitmez; yalnız kayıtta kalır.
    if (a.tur === "sonuc" && niyetKaynagi(a.sonuc.niyet_id) === REFLEKS_ONEKI) {
      this._kaydet(a, ozet, { gecti: false, kural: "kopru.refleks" });
      this._refleks.sonuc(a.sonuc);
      return;
    }

    // EYLEM SIRASI (spec 13): bekleyen adımın sonucu sırayı ilerletir. Algı yoluna
    // DEVAM eder — kapı, kayıt ve hata geri beslemesi bugünkü gibi çalışır.
    if (a.tur === "sonuc") this._sira.sonuc(a.sonuc);

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

    let kapi: KapiKarari;
    ({ kapi, ozet } = this._icerikKarari(a, ozet));
    if (!kapi.gecti && a.tur !== "duydum") { this._sayac.suzulen++; this._kaydet(a, ozet, kapi); return; }

    const k = this._dikkat.karar(a);
    if (!k.gecsin) {
      // Dikkat düşürdüğünde sebebini HEP söyler (icgudu.test.ts bekçisi);
      // sebepsiz düşüş kayıtta çelişkili görünsün diye `dikkat.gecti` yazılır.
      this._kaydet(a, ozet, { gecti: false, kural: k.sebep ? dikkatKurali(k.sebep) : "dikkat.gecti" }, golge);
      return;
    }

    // Ozyn'in her sözü süren refleksi keser: yeni emir kazanır (dünyadaki kuralla aynı).
    if (a.tur === "duydum") this._refleks.bitir("kesildi");

    // SOHBET EYLEMİ (spec 16 F5b, içgüdü `kopru.sohbet`): tam eşleşen söz kip değiştirir, LLM uyanmaz.
    // Komut yetkisinden bağımsız: kip, Ozyn'in bağlam üzerindeki kontrolüdür, bedenin işi değil.
    if (a.tur === "duydum" && a.kesin) {
      const e = sohbetEylemi(a.metin);
      if (e) { this._sohbetEylemiYap(a, ozet, e, golge); return; }
    }

    // TAKİP (içgüdü `kopru.takip`): "beni takip et" / "takibi bırak", tam eşleşme, LLM uyanmaz.
    // Komut programlarından ÖNCE: "peşimden gel" komut sözlüğünün `<yer> gel` kalıbına düşmesin.
    if (a.tur === "duydum" && a.kesin) {
      const e = takipEylemi(a.metin);
      if (e) { this._takipYap(a, ozet, e, golge); return; }
    }

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

    this._tamponaAl(a, ozet, kapi, golge);
  }

  /**
   * ANLIK BENLİK (spec 12): algı GELİR GELMEZ — kapıdan önce, süzülse bile. Fail ve süzgeç
   * merceğinin önerisi benlik güncellenmeden ÖNCE okunur (spec 14 R2: `algi`dan ayrıldı).
   */
  private _benligiGuncelle(a: Algi): void {
  // ANLIK BENLİK (spec 12): fail, benlik güncellenmeden ÖNCE okunur (onaylanan komutun
  // sonucu "ortak"tır — sonucu kapatmadan bakılmalı); sonra benlik güncellenir — SÜZÜLEN
  // algıdan da (onay bildirimi beyni uyandırmaz ama Orion bir şey beklediğini bilir).
  // Gözlemdir: hatası algı yolunu kesmez.
  try {
    const once = this._benlik.oku();
    this._algiEdeni = eden(a, once);
    this._algiMercegi = suzgecMercegi(a, once);
    if (a.tur === "sonuc") this._benlik.sonucGeldi(a.sonuc);
    if (a.tur === "sonuc" && a.sonuc.durum !== "basladi") {
      const ozet = this._isler.get(a.sonuc.niyet_id);
      if (ozet !== undefined) {
        this._isler.delete(a.sonuc.niyet_id);
        this._durum.isBitti(ozet, a.sonuc.durum === "bitti" ? "done" : `${a.sonuc.durum}${a.sonuc.not ? `: ${a.sonuc.not}` : ""}`);
      }
    }
    if (a.tur === "duydum" && a.kesin && this._sohbetKipi !== "temiz" && !sohbetEylemi(a.metin)) this._durum.ozynDedi(a.metin);
    else if (a.tur === "terminal") this._benlik.terminalBitti(terminalAyristir(a.kuyruk).komut, a.kod);
  } catch (err) {
    this._algiEdeni = undefined;
    this._algiMercegi = null;
    console.error("[BENLIK] guncellenemedi:", err);
  }
  }

  /**
   * İÇERİK KARARI: içerik süzgeci (refleks) ve — yetkideyse — süzgeç merceği. Dikkat bundan
   * SONRA gelir. Mercek geçirdiği bloğun özetine not ekleyebilir; yeni özet döner
   * (spec 14 R2: `algi`dan ayrıldı).
   */
  private _icerikKarari(a: Algi, ozet: string): { kapi: KapiKarari; ozet: string } {
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
  }
  // SÜZGEÇ MERCEĞİ, YETKİDE (spec 12 Faz 5): yalnız EZİLEBİLİR bir içerik kararını değiştirir
  // (konuşma, güvenli taraf, refleks.konusma gibi ezilemezlere dokunmaz). Dikkat SONRA gelir.
  const mercek = this._algiMercegi;
  if (mercek && this._ayar.benlikSuzgecYetkisi && ICGUDULER[kapi.kural].ezilebilir) {
    if (mercek.oneri === "gecir" && !kapi.gecti) {
      kapi = { gecti: true, kural: mercek.kural, gerekce: mercek.gerekce };
      // Talimat "terminaldeki komutları Ozyn yazar" der: bu blok ORTAK — söyle ki model bilsin.
      ozet = `${ozet}\n(This is the result of the command YOU suggested and Ozyn approved: ${mercek.gerekce.replace(/^önerdiğim komut /, "").replace(/ sonucu$/, "")}.)`;
    } else if (mercek.oneri === "suz" && kapi.gecti) {
      kapi = { gecti: false, kural: mercek.kural, gerekce: mercek.gerekce };
    }
  }
    return { kapi, ozet };
  }

  /**
   * Kapıdan geçen algı: zincir hakkı ve köken işaretleri, tampon ve kayıt, hafıza ve çalışma
   * belleği, turun türleri; söz hemen, diğerleri toplanarak düşünmeyi tetikler
   * (spec 14 R2: `algi`dan ayrıldı).
   */
  private _tamponaAl(a: Algi, ozet: string, kapi: KapiKarari, golge: BeceriGolgesi | null | undefined): void {
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

  // Beyne giden algı hafızaya da yazılır — süzgeçten geçerse (`_aniyaYaz`). Önem KURALLA belirlenir —
  // her anı için bir LLM turu ödemek ölçülmüş bir fayda olmadan kabul
  // edilemez (bkz. mind/hafiza.ts kuralOnemi).
  // Hafızaya BİÇİM değil İÇERİK yazılır.
  //
  // İlk sürüm `ozet`i ("Ozyn dedi: \"...\"") saklıyordu. Tüm anılar aynı
  // öneki taşıdığı için kelime örtüşmesi İÇERİKTEN değil KALIPTAN geliyordu:
  // canlı ölçümde sorgu ne olursa olsun hep aynı üç alakasız anı dönüyordu.
  // Kim söyledi bilgisi zaten `tur` alanında duruyor.
  // DURUM ≠ ANI (spec 06 K2). `gordum` o ANA ait bir gözlem: Orion iki adım
  // atınca yanlışa döner. Kalıcı hafızaya yazıldığında dünkü gözlem bugün
  // "hatırlanan bilgi" diye geri geliyordu ve Orion onu anlatıyordu.
  // [ÖLÇÜLDÜ] aynı girdi, tek fark eski gözlem anıları: sadakat %50 → %100.
  let icerik: string;
  if (a.tur === "gordum") { this._calisma.yaz(a.ne, a.metin); icerik = this._aniIcerigi(a, ozet).icerik; }
  else icerik = this._aniyaYaz(a, ozet);
  this._turIcerikleri.push(icerik);
  this._turTurleri.add(a.tur);
  if (a.tur === "terminal") this._turTerminal = (a.kod ?? 0) !== 0 ? "hatali" : (this._turTerminal ?? "basarili");
  if (a.tur === "sonuc" && a.sonuc.durum === "hata") this._turNiyetHatasi = true;

  if (a.tur === "duydum") {
    // Kullanıcı konuştu: bekletme, hemen düşün.
    this._dikkat.sifirla();
    this._gecmiseEkle({ rol: "kullanici", metin: a.metin });
    this._kirp();
    this._turSozleri.push(a.metin);
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
    if (this._algiEdeni) ek.eden = this._algiEdeni;
    if (this._algiMercegi) ek.mercek = { oneri: this._algiMercegi.oneri, kural: this._algiMercegi.kural };
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
   * geçmişe ve tampona döner (bkz. `_refleksiGeriAl`). Önce onay jesti — adım değildir,
   * sonucu beklenmez — sonra adımlar sırayla.
   */
  private _refleksBaslat(a: Algi & { tur: "duydum" }, ozet: string, kapi: KapiKarari, golge: BeceriGolgesi): void {
    const algi = this._kaydet(a, ozet, kapi, golge);
    this._aniyaYaz(a, ozet);
    this._dikkat.sifirla();
    this._sayac.refleks++;
    console.log(`[BECERI] refleks: "${a.metin}" → ${golge.beceri} (${golge.adimlar.length} adim, pay ${golge.pay})`);
    this._refleks.baslat({ algi, soz: a.metin, ozet, beceri: golge.beceri, adimlar: golge.adimlar });
  }

  /**
   * Başarısız refleksin sözü LLM'e döner (B13): konuşma geçmişine girer, özeti tampona,
   * sebebi geri besleme olarak yanına; LLM hemen uyanır ve görevi kendisi yapar. Kapanışta
   * (durdurulmuş köprü) hiçbir şey yapmaz.
   */
  private _refleksiGeriAl(g: RefleksGeriVerme): void {
    if (this._durduruldu) return;
    this._gecmiseEkle({ rol: "kullanici", metin: g.soz });
    this._kirp();
    this._tampon.push(g.ozet);
    this._tamponIdleri.push(g.algi);
    this._tampon.push(`Your automatic attempt at this request stopped at step "${g.adim}": ${g.neden}. Do it yourself.`);
    this._tamponIdleri.push(null);
    this._turTurleri.add("duydum");
    this._turIcerikleri.push(g.soz);
    this._turSozleri.push(g.soz);
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
    this._aniyaYaz(a, ozet);
    this._dikkat.sifirla();
    this._sayac.komut++;
    // Yeni emir takibi bitirir — `dur` gibi İŞ niyeti olmayan programlar da (yeni emir kazanır).
    this._takibiBitir(`yeni emir: ${p.program}`);
    this._gecmiseEkle({ rol: "kullanici", metin: a.metin });
    this._kirp();

    // Plan saf (bridge/komutProgrami.ts): doğrulanmış adımlar, kayıt niyetleri, geçmiş çağrıları.
    const { adimlar, niyetler, cagrilar, hata } = programPlani(p);
    for (const cagri of cagrilar) {
      this._gecmiseEkle({ rol: "orion", metin: "", arac: true, cagri });
      this._kirp();
    }
    // Program tablosu testli; geçersiz adım bir yazılım hatasıdır — sessiz kalmasın.
    if (hata) { console.error(`[KOMUT] ${p.program}: ${hata}`); return; }
    const onay = niyetDogrula(REFLEKS_ONAYI);
    let onayKaydi: NiyetKaydi | undefined;
    if (onay.ok) {
      const id = kimlik("komut");
      onayKaydi = niyetKaydi(id, onay.deger);
      this._gonder(onay.deger, id);
      this._sayac.niyet++;
    }
    this._kayit.program({ algi, program: p.program, ...(onayKaydi ? { onay: onayKaydi } : {}), niyetler });
    console.log(`[KOMUT] "${a.metin}" → ${p.program} (${adimlar.map((x) => x.niyet.tur).join(" → ")}), LLM uyanmadi`);
    this._sayac.niyet += adimlar.length;
    this._sira.baslat(adimlar);
  }

  /**
   * Algıyı kalıcı hafızaya yazar — süzgeçten geçerse (spec 16 F1, mind/aniSuzgeci.ts: olay yazılmaz,
   * terminal kırpılır, mikrofon sözü düşük önemli). Sade içeriği döner: bu turun sorgusu onunla kurulur,
   * süzgeç sorguyu değiştirmez. Üç yazma yolu (tampon, refleks, program) TEK buradan geçer.
   */
  private _aniyaYaz(a: Algi, ozet: string): string {
    const { tur, icerik } = this._aniIcerigi(a, ozet);
    // Temiz sohbet hafızaya YAZILMAZ (spec 16 F5b). İçerik yine bu turun sorgusu/bağlamıdır.
    if (this._sohbetKipi === "temiz") return icerik;
    const k = aniKaydi(a, tur, icerik);
    if (k) { this._hafiza.ekle(k.icerik, tur, k.onem); this._hafizaYaz(); }
    return icerik;
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
  /** Şu anki sohbet kipi (spec 16 F5b). */
  get sohbetKipi(): SohbetKipi { return this._sohbetKipi; }

  /** Kip değişimini dinle (ekrandaki işaret, günlük). Abonelikten çıkma fonksiyonu döner. */
  sohbetKipiDinle(cb: (kip: SohbetKipi, eylem: SohbetEylemi) => void): () => void {
    this._sohbetDinleyicileri.add(cb);
    return () => { this._sohbetDinleyicileri.delete(cb); };
  }

  /**
   * Sohbet eylemi: söz kayda (`kopru.sohbet`) yazılır ama hafızaya ve geçmişe GİRMEZ; konuşma penceresi
   * HER eylemde sıfırlanır (yeni sohbet: eski laf gitsin; temize girerken: önceki konuşma sızmasın;
   * temizden çıkarken: temiz sohbet standarda sızmasın). Bekleyen tur da düşer. Orion sabit cümleyle
   * onaylar (`SOHBET_ONAYI`) — model uyanmaz, onay durum defterine yazılmaz.
   */
  private _sohbetEylemiYap(a: Algi & { tur: "duydum" }, ozet: string, e: SohbetEylemi, golge: BeceriGolgesi | null | undefined): void {
    this._kaydet(a, ozet, { gecti: true, kural: "kopru.sohbet" }, golge);
    this._dikkat.sifirla();
    this._gecmis.length = 0;
    this._tampon.length = 0; this._tamponIdleri.length = 0;
    this._turIcerikleri.length = 0; this._turSozleri.length = 0; this._turTurleri.clear();
    this._sohbetKipi = sonrakiKip(e);
    console.log(`[SOHBET] ${e} → kip=${this._sohbetKipi} (pencere sifirlandi, LLM uyanmadi)`);
    for (const d of this._sohbetDinleyicileri) {
      try { d(this._sohbetKipi, e); } catch (err) { console.error("[kopru] sohbet dinleyicisi hatası:", err); }
    }
    if (this._konusmaDinleyiciler.size) this._konusmaYay(SOHBET_ONAYI[e], false);
  }

  /** "Beni takip et" sürüyor mu. */
  get takipte(): boolean { return this._takipte; }

  /**
   * Takip sözü: kayda (`kopru.takip`) ve anıya yazılır; söz ve onay konuşma geçmişine girer (LLM sonraki
   * turunda takip ettiğini bilsin). Takibi dünyaya `takipDinle` bildirir; Orion sabit cümleyle onaylar.
   */
  private _takipYap(a: Algi & { tur: "duydum" }, ozet: string, e: TakipEylemi, golge: BeceriGolgesi | null | undefined): void {
    this._kaydet(a, ozet, { gecti: true, kural: "kopru.takip" }, golge);
    this._aniyaYaz(a, ozet);
    this._dikkat.sifirla();
    this._gecmiseEkle({ rol: "kullanici", metin: a.metin });
    this._gecmiseEkle({ rol: "orion", metin: TAKIP_ONAYI[e], arac: true });
    this._kirp();
    if (e === "basla") {
      this._takipte = true;
      this._durum.isBasladi("takip → Ozyn");
      console.log("[TAKIP] basladi (LLM uyanmadi)");
      try { this._ayar.takipDinle?.(true); } catch (err) { console.error("[kopru] takip dinleyicisi hatası:", err); }
    } else {
      this._takibiBitir("söz");
    }
    if (this._konusmaDinleyiciler.size) this._konusmaYay(TAKIP_ONAYI[e]);
  }

  /** Takibi bitirir (söz ya da yeni emir); takip etmiyorsa bir şey yapmaz. */
  private _takibiBitir(neden: string): void {
    if (!this._takipte) return;
    this._takipte = false;
    this._durum.isBitti("takip → Ozyn", `bitti (${neden})`);
    console.log(`[TAKIP] bitti: ${neden}`);
    try { this._ayar.takipDinle?.(false); } catch (err) { console.error("[kopru] takip dinleyicisi hatası:", err); }
  }

  /** Durum defteri (spec 16 F2): dünya konumu ve monitörü buraya yazar. */
  get durum(): DurumDefteri { return this._durum; }

  /** Durum defterini depoya yaz — hafızayla aynı kısma penceresi (3 sn). */
  private _durumSaat: ReturnType<typeof setTimeout> | null = null;
  private _durumYaz(): void {
    const depo = this._ayar.durumDeposu;
    if (!depo || this._durumSaat) return;
    this._durumSaat = setTimeout(() => {
      this._durumSaat = null;
      try { depo.yaz(this._durum.kayitlar()); }
      catch (err) { console.warn("[DURUM] defter yazilamadi:", err); }
    }, 3000);
  }
  /** Devre panosu okuyucusu — dikkat ayarları ve sayaçları panelde görünsün. */
  get dikkat(): Dikkat { return this._dikkat; }

  /**
   * HAFIZA GÖRÜNÜMÜ için okuma (spec 13 Faz 5): derin (anılar), anlık (çalışma belleği,
   * konuşma penceresi) ve son turda getirilenler. Kopya döner; yalnız gözlem.
   */
  hafizaGorunumu(): { derin: Ani[]; calisma: string[]; gecmis: BeyinGirdisi["gecmis"]; getirilen: GetirSonucu[]; durum: DurumKaydi[] } {
    return {
      durum: this._durum.kayitlar(),
      derin: this._hafiza.dok(),
      calisma: this._calisma.satirlar(),
      gecmis: this._gecmis.map((g) => ({ ...g })),
      getirilen: this._sonGetirilen.map((g) => ({ ...g, ani: { ...g.ani } })),
    };
  }

  /** Anlık benlik (spec 12): birimler ve duvar karar anında `oku()` ile çeker. */
  get benlik(): AnlikBenlik { return this._benlik; }

  /** Ajanda (mind/ajanda.ts) için: beyin şu an düşünüyorsa araya girme. */
  get dusunuyorMu(): boolean { return this._dusunuyor; }

  /** Bekleyen işleri iptal eder. Kapanışta çağrılır. */
  durdur(): void {
    this._durduruldu = true;
    // Süren refleks kesilir ve satırı yazılır (defter dinlerken: canlı = kayıt kalsın).
    this._refleks.bitir("kesildi");
    this._sira.kes("kapanış");
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
    if (this._durumSaat) {
      clearTimeout(this._durumSaat);
      this._durumSaat = null;
      try { this._ayar.durumDeposu?.yaz(this._durum.kayitlar()); }
      catch (err) { console.warn("[DURUM] kapanista yazilamadi:", err); }
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
    this._benlik.dusunceBasladi(this._ayar.beyin.ad, this._zincirKokeni);
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
      const { girdi, sessiz, istekler } = this._turGirdisi(ozetler, uyanis);
      // Bağlam ölçüsü (spec 16 F0): davranışı değiştirmez, karar kaydına yazılır.
      uyanis.baglam = baglamOlcusu(girdi);
      const anisayisi = girdi.anilar?.length ?? 0;
      if (anisayisi) this._asama("hafiza", `${anisayisi} anı`);
      this._asama("beyin", "düşünüyor");
      beyinT0 = Date.now();
      const cikti = await this._ayar.beyin.dusun(girdi);
      this._asama("beyin:bitti", `${((Date.now() - beyinT0) / 1000).toFixed(1)} sn`);
      uyanis.sureMs = Date.now() - beyinT0;
      uyanis.cagrilar = cikti.cagrilar.map((c) => c.ad);
      const girdiToken = cikti.bilgi?.["girdiToken"];
      if (typeof girdiToken === "number") uyanis.baglam.token = girdiToken;
      const b = uyanis.baglam;
      console.log(`[BAGLAM] toplam=${b.toplam}ch${b.token !== undefined ? ` token=${b.token}` : ""} talimat=${b.talimat} araclar=${b.araclar} ornekler=${b.ornekler} gecmis=${b.gecmis}(${b.gecmisKayit}) dunya=${b.dunya} anilar=${b.anilar} ozetler=${b.ozetler}`);
      if (cikti.metin) uyanis.metin = cikti.metin;

      this._ciktiyiIsle(cikti, uyanis, sessiz, istekler);
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
      this._benlik.dusunceBitti();
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
   * Bir düşünme turunun GİRDİSİ (spec 14 R2: `_dusun`'dan ayrıldı, mantık aynı): hafızadan
   * getirme, turun türleri, zincir kökeni ve sessizliği, duruma göre talimat, dünya ve
   * çalışma belleği, geçmiş, örnekler. Uyanış satırının ilgili alanlarını doldurur.
   */
  private _turGirdisi(ozetler: string[], uyanis: UyanisBilgisi): { girdi: BeyinGirdisi; sessiz: boolean; istekler: string[] } {
    // İlgili anılar: sorgu, bu turu tetikleyen algıların birleşimi.
    const adet = this._ayar.hafizaGetirme ?? 3;
    const simdiMs = this._ayar.simdi?.() ?? Date.now();
    // Sorgu da İÇERİK olmalı: kalıpla sorgulamak kalıpla eşleşmeye yol açar.
    const icerikler = this._turIcerikleri.splice(0);
    const istekler = this._turSozleri.splice(0);
    const turTerminal = this._turTerminal, turNiyetHatasi = this._turNiyetHatasi;
    this._turTerminal = undefined; this._turNiyetHatasi = false;
    let getirilen: GetirSonucu[];
    let durumSatirlari: string[] = [];
    if (this._sohbetKipi === "temiz") {
      // TEMİZ SOHBET (spec 16 F5b): hafıza ve durum defteri bağlama girmez — hangi hafıza kipi olursa.
      getirilen = [];
      uyanis.sohbetKipi = "temiz";
    } else if (this._ayar.hafizaKipi === "yonlendirici") {
      // SPEC 16: bağlama yalnız İSTENEN girer. Yönlendirici sözden karar verir; varsayılan boş.
      const istek = yonlendir({
        sozler: istekler,
        ...(turTerminal ? { terminal: turTerminal } : {}),
        niyetHatasi: turNiyetHatasi,
        yerAdlari: this._ayar.yerAdlari?.() ?? [],
      });
      uyanis.hafizaIstegi = istek.kurallar;
      // Yakın pencerede ZATEN görünen sözler çekmeceden tekrar gelmez: "ne konuşmuştuk" pencerenin
      // ÖNCESİNİ getirmeli (baglamdene 1. koşu: pencerenin kendisini tekrar getirdi, eski bilgi dışarıda kaldı).
      const penceredeki = this._yakinPencere(simdiMs).map((g) => g.metin).filter(Boolean);
      getirilen = this._istenenAnilar(istek.cekmece, [...icerikler, ...penceredeki], icerikler);
      durumSatirlari = this._durum.satirlar(istek.durum);
      if (istek.kurallar.length) console.log(`[HAFIZA] istek: ${istek.kurallar.join(", ")} · durum ${durumSatirlari.length} satır · anı ${getirilen.length}`);
    } else {
      getirilen = adet > 0 && icerikler.length
        // Bu turun içerikleri hafızaya az önce yazıldı; anı olarak geri
        // gelmeleri "hatırlamak" değil kendini tekrar etmektir.
        ? this._hafiza.getir(icerikler.join(" "), adet, icerikler)
        : [];
    }
    // Zihin duvarının hafıza görünümü bu turda neyin hatırlandığını gösterir (spec 13 Faz 5).
    this._sonGetirilen = getirilen;
    // ZAMAN ETİKETİ (spec 06 K3): anı, şimdiki bilgiden ayırt edilebilsin.
    // Zamansızken canlı kayıtta günler öncesinin "Ozyn komutu reddetti"
    // anısı, model için az önce olmuş gibi duruyordu.
    const anilar = getirilen.map((x) => `[${oncesiSozu(simdiMs - x.ani.olusma)}] ${x.ani.metin}`);

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
    this._benlik.dusunceBasladi(this._ayar.beyin.ad, this._zincirKokeni);
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
    // Durum defterinin istenen satırları da ŞİMDİ'dedir (durum, anı değil; yaşıyla — spec 16 F2).
    const dunya = [this._ayar.dunyaDurumu(), ...durumSatirlari, ...this._calisma.satirlar()].join("\n");
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
    const gecmis = this._yakinPencere(simdiMs);

    const ornekler = ornekUret({
      terminal: turler.has("terminal"),
      konusma: turler.has("duydum"),
    });

    return {
      girdi: {
        talimat,
        ornekler,
        anilar,
        ozetler,
        dunya,
        sabit: this._ayar.sabitBilgi?.(),
        gecmis,
        araclar: this._araclar(),
      },
      sessiz,
      istekler,
    };
  }

  /**
   * Bir düşünme turunun ÇIKTISI (spec 14 R2: `_dusun`'dan ayrıldı, mantık aynı): düz metin,
   * araç çağrıları, düz metinden kurtarma, beden niyetleri (eylem sırası), iç ses ve
   * "söyledi ama yapmadı" bekçisi.
   */
  private _ciktiyiIsle(cikti: BeyinCikti, uyanis: UyanisBilgisi, sessiz: boolean, istekler: string[]): void {
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
    // Düşünen API modelinin ayrı gelen akıl yürütmesi (`reasoning_content`, bridge/apiBeyni.ts)
    // İÇ SESTİR: sesli okunmaz, geçmişe girmez, duvarda görünür (spec 13 Faz 5).
    const akil = cikti.bilgi?.["dusunce"];
    if (typeof akil === "string" && akil.trim()) tur.icSes.push(akil.trim());
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

      if (konusulabilir && (sessiz || ingilizceMi(konusulabilir)) && this._sozuGecir(konusulabilir)) {
        // Hareket zinciri: kurtarılan cümle de iç seste kalır. İngilizce düz metin de
        // (Ozyn'in testi, 2026-10-02: lfm25-tb'nin "I see the user is asking…" iç
        // monoloğu sesli okundu): Orion'un sesi Türkçedir, İngilizce çerçevenin dilidir.
        tur.icSes.push(konusulabilir);
      } else if (konusulabilir && this._konusmaDinleyiciler.size && this._sozuGecir(konusulabilir)) {
        const metin = konusulabilir.slice(0, 400);
        this._sayac.kurtarilanMetin++;
        uyanis.konusulanMetin = true;
        console.warn(`[kopru] arac cagrilmadi, temiz metin konusmaya cevrildi: "${metin.slice(0, 80)}"`);
        this._konusmaYay(metin);
        // Söylendi: geçmişe SÖZ olarak girer (düz metin olarak değil — bkz. yukarı).
        this._gecmiseEkle({ rol: "orion", metin, arac: true });
        this._kirp();
        tur.sozler.push(metin);
      } else if (!konusulabilir && kurtarilan.length === 0) {
        this._sayac.yutulanCop++;
        console.warn(`[kopru] arac copu KONUSULMADI: "${cikti.metin.slice(0, 80)}"`);
      }
    }

    // Beden niyetleri: tek niyet hemen, birden çoğu sırayla (bkz. EylemSirasi).
    this._sira.baslat(tur.beden);

    if (tur.icSes.length) {
      uyanis.icSes = tur.icSes.join(" / ");
      if (sessiz) uyanis.susturan = "kopru.hareket_sessiz";
      console.log(`[kopru] iç ses${sessiz ? " (hareket zinciri, kopru.hareket_sessiz)" : ""}: "${uyanis.icSes.slice(0, 120)}"`);
      try { this._ayar.icSesDinle?.(uyanis.icSes); }
      catch (err) { console.error("[kopru] iç ses dinleyicisi hatası:", err); }
    }

    // SÖYLEDİ AMA YAPMADI (mind/sozEylem.ts): yalnız gözlem, davranış değişmez.
    const eksik = sozEylemUcurumu(tur.sozler, uyanis.niyetler.map((n) => n.tur), istekler);
    if (eksik.length) {
      uyanis.sozEylemUcurumu = eksik;
      const soz = tur.sozler.join(" ");
      console.warn(`[kopru] SOZ-EYLEM: "${soz.slice(0, 80)}" dedi ama ${eksik.join(", ")} niyeti yok`);
      try { this._ayar.sozEylemDinle?.(eksik, soz); }
      catch (err) { console.error("[kopru] söz-eylem dinleyicisi hatası:", err); }
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
        this._gecmiseEkle({ rol: "orion", metin: n.metin, arac: true });
        this._kirp();
      }
      tur.sozler.push(n.metin);
    }
    // Gövdesiyle (spec 10, Faz A): beceri refleksi görevin nasıl yapıldığını buradan öğrenir.
    uyanis.niyetler.push(niyetKaydi(id, n));
    this._sayac.niyet++;
    if (SOZ_NIYETLERI.has(n.tur)) { this._gonder(n, id); return; }
    // Beden niyeti geçmişe ARAÇ olarak girer (spec 13): model "komut → eylem" görsün.
    const { tur: nt, ...girdi } = n;
    this._gecmiseEkle({ rol: "orion", metin: "", arac: true, cagri: { ad: `dunya_${nt}`, girdi } });
    this._kirp();
    tur.beden.push({ niyet: n, id });
  }

  /**
   * Modele giden geçmiş. `yakinPencere` verilmezse bütün pencere (gecmisSiniri). Verilirse yalnız son
   * `kayit` kayıt ve `yasMs`ten yeni olanlar (spec 16 K3): "evet", "onu da yap" anlaşılsın diye az
   * önceki alışveriş kalır; daha eskisi yalnız sorulunca konuşma çekmecesinden gelir. Zihin
   * duvarının penceresi bundan etkilenmez (orada bütün pencere görünür).
   */
  private _yakinPencere(simdi: number): BeyinGirdisi["gecmis"] {
    const p = this._ayar.yakinPencere;
    if (!p) return this._gecmis.slice();
    return this._gecmis.slice(-p.kayit).filter((k) => simdi - (this._gecmisZamani.get(k) ?? simdi) <= p.yasMs);
  }

  /** Yönlendiricinin istediği çekmecelerden anılar; aynı anı iki istekten gelirse bir kez. */
  private _istenenAnilar(istekler: readonly CekmeceIstegi[], haric: string[], icerikler: string[]): GetirSonucu[] {
    const sonuc: GetirSonucu[] = [];
    const gorulen = new Set<string>();
    for (const i of istekler) {
      const r = i.mod === "son"
        ? this._hafiza.sonlar(i.cekmeceler, i.adet, haric)
        : (icerikler.length ? this._hafiza.getir(icerikler.join(" "), i.adet, haric, i.cekmeceler) : []);
      for (const x of r) if (!gorulen.has(x.ani.metin)) { gorulen.add(x.ani.metin); sonuc.push(x); }
    }
    return sonuc;
  }

  /** Modele sunulan araçlar (spec 16 F6): `cikarilanAraclar` dışındakiler. */
  private _araclar(): ReturnType<typeof araclariUret> {
    const c = this._ayar.cikarilanAraclar;
    const hepsi = araclariUret();
    return c?.length ? hepsi.filter((a) => !c.includes(a.ad)) : hepsi;
  }

  private _gecmiseEkle(k: BeyinGirdisi["gecmis"][number]): void {
    this._gecmis.push(k);
    this._gecmisZamani.set(k, this._ayar.simdi?.() ?? Date.now());
  }

  private _kirp(): void {
    const sinir = this._ayar.gecmisSiniri ?? 12;
    if (this._gecmis.length > sinir) this._gecmis.splice(0, this._gecmis.length - sinir);
  }
}
