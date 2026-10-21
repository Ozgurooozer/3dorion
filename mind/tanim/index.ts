// mind/tanim/*.ts — modüllerin DEVRE PANOSU tanımları.
//
// NEDEN MODÜLLERİN İÇİNDE DEĞİL: tanım, modülün değil modüle BAKIŞIN
// özelliğidir. `Dikkat` sınıfının içine koysaydık `mind/dikkat.ts` panoyu
// bilmek zorunda kalırdı; bugün hiçbiri bilmiyor ve pano olmadan da
// çalışmalılar. Burada ilişki tek yönlü: tanım modülü görür, modül tanımı
// görmez.
//
// Her tanım bir ÖRNEK alır, değer değil. Böylece `oku()` çağrıldığı anda
// canlı durumu okur — panonun önbellek tutması yapısal olarak imkânsız kalır.
"use strict";
import type { Modul, Dugme, Deger, Tel } from "../../protocol/pano.ts";
import type { Dikkat } from "../dikkat.ts";
import type { Ani, Hafiza } from "../hafiza.ts";
import type { Ajanda } from "../ajanda.ts";
import type { OnayKapisi } from "../onayKapisi.ts";
import { BOZULMA } from "../hafiza.ts";
import { UZUN_ISLEM_MS } from "../refleks.ts";
import { OTO_ARALIK_DK_ARALIGI, OTO_ARALIK_MS, OTO_ESIK, OTO_ESIK_ARALIGI } from "../sikistir.ts";
import { MD_DOSYA_ARALIGI, MD_SINIRLARI, MD_TOPLAM_ARALIGI } from "../mdBaglami.ts";

/**
 * Yazılabilir ayarların telleri.
 *
 * Tanım fonksiyonları bunları İSTEĞE BAĞLI alır: tel verilmezse düğme
 * modülün getter'ından okunur ve SALT OKUNUR kalır. Böylece pano, telsiz
 * kurulumda (testler, senaryolar) da çalışır ve yazma yolu yalnızca
 * kompozisyon kökü bilerek tel taktığında açılır.
 */
export interface DikkatTelleri {
  tekrar?: Tel<number>;
  terminalKis?: Tel<number>;
  /** `tehlikeli`: iki aşamalı teyitten geçer. */
  azami?: Tel<number>;
}
export interface HafizaTelleri {
  kapasite?: Tel<number>;
  /** Otomatik sıkıştırma: ham anı sayısı bu eşiği aşınca (varsayılan 100). */
  otoEsik?: Tel<number>;
  /** Otomatik sıkıştırma: iki sıkıştırma arası en az bu kadar dakika (varsayılan 15). */
  otoAralikDk?: Tel<number>;
  /** Orion'un md notlarının (Hafıza sekmesi) bağlama giren TOPLAM karakter bütçesi (varsayılan 5000). */
  mdToplam?: Tel<number>;
  /** Tek md notunun bağlama giren en çok karakteri (varsayılan 2000; anlık hafıza hariç). */
  mdDosya?: Tel<number>;
  /**
   * Elle unutma (duvardan). Verilmezse `hafiza.unut` düğmesi HİÇ kurulmaz: yedeksiz silme yok.
   * `yedekle` fırlatırsa anı silinmez; `kaydet` silmeden sonra diske hemen yazar (3 sn'lik kısma beklenmez).
   */
  unut?: { yedekle(aniler: Ani[]): void; kaydet(): void };
}
export interface OnayTelleri {
  zamanAsimi?: Tel<number>;
}
export interface AjandaTelleri {
  asgari?: Tel<number>;
  sapma?: Tel<number>;
}

/**
 * Tel varsa oku+yaz, yoksa yalnız oku.
 *
 * Tek satırda toplanması önemli: her düğmede elle `yaz: t?.yaz` yazsaydık
 * bir yerde unutmak, o düğmeyi sessizce salt okunur bırakırdı — panelde
 * "AYAR" rozetiyle görünüp değişmeyen bir düğme.
 */
function bagla(
  temel: Omit<Dugme, "oku">, yedekOku: () => number, t?: Tel<number>,
): Dugme {
  return t ? { ...temel, oku: t, yaz: (d) => t.yaz(d as number) }
           : { ...temel, oku: yedekOku };
}

