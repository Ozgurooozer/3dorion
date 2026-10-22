// uygulama/graf/dugumKaydi.ts — DÜĞÜM KÜTÜPHANESİ (spec 35): her düğüm türü bir kayıt. Yeni yetenek = yeni kayıt; yorumlayıcı ve editör türleri bilmez.
//
// Bir düğüm türü şunları söyler: pinleri (ayara/desene göre değişebilir: "Sıra 3" üç çıkış, desen çağrısı desenin pinleri), ayarları (aralıklı),
// SAF mı (yürütme pini yok, değeri istendiğinde hesaplanır: "Sayı", "Ajan seç"), ve çalışınca ne yaptığı. Çalışma dünyaya yalnız `yetenek` üzerinden
// dokunur (kompozisyon kökü verir): kütüphanede OLMAYAN bir yetenek grafikten çağrılamaz (sınır budur; terminal, güvenlik ayarları, protokol yoktur).
"use strict";
import type { Graf, GrafDegeri, PinTanimi } from "../../protocol/graf.ts";

export type DugumKategorisi = "olay" | "akis" | "veri" | "ajan" | "dunya" | "desen";

export interface DugumPinleri {
  girisler: readonly PinTanimi[];
  cikislar: readonly PinTanimi[];
}

/** Düğüm ayarı tanımı: editör alanı ve doğrulama. Bağlanmamış veri girişi de aynı adla ayardan okunur. */
export interface AyarTanimi {
  ad: string;
  tip: "sayi" | "metin" | "bool";
  varsayilan?: GrafDegeri;
  en?: number;
  cok?: number;
  /**
   * Metin ayarında izinli değerler (listeden seçim). Sabit liste ya da ÇALIŞMA ANINDA hesaplanan liste (dilim 1): "Ajan seç"in seçenekleri ajan
   * defteridir ve Flash sonradan gelir; kayıt anında donmuş bir liste ya eksik ya bayat olurdu. Fonksiyon pin ortamından okur (`secenekleriCoz`).
   */
  secenekler?: readonly string[] | ((o: PinOrtami) => readonly string[]);
  aciklama?: string;
  /**
   * Görsel editörün (dilim 2b) YENİ düğüme yazdığı ilk değer — `varsayilan` DEĞİL: varsayılan, ayar yokken denetim ve çalışmanın kullandığı değerdir;
   * değişken adının varsayılanı bilerek yoktur (ad açıkça yazılmalı). Örnek yalnız palette'ten eklenen düğümün JSON'una bir kez yazılır, Ozyn değiştirir.
   */
  ornek?: GrafDegeri;
}

/** Pin/ayar çözümünde düğümün dış dünyadan bilmesi gerekenler (desen deposu, ajan defteri). */
export interface PinOrtami {
  desen(ad: string): Graf | null;
  /** Denetlenen/çalışan grafiğin kendisi (fonksiyon giriş/dönüş düğümlerinin pinleri grafiğin `girisler`/`cikislar`ından gelir). */
  buGraf: Graf | null;
  /**
   * Dünyadaki ajanların kimlikleri (ajan defteri; "Ajan seç" denetimi). Verilmezse liste BOŞ sayılır: dünyaya bağlı olmayan bir denetim
   * "her ajan var" demez, ajan seçen grafik o denetimden geçmez (sessiz geçiş yerine nedenli hata).
   */
  ajanlar?(): readonly string[];
}

/** Ayarın izinli değerleri (sabit ya da ortamdan); seçenek listesi yoksa null. */
export function secenekleriCoz(a: AyarTanimi, o: PinOrtami): readonly string[] | null {
  if (!a.secenekler) return null;
  return typeof a.secenekler === "function" ? a.secenekler(o) : a.secenekler;
}

/**
 * Çalışmanın DEĞİŞKEN ALANI (dilim 2): grafik başına, YALNIZ BELLEKTE (uygulama kapanınca gider). Kök grafiğin adıyla açılır; desen çağrısı çağıranın
 * alanını görür (desen bir fonksiyondur, durumu onu çağıran programındır). Tavanlar (adet, metin uzunluğu) `yaz`da: aşılırsa fırlatır, düğüm nedenle düşer.
 */
export interface DegiskenAlani {
  oku(ad: string): GrafDegeri | undefined;
  /** Yalnız sayı (sonlu), metin, bool. Tavan aşılırsa fırlatır. */
  yaz(ad: string, deger: GrafDegeri): void;
}

/** Çalışmayı bir OLAY başlattıysa (dinlemedeki grafik, dilim 2): hangi olay düğümünden ve olayın verisi (mesafe, yüzey). ▶ ile başlayınca null. */
export interface CalismaTetigi {
  readonly dugum: string;
  readonly veri: Readonly<Record<string, unknown>>;
}

