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
import { Dikkat, type DikkatAyari } from "../mind/dikkat.ts";
import { Hafiza, kuralOnemi, type AniTuru } from "../mind/hafiza.ts";
import { araclariUret, cagriyiNiyete } from "./araclar.ts";
import type { Beyin } from "./beyin.ts";
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
   */
  suzgec?: (a: Algi, ozet: string) => boolean;
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
}

export class Kopru {
  private _ayar: KopruAyari;
  private _dikkat: Dikkat;
  private _hafiza: Hafiza;
  private _tampon: string[] = [];
  /** Bu turda hangi algi turleri geldi — talimat buna gore daralir. */
  private _turTurleri = new Set<string>();
  /** Bu turda hafızaya yazılan içerikler — sorgu ve dışlama için. */
  private _turIcerikleri: string[] = [];
  private _gecmis: { rol: "kullanici" | "orion"; metin: string; arac?: boolean }[] = [];
  private _zamanlayici: ReturnType<typeof setTimeout> | null = null;
  private _dusunuyor = false;
  /** Düşünme sürerken yeni girdi geldiyse, bitince bir tur daha dön. */
  private _tekrarGerek = false;
  private _sayac: KopruSayaci = { dusunme: 0, niyet: 0, reddedilenCagri: 0, hata: 0, suzulen: 0, kurtarilanMetin: 0, kurtarilanCagri: 0, yutulanCop: 0 };
  /** Üst üste kaç tur yalnızca ret geri beslemesiyle döndük. Döngü kalkanı. */
  private _ardisikRet = 0;
  private _konusmaDinleyiciler = new Set<(metin: string) => void>();
  private _durduruldu = false;

  constructor(ayar: KopruAyari) {
    this._ayar = ayar;
    this._dikkat = new Dikkat(ayar.dikkat);
    this._hafiza = new Hafiza({ simdi: ayar.simdi });

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
      let gecsin = true;
      try { gecsin = this._ayar.suzgec(a, ozet); }
      catch (err) { console.warn("[kopru] süzgeç hatası, güvenli tarafa geçiriliyor:", err); }
      if (!gecsin) { this._sayac.suzulen++; return; }
    }

    const k = this._dikkat.karar(a);
    if (!k.gecsin) return;

    this._tampon.push(ozet);

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
    this._hafiza.ekle(icerik, aniTur, kuralOnemi(aniTur, icerik, a.tur === "terminal" ? a.kod : undefined));
    this._hafizaYaz();
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

  sayac(): KopruSayaci & { dikkat: ReturnType<Dikkat["sayac"]>; hafiza: number } {
    return { ...this._sayac, dikkat: this._dikkat.sayac(), hafiza: this._hafiza.sayi };
  }

  /** Tanılama/ölçüm: hafızaya doğrudan erişim. */
  get hafiza(): Hafiza { return this._hafiza; }

  /** Ajanda (mind/ajanda.ts) için: beyin şu an düşünüyorsa araya girme. */
  get dusunuyorMu(): boolean { return this._dusunuyor; }