/**
 * DİKKAT — maliyet tavanı.
 *
 * `tik` yasağı burada SABİT olarak ilan ediliyor. Görünmeyen bir güvenlik
 * teli savunulamaz: panoda çizili olmadığı sürece kimse onun varlığını
 * bilmez, dolayısıyla kaybolduğunu da fark etmez.
 */
export function dikkatTanimi(d: Dikkat, teller: DikkatTelleri = {}): Modul {
  const dugmeler: Dugme[] = [
    { ad: "dikkat.tik_yasagi", etiket: "tik beyne gidemez", sinif: "sabit", etki: "aninda",
      oku: () => true,
      aciklama: "20 Hz tik algısı beyin kanalına ASLA giremez. protokol.test.ts kilitler; panelden kapatılamaz." },
    { ad: "dikkat.pencere", etiket: "bütçe penceresi", sinif: "sabit", etki: "aninda",
      birim: "sn", oku: () => 60,
      aciklama: "Bütçe 60 saniyelik kayan pencereyle ölçülür. Sabit olarak çizili: tavanı düşürünce gecikme buradan gelir, arıza sanılmasın." },
    bagla({ ad: "dikkat.azami", etiket: "dakikada azami", sinif: "tehlikeli", etki: "sonraki_tur",
      birim: "mesaj", aralik: { en: 1, cok: 120 }, adim: 5,
      aciklama: "Beyne dakikada gidebilecek mesaj tavanı. Düşürmek, 60 sn'lik pencere dönene kadar beyni susturur.",
      // CANLI uyarı: sabit bir cümle ("beyin susabilir") bilgi değil
      // temennidir. Kullanıcının bilmesi gereken, ŞU ANKİ pencereye göre
      // ne kadar süre susacağıdır.
      uyari: (yeni) => {
        const simdiki = d.penceredekiMesaj;
        const hedef = yeni as number;
        if (simdiki < hedef) return `pencerede ${simdiki} mesaj var; ${hedef} tavanı hemen etkilemez.`;
        // 60 sn'lik kayan pencere: en eski mesaj düşene kadar yeni tavan
        // altına inilemez. Kaba ama dürüst bir üst sınır.
        const sn = Math.round(60 * (simdiki - hedef + 1) / Math.max(1, simdiki));
        return `pencerede ${simdiki} mesaj var; ${hedef}'a düşürürsen ~${sn} sn beyne hiçbir şey gitmez.`;
      },
      bagliEylemler: [{
        ad: "dikkat.sifirla", etiket: "pencereyi sıfırla",
        aciklama: "Bütçe penceresini boşaltır; yeni tavan hemen geçerli olur.",
        calistir: () => d.sifirla(),
      }] },
      () => d.azami, teller.azami),
    bagla({ ad: "dikkat.tekrar", etiket: "tekrar penceresi", sinif: "guvenli", etki: "aninda",
      birim: "ms", aralik: { en: 0, cok: 30000 }, adim: 500,
      aciklama: "Aynı olayın bu süre içindeki tekrarı yutulur. Büyütmek gürültüyü keser, küçültmek tepkiyi artırır." },
      () => d.tekrarPenceresiMs, teller.tekrar),
    bagla({ ad: "dikkat.terminal_kis", etiket: "terminal kısma", sinif: "guvenli", etki: "aninda",
      birim: "ms", aralik: { en: 0, cok: 30000 }, adim: 500,
      aciklama: "Terminal çıktısı bu sıklıktan daha sık beyne gönderilmez." },
      () => d.terminalKisMs, teller.terminalKis),
    { ad: "dikkat.penceredeki", etiket: "pencerede şu an", sinif: "sabit", etki: "aninda",
      birim: "mesaj", oku: () => d.penceredekiMesaj,
      aciklama: "Ölçüm, ayar değil: tavanı düşürmenin şu anda ne kadar susturacağını bu sayı söyler." },
    { ad: "dikkat.gecen", etiket: "geçen / düşen", sinif: "sabit", etki: "aninda",
      oku: () => { const s = d.sayac(); return `${s.gecen} / ${s.dusen}`; },
      aciklama: "Kurulduğundan beri beyne geçen ve süzülen algı sayısı. S5 kapısı bu sayıdaki değişimi ister." },
  ];
  return { ad: "dikkat", etiket: "DİKKAT", dugum: "dikkat", dugmeler };
}

