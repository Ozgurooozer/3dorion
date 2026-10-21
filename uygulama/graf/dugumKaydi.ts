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
  /** Metin ayarında izinli değerler (listeden seçim). */
  secenekler?: readonly string[];
  aciklama?: string;
}

/** Pin/ayar çözümünde düğümün dış dünyadan bilmesi gerekenler (desen deposu). */
export interface PinOrtami {
  desen(ad: string): Graf | null;
  /** Denetlenen/çalışan grafiğin kendisi (fonksiyon giriş/dönüş düğümlerinin pinleri grafiğin `girisler`/`cikislar`ından gelir). */
  buGraf: Graf | null;
}

/** Düğüm çalışırken eline verilenler. */
export interface DugumCalismasi<Y> {
  readonly dugumId: string;
  readonly ayar: Readonly<Record<string, GrafDegeri>>;
  /** Veri girişinin değeri: bağlıysa kaynaktan, değilse ayardan (aynı ad), o da yoksa ayar tanımının varsayılanı. Hiçbiri yoksa HATA. */
  giris(pin: string): Promise<unknown>;
  /** Bu düğümün VERİ giriş pinlerinin adları (akış hariç; çözülmüş pinlerden). */
  girisAdlari(): string[];
  /** Çalışma durduruldu mu (■): uzun düğümler aralıkla bakar. */
  durduruldu(): boolean;
  /** Durdurulabilir bekleme. */
  bekle(ms: number): Promise<void>;
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