  /** Bekleyen işleri iptal eder. Kapanışta çağrılır. */
  durdur(): void {
    this._durduruldu = true;
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
    this._sayac.dusunme++;

    try {
      // İlgili anılar: sorgu, bu turu tetikleyen algıların birleşimi.
      const adet = this._ayar.hafizaGetirme ?? 3;
      // Sorgu da İÇERİK olmalı: kalıpla sorgulamak kalıpla eşleşmeye yol açar.
      const icerikler = this._turIcerikleri.splice(0);
      const anilar = adet > 0 && icerikler.length
        // Bu turun içerikleri hafızaya az önce yazıldı; anı olarak geri
        // gelmeleri "hatırlamak" değil kendini tekrar etmektir.
        ? this._hafiza.getir(icerikler.join(" "), adet, icerikler).map((x) => x.ani.metin)
        : [];

      if (anilar.length) console.log(`[HAFIZA] getirilen ${anilar.length}: ${anilar.map((a) => a.slice(0, 60)).join(" | ")}`);

      const turler = new Set(this._turTurleri);
      this._turTurleri.clear();
      const talimat = talimatUret({
        konusma: turler.has("duydum"),
        terminal: turler.has("terminal"),
        anilar: anilar.length > 0,
        olay: turler.has("olay"),
      });

      const dunya = this._ayar.dunyaDurumu();
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
      const beyinT0 = Date.now();
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

      // Düz metin DUYULMAZ — protokolde konuşmak bir eylemdir (dunya_soyle).
      // Yine de geçmişe yazılır: modelin kendi düşüncesi bağlamda kalsın.
      if (cikti.metin) {
        // Düz metin DUYULMAZ. Model araç çağırmak yerine sohbet ediyorsa bu
        // SESSİZ bir davranış hatasıdır — kullanıcı Orion'u susmuş sanır.
        // Görünür olsun ki ölçülebilsin.
        console.log(`[BEYIN:metin] ${cikti.metin.slice(0, 160)}${cikti.cagrilar.length === 0 ? "  ← ARAÇ YOK, bu duyulmayacak" : ""}`);
        this._ayar.metinDinle?.(cikti.metin, cikti.cagrilar.length > 0);
        this._gecmis.push({ rol: "orion", metin: cikti.metin });
        this._kirp();
      }

      for (const c of cikti.cagrilar) {
        const d = cagriyiNiyete(c.ad, c.girdi);
        if (!d.ok) {
          this._sayac.reddedilenCagri++;
          // Reddi sessizce yutma: modele geri besle, kendini düzeltsin.
          this._tampon.push(`Araç reddedildi (${c.ad}): ${d.hata}`);
          console.warn(`[kopru] çağrı reddedildi: ${d.hata}`);
          continue;
        }
        this._ardisikRet = 0;  // geçerli çağrı geldi, düzeltme döngüsü kırıldı
        const id = kimlik("n");
        if (d.deger.tur === "soyle" && this._konusmaDinleyiciler.size) {
          this._konusmaYay(d.deger.metin);
          this._gecmis.push({ rol: "orion", metin: d.deger.metin, arac: true });
          this._kirp();
        }
        this._ayar.niyetGonder(d.deger, id);
        this._sayac.niyet++;
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
          console.warn(`[kopru] METINDEN kurtarildi: ${c.ad}`);
          const id = kimlik("n");
          if (d.deger.tur === "soyle") { this._konusmaYay(d.deger.metin); this._gecmis.push({ rol: "orion", metin: d.deger.metin, arac: true }); this._kirp(); }
          this._ayar.niyetGonder(d.deger, id);
          this._sayac.niyet++;
        }

        if (konusulabilir && this._konusmaDinleyiciler.size) {
          const metin = konusulabilir.slice(0, 400);
          this._sayac.kurtarilanMetin++;
          console.warn(`[kopru] arac cagrilmadi, temiz metin konusmaya cevrildi: "${metin.slice(0, 80)}"`);
          this._konusmaYay(metin);
        } else if (!konusulabilir && kurtarilan.length === 0) {
          this._sayac.yutulanCop++;
          console.warn(`[kopru] arac copu KONUSULMADI: "${cikti.metin.slice(0, 80)}"`);
        }
      }
    } catch (err) {
      this._sayac.hata++;
      // Beyin hatası dünyayı durdurmaz ama SESSİZ de kalmaz.
      const m = err instanceof Error ? err.message : String(err);
      console.error("[kopru] beyin hatası:", m);
      this._arizaYay(m);
    } finally {
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
          this._ardisikRet = 0;
          console.warn(`[kopru] model üst üste geçersiz çağrı üretti, düzeltme döngüsü kesildi (${dusen.length} geri besleme düşürüldü)`);
        } else {
          this._gecikmeliDusun();
        }
      }
    }
  }

  private _kirp(): void {
    const sinir = this._ayar.gecmisSiniri ?? 12;
    if (this._gecmis.length > sinir) this._gecmis.splice(0, this._gecmis.length - sinir);
  }
}
