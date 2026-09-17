// protocol/pano.ts — DEVRE PANOSU SÖZLEŞMESİ.
//
// Zihin duvarındaki şema bugün Orion'un işlem hattını GÖSTERİYOR. Pano onu
// KUMANDAYA çevirir: hangi ayar nerede, ne kadar tehlikeli, değiştirince ne
// zaman etkiler. Bu dosya o sorulara verilen cevabın biçimidir.
//
// SIFIR BAĞIMLILIK — `protocol/`un kuralı. `world/` bundan yalnızca TİP
// alır; kayıt defterini kompozisyon kökü (`world/giris.ts`) kurar.
//
// ── İKİ EKSEN, BİRLEŞTİRİLMEZ ────────────────────────────────────────────
//
// `sinif` = değiştirmek NE KADAR TEHLİKELİ.
// `etki`  = değişiklik NE ZAMAN görünür.
//
// İkisi bağımsız: güvenli bir ayar yeniden kurulum isteyebilir, tehlikeli
// bir ayar anında etkiyebilir. Tek bir "seviye" alanında birleştirmek
// panelin yalan söylediği yer olurdu — operatör "güvenli" görüp anında
// etkiyeceğini sanır, oysa dünyanın yeniden kurulmasını beklemektedir.
"use strict";

/**
 * Tehlike sınıfı. SCADA panolarının kilit/etiket mantığı:
 * her düğmenin dokunulabilirliği ÖNCEDEN ilan edilir, denenerek öğrenilmez.
 */
export type Sinif =
  /**
   * Testle kilitli tel. Panelde ÇİZİLİR ama yazıcısı YOKTUR.
   *
   * Gizlenmez: devre panosu lehimli izleri de gösterir. Saklamak operatöre
   * "panel her şeydir" yalanını öğretir ve `tik` yasağı gibi görünmeyen bir
   * güvenlik teli, var olduğu bilinmediği için savunulamaz hale gelir.
   */
  | "sabit"
  /** Ölçümle seçildi. Kilit açılmadan yazılamaz; `kaynak` ZORUNLU. */
  | "olculmus"
  /** Durumsuz/zararsız. Serbest yazılır. */
  | "guvenli"
  /** Canlı durum risk altında. İki aşamalı teyit ister. */
  | "tehlikeli";

/** Değişikliğin ne zaman görüneceği. */
export type Etki =
  /** Bir sonraki okumada geçerli (tel-fonksiyon yolu). */
  | "aninda"
  /** Sıradaki tur/pencere dönene kadar eski davranış sürer. */
  | "sonraki_tur"
  /** Modülün yeniden kurulmasını gerektirir — durum kaybı riski. */
  | "yeniden_kurulum";

/** Bir düğmenin okunabilir değeri. Nesne YOK: panelde tek satır çizilir. */
export type Deger = number | boolean | string;

/**
 * TEL — aynı anda hem okuyucu hem yazma noktası.
 *
 * Çağrıldığında güncel değeri verir; `yaz` ile değiştirilir. Modüle `()=>T`
 * olarak takılır, panoya olduğu gibi verilir: karar yolu ile panel ARTIK
 * AYNI NESNEYİ okur, ikisinin ayrışması yapısal olarak imkânsızdır.
 *
 * Değer modülün İÇİNDE değil, kompozisyon kökünde durur. İki kazanç:
 * modül yeniden kurulduğunda ayar kaybolmaz (`etki: "yeniden_kurulum"`
 * olan düğmelerin var olma sebebi bu), ve `OnayKapisi`nin S0'da aldığı
 * `number | (() => number)` biçimiyle birebir uyar.
 */
export interface Tel<T extends Deger> {
  (): T;
  yaz(deger: T): void;
}

export function tel<T extends Deger>(baslangic: T): Tel<T> {
  let deger = baslangic;
  const f = (() => deger) as Tel<T>;
  f.yaz = (yeni) => { deger = yeni; };
  return f;
}

