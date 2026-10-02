// uygulama/pencereKancalari.ts — `window` üzerindeki deneme ve ölçüm kancalarının TEK tip tanımı
// (spec 14 R5).
//
// Kompozisyon kökü (world/giris.ts) bazı nesneleri pencereye açar: konsol ve MCP için `dunya`,
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
    _goruKanca?: GoruKancasi;
  }
}