/**
 * ANIYI UNUT: duvarda seçili anıyı elle silmek. Değer = anının tam metni (kimlik). `tehlikeli` olduğundan her silme iki
 * aşamalı teyitten geçer; uyarı İSTEK ANINDA anının kendisini söyler. Silmeden ÖNCE yedek (fırlatırsa silinmez), sonra
 * diske hemen yazılır. Okuma değeri "son unutulan": `teyitliYaz` yazdığı değerin geri okunmasını ister.
 */
function unutDugmesi(h: Hafiza, u: NonNullable<HafizaTelleri["unut"]>): Dugme {
  let son = "—";
  const bul = (metin: string) => h.dok().find((a) => a.metin === metin);
  return {
    ad: "hafiza.unut", etiket: "anıyı unut", sinif: "tehlikeli", etki: "aninda",
    oku: () => son,
    yaz: (deger) => {
      const metin = String(deger);
      const ani = bul(metin);
      if (!ani) throw new Error("böyle bir anı yok (zaten silinmiş olabilir)");
      u.yedekle(h.dok());
      h.unut(metin);
      son = metin;
      u.kaydet();
      console.log(`[PANO] anı unutuldu: "${metin}" (${ani.tur}, önem ${ani.onem})`);
    },
    aciklama: "Duvarda seçtiğin tek anıyı siler. Geri alınamaz; silmeden önce hafıza yedeği alınır (son 5 yedek tutulur).",
    uyari: (yeni) => {
      const ani = bul(String(yeni));
      if (!ani) return "böyle bir anı yok; silinecek bir şey kalmadı.";
      const olgu = ani.tur === "olgu" ? " Bu bir OLGU (damıtılmış kalıcı bilgi)." : "";
      return `"${ani.metin}" (${ani.tur}, önem ${ani.onem}) KALICI olarak silinir.${olgu} Önce yedek alınır.`;
    },
  };
}