/** Yazma denemesinin sonucu. FIRLATMAZ — ret bir değerdir, olay değil. */
export interface YazmaSonucu {
  oldu: boolean;
  /** Olmadıysa NEDEN. Panelde aynen gösterilir; boş bırakılmaz. */
  sebep: string;
  /** Yazmadan SONRAKİ değer (ret durumunda eski değer). */
  deger: Deger | null;
}

/**
 * Panodaki tek bir ayar/tel.
 *
 * `oku` bir FONKSİYONDUR, değer değil — panonun kopya tutması yapısal olarak
 * imkânsız olsun diye. Modüller kendi içlerinde değişiyor (devre kesici,
 * kota, pencere dönüşü); kopya tutan panel er geç yalan söyler ve bu, en
 * çok güvenilmesi gereken ekranda olur.
 */
export interface Dugme {
  /** Pano genelinde BENZERSİZ. Kayıt defteri çakışmada kurulumda çöker. */
  ad: string;
  etiket: string;
  sinif: Sinif;
  etki: Etki;
  /** "ms", "adet", "×" gibi. Sayı birimsiz gösterilmez. */
  birim?: string;
  /** Sayısal düğmeler için geçerli aralık — S5'te sınır denetimi buradan. */
  aralik?: { readonly en: number; readonly cok: number };
  /**
   * `olculmus` için ZORUNLU: bu sayıyı hangi ölçüm seçti.
   *
   * Kaynaksız "ölçüldü" iddiası, ölçülmemiş bir sayıya ölçüm kılığı
   * giydirir; bu projede en pahalı hata türü tam olarak budur.
   */
  kaynak?: string;
  /** Bir adımda ne kadar değişir — sayısal düğmelerde panel bunu kullanır. */
  adim?: number;
  /** Güncel değeri TAZE okur. Fırlatabilir — okuyucu yakalar. */
  oku(): Deger;
  /**
   * Değeri değiştirir. YOKSA düğme salt okunurdur.
   *
   * `sabit` düğmelerde BULUNMAMALI — kayıt defteri kurulumda bunu zorlar.
   * Var olması tek başına yazılabilirlik demek değil: sınıf kapısı da
   * geçilmeli (`tehlikeli` S6'yı, `olculmus` S7'nin kilidini bekler).
   */
  yaz?(deger: Deger): void;
  /** Neden böyle — panelde detayda görünür. */
  aciklama: string;
  /**
   * `tehlikeli` yazma öncesi CANLI hesaplanan uyarı.
   *
   * Sabit bir cümle yazmak yetmez: "bütçeyi düşürürsen beyin susar" bilgi
   * değil temennidir. Kullanıcının bilmesi gereken şey ŞU ANKİ duruma bağlı
   * — "pencerede 17 mesaj var, 10'a düşürürsen ~43 sn hiçbir şey gitmez".
   */
  uyari?(yeniDeger: Deger): string;
  /** Teyit ekranında birlikte sunulan eylemler. */
  bagliEylemler?: readonly Eylem[];
}

/**
 * Teyitle birlikte sunulan BAĞLI EYLEM.
 *
 * Neden ayrı: `Hafiza.kapasite`yi 300'den 50'ye çekmek anıları HEMEN
 * silmez (budama tembel, yalnız `ekle`/`yukle`den tetiklenir). Budamayı
 * ayarın yan etkisi yapmak, sürgüyü sürüklerken her ara değerde anı silerdi.
 * Eylem ayrı durur, teyitte SEÇİLEREK çalıştırılır.
 */
export interface Eylem {
  ad: string;
  etiket: string;
  aciklama: string;
  calistir(): void;
}

