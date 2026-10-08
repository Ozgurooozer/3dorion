// uygulama/senaryoBaglami.ts — Canlı deneme senaryolarının (`3dorion.bat <ad>dene`) dünyaya erişimi
// (spec 14 R3).
//
// Senaryolar eskiden world/giris.ts'in içinde, 23 blok ve ~1000 satırdı (ACIK-ISLER "sıradaki 1"):
// test kodu üretim dosyasında ve pakette. Artık her biri `uygulama/senaryolar/<ad>.ts`, yalnız URL'de
// istendiğinde dinamik olarak yüklenir. Kompozisyon kökü (giris.ts) bu bağlamı kurar: senaryo
// odanın nesnelerini buradan görür, giris.ts'in modül değişkenlerine doğrudan dokunmaz.
//
// SONRADAN ATANANLAR GETTER: `orion` (avatar asenkron yüklenir), `kopru` (beyin bağlanınca),
// `gordumGeldi`, `zoomPayi` — senaryo her okuduğunda güncel değeri görür.
"use strict";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Saat } from "../world/engine/tik.ts";
import type { KameraRig } from "../world/engine/kamera.ts";
import type { OdaKurulumu } from "../world/level/oda.ts";
import type { Oyuncu } from "../world/player/oyuncu.ts";
import type { Avatar } from "../world/avatar/index.ts";
import type { Monitor } from "../world/surfaces/monitor.ts";
import type { Tahta } from "../world/surfaces/tahta.ts";
import type { GunlukEkrani } from "../world/surfaces/gunluk.ts";
import type { SemaPaneli } from "../world/surfaces/sema.ts";
import type { Niyet } from "../protocol/niyet.ts";
import type { Pano } from "../protocol/pano.ts";
import type { Kopru } from "../bridge/kopru.ts";
import type { Cevap, Soru } from "../mind/algiHizmeti.ts";
import type { KuralRefleksi } from "../mind/refleks.ts";
import type { OnayKapisi } from "../mind/onayKapisi.ts";

export interface SenaryoBaglami {
  // ── sahne ve oda ──
  readonly motor: Engine;
  readonly sahne: Scene;
  readonly saat: Saat;
  readonly rig: KameraRig;
  readonly oda: OdaKurulumu;
  readonly oyuncu: Oyuncu;
  // ── yüzeyler ──
  readonly monitor: Monitor;
  readonly adminTerminal: Monitor;
  readonly tahta: Tahta;
  readonly gunluk: GunlukEkrani;
  readonly sema: SemaPaneli;
  readonly zoomKutu: HTMLElement;
  readonly zoomOran: HTMLElement;
  // ── karar ve onay ──
  readonly refleks: KuralRefleksi;
  readonly onayKapisi: OnayKapisi;
  // ── sonradan atananlar (getter) ──
  readonly orion: Avatar | null;
  readonly kopru: Kopru | null;
  readonly gordumGeldi: boolean;
  readonly zoomPayi: number;
  // ── eylemler ──
  niyetiYurut(n: Niyet, id: string): void;
  onayKarari(onaylandi: boolean): void;
  algiSor(ne: Soru): Cevap;
  monitoreGec(): Promise<void>;
  admineGec(): Promise<void>;
  panelOdak(mesh: AbstractMesh, etiket: string): void;
  panoyuAl(): Pano | null;
  zoomUygula(yenidenCerceveleme?: boolean): void;
}

/** Senaryo adları — `3dorion.bat` modları ve URL anahtarları. Yükleyici yalnız bunları yükler. */
export const SENARYOLAR = [
  "terminaldene", "otodene", "gorudene", "sessizdene", "davranis", "tezdene", "gordene", "admindene",
  "zoomdene", "zihindene", "onaydene", "tahtabeyin", "becerdene", "bakdene", "acidene", "saglobdene",
  "senaryodene", "eylemdene", "benlikdene", "apidene", "tahtadene", "hafizadene", "yuzdene", "baglamdene",
] as const;
export type SenaryoAdi = (typeof SENARYOLAR)[number];

/** URL'de istenen senaryolar (birden çok olabilir; sıra listedeki sıra). */
export function istenenSenaryolar(sorgu: string): SenaryoAdi[] {
  const q = new URLSearchParams(sorgu);
  return SENARYOLAR.filter((ad) => q.has(ad));
}