/** HAFIZA — Generative Agents skorlaması. Sabitleri ÖLÇÜMLE seçildi. */
export function hafizaTanimi(h: Hafiza, teller: HafizaTelleri = {}): Modul {
  const dugmeler: Dugme[] = [
    { ad: "hafiza.bozulma", etiket: "bozulma katsayısı", sinif: "olculmus", etki: "aninda",
      oku: () => BOZULMA, kaynak: "Generative Agents (Park ve ark. 2023) — saat başına 0.995",
      aciklama: "Anının tazeliği saat başına bu oranla söner. Kaynaklı sabit; sezgiyle oynanmaz." },
    { ad: "hafiza.yansima_esigi", etiket: "yansıma eşiği", sinif: "olculmus", etki: "sonraki_tur",
      birim: "önem", oku: () => 150, kaynak: "Generative Agents — biriken önem 150",
      aciklama: "Biriken önem bu değeri aşınca Orion geçmişi üzerine düşünür." },
    bagla({ ad: "hafiza.kapasite", etiket: "kapasite", sinif: "tehlikeli", etki: "sonraki_tur",
      birim: "anı", aralik: { en: 20, cok: 5000 }, adim: 25,
      aciklama: "Aşılınca en düşük skorlu anılar atılır. Düşürmek KALICI: silinen anı geri gelmez.",
      uyari: (yeni) => {
        const fazla = h.sayi - (yeni as number);
        return fazla > 0
          ? `${h.sayi} anı var; budarsan ${fazla} tanesi KALICI olarak silinir.`
          : `${h.sayi} anı var; yeni kapasite hiçbir anıyı silmez.`;
      },
      // Budama AYRI eylem: sürgüyü sürüklerken her ara değerde anı silmek
      // geri alınamaz bir hatayı kaza eseri yapılabilir kılardı.
      bagliEylemler: [{
        ad: "hafiza.buda", etiket: "şimdi buda",
        aciklama: "Kapasite fazlasını HEMEN siler. Geri alınamaz.",
        calistir: () => { const n = h.buda(); console.log(`[PANO] ${n} anı budandı`); },
      }] },
      () => h.kapasite, teller.kapasite),
    // BAĞLAMI ŞİŞİRMEME ayarları (Ozyn, 2026-10-21). Orion hafızadan YALNIZ SORULANI bağlama getirir (spec 16); şişiren iki şey var: biriken ham anılar
    // (otomatik sıkıştırma onları özete indirir) ve her turda giden md notları (bütçe). İkisi de güvenli ayar: sıkıştırma yedek alır, bütçe yalnız kesme noktasını oynatır.
    bagla({ ad: "hafiza.oto_esik", etiket: "otomatik sıkıştırma eşiği", sinif: "guvenli", etki: "sonraki_tur",
      birim: "ham anı", aralik: { ...OTO_ESIK_ARALIGI }, adim: 10,
      aciklama: "Ham kayıt (konuşma, olay, terminal…) sayısı bunu aşınca ve beyin boştayken eski olanlar tek özete iner (yedek alınır; en yeni 30 ve son 1 saat korunur). Düşürmek bağlamı küçük tutar, ayrıntıyı erken özete indirir." },
      () => OTO_ESIK, teller.otoEsik),
    bagla({ ad: "hafiza.oto_aralik", etiket: "sıkıştırma arası", sinif: "guvenli", etki: "sonraki_tur",
      birim: "dk", aralik: { ...OTO_ARALIK_DK_ARALIGI }, adim: 5,
      aciklama: "İki otomatik sıkıştırma arasındaki en kısa süre. Her sıkıştırma bir model çağrısıdır: çok kısa süre maliyeti artırır." },
      () => OTO_ARALIK_MS / 60_000, teller.otoAralikDk),
    bagla({ ad: "hafiza.md_toplam", etiket: "md notları bütçesi", sinif: "guvenli", etki: "sonraki_tur",
      birim: "karakter", aralik: { ...MD_TOPLAM_ARALIGI }, adim: 500,
      aciklama: "Aktif md notlarının (Hafıza sekmesi) her turda bağlama giren toplam karakteri; sığmayan not girmez ve kartta uyarı çıkar. Anlık hafıza bu bütçeye girmez (kendi emniyet tavanı var)." },
      () => MD_SINIRLARI.toplam, teller.mdToplam),
    bagla({ ad: "hafiza.md_dosya", etiket: "tek not sınırı", sinif: "guvenli", etki: "sonraki_tur",
      birim: "karakter", aralik: { ...MD_DOSYA_ARALIGI }, adim: 200,
      aciklama: "Tek bir md notundan bağlama en çok bu kadar karakter girer (fazlası kesilir, kartta 'kesildi' yazar)." },
      () => MD_SINIRLARI.dosyaBasina, teller.mdDosya),
    ...(teller.unut ? [unutDugmesi(h, teller.unut)] : []),
    { ad: "hafiza.sayi", etiket: "şu anki anı", sinif: "sabit", etki: "aninda",
      birim: "anı", oku: () => h.sayi,
      aciklama: "Ölçüm: kapasiteyi düşürmenin kaç anıyı sileceğini bu sayıyla karşılaştır." },
    { ad: "hafiza.biriken", etiket: "biriken önem", sinif: "sabit", etki: "aninda",
      oku: () => Math.round(h.birikenOnem),
      aciklama: "Yansıma eşiğine ne kadar kaldığını gösterir." },
  ];
  return { ad: "hafiza", etiket: "HAFIZA", dugum: "hafiza", dugmeler };
}

/** ONAY KAPISI — projenin merkezi güvenlik vaadi. */
export function onayTanimi(o: OnayKapisi, teller: OnayTelleri = {}): Modul {
  const dugmeler: Dugme[] = [
    { ad: "onay.zorunlu", etiket: "komut onaysız çalışmaz", sinif: "sabit", etki: "aninda",
      oku: () => true,
      aciklama: "Her komut önerisi onay kapısından geçer. Orion çalıştırmaz; çalıştıran şey Ozyn'in tuşudur. Panelden kapatılamaz." },
    { ad: "onay.ezilmez", etiket: "bekleyen ezilemez", sinif: "sabit", etki: "aninda",
      oku: () => true,
      aciklama: "Bekleyen bir öneri varken ikincisi onun yerine geçemez — okuduğun öneri, basacağın öneridir." },
    bagla({ ad: "onay.zaman_asimi", etiket: "zaman aşımı", sinif: "tehlikeli", etki: "sonraki_tur",
      birim: "ms", aralik: { en: 5000, cok: 600000 }, adim: 5000,
      aciklama: "Karara bağlanmayan öneri bu süre sonunda DÜŞER. Bekleyenin son tarihi öneri anında donduğundan değişiklik yalnızca SONRAKİ öneriye uygular.",
      uyari: () => o.durum === "bekliyor"
        ? "Şu an bekleyen bir öneri var. Son tarihi öneri anında donduğu için bu değişiklik ONU ETKİLEMEZ — özgün süresine kadar yaşar."
        : "Bekleyen öneri yok; değişiklik ilk yeni öneride geçerli olur." },
      () => o.zamanAsimiMs, teller.zamanAsimi),
    { ad: "onay.durum", etiket: "kapı durumu", sinif: "sabit", etki: "aninda",
      oku: () => o.durum,
      aciklama: "Şu an bekleyen bir öneri var mı." },
    { ad: "onay.sayac", etiket: "onay / ret / düşen", sinif: "sabit", etki: "aninda",
      oku: () => { const s = o.sayac(); return `${s.onaylanan} / ${s.reddedilen} / ${s.dusen}`; },
      aciklama: "Denetim izi özeti. Elle düşürülenler ayrı sayılır, asla onay sayılmaz." },
  ];
  return { ad: "onay", etiket: "ONAY KAPISI", dugum: "onay", dugmeler };
}