/** Bekleyen iki aşamalı teyit. */
export interface Teyit {
  /** Onaylamak için gereken jeton. Bayat teyit kabul edilmez. */
  jeton: string;
  dugmeAdi: string;
  etiket: string;
  eski: Deger;
  yeni: Deger;
  /** İSTEK ANINDA canlı hesaplanmış uyarı — dondurulmuş sözleşme. */
  uyari: string;
  /** Seçilebilecek bağlı eylemler. */
  eylemler: readonly { ad: string; etiket: string; aciklama: string }[];
  /** Bu andan sonra jeton geçersiz (epoch ms). */
  sonTarih: number;
}

/** Bir modülün panodaki karşılığı. */
export interface Modul {
  ad: string;
  etiket: string;
  /** Şemadaki hangi durağa ait (`semaCekirdek.DUGUMLER[].ad`). */
  dugum: string;
  dugmeler: readonly Dugme[];
}

/** Bir düğmenin okunmuş hâli — çizime hazır, ASLA fırlatmaz. */
export interface DugmeGoruntu {
  ad: string;
  etiket: string;
  sinif: Sinif;
  etki: Etki;
  birim: string;
  kaynak: string;
  aciklama: string;
  /** Okunamadıysa `null` ve `hata` dolu. */
  deger: Deger | null;
  hata: string;
  /** Panelden ŞU AN değiştirilebilir mi — sınıf kapısı dahil. */
  yazilabilir: boolean;
  /** Yazılamıyorsa neden — panelde rozet yerine bu okunur. */
  kilitSebebi: string;
  adim: number;
}

export interface ModulGoruntu {
  ad: string;
  etiket: string;
  dugum: string;
  dugmeler: readonly DugmeGoruntu[];
}

export interface Pano {
  moduller(): readonly Modul[];
  /**
   * Bir düğmeye yaz. FIRLATMAZ — her ret gerekçeli bir değer olarak döner.
   *
   * Panel bir tuş/tıklama geri çağrısından çağırıyor; atılan istisna oradan
   * kaçarsa olay işleyici ölür ve panel sessizce tepkisiz kalır. Ret bir
   * SONUÇTUR: kullanıcı neden olmadığını ekranda okumalı.
   */
  yaz(dugmeAdi: string, deger: Deger): YazmaSonucu;
  /**
   * `tehlikeli` düğme için 1. AŞAMA: teyit iste.
   *
   * Uyarı İSTEK ANINDA hesaplanır ve jetonla birlikte donar — kullanıcıya
   * gösterilen cümle, onayladığı şeyin sözleşmesidir. Jetonun son tarihi
   * var: 40 saniye önce hesaplanmış bir uyarıya bakarak onaylamak, artık
   * doğru olmayan bir cümleye dayanarak karar vermek demektir.
   */
  teyitIste(dugmeAdi: string, deger: Deger): YazmaSonucu;
  /** Bekleyen teyit, yoksa `null`. */
  bekleyenTeyit(): Teyit | null;
  /** 2. AŞAMA: jetonla onayla, istenen bağlı eylemleri de çalıştır. */
  teyitliYaz(jeton: string, eylemAdlari?: readonly string[]): YazmaSonucu;
  /** Bekleyen teyidi düşür. */
  teyitIptal(): void;

  // ── ÖLÇÜM KİLİDİ ──────────────────────────────────────────────────────
  //
  // `olculmus` düğmeler ölçümle seçildi. Onları sezgiyle değiştirmek, bu
  // projede defalarca pahalıya patlayan hata türüdür. Kilit sürtünme
  // eklemek için var: açmak mümkün ama BEDAVA değil — gerekçe istenir,
  // günlüğe yazılır ve panelde kalıcı bir damga bırakır.

