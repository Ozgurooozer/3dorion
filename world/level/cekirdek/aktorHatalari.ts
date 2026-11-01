// world/level/cekirdek/aktorHatalari.ts — AKTÖR / BLUEPRINT ALTYAPISININ HATA KODLARI (spec 45 §13). SAF: Babylon, DOM ve bağımlılık YOK.
//
// Amaç: bir şey ters gidince "nerede, neden" tek bakışta anlaşılsın. Her hata `AKT-<ALAN>-<NNN>` kodu taşır ve mesaj `[KOD] ayrıntı` biçimindedir:
//   • graf düğümü hatası, günlük satırı, test çıktısı ve konsol AYNI kodu gösterir (grep'lenebilir);
//   • kod ALANI hatanın hangi katmanda doğduğunu söyler (olay yolu, bağ/soket, hareket, tetik, graf düğümü, yetenek, çalışma zamanı);
//   • katalogdaki `cozum` sütunu "şimdi ne yapayım"ı söyler (günlük/hata ayıklama çıktısı bunu da basar).
// Kod ASLA yeniden kullanılmaz/yeniden numaralanmaz (günlüklerde eski kodlar kalabilir); kullanılmayan kod ve katalogda olmayan kod BEKÇİ ile yakalanır
// (`uygulama/aktor/aktorHataBekcisi.test.ts`). Yeni hata = önce buraya satır, sonra kodu kullan.
"use strict";

export type AktorAlani = "OLY" | "BAG" | "HRK" | "DUG" | "YTN" | "ZMN" | "BYR" | "SEM" | "SBL" | "BIL" | "TSL" | "ISK";

/** Alan → okunur ad (günlük ve hata ayıklama çıktısı). */
export const AKTOR_ALANLARI: Readonly<Record<AktorAlani, string>> = {
  OLY: "olay yolu", BAG: "üst/soket bağı", HRK: "hareket bileşeni", DUG: "graf düğümü",
  YTN: "aktör yeteneği", ZMN: "çalışma zamanı", BYR: "bayrak/ayar", SEM: "bileşen şeması", SBL: "aktör şablonu", BIL: "bileşen düzenleme", TSL: "Orion taslağı", ISK: "ışık bileşeni",
};

export interface HataKaydi { readonly alan: AktorAlani; readonly anlam: string; readonly cozum: string }

