// uygulama/senaryoBaglami.ts — Canlı deneme senaryolarının (`3dorion.bat <ad>dene`) dünyaya erişimi
// (spec 14 R3).
//
// Senaryolar eskiden uygulama/giris.ts'in içinde, 23 blok ve ~1000 satırdı (ACIK-ISLER "sıradaki 1"):
// test kodu üretim dosyasında ve pakette. Artık her biri `uygulama/senaryolar/<ad>.ts`, yalnız URL'de
// istendiğinde dinamik olarak yüklenir. Kompozisyon kökü (giris.ts) bu bağlamı kurar: senaryo
// odanın nesnelerini buradan görür, giris.ts'in modül değişkenlerine doğrudan dokunmaz.
//
// SONRADAN ATANANLAR GETTER: `orion` (avatar asenkron yüklenir), `kopru` (beyin bağlanınca),
// `gordumGeldi`, `zoomPayi` — senaryo her okuduğunda güncel değeri görür.
"use strict";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { LevelTanimi } from "../world/level/cekirdek/levelTanimi.ts";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Saat } from "../world/engine/tik.ts";
import type { KameraRig } from "../world/engine/kamera.ts";
import type { OdaKurulumu } from "../world/level/oda.ts";
import type { Oyuncu } from "../world/player/oyuncu.ts";
import type { Avatar } from "../world/avatar/index.ts";
import type { Yer } from "../world/yer/yer.ts";
import type { Monitor } from "../world/surfaces/terminal/monitor.ts";
import type { Tahta } from "../world/surfaces/tahta/tahta.ts";
import type { GunlukEkrani } from "../world/surfaces/duvar/gunluk.ts";
import type { SemaPaneli } from "../world/surfaces/duvar/sema.ts";
import type { Niyet } from "../protocol/niyet.ts";
import type { Pano } from "../protocol/pano.ts";
import type { Kopru } from "../bridge/kopru.ts";
import type { LevelBaglantisi } from "./levelBaglantisi.ts";
import type { Graf } from "../protocol/graf.ts";
import type { Level } from "../world/level/cekirdek/levelKur.ts";
import type { Cevap, Soru } from "../mind/algiHizmeti.ts";
import type { KuralRefleksi } from "../mind/refleks.ts";
import type { OnayKapisi } from "../mind/onayKapisi.ts";
import type { GormeKaydi } from "./niyetYurutucu.ts";
import type { Doktor } from "./doktor.ts";
import type { WebMonitoru } from "./webMonitoru.ts";
import type { Gozlem } from "./gozlem.ts";
import type { IsikHacmi } from "../world/level/gi/isikHacmi.ts";
import type { SekansSenaryoYuzu } from "./yapi/sekans/kurulum.ts";
import type { DokYoneticisi } from "./yapi/ortak/dok/dokYoneticisi.ts";
import type { EklentiDefteri } from "./eklenti/eklentiDefteri.ts";
import type { IcerikPaneli } from "./yapi/icerik/icerikPaneli.ts";
import type { VarlikPenceresi } from "./yapi/onizleme/varlikPenceresi.ts";
import type { OutlinerPaneli } from "./yapi/outliner/outlinerPaneli.ts";
import type { SecimDurumu } from "./secimDurumu.ts";

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
  /** Ozyn'in ve Orion'un bulunduğu yer (spec 24). */
  yerler(): { ozyn: Yer; orion: Yer };
  /** Kapıdan geçmeden ovaya çık (ikisi birlikte; kapı yolu `kapidene`nin işi). Çıkılamazsa false. */
  ovayaCik(): Promise<boolean>;
  /**
   * ORTAM aracı (ova'nın ışığı/stili/zamanı; `ortamdene`): ova'nın GERÇEK tanımı (ofiste null), hatırlama kipi, öğrenen
   * sözlüğün kayıt sayısı ve ofise dönüş (kalıcılık denemesi için).
   */
  /** Orion Doktor (`uygulama/doktor.ts`): `efektdene` ve ileride canlı hata tespiti AYNI muayeneyi çalıştırır. */
  readonly doktor: Doktor;
  /** Ofisteki 3. monitör (groma haritası; `gromadene`). */
  readonly webMonitoru: WebMonitoru;
  /** Göz muayenesi (`gozlemdene`): Orion'un gözünden kare → görme modeli → panel. */
  readonly gozlem: Gozlem;
  /** Sekans (spec 36; `sekansdene`): örnekler, gerçek oynatıcı, Sekans sekmesi ve editör. Oynatma yalnız `?sekansdene=1` ya da `?kimododene=1` (spec 37) koşusunda. */
  readonly sekans: SekansSenaryoYuzu;
  /** Dok sistemi (spec 39 D3): `dokdene` bölgeleri, taşımayı ve kalıcılığı buradan sınar. */
  readonly dok: DokYoneticisi;
  /** Eklenti defteri (spec 40): `eklentidene` açma/kapama, rozet ve kapıları buradan sınar. */
  readonly eklentiler: EklentiDefteri;
  /** Orion'un ayar panelini aç/kapat (imleç kipi açılır): `eklentidene` Eklentiler bölümünü gerçek DOM'da sınar. */
  ayarAc(): void;
  ayarKapat(): void;
  /** İçerik gezgini (spec 39 D4): `icerikdene` panelin gerçek DOM'unu ve işlemlerini buradan sınar. */
  readonly icerik: IcerikPaneli;
  /** Varlık/karakter önizleme penceresi (spec 39 D5): `icerikdene` yükleme, mesh hazırlığı ve çizimi buradan ölçer. */
  readonly onizleme: VarlikPenceresi;
  /** Yeni level + ışık aktörleri (spec 42; `leveldene`): pencere/panel kablolaması ve birleşik dünyadaki level (ofiste null). */
  readonly levelIsik: { readonly baglanti: LevelBaglantisi; level(): Level | null };
  /** Level Outliner (spec 39 D6) ve sahnedeki seçim durumu (spec 28): `icerikdene` ikisinin eşleşmesini ölçer. */
  readonly outliner: OutlinerPaneli;
  readonly secim: SecimDurumu;
  /** Graf editörü (`grafdene`, spec 38 §6): kayıtlı grafik adları, editörü aç/gizle. */
  readonly graf: { adlar(): string[]; ac(ad: string): void; gizle(): void; acikMi(): boolean; /** Senaryo koşusunun geçici deposuna küçük bir deneme grafiği yazar; adı döner. */ ornekOlustur(): Promise<string>; /** Senaryonun geçici deposuna verilen grafiği yazar (varsa hata). */ yeni(g: Graf): Promise<void> };
  /**
   * Aktör grafı SENARYO YÜZÜ (spec 43 A3; `aktordene`): Details'teki ▶ ■ düğmeleri yalnız gerçek tıklamayla çalışır (`isTrusted`), senaryo ise sentetik tıklama üretir;
   * gerçek çalıştırıcıyı sürmek için bu yüz var (`sekansiOynat` emsali). Üretimde başka çağıranı yoktur (bekçi: aktorCalistirici.test.ts).
   */
  readonly aktorGraf: { calistir(aktor: string, graf: string): { ok: true } | { ok: false; neden: string }; durdur(aktor: string): boolean; calisiyor(aktor: string): boolean; sayi(): number; bitti(): Promise<void>;
    /** Hata ayıklama (spec 43 A4): Devam/Adım düğmeleri yalnız gerçek tıklamayla çalışır; senaryo bu yüzle sürdürür. */
    devam(): boolean; adim(): boolean; duraklayan(): string[] };
  /** Ozyn'in AYAK konumu (spec 45 B9; `bpdene`): tetik bileşenlerinin gözlediği kaynakla aynı (`giris.ts` `gozlenenler`). Salt okunur. */
  ozynKonumu(): { x: number; z: number };
  readonly ortam: {
    tanim(): LevelTanimi | null;
    kipAyarla(kip: "oturum" | "kalici"): void;
    ogrenilenSayisi(): number;
    odayaDon(): boolean;
  };
  /** Birleşik dünya (spec 27; `kapidene`): ofis kapısının açısı (rad; 0 kapalı, π/2 açık; kapı kurulmadıysa null) ve kameranın ofis içi derecesi. */
  readonly dunya: {
    kapiAcisi(): number | null; ic(): number;
    /** Işık Hacmi (GI spike 1; `gidene`): yalnız `?gi=hacim` ile ve birleşik dünya kurulduysa, yoksa null. */
    gi(): IsikHacmi | null;
  };
  // ── eylemler ──
  niyetiYurut(n: Niyet, id: string): void;
  onayKarari(onaylandi: boolean): void;
  algiSor(ne: Soru): Cevap;
  monitoreGec(): Promise<void>;
  admineGec(): Promise<void>;
  panelOdak(mesh: AbstractMesh, etiket: string): void;
  panoyuAl(): Pano | null;
  zoomUygula(yenidenCerceveleme?: boolean): void;
  // ── görme (spec 25 Faz 2) ──
  /** Son `sor gor`un kaydı (algı, betim, süre). */
  sonGorme(): GormeKaydi | null;
  /** Kullanılan görme modelinin adı (`?goz=`). */
  gozModeli(): string;
}

/** Senaryo adları — `3dorion.bat` modları ve URL anahtarları. Yükleyici yalnız bunları yükler. */
export const SENARYOLAR = [
  "terminaldene", "otodene", "gorudene", "sessizdene", "davranis", "tezdene", "gordene", "admindene",
  "zihindene", "onaydene", "tahtabeyin", "becerdene", "bakdene", "acidene", "saglobdene",
  "senaryodene", "eylemdene", "benlikdene", "apidene", "tahtadene", "hafizadene", "yuzdene", "baglamdene", "takipdene",
  "kapidene", "gozdene", "ovadene", "ortamdene", "gidene", "efektdene", "gromadene", "gozlemdene", "klipdene", "sekansdene", "kimododene", "rigdene", "kameradene", "grafdene",
  "projedene", "dokdene", "icerikdene", "eklentidene", "leveldene", "aktordene", "bpdene",
] as const;
export type SenaryoAdi = (typeof SENARYOLAR)[number];

/** URL'de istenen senaryolar (birden çok olabilir; sıra listedeki sıra). */
export function istenenSenaryolar(sorgu: string): SenaryoAdi[] {
  const q = new URLSearchParams(sorgu);
  return SENARYOLAR.filter((ad) => q.has(ad));
}