  /** Ölçüm kilidi açık mı (yani yazmaya İZİN veriliyor mu). */
  kilitAcikMi(): boolean;
  /** Kilidi aç. Gerekçe ZORUNLU; boşsa açılmaz. */
  kilitAc(gerekce: string): boolean;
  /** Kilidi yeniden kapat — damga KALKMAZ. */
  kilitKapat(): void;
  /**
   * Bu oturumda ölçüm kilidi bir kez bile açıldı mı.
   *
   * Kilit kapansa bile TRUE kalır: panelde "ÖLÇÜM DIŞI" şeridi bundan
   * beslenir. Kapatınca temizlenseydi damga anlamsız olurdu — kilidi aç,
   * değiştir, kapat ve panel yeniden tertemiz görünür.
   */
  olcumDisi(): boolean;
  /** Kilit neden açıldı — günlüğe ve panele yazılır. */
  kilitGerekcesi(): string;
  /** Bir şema düğümüne bağlı modüller. */
  dugumun(dugumAdi: string): readonly Modul[];
  /**
   * Çizime hazır görüntü. FIRLATMAZ.
   *
   * Panel bir render geri çağrısının içinden okunuyor: buradan kaçan tek bir
   * istisna kare döngüsünü öldürür, yani bir ayarın bozukluğu bütün odayı
   * karartır. Okuma hatası bir DEĞER olarak taşınır, olay olarak değil.
   */
  goruntu(dugumAdi?: string): readonly ModulGoruntu[];
}

/** Kurulum hatası — kompozisyon kökünde, kare döngüsünün DIŞINDA patlar. */
export class PanoKurulumHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "PanoKurulumHatasi";
  }
}

/**
 * Tanımları doğrular ve panoyu kurar.
 *
 * Doğrulama kurulumda yapılır çünkü burası kare döngüsünün dışıdır: bozuk
 * bir tanım uygulamayı açılışta, yığın iziyle durdurur. Aynı hatayı çizim
 * sırasında yakalamak "panel bazen boş" gibi görünürdü.
 */
