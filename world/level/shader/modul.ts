// world/level/shader/modul.ts — Özel shader modülü sözleşmesi (spec 20). Katman modülüyle (cekirdek/modul.ts) aynı
// desen: `varsayilan` = şema (ayarBirlestir), `aralik` = panel kaydırıcıları; metin ayar = RENK kuralı.
//
// İki tür:
//   "dunya" — sahnedeki malzemelerde çalışır: ortak dünya eklentisinin (dunyaEklentisi.ts) uniform'larına yazar;
//             malzeme yeniden derlenmez, yalnız değer değişir.
//   "ekran" — kameraya sonrası işlem kurar; stil zincirinin SONUNA, listedeki sırayla eklenir.
// Bir modül ikisini birden yapabilir (ör. hata imzası: nesnede glitch + ekranda RGB kayma).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Ayar, AyarAraligi } from "../cekirdek/modul.ts";
import type { Renk } from "../cekirdek/renk.ts";
import type { DunyaDurumu } from "./dunyaDurumu.ts";
import type { DunyaUniformlari } from "./dunyaEklentisi.ts";

export interface ShaderBaglami {
  sahne: Scene;
  /** Ortak dünya eklentisinin değerleri (bütün ışıklı/pişmiş malzemeler okur). */
  uniform: DunyaUniformlari;
  /** Palet adı ya da "#rrggbb" → renk. */
  renk(ad: string): Renk;
}

export interface EkranEfekti { yokEt(): void }

export interface ShaderOrnegi<A extends Ayar = Ayar> {
  /** Ayar değişince (kaydırıcı): yeniden kurmadan uygula. */
  ayarla(a: A): void;
  /** Her kare: dünya durumundan uniform yaz. */
  kare(d: DunyaDurumu): void;
  /** Ekran shader'ı ise kameraya kur (stil zinciri çağırır, sırayla). */
  ekran?(kamera: Camera): EkranEfekti;
  /** Uniform'ları kapalıya döndür, kaynakları bırak. */
  yokEt(): void;
}

export interface ShaderModulu<A extends Ayar = Ayar> {
  tur: string;
  aciklama: string;
  varsayilan: A;
  aralik?: Readonly<Partial<Record<keyof A & string, AyarAraligi>>>;
  /** Ekran shader'ı mı (zincir sırası ve yeniden kurma imzası için). */
  ekranMi: boolean;
  kur(b: ShaderBaglami, a: A): ShaderOrnegi<A>;
}
