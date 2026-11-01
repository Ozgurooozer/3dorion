// uygulama/pencereKancalari.ts — `window` üzerindeki deneme ve ölçüm kancalarının TEK tip tanımı
// (spec 14 R5).
//
// Kompozisyon kökü (uygulama/giris.ts) bazı nesneleri pencereye açar: konsol ve MCP için `dunya`,
// `orionModel`, `orionPano`, `orionSes`; senaryolar için `_davranisKayit`, `_goruKanca`. Eskiden her
// yazan ve okuyan kendi `as unknown as { … }` kalıbını yazıyordu: 11 kopya tip, biri değişince
// diğerleri sessizce eski kalıyordu. Artık tip burada; yazan ve okuyan aynı tanımı görür.
// `host/kopru.ts`'teki `window.kopru` tanımıyla aynı kalıp.
"use strict";
import type { PiperCikisi } from "../voice/cikis.ts";
import type { DavranisKaydi } from "../world/davranisDenemesi.ts";
import type { OllamaKatalogu } from "../bridge/ollamaKatalog.ts";
import type { OpenCodeKatalogu } from "../bridge/opencodeKatalog.ts";
import type { ApiKatalogu } from "../bridge/apiKatalog.ts";
import type { AktorKodu } from "../world/level/cekirdek/aktorHatalari.ts";
import type { AktorGunlugu, GunlukKaydi, GunlukKategorisi, GunlukSeviyesi } from "./aktor/aktorGunlugu.ts";
import type { HataAyiklamaDokumu } from "./aktor/aktorCalismaZamani.ts";

/** M seçicisinin konsol/senaryo yüzü (beyin bağlanınca kurulur). */
export interface OrionModelKancasi {
  ac(): void;
  tara(): Promise<void>;
  katalog(): OllamaKatalogu | null;
  bulutKatalog(): OpenCodeKatalogu | null;
  apiKatalog(): ApiKatalogu | null;
  secenekVarMi(ad: string): boolean;
  iste(ad: string): void;
  aktif(): string;
}

/** Ölçüm kilidi: panelden AÇILMAZ, yönetim terminalinden gerekçeyle açılır. */
export interface OrionPanoKancasi {
  kilitAc(gerekce: string): boolean;
  kilitKapat(): void;
  durum(): { kilitAcik: boolean; olcumDisi: boolean; gerekce: string };
}

/** Aktör altyapısının hata ayıklama yüzü (spec 45 §13): konsoldan `aktorDebug.durum()`, `.son()`, `.bayrak("olay,-tetik")`. Protokol değil, DEBUG. */
export interface AktorDebugKancasi {
  /** Canlı durumun dökümü: bağlar, tetik içerdekileri, hareketliler, geçerli uyarılar, kapalı bileşenler, olay sayımı. */
  durum(): HataAyiklamaDokumu;
  /** Son n günlük kaydı (eskiden yeniye), isteğe bağlı süzgeçle. */
  son(n?: number, suzgec?: { seviye?: GunlukSeviyesi; kategori?: GunlukKategorisi; kod?: AktorKodu }): readonly GunlukKaydi[];
  /** Kod ve seviye başına toplamlar (tekrarlar dahil). */
  sayim(): ReturnType<AktorGunlugu["sayim"]>;
  /** Bayrak dizgesini UYGULAR (`olay,tetik` ayrıntılı, `-hareket` kapat, `hepsi`); tanınmayan adları döndürür. Eski bayraklar silinir. */
  bayrak(metin: string): { bilinmeyen: readonly string[]; ayrintili: readonly GunlukKategorisi[]; kapali: readonly string[] };
  temizle(): void;
}

/** Terminal bloğu süzgeçten geçince çağrılır (`gorudene`, `sessizdene`). */
export type GoruKancasi = (blok: string, terfi: boolean) => void;

declare global {
  interface Window {
    /** DEBUG yüzeyi (T7): sinematik, elle niyet, tahta, terminal. Protokol değil. */
    dunya?: object;
    orionModel?: OrionModelKancasi;
    orionPano?: OrionPanoKancasi;
    orionSes?: PiperCikisi;
    _davranisKayit?: DavranisKaydi;
    aktorDebug?: AktorDebugKancasi;
    _goruKanca?: GoruKancasi;
  }
}