export function panoKur(moduller: readonly Modul[]): Pano {
  const adlar = new Set<string>();
  for (const m of moduller) {
    for (const d of m.dugmeler) {
      // ASSUMPTION(sabit-yazicisiz): `sabit` bir telin yazıcısı OLAMAZ.
      // Sınıfı "sabit" yazıp yazıcı bırakmak, panelde kilitli görünen ama
      // programatik olarak değiştirilebilen bir güvenlik teli demekti —
      // tam olarak savunulamaz durum. Kurulumda, kare döngüsünün dışında
      // patlar.
      if (d.sinif === "sabit" && typeof d.yaz === "function") {
        throw new PanoKurulumHatasi(`'${d.ad}' sabit ilan edildi ama yazıcısı var`);
      }
      if (adlar.has(d.ad)) {
        throw new PanoKurulumHatasi(`düğme adı iki kez tanımlı: ${d.ad}`);
      }
      adlar.add(d.ad);
      // ASSUMPTION(olculmus-kaynakli): "ölçüldü" demek kanıt göstermeyi
      // gerektirir. Bu kontrol kaldırılırsa ölçülmemiş sayılar ölçüm
      // rozetiyle panelde durur ve kimse fark etmez.
      if (d.sinif === "olculmus" && !d.kaynak?.trim()) {
        throw new PanoKurulumHatasi(`'${d.ad}' ölçülmüş ilan edildi ama kaynağı yok`);
      }
    }
  }

  /**
   * Sınıf kapısı: bu düğme ŞU AN yazılabilir mi, değilse neden.
   *
   * Aşama aşama açılır ve her aşamanın kendi kapısı vardır. Burada tek
   * yerde toplanması önemli: dağılsaydı S6 `tehlikeli`yi açarken S7'nin
   * `olculmus` kilidini yanlışlıkla da açmak mümkün olurdu.
   */
  const kapi = (d: Dugme): string => {
    if (d.sinif === "sabit") return "sabit tel — testle kilitli, panelden değiştirilemez";
    if (typeof d.yaz !== "function") return "yazıcısı yok";
    if (d.sinif === "tehlikeli") return "iki aşamalı teyit gerek";
    if (d.sinif === "olculmus" && !kilitAcik) return "ölçüm kilidi açılmalı";
    // Kilit açık bile olsa ölçülmüş bir sabit iki aşamalı teyitten geçer:
    // kilidi açmak "artık serbest" demek değil, "bilerek yapıyorum" demek.
    if (d.sinif === "olculmus") return "iki aşamalı teyit gerek";
    return "";
  };

  const dugmeBul = (ad: string): Dugme | null => {
    for (const m of moduller) for (const d of m.dugmeler) if (d.ad === ad) return d;
    return null;
  };

  const oku = (d: Dugme): DugmeGoruntu => {
    let deger: Deger | null = null;
    let hata = "";
    try {
      deger = d.oku();
    } catch (e) {
      hata = e instanceof Error ? e.message : String(e);
      // Sessiz bozulma en tehlikeli hâl: panelde "okunamadı" yazacak ama
      // NEDENİ yalnızca burada görünür.
      console.error(`[PANO] '${d.ad}' okunamadı:`, e);
    }
    return {
      ad: d.ad, etiket: d.etiket, sinif: d.sinif, etki: d.etki,
      birim: d.birim ?? "", kaynak: d.kaynak ?? "", aciklama: d.aciklama,
      deger, hata,
      yazilabilir: kapi(d) === "",
      kilitSebebi: kapi(d),
      adim: d.adim ?? 0,
    };
  };

  const dugumun = (dugumAdi: string) => moduller.filter((m) => m.dugum === dugumAdi);

  // ── İKİ AŞAMALI TEYİT ───────────────────────────────────────────────────
  //
  // Bekleyen teyit TEK. `OnayKapisi`nin "bekleyen ezilemez" kuralıyla aynı
  // gerekçe: ekranda okuduğun teyit, onayladığın teyit olmalı. İkincisinin
  // birincinin yerine geçmesi, kullanıcının gördüğü cümle ile onayladığı
  // eylemi ayırırdı.
  let bekleyen: Teyit | null = null;
  let jetonSayaci = 0;
  let kilitAcik = false;
  // ASSUMPTION(olcum-damgasi-silinmez): bir kez açıldıysa bu oturum artık
  // "ölçüm dışıdır". Bu bayrağı temizleyen bir yol EKLENMEMELİ.
  let olcumDisiDamgasi = false;
  let kilitGerekce = "";
  /** Teyit ömrü: bundan eskisi, artık doğru olmayabilecek bir uyarıya dayanır. */
  const TEYIT_OMRU_MS = 30_000;

  const teyitTaze = (simdi: number): Teyit | null => {
    if (!bekleyen) return null;
    if (simdi > bekleyen.sonTarih) {
      console.warn(`[PANO] teyit süresi doldu: ${bekleyen.dugmeAdi}`);
      bekleyen = null;
    }
    return bekleyen;
  };

  return {
    moduller: () => moduller,
    dugumun,
    yaz(dugmeAdi, deger) {
      const red = (sebep: string, d: Dugme | null): YazmaSonucu => {
        let mevcut: Deger | null = null;
        try { mevcut = d ? d.oku() : null; } catch { mevcut = null; }
        console.warn(`[PANO] '${dugmeAdi}' yazılamadı: ${sebep}`);
        return { oldu: false, sebep, deger: mevcut };
      };

      const d = dugmeBul(dugmeAdi);
      if (!d) return red("böyle bir düğme yok", null);

      const engel = kapi(d);
      if (engel) return red(engel, d);

      // Tip uyuşmazlığı: sayısal bir tele metin yazmak sessizce NaN üretir
      // ve modül günlerce bozuk çalışır. Karşılaştırma MEVCUT değerin
      // türüyle yapılır — tanımda ayrı bir "tur" alanı tutmak, tel ile
      // ayrışabilecek ikinci bir doğruluk kaynağı olurdu.
      let mevcut: Deger;
      try { mevcut = d.oku(); }
      catch (e) { return red(`okunamadı: ${e instanceof Error ? e.message : e}`, null); }
      if (typeof deger !== typeof mevcut) {
        return red(`tür uymuyor: ${typeof mevcut} bekleniyor`, d);
      }
      if (typeof deger === "number" && !Number.isFinite(deger)) {
        return red("sayı geçersiz", d);
      }
      if (typeof deger === "number" && d.aralik) {
        const { en, cok } = d.aralik;
        if (deger < en || deger > cok) {
          return red(`aralık dışı: ${en}–${cok}${d.birim ? " " + d.birim : ""}`, d);
        }
      }

      try { d.yaz!(deger); }
      catch (e) { return red(`yazma hatası: ${e instanceof Error ? e.message : e}`, d); }

      // Doğrulama okuma: yazdığımız değer GERÇEKTEN oturmuş mu. Tel yerine
      // kopya güncelleyen bir tanım burada yakalanır.
      let sonra: Deger | null = null;
      try { sonra = d.oku(); } catch { /* okuma hatası ayrı raporlanır */ }
      if (sonra !== deger) {
        console.warn(`[PANO] '${dugmeAdi}' yazıldı ama okuma ${String(sonra)} döndü`);
        return { oldu: false, sebep: "yazıldı ama değer oturmadı", deger: sonra };
      }
      console.log(`[PANO] ${dugmeAdi} = ${String(deger)}`);
      return { oldu: true, sebep: "", deger: sonra };
    },

    teyitIste(dugmeAdi, deger) {
      const simdi = Date.now();
      const d = dugmeBul(dugmeAdi);
      if (!d) return { oldu: false, sebep: "böyle bir düğme yok", deger: null };
      if (d.sinif === "olculmus" && !kilitAcik) {
        return { oldu: false, sebep: "ölçüm kilidi açılmalı", deger: null };
      }
      if (d.sinif !== "tehlikeli" && d.sinif !== "olculmus") {
        return { oldu: false, sebep: "bu düğme teyit istemiyor", deger: null };
      }
      if (typeof d.yaz !== "function") {
        return { oldu: false, sebep: "yazıcısı yok", deger: null };
      }
      if (teyitTaze(simdi)) {
        // Bekleyen EZİLEMEZ — onay kapısıyla aynı kural.
        return { oldu: false, sebep: `önce bekleyen teyit karara bağlanmalı (${bekleyen!.etiket})`, deger: null };
      }

      let eski: Deger;
      try { eski = d.oku(); }
      catch (e) { return { oldu: false, sebep: `okunamadı: ${e instanceof Error ? e.message : e}`, deger: null }; }
      if (typeof deger !== typeof eski) {
        return { oldu: false, sebep: `tür uymuyor: ${typeof eski} bekleniyor`, deger: eski };
      }
      if (typeof deger === "number" && !Number.isFinite(deger)) {
        return { oldu: false, sebep: "sayı geçersiz", deger: eski };
      }
      if (typeof deger === "number" && d.aralik && (deger < d.aralik.en || deger > d.aralik.cok)) {
        return { oldu: false, sebep: `aralık dışı: ${d.aralik.en}–${d.aralik.cok}`, deger: eski };
      }

      let uyari = "";
      try { uyari = d.uyari?.(deger) ?? ""; }
      catch (e) {
        // Uyarı hesabı çökerse teyit İPTAL edilir. Uyarısız bir tehlikeli
        // teyit, kullanıcıya boş bir onay kutusu göstermekle aynı şey.
        console.error(`[PANO] '${dugmeAdi}' uyarısı hesaplanamadı:`, e);
        return { oldu: false, sebep: "uyarı hesaplanamadı — teyit açılmadı", deger: eski };
      }

      bekleyen = {
        jeton: `t${++jetonSayaci}:${dugmeAdi}:${simdi}`,
        dugmeAdi, etiket: d.etiket, eski, yeni: deger, uyari,
        eylemler: (d.bagliEylemler ?? []).map((e) => ({
          ad: e.ad, etiket: e.etiket, aciklama: e.aciklama,
        })),
        sonTarih: simdi + TEYIT_OMRU_MS,
      };
      console.log(`[PANO] teyit istendi: ${dugmeAdi} ${String(eski)} -> ${String(deger)}`);
      return { oldu: false, sebep: "teyit bekleniyor", deger: eski };
    },

    bekleyenTeyit() {
      const t = teyitTaze(Date.now());
      return t ? { ...t } : null;
    },

    teyitIptal() {
      if (bekleyen) console.log(`[PANO] teyit iptal: ${bekleyen.dugmeAdi}`);
      bekleyen = null;
    },

    kilitAcikMi: () => kilitAcik,
    olcumDisi: () => olcumDisiDamgasi,
    kilitGerekcesi: () => kilitGerekce,
    kilitAc(gerekce) {
      const g = gerekce.trim();
      if (!g) {
        // Gerekçesiz açma, kilidi tek tuşluk bir formaliteye çevirirdi.
        console.warn("[PANO] ölçüm kilidi GEREKÇESİZ açılamaz");
        return false;
      }
      kilitAcik = true;
      olcumDisiDamgasi = true;
      kilitGerekce = g;
      // Denetim izi: bu satır, ölçümle seçilmiş bir sabitin ne zaman ve
      // neden elle değiştirilebilir kılındığının tek kaydı.
      console.warn(`[PANO] ÖLÇÜM KİLİDİ AÇILDI — gerekçe: ${g}`);
      return true;
    },
    kilitKapat() {
      if (kilitAcik) console.log("[PANO] ölçüm kilidi kapatıldı (damga kalıcı)");
      kilitAcik = false;
    },

    teyitliYaz(jeton, eylemAdlari = []) {
      const simdi = Date.now();
      const t = teyitTaze(simdi);
      if (!t) return { oldu: false, sebep: "bekleyen teyit yok ya da süresi doldu", deger: null };
      // Jeton eşleşmesi: panelde görülen teyit ile onaylanan teyit AYNI
      // olmalı. Bayat bir jetonla onaylamak, başka bir cümleye bakarak
      // onaylamaktır.
      if (jeton !== t.jeton) {
        return { oldu: false, sebep: "jeton eşleşmiyor — teyidi yeniden iste", deger: null };
      }

      const d = dugmeBul(t.dugmeAdi);
      if (!d || typeof d.yaz !== "function") {
        bekleyen = null;
        return { oldu: false, sebep: "düğme kayboldu", deger: null };
      }

      try { d.yaz(t.yeni); }
      catch (e) {
        bekleyen = null;
        return { oldu: false, sebep: `yazma hatası: ${e instanceof Error ? e.message : e}`, deger: null };
      }

      let sonra: Deger | null = null;
      try { sonra = d.oku(); } catch { /* ayrı raporlanır */ }
      if (sonra !== t.yeni) {
        bekleyen = null;
        return { oldu: false, sebep: "yazıldı ama değer oturmadı", deger: sonra };
      }

      // Bağlı eylemler YAZMADAN SONRA ve YALNIZCA seçilenler. Ayarın yan
      // etkisi değiller: kullanıcı ikisini ayrı ayrı istemiş olmalı.
      const kosan: string[] = [];
      for (const e of d.bagliEylemler ?? []) {
        if (!eylemAdlari.includes(e.ad)) continue;
        try { e.calistir(); kosan.push(e.ad); }
        catch (hata) { console.error(`[PANO] eylem '${e.ad}' çöktü:`, hata); }
      }

      bekleyen = null;
      console.log(`[PANO] teyitli yazma: ${t.dugmeAdi} = ${String(t.yeni)}` +
        (kosan.length ? ` + eylem[${kosan.join(",")}]` : ""));
      return { oldu: true, sebep: "", deger: sonra };
    },
    goruntu(dugumAdi) {
      const secilen = dugumAdi === undefined ? moduller : dugumun(dugumAdi);
      return secilen.map((m) => ({
        ad: m.ad, etiket: m.etiket, dugum: m.dugum,
        dugmeler: m.dugmeler.map(oku),
      }));
    },
  };
}