/** AJANDA — boşta davranış. */
export function ajandaTanimi(a: Ajanda, teller: AjandaTelleri = {}): Modul {
  const dugmeler: Dugme[] = [
    bagla({ ad: "ajanda.asgari", etiket: "asgari aralık", sinif: "guvenli", etki: "sonraki_tur",
      birim: "ms", aralik: { en: 3000, cok: 300000 }, adim: 1000,
      aciklama: "İki boşta önerisi arasındaki en kısa süre. Bekleme hesabı bir sonraki turda yapılır." },
      () => a.asgariAralikMs, teller.asgari),
    bagla({ ad: "ajanda.sapma", etiket: "azami sapma", sinif: "guvenli", etki: "sonraki_tur",
      birim: "ms", aralik: { en: 0, cok: 300000 }, adim: 1000,
      aciklama: "Asgariye eklenen determinist uzatma tavanı — hareket makine gibi ritmik olmasın." },
      () => a.azamiSapmaMs, teller.sapma),
    { ad: "ajanda.capa", etiket: "bakılacak çapa", sinif: "sabit", etki: "aninda",
      birim: "adet", oku: () => a.capaSayisi,
      aciklama: "Boştayken bakılabilecek nokta sayısı." },
    { ad: "ajanda.oneri", etiket: "üretilen öneri", sinif: "sabit", etki: "aninda",
      oku: () => a.oneriSayisi(),
      aciklama: "Kurulduğundan beri kaç boşta davranışı üretildi." },
  ];
  return { ad: "ajanda", etiket: "AJANDA", dugum: "beden", dugmeler };
}

export interface RefleksTelleri {
  /**
   * Doğuştan komut programları (içgüdü `kopru.komut`, spec 13 Faz 2b) açık mı. Verilmezse düğme HİÇ kurulmaz (eski pano birebir aynı).
   * Değer köprüye aynı telle gider (`KopruAyari.komutYetkisi`): panel ile karar yolu aynı nesneyi okur.
   */
  komut?: Tel<boolean>;
}

/** REFLEKS — sağ lob, kural tabanlı hızlı tepki. */
export function refleksTanimi(teller: RefleksTelleri = {}): Modul {
  const komut = teller.komut;
  const dugmeler: Dugme[] = [
    // GÜVENLİ sınıfta: kapatmak yalnız LLM'i atlayan yolu kapatır (söz LLM'e gider: daha yavaş, token harcar); açmak açılıştaki ölçülmüş varsayılandır
    // (62 gerçek sözde yanlış eşleşme 0). Kalıcı DEĞİL: her açılış ölçülmüş varsayılana döner (senaryolarda kapalı) — elle kapatılmış bir anahtar
    // haftalar sonra "Orion neden yavaş" diye sessizce kalmasın (spec 34).
    ...(komut ? [{ ad: "refleks.dogustan_komut", etiket: "doğuştan komutlar", sinif: "guvenli" as const, etki: "sonraki_tur" as const,
      oku: komut, yaz: (d: Deger) => komut.yaz(d === true),
      aciklama: "Kesin söz doğuştan bir programa TAM uyuyorsa (otur, bana gel, pencereye bak, bilgisayarı aç) LLM uyanmaz, adımlar sırayla yürür (içgüdü kopru.komut). Kapalıyken aynı söz LLM'e gider. Bu oturum için; açılışta varsayılana döner." }] : []),
    { ad: "refleks.uzun_islem", etiket: "uzun işlem eşiği", sinif: "olculmus", etki: "aninda",
      birim: "ms", oku: () => UZUN_ISLEM_MS,
      kaynak: "tools/refleks-olcum.ts — komut süre dağılımı",
      aciklama: "Bu süreyi aşan komut uzun sürmüş sayılır ve tepkisi değişir." },
    { ad: "refleks.kanal", etiket: "yerel kanalda kalır", sinif: "sabit", etki: "aninda",
      oku: () => true,
      aciklama: "Refleks kararı beyne hiç uğramaz; maliyeti sıfır tutan şey budur." },
  ];
  return { ad: "refleks", etiket: "REFLEKS", dugum: "refleks", dugmeler };
}