export const AKTOR_HATALARI = {
  // ── olay yolu (aktorOlayYolu.ts) ──
  "AKT-OLY-001": { alan: "OLY", anlam: "olay adı geçersiz", cozum: "olay adı harf/rakam/_/-/. içermeli ve ≤ 64 karakter olmalı" },
  "AKT-OLY-002": { alan: "OLY", anlam: "olay verisi geçersiz", cozum: "veri ≤ 8 alan; değerler sayı, ≤ 200 karakter metin ya da doğru/yanlış olmalı" },
  "AKT-OLY-003": { alan: "OLY", anlam: "aktör adresi geçersiz", cozum: "aktör kimliği boş olmayan metin (≤ 64) olmalı" },
  "AKT-OLY-004": { alan: "OLY", anlam: "olay zinciri derinlik tavanını aştı (olay olayı doğuruyor)", cozum: "döngüye giren olay/graf zincirini bul: A olayı B'yi, B de A'yı yayınlıyor olabilir" },
  "AKT-OLY-005": { alan: "OLY", anlam: "kare başına olay tavanı aşıldı", cozum: "bir karede yüzlerce olay yayınlayan graf/bileşen var: tetik sınırında titreyen aktör ya da döngü" },
  "AKT-OLY-006": { alan: "OLY", anlam: "olay dinleyicisi hata verdi (öteki dinleyiciler etkilenmez)", cozum: "ilgili ⚡ grafın çalışma günlüğüne bak; hata mesajı ayrıntıda" },
  "AKT-OLY-007": { alan: "OLY", anlam: "aktör olay yolu kurulu değil", cozum: "level açık değil ya da senaryo/test dünyası: olay yolu levelBaglantisi'nda kurulur" },
  // ── üst / soket bağı (hiyerarşi) ──
  "AKT-BAG-001": { alan: "BAG", anlam: "çalışma zamanı komutu: aktör level'da yok", cozum: "kimliği Outliner'dan doğrula; aktör silinmiş ya da henüz eklenmemiş olabilir" },
  "AKT-BAG-002": { alan: "BAG", anlam: "üst aktör level'da yok", cozum: "üst kimliğini Outliner'dan doğrula ('beden:<ad>' bedenler içindir)" },
  "AKT-BAG-003": { alan: "BAG", anlam: "aktör kendi üstü olamaz", cozum: "üst olarak başka bir aktör seç" },
  "AKT-BAG-004": { alan: "BAG", anlam: "hiyerarşide döngü", cozum: "üstün zaten bu aktörün altında; bağı ters kur ya da önce ayır" },
  "AKT-BAG-005": { alan: "BAG", anlam: "hiyerarşi derinlik sınırını aştı (en çok 4 kat)", cozum: "hiyerarşiyi düzleştir" },
  "AKT-BAG-006": { alan: "BAG", anlam: "beden adı boş ('beden:' sonrası ad yok)", cozum: "'beden:orion' gibi yaz" },
  "AKT-BAG-007": { alan: "BAG", anlam: "beden soketi adı verilmedi", cozum: "soket adı ver (örn. el_sag)" },
  "AKT-BAG-008": { alan: "BAG", anlam: "bedende böyle bir soket yok", cozum: "beden ve soket adını kontrol et; beden henüz kurulmamış olabilir" },
  "AKT-BAG-009": { alan: "BAG", anlam: "üst aktörde böyle bir soket bileşeni yok", cozum: "Details ▸ Bileşenler ▸ Soket ekle ya da soket adını düzelt" },
  "AKT-BAG-010": { alan: "BAG", anlam: "aktör bir üste bağlı değil", cozum: "önce sokete_tak; ya da bu düğümü atla" },
  "AKT-BAG-011": { alan: "BAG", anlam: "bağ çözülemedi: üst aktör henüz sahnede değil", cozum: "üst nesnenin modeli yüklenemedi ya da gizli/silinmiş olabilir; konsolda [nesneler] yükleme hatasına bak" },
  "AKT-BAG-012": { alan: "BAG", anlam: "bağ çözülemedi: beden soketi bulunamadı", cozum: "beden (Orion/Flash) kurulu ve soket adı iskeletinde tanımlı mı?" },
  "AKT-BAG-013": { alan: "BAG", anlam: "bağ çözülemedi: üstte tanımlı soket yok", cozum: "level tanımındaki soket adı ile üstün Soket bileşeni uyuşmuyor" },
  // ── hareket bileşeni ──
  "AKT-HRK-001": { alan: "HRK", anlam: "aktörün hareket bileşeni yok", cozum: "Details ▸ Bileşenler'den 'Hareket' ekle" },
  "AKT-HRK-002": { alan: "HRK", anlam: "hareket komutu sonlu sayı değil", cozum: "hız ve dönüş sayı olmalı (NaN/∞ olamaz); bağlı pinin değerine bak" },
  "AKT-HRK-003": { alan: "HRK", anlam: "hız azami hızı aşıyor", cozum: "hızı azaltın ya da Hareket bileşeninin azamiHiz alanını artır" },
  "AKT-HRK-004": { alan: "HRK", anlam: "dönüş hızı azami dönme hızını aşıyor", cozum: "dönüşü azaltın ya da donmeHizi alanını artır" },
  "AKT-HRK-005": { alan: "HRK", anlam: "hareket edemez: nesne henüz yüklenmedi (ya da ışık)", cozum: "nesnenin modeli yüklenince dene; ışıklar hareket etmez" },
  // (tetik bileşeninin 'kim'/şekil değerlerini şema zaten reddeder: ayrı tetik kodu gerekmedi; çalışma zamanı hatası AKT-ZMN-001 `tetik` kategorisiyle gelir)
  // ── graf düğümü ──
  "AKT-DUG-001": { alan: "DUG", anlam: "olay adı verilmedi", cozum: "düğümün 'olay' ayarını doldur" },
  "AKT-DUG-002": { alan: "DUG", anlam: "olay adı geçersiz (graf yerleşik noktalı olayları yayınlayamaz)", cozum: "harf, rakam, _ ve - kullan; nokta yok" },
  "AKT-DUG-003": { alan: "DUG", anlam: "yön geçersiz", cozum: "aktor, ust ya da alt seç" },
  "AKT-DUG-004": { alan: "DUG", anlam: "değer türü uygun değil", cozum: "sayı, metin ya da doğru/yanlış bağla; pin türünü kontrol et" },
  "AKT-DUG-005": { alan: "DUG", anlam: "bu dünyada aktör yeteneği yok", cozum: "level açık değil ya da senaryo dünyası" },
  "AKT-DUG-006": { alan: "DUG", anlam: "bu dünyada aktör olay yolu yok", cozum: "level açık değil ya da senaryo dünyası" },
  "AKT-DUG-007": { alan: "DUG", anlam: "bu dünyada aktör hiyerarşisi yok", cozum: "level açık değil ya da senaryo dünyası" },
  "AKT-DUG-008": { alan: "DUG", anlam: "sıra geçersiz", cozum: "0 ya da daha büyük tam sayı ver" },
  "AKT-DUG-009": { alan: "DUG", anlam: "dinlenecek aktör seçilmedi", cozum: "⚡ düğümün 'aktor' ayarına kimlik yaz" },
  "AKT-DUG-010": { alan: "DUG", anlam: "'@bu' dinlemede çözülemez", cozum: "⚡ girişte açık aktör kimliği yaz ('@bu' yalnız Details'ten ▶ ile çalışan graflarda)" },
  "AKT-DUG-011": { alan: "DUG", anlam: "olay düğümü yalnız kendi olayıyla başlar", cozum: "grafı ⚡ dinlemeye al; ▶ olay düğümünden başlamaz" },
  "AKT-DUG-012": { alan: "DUG", anlam: "üst verilmedi", cozum: "düğümün 'ust' ayarını doldur (aktör kimliği, '@bu' ya da 'beden:<ad>')" },
  "AKT-DUG-013": { alan: "DUG", anlam: "'@bu' çözülemez: graf bir aktörün Details'inden başlatılmadı", cozum: "Details ▸ ▶ ile çalıştır ya da aktör kimliğini ayara yaz" },
  "AKT-DUG-014": { alan: "DUG", anlam: "hız/dönüş sayı değil", cozum: "sayı pini bağla ya da ayarı sayı yap" },
  "AKT-DUG-015": { alan: "DUG", anlam: "bu dünyada aktör çalışma zamanı yok", cozum: "level açık değil ya da senaryo dünyası" },
  "AKT-DUG-016": { alan: "DUG", anlam: "alan grafta kullanılamaz", cozum: "yalnız şemada 'grafta' bayraklı alanlar açık (renk, şiddet, menzil, gizli)" },
  "AKT-DUG-017": { alan: "DUG", anlam: "değişken adı verilmedi ya da geçersiz", cozum: "harf, rakam, _ ve - ile bir ad yaz" },
  "AKT-DUG-018": { alan: "DUG", anlam: "aktör kimliği geçersiz", cozum: "aktor ayarı '@bu' ya da kimlik olmalı" },
  "AKT-DUG-019": { alan: "DUG", anlam: "graf düğümü: hedef aktör level'da yok", cozum: "kimliği Outliner'dan doğrula" },
  "AKT-DUG-020": { alan: "DUG", anlam: "aktör değişkeni tanımsız", cozum: "Details ▸ Değişkenler'den ekle" },
  "AKT-DUG-021": { alan: "DUG", anlam: "soket adı metin olmalı", cozum: "'soket' ayarına metin yaz" },
  // ── aktör yeteneği (aktorYetenegi.ts) ──
  "AKT-YTN-001": { alan: "YTN", anlam: "level açık değil", cozum: "bir level yüklenince dene" },
  "AKT-YTN-002": { alan: "YTN", anlam: "aktör yok", cozum: "kimliği Outliner'dan doğrula" },
  "AKT-YTN-003": { alan: "YTN", anlam: "alan bu aktör türü için grafta açık değil", cozum: "alan şemada 'grafta' bayraklı değil" },
  "AKT-YTN-004": { alan: "YTN", anlam: "ışık sahnede kurulu değil", cozum: "ışık gizli/silinmiş olabilir; level'ı yeniden uygula" },
  "AKT-YTN-005": { alan: "YTN", anlam: "nesne henüz yüklenmedi", cozum: "model yüklenince dene (konsolda [nesneler] hatasına bak)" },
  "AKT-YTN-006": { alan: "YTN", anlam: "alan değeri şemaya uymuyor", cozum: "tür/aralık Details'teki şemaya göre" },
  "AKT-YTN-007": { alan: "YTN", anlam: "renk #rrggbb olmalı", cozum: "6 haneli onaltılık renk yaz" },
  "AKT-YTN-008": { alan: "YTN", anlam: "değişken tanımlı değil", cozum: "Details ▸ Değişkenler'den ekle" },
  "AKT-YTN-009": { alan: "YTN", anlam: "değişken türü uyuşmuyor (tür değişmez)", cozum: "değişkenin türünde değer yaz" },
  "AKT-YTN-010": { alan: "YTN", anlam: "değişken değeri sonlu sayı değil", cozum: "NaN/∞ yazma" },
  "AKT-YTN-011": { alan: "YTN", anlam: "değişken metni çok uzun", cozum: "metni kısalt" },
  "AKT-YTN-012": { alan: "YTN", anlam: "aktör çalışma zamanı kurulu değil", cozum: "level bağlantısı kurulmadan çağrıldı" },
  // ── çalışma zamanı (aktorCalismaZamani.ts) ──
  "AKT-ZMN-001": { alan: "ZMN", anlam: "kare aşaması beklenmedik hata verdi (öteki aşamalar sürer)", cozum: "ayrıntıdaki aşama ve hata mesajına bak; tekrar sayısı günlükte" },
  "AKT-ZMN-002": { alan: "ZMN", anlam: "çalışma zamanı bayrakla kapatıldı", cozum: "?aktor=-tetik gibi bir bayrak ya da aktorDebug.bayrak ile açılmıştır; bilerek değilse kaldır" },
  // ── bayrak / ayar ──
  "AKT-BYR-001": { alan: "BYR", anlam: "bilinmeyen bayrak adı (yok sayıldı)", cozum: "geçerli adlar: olay, tetik, hareket, bag, dugum, zaman, hepsi; kapatmak için -tetik/-hareket/-bag" },
  // ── bileşen şeması ──
  "AKT-SEM-001": { alan: "SEM", anlam: "iki bileşen şemasında aynı alan adı farklı türde", cozum: "bilesen.ts şemalarında alan türünü eşitle" },
  // ── aktör şablonu (aktorSablonu.ts) ──
  "AKT-SBL-001": { alan: "SBL", anlam: "şablon biçimi geçersiz (sürüm, ad, aktör listesi ya da bilinmeyen alan)", cozum: "dosyayı 'Şablon olarak kaydet' ile yeniden üret; elle düzenlediysen hata ayrıntısındaki alan yoluna bak" },
  "AKT-SBL-002": { alan: "SBL", anlam: "şablon aktörü geçersiz (kimlik, tür, konum, bileşen ya da graf alanı)", cozum: "hata ayrıntısındaki aktör ve alan yolunu düzelt; bileşenler bilesenKaydi şemasına uymalı" },
  "AKT-SBL-003": { alan: "SBL", anlam: "şablon hiyerarşisi geçersiz (tek kök yok, olmayan üst, döngü ya da derinlik)", cozum: "şablonda tam bir kök (üstsüz) aktör olmalı; çocukların 'ust'u şablondaki bir aktöre ya da 'beden:<ad>'a işaret etmeli" },
  "AKT-SBL-004": { alan: "SBL", anlam: "şablon kökü level'da yok", cozum: "kimliği Outliner'dan doğrula; aktör silinmiş olabilir" },
  "AKT-SBL-005": { alan: "SBL", anlam: "yerleştirme level tavanını aşar (ışık ya da şablon boyutu)", cozum: "level'daki ışık sayısını azalt ya da şablondan ışık bileşenli aktörleri çıkar" },
  "AKT-SBL-006": { alan: "SBL", anlam: "glb'deki adlı düğüm soket olamadı (ad geçersiz, yinelenen ya da tavan aşıldı); atlandı", cozum: "glb'de düğümü 'soket_<ad>' diye adlandır (harf, rakam, _ ve -; aynı ad bir kez; en çok 7)" },
  "AKT-SBL-007": { alan: "SBL", anlam: "şablon dosyası okunamadı ya da yazılamadı (host/IPC hatası ya da dosya içeriği geçersiz)", cozum: "Content/Actors klasörünü ve dosya adını kontrol et; ad zaten varsa başka ad seç; ayrıntıdaki host kodu nedeni söyler" },
  "AKT-SBL-008": { alan: "SBL", anlam: "yerleştirilmiş nesnenin glb düğümleri okunamadı (sahne düğümü yok ya da nesne glb değil)", cozum: "nesnenin glb'sinin yüklendiğinden emin ol (Nesneler panelinde seçili nesne sahnede görünmeli); gizli/yüklenmemiş nesnede düğüm yoktur" },
  // ── bileşen düzenleme (bilesenIslemleri.ts; Details'in Bileşenler bölümü) ──
  "AKT-BIL-001": { alan: "BIL", anlam: "düzenlenecek aktör level'da yok", cozum: "kimliği Nesneler panelinden doğrula; aktör silinmiş olabilir" },
  "AKT-BIL-002": { alan: "BIL", anlam: "bileşen türü eklenemez (bilinmeyen ya da rezerve: fizik/Havok henüz yok)", cozum: "bilesenKaydi.ts'teki türlerden birini seç (isik, tetik, soket, hareket)" },
  "AKT-BIL-003": { alan: "BIL", anlam: "bileşen aktörde yok (silinmiş olabilir)", cozum: "Details'i tazele; bileşen kimliğini aktörün bileşen listesinden al" },
  "AKT-BIL-004": { alan: "BIL", anlam: "level değişikliği reddetti (alan değeri, bileşen tavanı, yinelenen soket adı ya da hiyerarşi kuralı)", cozum: "ayrıntıdaki alan yoluna ve nedene bak; değişiklik uygulanmadı, eski hâl korundu" },
  // ── Orion taslak kapısı (taslakKapisi.ts; spec 45 B8) ──
  "AKT-TSL-001": { alan: "TSL", anlam: "taslak zarfı geçersiz (sürüm, ad, gerekçe, boyut ya da bilinmeyen alan)", cozum: "zarf: { taslak: 1, ad, gerekce, sablon, graflar? }; ad şablonun adıyla aynı olmalı; gerekçe 1-300 karakter" },
  "AKT-TSL-002": { alan: "TSL", anlam: "taslaktaki aktör şablonu geçersiz", cozum: "ayrıntıdaki AKT-SBL kodunu düzelt; şablonu elle yazma, 'Şablon olarak kaydet' çıktısını örnek al" },
  "AKT-TSL-003": { alan: "TSL", anlam: "taslaktaki graf geçersiz (biçim, ad ya da tavan)", cozum: "graf biçimi protocol/graf.ts şeması; adlar benzersiz, en çok 4 graf" },
  "AKT-TSL-004": { alan: "TSL", anlam: "taslak dosyası okunamadı ya da silinemedi (host/IPC hatası)", cozum: "Content/Drafts klasörünü ve dosya adını (<ad>.taslak.json) kontrol et" },
  "AKT-TSL-005": { alan: "TSL", anlam: "taslak onaylanamadı (şablon ya da graf dosyası yazılamadı, çoğunlukla aynı ad zaten var)", cozum: "var olan şablonu/grafı yeniden adlandır ya da sil, taslağı yeniden onayla; yarım yazma geri alınır" },
  // ── ışık bileşeni (spec 45; aktorIsiklari.ts) ──
  "AKT-ISK-001": { alan: "ISK", anlam: "ışık bileşeni kurulamadı: level ışık tavanı doldu (ışık aktörleri + bileşen ışıkları)", cozum: "başka bir ışığı sil/gizle ya da bileşeni gizli yap; tavan ISIK_TAVANI (levelTanimi.ts)" },
  "AKT-ISK-002": { alan: "ISK", anlam: "ışık bileşeninin rengi çözülemedi (palette olmayan ad ya da bozuk #rrggbb); varsayılan renk kullanıldı", cozum: "rengi #rrggbb yaz ya da level paletinde tanımlı bir ad ver" },
} as const satisfies Record<string, HataKaydi>;

