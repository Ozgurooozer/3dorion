// uygulama/yapi/graf/editorBaglami.ts — GÖRSEL EDİTÖRÜN PARÇALARININ ORTAK BAĞLAMI (spec 35 dilim 2b): tuval, palet, paneller denetimciye (grafEditoru.ts)
// yalnız bu arayüzden konuşur — birbirini import etmezler. Yalnız TİP: DOM ya da mantık yok.
"use strict";
import type { GrafDegeri, PinTipi } from "../../../protocol/graf.ts";
import type { DugumKaydi } from "../../graf/dugumKaydi.ts";
import type { CalismaIsareti } from "../../graf/editor/calismaGorunumu.ts";
import type { EditorOturumu, KomutSonucu } from "../../graf/editor/editorOturumu.ts";
import type { PinRef } from "../../graf/editor/bagKurali.ts";
import type { Nokta } from "../../graf/editor/tuvalMatematigi.ts";

export type MesajTuru = "bilgi" | "iyi" | "uyari" | "hata";

export interface EditorBaglami {
  kayit: DugumKaydi<unknown>;
  /** Etkin sekmenin oturumu (sekme yoksa null). */
  oturum(): EditorOturumu | null;
  /** Etkin sekmenin grafik adı. */
  ad(): string | null;
  calisma(): CalismaIsareti | null;
  /** Bir komutun sonucunu gösterir ve her şeyi yeniden çizer (hata ise mesaj kırmızı, grafik değişmemiştir). */
  sonuc(r: KomutSonucu): void;
  bildir(metin: string, tur?: MesajTuru): void;
  /** Yalnız tuvali (sürükleme sırasında) değil her şeyi yeniden çiz. */
  tazele(): void;
  /** Palet: ekran noktasında (tuvale göre) açılır; düğüm `dunya` noktasına eklenir; `pin` verildiyse yalnız ona uyanlar ve eklenince bağlanır. */
  paletAc(ekran: Nokta, dunya: Nokta, pin?: (PinRef & { tip: PinTipi }) | null, arama?: string): void;
  /** Tuvalin ortasına düğüm ekle (sol paneldeki kısayollar). */
  ortayaEkle(tip: string, ayar: Record<string, GrafDegeri>): void;
  /** Deseni (fonksiyon grafiğini) yeni sekmede aç. */
  desenAc(ad: string): void;
  /** Kayıtlı desen adları (depo). */
  desenler(): string[];
  /** Düğümü seç ve görünümü ona kaydır (hata listesinden). */
  dugumeGit(id: string): void;
}
