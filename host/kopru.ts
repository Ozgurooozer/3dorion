// host/kopru.ts — Electron main ↔ renderer IPC sözleşmesinin TİPLERİ.
//
// KANAL ADLARI BURADA DEĞİL: tek kaynakları `host/kanallar.cjs`. Bu dosyada
// eskiden `CAGRI` ve `OLAY` sabitlerinin ikinci bir kopyası duruyordu ve
// kimse onları import etmiyordu (2026-09-19, grep ile doğrulandı) — yani
// `kanallar.cjs`'in önlemek için yaratıldığı hata sınıfının ta kendisi:
// kanal eklenir, bir kopyaya yazılmaz, `ipcMain.handle(undefined, ...)`
// sessizce hiçbir şey kaydetmez. Silindi; burada yalnızca tipler kalır.
"use strict";
import type { DosyaDurumu } from "../mind/hafizaGocu.ts";
import type { DinlemeOlayi } from "./dinleme.js";
import type { MdBilgisi } from "./mdDosyalari.js";
import type { DosyaBilgisi } from "./dosyaKlasoru.js";
import type { ProjeDurumu, SablonAdi } from "./proje.js";
import type { IcerikOgesi, KokAdi as IcerikKoku } from "./icerik.js";
import type { SesDurumu, SesIndirmeIlerlemesi, SesSatiri } from "./sesler.js";

export type { SesDurumu, SesIndirmeIlerlemesi, SesSatiri };

/** Sonuç nesneli IPC (md, ses): invoke hata nesnesinin `kod` alanını taşımaz, o yüzden sonuç nesnesi. */
export type IpcSonuc<T> = { ok: true; deger: T } | { ok: false; kod: string; mesaj: string };
/** md IPC sonucu (spec 32): `IpcSonuc`un eski adı, kullanıcıları değişmesin diye. */
export type MdSonuc<T> = IpcSonuc<T>;
/** Açık proje (spec 39): renderer'ın bildiği kadarı. */
export type { ProjeDurumu, SablonAdi, IcerikOgesi, IcerikKoku };
export interface ProjeOzeti { ad: string; dizin: string; icerik: string; varsayilanLevel: string; kok: string }

/** Ofisteki 3. monitörün olayları (host/webMonitor.js). */
export type WebmonOlayi =
  | { olay: "durum"; d: "yukleniyor" | "acik" | "kapali" | "sonlandi" }
  | { olay: "kare"; jpeg: Uint8Array; g: number; y: number };

export interface PtyAcIstek {
  /** Boş bırakılırsa ana kabuk (Windows: powershell.exe). */
  kabuk?: string;
  argv?:  string[];
  cwd?:   string;
  cols:   number;
  rows:   number;
}

export interface PtyCikti { id: string; veri: string }
export interface PtyBitti { id: string; kod: number }

