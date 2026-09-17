// world/surfaces/semaCekirdek.ts — Beyin şemasının SAF çekirdeği.
//
// Şema, Orion'un algıdan eyleme giden yolunu odada gösterir. Bu dosya o yolun
// VERİSİ ve YERLEŞİM aritmetiğidir; Babylon yok, canvas yok, test edilebilir.
//
// NEDEN ŞEMA: iki katmanlı beyin (sağ lob yerel/refleks, sol lob OpenCode)
// tasarlandı ama dışarıdan bakan biri hangi katmanın çalıştığını göremiyordu.
// Bir arıza olduğunda "Orion neden sustu" sorusunun cevabı konsoldaydı.
//
// SAF: bağımlılık yok, yan etki yok.
"use strict";

/** Şemadaki bir düğüm — işlem hattının bir durağı. */
export interface Dugum {
  ad: string;
  etiket: string;
  /** Hangi lob: yerel (hızlı, kuralcı) / bulut (yavaş, dilsel) / ortak. */
  lob: "yerel" | "bulut" | "ortak";
  /** Yerleşim ızgarası: sütun soldan sağa akış, satır 0 = ana hat. */
  sutun: number;
  satir: number;
  /**
   * Bu durak NE YAPAR — tek cümle, detay görünümünde okunur.
   *
   * Kısa tutulması kural: panel duvardan okunuyor ve paragraf okunmaz.
   * Ayrıntı sayılarla verilir, nesirle değil.
   */
  aciklama: string;
}

/**
 * İşlem hattı. Sıra ANLAMLI: soldan sağa veri akışı.
 *
 * Ana hat (satır 0) algıdan bedene giden yoldur. Satır -1/+1 yan dallardır:
 * refleks ana hattı KISA DEVRE yapar (beyne uğramadan bedene gider), hafıza
 * ise beyne girdi sağlar.
 */
export const DUGUMLER: readonly Dugum[] = [
  { ad: "algi",    etiket: "ALGI",     lob: "yerel", sutun: 0, satir: 0,
    aciklama: "Dünyadan gelen her şey buradan girer: terminal çıktısı, konuşma, olay." },
  { ad: "suzgec",  etiket: "SÜZGEÇ",   lob: "yerel", sutun: 1, satir: 0,
    aciklama: "İçerik yargısı: hangi algı beyne değer? Kural tabanlı, 0 ms." },
  { ad: "refleks", etiket: "REFLEKS",  lob: "yerel", sutun: 2, satir: -1,
    aciklama: "Süzgeçten dönen algı burada kalır — beyne gitmez, ucuz tepki verilir." },
  { ad: "dikkat",  etiket: "DİKKAT",   lob: "yerel", sutun: 2, satir: 0,
    aciklama: "Maliyet tavanı: tik yasağı, bütçe, tekrar ve kısma kuralları." },
  { ad: "hafiza",  etiket: "HAFIZA",   lob: "yerel", sutun: 2, satir: 1,
    aciklama: "Geçmiş anılardan bu tura ilgili olanları getirir." },
  { ad: "beyin",   etiket: "DÜŞÜNCE",  lob: "bulut", sutun: 3, satir: 0,
    aciklama: "Dil katmanı: dış model. Yavaş ve pahalı, o yüzden seçilerek uyandırılır." },
  // BAKIŞ ana hattın tersine akar: diğer düğümlerde bilgi dünyadan beyne
  // gelir, burada beyin bilgiyi KENDİ ister (dunya_sor). Ayrı kutu olması
  // bu yüzden: "ALGI" içinde göstermek iki farklı yönü tek şeymiş gibi
  // okutuyordu.
  { ad: "bakis",   etiket: "BAKIŞ",    lob: "yerel", sutun: 4, satir: -1,
    aciklama: "Beynin KENDİ istediği bilgi: odaya bakma sorgusunun cevabı." },
  { ad: "niyet",   etiket: "NİYET",    lob: "ortak", sutun: 4, satir: 0,
    aciklama: "Karar eyleme dönüşür; protokol doğrulamasından geçer." },
  { ad: "onay",    etiket: "ONAY",     lob: "yerel", sutun: 5, satir: 1,
    aciklama: "Komut önerileri burada bekler. Ozyn onaylamadan hiçbir komut çalışmaz." },
  { ad: "beden",   etiket: "BEDEN",    lob: "yerel", sutun: 5, satir: 0,
    aciklama: "Avatar gerçekten hareket eder: yürür, bakar, yazar, konuşur." },
] as const;

/** Aralarındaki oklar: [kaynak, hedef]. */
export const OKLAR: readonly (readonly [string, string])[] = [
  ["algi", "suzgec"],
  ["suzgec", "dikkat"],
  ["suzgec", "refleks"],
  ["dikkat", "beyin"],
  ["hafiza", "beyin"],
  ["beyin", "niyet"],
  ["niyet", "beden"],
  ["niyet", "onay"],
  ["refleks", "niyet"],
  // Beyin bakmak ister, cevap beyne geri döner. Ok şemada ileri çizilir
  // (geriye akan ok yerleşimi okunmaz kılardı); dönüşü "BAKIŞ" etiketi anlatır.
  ["beyin", "bakis"],
] as const;