/**
 * DÜŞÜNCE — dış model.
 *
 * Diğerlerinden farklı olarak bir SINIF örneği değil, üç okuyucu alır:
 * koşan beyin `giris.ts`'te devre kesici ve kota durumuyla birlikte
 * yönetiliyor ve o durum tek bir nesnede toplanmış değil. Sahte bir nesne
 * uydurmak yerine tel doğrudan oradan çekiliyor.
 */
export function beyinTanimi(kaynaklar: {
  ad: () => string;
  kesikSaniye: () => number;
  yakinlikKurali: () => boolean;
  /**
   * Beyin SEÇİCİSİ. Verilmezse `beyin.model` salt okunur kalır.
   *
   * Sınıf değil düz fonksiyonlar: `mind/` → `bridge/` bağımlılığı yok ve
   * olmamalı. Kompozisyon kökü `SecilebilirBeyin`i bu biçime çevirir.
   */
  secim?: {
    /** Kullanıcının en son seçtiği (sağlık kontrolü sürerken hedef). */
    istenen: () => string;
    /** Geçiş iste; `""` = kabul, aksi hâlde red sebebi. */
    iste: (ad: string) => string;
    secenekler: () => readonly string[];
    /** Gerçekten koşan beyin + geçiş durumu, tek satır. */
    durum: () => string;
  };
}): Modul {
  const s = kaynaklar.secim;
  const dugmeler: Dugme[] = [
    s
      ? { ad: "beyin.model", etiket: "seçili beyin", sinif: "tehlikeli", etki: "sonraki_tur",
          oku: s.istenen, secenekler: s.secenekler,
          // Ret FIRLATILIR: pano yazıcı hatasını sebebiyle gösterir. Sessiz
          // dönseydi pano "yazıldı ama değer oturmadı" der, asıl neden
          // ("geçiş sürüyor") kaybolurdu.
          yaz: (d) => { const red = s.iste(String(d)); if (red) throw new Error(red); },
          uyari: (yeni) =>
            `Şu an ${kaynaklar.ad()} düşünüyor. ${String(yeni)} beynine geçince mevcut ` +
            `oturumun sohbet geçmişi yeni beyne TAŞINMAZ. Geçiş önce sağlık ` +
            `kontrolünden geçer; geçemezse mevcut beyin kalır. Süren düşünce eski beyinde biter.`,
          aciklama: "Düşünceyi hangi beynin üreteceği. Geçiş tur sınırında olur, yarım düşünce bölünmez." }
      : { ad: "beyin.model", etiket: "koşan beyin", sinif: "tehlikeli", etki: "yeniden_kurulum",
          oku: kaynaklar.ad,
          aciklama: "Şu an düşünceyi üreten model/ajan. Değiştirmek beynin yeniden kurulmasını gerektirir." },
    ...(s ? [{ ad: "beyin.aktif", etiket: "gerçekten koşan", sinif: "sabit" as const, etki: "aninda" as const,
          oku: s.durum,
          aciklama: "Seçilen ile koşan ayrı gösterilir: sağlık kontrolü sürerken ya da reddedilince ikisi farklıdır." }] : []),
    { ad: "beyin.kesik", etiket: "devre kesici", sinif: "sabit", etki: "aninda",
      birim: "sn", oku: kaynaklar.kesikSaniye,
      aciklama: "Üst üste arızadan sonra beyin geçici kapanır. 0 = açık. Ölçüm, ayar değil." },
    { ad: "beyin.yakinlik", etiket: "yakınlık kuralı", sinif: "sabit", etki: "aninda",
      oku: kaynaklar.yakinlikKurali,
      aciklama: "Tahtaya uzaktan yazılamaz; Orion önce yürümek zorunda. Panelden kapatılamaz." },
  ];
  return { ad: "beyin", etiket: "DÜŞÜNCE", dugum: "beyin", dugmeler };
}