/** Düğüm çalışırken eline verilenler. */
export interface DugumCalismasi<Y> {
  readonly dugumId: string;
  /** Çalışmayı başlatan olay (yalnız olay düğümü okur); ▶ ile başladıysa null. */
  readonly tetik: CalismaTetigi | null;
  /** Grafiğin değişken alanı; çalıştıran vermediyse null (değişken düğümleri nedenle düşer, sessiz geçmez). */
  readonly degiskenler: DegiskenAlani | null;
  /** Yerel saat (0–24, kesirli): "Gün vakti" düğümü. Testte sahte saat. */
  saat(): number;
  readonly ayar: Readonly<Record<string, GrafDegeri>>;
  /** Veri girişinin değeri: bağlıysa kaynaktan, değilse ayardan (aynı ad), o da yoksa ayar tanımının varsayılanı. Hiçbiri yoksa HATA. */
  giris(pin: string): Promise<unknown>;
  /** Bu düğümün VERİ giriş pinlerinin adları (akış hariç; çözülmüş pinlerden). */
  girisAdlari(): string[];
  /** Çalışma durduruldu mu (■): uzun düğümler aralıkla bakar. */
  durduruldu(): boolean;
  /** Durdurulabilir bekleme. */
  bekle(ms: number): Promise<void>;
  /**
   * Dünya işinin sözünü ■'ye KARŞI bekler (dilim 1: ajan eyleminin sonucu). ■ önce gelirse çalışma 'durdu' ile biter; söz sonradan çözülse de
   * yok sayılır. NEDEN ayrı: `bekle` yalnız süre bekler; yürüyen bir bedenin "vardım" sonucu ne zaman geleceği belli olmayan bir sözdür.
   */
  bekleVeyaDur<T>(is: Promise<T>): Promise<T>;
  /**
   * ■ basılınca BİR KEZ çağrılacak iş (yürüyen bedene `dur` göndermek, sözü susturmak). Bekleme yalnız grafiği bırakır; dünyadaki iş kendi
   * kendine durmaz: bu kanca olmasa ■'den sonra Flash yürümeye devam ederdi. Bırakma fonksiyonu döner (iş bitince çağrılır).
   */
  durdurulunca(f: () => void): () => void;
  /** Desen (fonksiyon grafiği) çağır: girdiler → çıktılar. Derinlik tavanlı. */
  desenCagir(ad: string, girdiler: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>>;
  /** Kompozisyon kökünün verdiği dünya yetenekleri (ajan eylemleri, nesne düzenleme…). */
  readonly yetenek: Y;
}

/**
 * Düğümün çalışma sonucu.
 *   • `cikti`: veri çıkışları (sonraki düğümler okur);
 *   • `dallar`: SIRAYLA tamamı yürütülecek akış çıkışları (Sıra: "0","1"…; Tekrar: n kez "govde", her birine kendi `cikti`sıyla);
 *   • `sonra`: dallardan SONRA devam edilecek akış çıkışı (null/undefined = burada biter).
 * Fonksiyon dönüşü (`donus`) yorumlayıcıya grafiğin çıktısını söyler ve o çerçeveyi bitirir.
 */
export interface DugumSonucu {
  cikti?: Record<string, unknown>;
  dallar?: readonly { pin: string; cikti?: Record<string, unknown> }[];
  sonra?: string | null;
  donus?: Record<string, unknown>;
}

export interface DugumTanimi<Y = unknown> {
  tip: string;
  /** Editörde görünen ad (Türkçe). */
  ad: string;
  kategori: DugumKategorisi;
  aciklama: string;
  /** Saf düğüm: akış pini yok; değeri istendiğinde hesaplanır (her istekte yeniden — Blueprint'teki gibi). */
  saf: boolean;
  /** Olay düğümü (grafiğin giriş noktası): akış girişi yok. */
  olay?: boolean;
  /**
   * DÜNYA OLAYI düğümüyse (dilim 2: "Ozyn yaklaştı"), dinlediği olayın adı (`world/olayUretici.ts`). Böyle bir düğüm ▶ ile değil, grafik DİNLEMEYE
   * ALININCA (Ozyn'in tıklaması) o olay gelince yürür. `olay: true` ile birlikte verilir.
   */
  dunyaOlayi?: string;
  pinler(ayar: Readonly<Record<string, GrafDegeri>>, ortam: PinOrtami): DugumPinleri;
  ayarlar?: readonly AyarTanimi[];
  calistir(c: DugumCalismasi<Y>): Promise<DugumSonucu> | DugumSonucu;
}

/** Akış pini kısaltmaları (okunurluk). */
export const AKIS_GIRIS: PinTanimi = { ad: "giris", tip: "akis" };
export const AKIS_SONRA: PinTanimi = { ad: "sonra", tip: "akis" };

export class DugumKaydi<Y = unknown> {
  private readonly _tanimlar = new Map<string, DugumTanimi<Y>>();

  /** Aynı tür iki kez kaydedilemez: sessizce üstüne yazmak bir yeteneği görünmeden değiştirirdi. */
  kaydet(t: DugumTanimi<Y>): this {
    if (this._tanimlar.has(t.tip)) throw new Error(`düğüm türü zaten kayıtlı: ${t.tip}`);
    this._tanimlar.set(t.tip, t);
    return this;
  }

  al(tip: string): DugumTanimi<Y> | null { return this._tanimlar.get(tip) ?? null; }

  hepsi(): DugumTanimi<Y>[] { return [...this._tanimlar.values()]; }
}