export type AktorKodu = keyof typeof AKTOR_HATALARI;

export const AKTOR_KOD_DESENI = /\[(AKT-[A-Z]{3}-\d{3})\]/;
const KOD_ONEKI = /^\[AKT-[A-Z]{3}-\d{3}\] /;

/** `[KOD] ayrıntı` metni. Kod katalogda olmalı (tür sistemi garanti eder). */
export const kodlu = (kod: AktorKodu, ayrinti: string): string => `[${kod}] ${ayrinti}`;

/** Kodlu hata: `kod` alanı programla okunur, mesaj `[KOD] ayrıntı`. */
export class AktorHatasi extends Error {
  readonly kod: AktorKodu;
  constructor(kod: AktorKodu, ayrinti: string) {
    super(kodlu(kod, ayrinti));
    this.name = "AktorHatasi";
    this.kod = kod;
  }
}
export const aktorHatasi = (kod: AktorKodu, ayrinti: string): AktorHatasi => new AktorHatasi(kod, ayrinti);

/** Metni ZATEN kod taşıyan (başka katmandan gelen) hatayı fırlatılabilir hâle getirir; kodu korur, yeni kod eklemez. Kodsuz metin programcı hatasıdır (TypeError). */
export function kodluHata(metin: string): AktorHatasi {
  const m = AKTOR_KOD_DESENI.exec(metin);
  if (!m || !(m[1]! in AKTOR_HATALARI)) throw new TypeError(`kodluHata: metin katalogdaki bir kodu taşımıyor: ${metin}`);
  return new AktorHatasi(m[1] as AktorKodu, metin.replace(AKTOR_KOD_DESENI, "").replace(/\s{2,}/g, " ").trim());
}

/** Metnin BAŞINDAKİ `[KOD] ` önekini atar (günlük satırı kodu ayrı alanda taşır, metinde tekrarlanmaz). */
export const kodOnekiniSil = (m: string): string => m.replace(KOD_ONEKI, "");

/** Bir hata/mesajdan kodu okur (kodsuzsa null): günlük ve sayaçlar buradan gruplar. */
export function kodOku(x: unknown): AktorKodu | null {
  const m = x instanceof AktorHatasi ? x.kod : AKTOR_KOD_DESENI.exec(x instanceof Error ? x.message : typeof x === "string" ? x : "")?.[1];
  return typeof m === "string" && m in AKTOR_HATALARI ? (m as AktorKodu) : null;
}

/** Kodun katalog satırı (günlük/hata ayıklama çıktısı: alan adı + çözüm önerisi). */
export function kodAciklamasi(kod: AktorKodu): string {
  const k: HataKaydi = AKTOR_HATALARI[kod];
  return `${AKTOR_ALANLARI[k.alan]}: ${k.anlam} — ${k.cozum}`;
}