export interface DugumDurumu {
  /** Kaç kez çalıştı. */
  sayac: number;
  /** En son ne zaman çalıştı (epoch ms); 0 = hiç. */
  sonAn: number;
  /** Kutunun altına yazılacak kısa not (gecikme, model adı, kesik süresi). */
  not: string;
  /** Arızalı mı — kırmızı çizilir. */
  arizali: boolean;
}

export interface SemaDurumu {
  oku(ad: string): DugumDurumu;
  /** Düğüm çalıştı: sayaç artar, parıltı başlar. */
  vur(ad: string, not?: string): void;
  /** Not günceller ama sayacı ARTIRMAZ (durum bilgisi, olay değil). */
  notYaz(ad: string, not: string): void;
  ariza(ad: string, arizali: boolean, not?: string): void;
  /**
   * Parıltı yoğunluğu 0..1 — `sonAn`dan bu yana geçen süreye göre söner.
   * Çizim bunu doğrudan alfa olarak kullanır.
   */
  parilti(ad: string, simdi: number): number;
}

/** Parıltının tamamen sönmesi (ms). Göz bir vuruşu yakalayacak kadar uzun. */
export const PARILTI_MS = 1200;

export function semaDurumuKur(): SemaDurumu {
  const harita = new Map<string, DugumDurumu>();
  const al = (ad: string): DugumDurumu => {
    let d = harita.get(ad);
    if (!d) { d = { sayac: 0, sonAn: 0, not: "", arizali: false }; harita.set(ad, d); }
    return d;
  };

  return {
    oku: (ad) => ({ ...al(ad) }),
    vur(ad, not) {
      const d = al(ad);
      d.sayac++;
      d.sonAn = Date.now();
      if (not !== undefined) d.not = not;
      // Bir vuruş arızayı KALDIRIR: düğüm yeniden çalışıyor demektir.
      d.arizali = false;
    },
    notYaz(ad, not) { al(ad).not = not; },
    ariza(ad, arizali, not) {
      const d = al(ad);
      d.arizali = arizali;
      if (not !== undefined) d.not = not;
    },
    parilti(ad, simdi) {
      const d = al(ad);
      if (!d.sonAn) return 0;
      const gecen = simdi - d.sonAn;
      if (gecen < 0) return 1;                 // saat geri gitti; sönük gösterme
      if (gecen >= PARILTI_MS) return 0;
      return 1 - gecen / PARILTI_MS;
    },
  };
}

export interface Kutu { x: number; y: number; g: number; yuk: number }

/**
 * Izgarayı piksel kutularına çevirir.
 *
 * Yerleşim ÇİZİMDEN ayrı tutuldu ki sınanabilsin: kutuların çakışmaması ve
 * alanın içinde kalması görsel değil, aritmetik bir iddiadır.
 */
export function yerlesim(
  genislik: number, yukseklik: number, kenar: number, dugumler: readonly Dugum[] = DUGUMLER,
): Map<string, Kutu> {
  const sutunlar = Math.max(...dugumler.map((d) => d.sutun)) + 1;
  const satirlar = [...new Set(dugumler.map((d) => d.satir))].sort((a, b) => a - b);
  const enUst = satirlar[0] ?? 0;
  const satirSayisi = (satirlar.at(-1) ?? 0) - enUst + 1;

  const alanG = genislik - kenar * 2;
  const alanY = yukseklik - kenar * 2;
  const hucreG = alanG / sutunlar;
  const hucreY = alanY / satirSayisi;

  // Kutular hücreden küçük: aradaki boşluk okların geçtiği yerdir.
  const kutuG = hucreG * 0.76;
  const kutuY = Math.min(hucreY * 0.62, kutuG * 0.52);

  const harita = new Map<string, Kutu>();
  for (const d of dugumler) {
    const merkezX = kenar + d.sutun * hucreG + hucreG / 2;
    const merkezY = kenar + (d.satir - enUst) * hucreY + hucreY / 2;
    harita.set(d.ad, {
      x: merkezX - kutuG / 2, y: merkezY - kutuY / 2, g: kutuG, yuk: kutuY,
    });
  }
  return harita;
}

// ── ALAN GEOMETRİSİ — çizim ve TIKLAMA aynı kaynaktan okur ────────────────
//
// NEDEN BURADA: bu oranlar `sema.ts`'in `ciz()` fonksiyonunun içindeydi
// (`kenar`, `basYuk`, `altYuk`) ve yerleşime uygulanan `+y0` kaydırması da
// orada ayrı bir yardımcıdaydı. Tıklama testi bu DÖRT sayıyı yeniden
// hesaplasaydı çizim ile tıklama iki ayrı matematiğe dayanırdı ve er geç
// kayarlardı — kullanıcıya "panel biraz şaşı" diye görünen, ama aslında iki
// kopya arasındaki sapma olan bir hata.
//
// Artık tek kaynak burası. `sema.ts` çizerken, vuruş testi tıklarken
// aynı fonksiyonları çağırır.