/** preload'un renderer'a açtığı yüzey. `window.kopru` olarak erişilir. */
export interface Kopru {
  ptyAc(istek: PtyAcIstek): Promise<string>;
  ptyYaz(id: string, veri: string): void;
  ptyBoyut(id: string, cols: number, rows: number): void;
  ptyKapat(id: string): void;
  ptyDinle(cb: (c: PtyCikti) => void): () => void;
  ptyBittiDinle(cb: (b: PtyBitti) => void): () => void;
  /**
   * Metni sese çevirir ve wav BAYTLARINI döndürür — dosya yolu DEĞİL.
   *
   * Gerekçe: renderer geliştirme modunda http://localhost'tan yüklenir ve
   * oradan `file://` okumak Chromium tarafından engellenir. Bayt döndürmek
   * hem geliştirme hem paketli modda aynı şekilde çalışır (Blob URL).
   */
  sesUret(metin: string): Promise<{ ok: boolean; ses?: Uint8Array; hata?: string }>;
  sesVarMi(): Promise<boolean>;
  varlik(ad: string): Promise<string>;
  /**
   * Hafıza dosyası (spec 07 K4). Okuma SENKRON — `bridge/kopru.ts` depoyu
   * kurucuda senkron okuyor ve K7 arayüzü değiştirmeyi yasaklıyor.
   * Dönüş biçimi `mind/hafizaGocu.ts` → `DosyaDurumu`.
   */
  hafizaOku(): DosyaDurumu;
  hafizaYaz(kayitlar: unknown[]): void;
  /** Göç için: sonuç bilinmeden "taşındı" denemez. */
  hafizaYazSenkron(kayitlar: unknown[]): boolean;
  /** Tarih damgalı yedek; yazıldıysa true. Varsayılan: sıkıştırma/göç yedeği (son 5). `"unut"`: duvardan elle silme yedeği, ayrı önek (son 100). */
  hafizaYedekYaz(kayitlar: unknown[], tur?: "unut"): boolean;
  /** MCP rölesi: main'deki HTTP ucuna gelen `tools/list` / `tools/call`. */
  mcpDinle(cb: (istek: { id: number; yontem: string; param: unknown }) => void): () => void;
  mcpYanitla(id: number, sonuc: unknown, hata?: string): void;
  /**
   * Öğrenen kapı (spec 08, toplantı 2026-09-27 K5): kayıttaki öğretim satırları.
   * SENKRON — köprü kural hafızasını kurucuda kurar. Doğrulanmamış veridir;
   * köprü (`mind/ogretim.ts`) bozuk satırı atlar.
   */
  ogretimOku(): unknown[];
  /** Öğretim dosyasına düşen yeni satır (ör. tools/ogret.ts) — canlı hafızaya. */
  ogretimDinle(cb: (satir: unknown) => void): () => void;
  /**
   * Beceri refleksi (spec 10): kayıttan seçilen satırlar — türü `turler`de olanlar ve
   * algı türü `algilar`da olan algı satırları. SENKRON — köprü beceri defterini kurucuda
   * kurar. Doğrulanmamış veridir; defter bozuk geçmişte geçmişsiz başlar.
   */
  kayitSatirlariOku(secim: { turler: readonly string[]; algilar: readonly string[] }): unknown[];
  /**
   * API anahtarlı beyin (spec 13 Faz 3, host/anahtarDeposu.js). `apiDurum` anahtarın
   * KENDİSİNİ döndürmez; anahtar yalnız `apiKaydet` ile gider. İstekleri main atar.
   */
  apiDurum(): Promise<{ ad: string; adres: string; anahtarVar: true; kalici: boolean }[]>;
  apiKaydet(ad: string, adres: string, anahtar: string): Promise<{ ok: true; kalici: boolean } | { ok: false; hata: string }>;
  apiSil(ad: string): Promise<{ ok: true } | { ok: false; hata: string }>;
  apiModeller(ad: string): Promise<{ ok: true; veri: unknown } | { ok: false; hata: string }>;
  apiSohbet(ad: string, govde: unknown): Promise<{ ok: true; veri: unknown } | { ok: false; hata: string }>;
  /** Durum defteri (spec 16 F2): SENKRON okuma; dosya yoksa ya da bozuksa boş dizi. */
  durumOku(): unknown[];
  durumYaz(kayitlar: unknown[]): void;
  /** Orion'un md dosyaları (spec 32). Sonuç `{ ok, deger }` ya da `{ ok: false, kod, mesaj }`. */
  mdListe(): Promise<MdSonuc<MdBilgisi[]>>;
  mdOku(ad: string): Promise<MdSonuc<string>>;
  mdYaz(ad: string, metin: string): Promise<MdSonuc<true>>;
  mdYeni(ad: string, metin?: string): Promise<MdSonuc<true>>;
  mdAktif(ad: string, aktif: boolean): Promise<MdSonuc<true>>;
  /** Düğüm grafikleri (spec 35 dilim 1): ad = grafın adı (uzantısız). Çalıştırma kanalı YOK (grafik renderer'da, Ozyn'in ▶'siyle). */
  grafListe(): Promise<IpcSonuc<DosyaBilgisi[]>>;
  grafOku(ad: string): Promise<IpcSonuc<string>>;
  grafYaz(ad: string, metin: string): Promise<IpcSonuc<true>>;
  grafYeni(ad: string, metin: string): Promise<IpcSonuc<true>>;
  /** Kalıcı silme değil: dosya `.silinenler/` altına taşınır. */
  grafSil(ad: string): Promise<IpcSonuc<true>>;
  /** NPC kayıtları (spec 35 dilim 3): ad = kaydın adı (uzantısız). Dinleme kanalı YOK (Ozyn'in tıklaması renderer'da). Sil = `.silinenler/`e taşı. */
  npcListe(): Promise<IpcSonuc<DosyaBilgisi[]>>;
  npcOku(ad: string): Promise<IpcSonuc<string>>;
  npcYaz(ad: string, metin: string): Promise<IpcSonuc<true>>;
  npcYeni(ad: string, metin: string): Promise<IpcSonuc<true>>;
  npcSil(ad: string): Promise<IpcSonuc<true>>;
  /** Sekanslar (spec 36): ad = sekansın adı (uzantısız). Oynatma kanalı YOK (▶ renderer'da, Ozyn'in gerçek tıklamasıyla). Sil = `.silinenler/`e taşı. */
  sekansListe(): Promise<IpcSonuc<DosyaBilgisi[]>>;
  sekansOku(ad: string): Promise<IpcSonuc<string>>;
  sekansYaz(ad: string, metin: string): Promise<IpcSonuc<true>>;
  sekansYeni(ad: string, metin: string): Promise<IpcSonuc<true>>;
  sekansSil(ad: string): Promise<IpcSonuc<true>>;
  /** Proje (spec 39, host/proje.js): açık projenin özeti; proje hazırlanamadıysa `deger: null` (eski userData klasörleriyle sürüyor). */
  projeBilgi(): Promise<IpcSonuc<ProjeOzeti | null>>;
  /** Açık projenin level'ı (`Content/Levels/<ad>/<ad>.level.json`), ham metin; biçimi renderer doğrular. Proje yoksa `proje-yok`. */
  projeLevelOku(ad: string): Promise<IpcSonuc<string>>;
  /** Proje tarayıcısı (spec 39 D2): kök, açık proje ve projeler (son açılanlar önde; bozuk proje `hata` ile görünür). */
  projeListe(): Promise<IpcSonuc<ProjeDurumu>>;
  /** Şablondan yeni proje (`ofis` | `bos`); AÇMAZ. Hata kodları: var | gecersiz-ad | gecersiz-sablon. */
  projeYeni(ad: string, sablon: SablonAdi): Promise<IpcSonuc<{ ad: string; dizin: string }>>;
  /** Projeyi AÇAR: seçimi yazıp uygulamayı yeniden başlatır (`yeniden: true`); zaten açıksa ya da senaryo koşusunda başlatmaz. */
  projeAc(ad: string): Promise<IpcSonuc<{ yeniden: boolean; neden?: string }>>;
  /** Açık projenin klasörünü dosya gezgininde aç. */
  projeKlasorGoster(): Promise<IpcSonuc<true>>;
  /**
   * İçerik gezgini (spec 39 D4, host/icerik.js). Adres `Content/…` (proje) | `Engine/…` (motor, salt okunur). Hata kodları: gecersiz-adres | gecersiz-ad | var | yok |
   * salt-okunur | korumali | cok-buyuk | klasor | kok-yok. `icerikIceAktar` ana süreçte dosya seçici açar (iptal = `eklenen: []`).
   */
  icerikListe(kok: IcerikKoku): Promise<IpcSonuc<{ kok: IcerikKoku; ogeler: IcerikOgesi[]; kesildi: boolean }>>;
  icerikIkili(adres: string): Promise<IpcSonuc<{ adres: string; boyut: number; base64: string }>>;
  icerikMetin(adres: string): Promise<IpcSonuc<string>>;
  icerikYeniKlasor(adres: string): Promise<IpcSonuc<string>>;
  icerikAdlandir(adres: string, yeniAd: string): Promise<IpcSonuc<string>>;
  icerikCogalt(adres: string): Promise<IpcSonuc<string>>;
  icerikSil(adres: string): Promise<IpcSonuc<string>>;
  icerikIceAktar(hedefAdres: string): Promise<IpcSonuc<{ eklenen: string[]; atlanan: { ad: string; neden: string }[] }>>;
  /** Aynı tür klasörü içinde `adres`i `hedefKlasor`e taşır (üstüne yazmaz); dönüş yeni adres. */
  icerikTasi(adres: string, hedefKlasor: string): Promise<IpcSonuc<string>>;
  /** Explorer'dan bırakılan dosyalar (`DataTransfer.files`) `hedefAdres`e kopyalanır; kurallar `icerikIceAktar` ile aynı, seçici açılmaz. */
  icerikBirakAktar(hedefAdres: string, dosyalar: readonly File[]): Promise<IpcSonuc<{ eklenen: string[]; atlanan: { ad: string; neden: string }[] }>>;
  icerikGoster(adres: string): Promise<IpcSonuc<true>>;
  /**
   * Orion'un sesi (spec 34, host/sesler.js). Her işlem güncel durumu döner. `sesSec` bir SONRAKİ cümleden geçerli; `ORION_PIPER_MODEL` varken
   * `kilitli` kodla reddedilir. `sesIndir` yalnız katalogdaki adı kabul eder (adres renderer'dan gelmez); `sesSil` yalnız panelden indirileni.
   */
  sesListe(): Promise<IpcSonuc<SesDurumu>>;
  sesSec(ad: string): Promise<IpcSonuc<SesDurumu>>;
  sesIndir(ad: string): Promise<IpcSonuc<SesDurumu>>;
  sesSil(ad: string): Promise<IpcSonuc<SesDurumu>>;
  /** İndirme ilerlemesi; abonelikten çıkma işlevi döner. */
  sesIndirmeDinle(cb: (o: SesIndirmeIlerlemesi) => void): () => void;
  /**
   * Orion'un kulağı (host/dinleme.js, tools/nemotron-dinle.py): "baslat" süreci açar, "kayit"/"dur"
   * bas-konuş, "kapat" süreci kapatır. Dönüş: komut iletildi mi. Ses renderer'a GİRMEZ; çözülmüş
   * metin `dinleDinle` ile olay olarak gelir.
   */
  dinleKomut(komut: "baslat" | "kayit" | "dur" | "kapat"): Promise<boolean>;
  /** 3. monitör (groma haritası, host/webMonitor.js): `ac` yalnız yerel adresi yükler; `fare` normalleştirilmiş (0..1) koordinat taşır. */
  webmonKomut(komut: "ac" | "kapat" | "fare", yuk?: unknown): Promise<boolean>;
  /** 3. monitör olayları: durum (yukleniyor/acik/kapali/sonlandi) ve JPEG kareler. Abonelikten çıkma işlevi döner. */
  webmonDinle(cb: (o: WebmonOlayi) => void): () => void;
  dinleDinle(cb: (o: DinlemeOlayi) => void): () => void;
}

declare global {
  interface Window { kopru: Kopru }
}