/** Panelin şerit/kenar geometrisi. Tüm oranlar burada, başka hiçbir yerde. */
export interface SemaAlani {
  genislik: number;
  yukseklik: number;
  /** Dış kenar boşluğu. */
  kenar: number;
  /** Başlık şeridi yüksekliği. Şema alanı bunun ALTINDA başlar. */
  basYuk: number;
  /** Alt durum şeridi yüksekliği. */
  altYuk: number;
  /** Şema alanının üst kenarı (= basYuk). */
  y0: number;
  /** Şema alanının yüksekliği (şeritler düşülmüş). */
  alanYuk: number;
}

export function semaAlani(genislik: number, yukseklik: number): SemaAlani {
  // Math.round: `sema.ts`'teki özgün davranış birebir korunuyor. Yuvarlamayı
  // kaldırmak kutuları yarım piksel kaydırır ve yazıyı bulanıklaştırır.
  const kenar = Math.round(yukseklik * 0.04);
  const basYuk = Math.round(yukseklik * 0.11);
  const altYuk = Math.round(yukseklik * 0.10);
  return {
    genislik, yukseklik, kenar, basYuk, altYuk,
    y0: basYuk,
    alanYuk: yukseklik - basYuk - altYuk,
  };
}

/** Panelde GÖRÜLEN kutular — `yerlesim()` + dikey kaydırma. */
export function semaYerlesimi(
  alan: SemaAlani, dugumler: readonly Dugum[] = DUGUMLER,
): Map<string, Kutu> {
  const ham = yerlesim(alan.genislik, alan.alanYuk, alan.kenar, dugumler);
  const cikti = new Map<string, Kutu>();
  for (const [ad, k] of ham) cikti.set(ad, { ...k, y: k.y + alan.y0 });
  return cikti;
}

/**
 * Piksel noktası hangi düğümün üstünde? Kutu dışıysa `null`.
 *
 * Başlık ve alt şerit bilerek `null` döner: oralara tıklamak bir düğüm
 * seçmek değildir ve "yanlışlıkla en yakın kutuyu seç" davranışı devre
 * panosunda tehlikelidir — operatör neye bastığını bilmeli.
 */
export function dugumBul(
  alan: SemaAlani, px: number, py: number, dugumler: readonly Dugum[] = DUGUMLER,
): string | null {
  if (py < alan.y0 || py > alan.y0 + alan.alanYuk) return null;
  for (const [ad, k] of semaYerlesimi(alan, dugumler)) {
    if (px >= k.x && px <= k.x + k.g && py >= k.y && py <= k.y + k.yuk) return ad;
  }
  return null;
}

// ── UV → DÜĞÜM ────────────────────────────────────────────────────────────
//
// NEDEN ÇEKİRDEKTE: Babylon'un `PickingInfo.getTextureCoordinates()` UV verir
// (0..1, v ALTTAN yukarı). Piksel uzayı ise ÜSTTEN aşağı. Aradaki `1 - v`
// çevirimi `giris.ts`'te dursaydı:
//
//   - geometriden ayrı bir yerde yaşardı ve ters dönmesi ancak canlı koşuda
//     fark edilirdi (panel "biraz şaşı" görünür, birim testi yeşil kalır),
//   - tıklanabilir her yeni yüzey aynı satırı kopyalardı.
//
// Şemanın dikey yerleşimi neredeyse simetrik (satır -1 / 0 / +1) olduğu için
// ters çevrim ÇÖKMEZ: yalnızca REFLEKS yerine HAFIZA seçer. Sessiz ve yanlış.
// Bu yüzden testi simetriyi kıracak şekilde yazıldı.

/** UV (v alttan) → piksel (y üstten). Aralık dışı değer KIRPILMAZ, aynen döner. */
export function uvdenPiksel(
  alan: SemaAlani, u: number, v: number,
): { px: number; py: number } {
  return { px: u * alan.genislik, py: (1 - v) * alan.yukseklik };
}

/** Doku UV'si hangi düğümün üstünde? Kutu dışıysa `null`. Fırlatmaz. */
export function dugumBulUv(
  alan: SemaAlani, u: number, v: number, dugumler: readonly Dugum[] = DUGUMLER,
): string | null {
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  const { px, py } = uvdenPiksel(alan, u, v);
  return dugumBul(alan, px, py, dugumler);
}

/** Bir düğümün tanımı — detay görünümü ve pano kaydı buradan okur. */
export function dugumTanim(ad: string): Dugum | null {
  return DUGUMLER.find((d) => d.ad === ad) ?? null;
}
