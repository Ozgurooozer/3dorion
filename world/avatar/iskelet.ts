// world/avatar/iskelet.ts — Avatar iskeletinin SÖZLEŞMESİ.
//
// `beden.ts` yalnızca bu arayüzü tanır: karşısındakinin VRM mi yoksa prosedürel
// bloklardan mı yapıldığını BİLMEZ. VRM yüklenemediğinde tek satır değişmeden
// prosedürel iskelete geçilebilmesinin sebebi budur.
//
// Buradaki hiçbir fonksiyon KARAR VERMEZ. `yurutucu.ts` ne yapılacağını
// söyler, bu arayüz onu mesh'e/kemiğe uygular.
//
// SÜRÜCÜ ARAYÜZÜ — Babylon'a bağlı DEĞİL (2026-09-18).
//
// Eskiden burada `readonly kok: TransformNode` vardı ve arayüzün tek Babylon
// sızıntısı oydu. Geri kalan her şey saf sayı: yaw, pitch, faz, hız, açıklık,
// nefes, kapanma. Yani bu arayüz fiilen bir SERVO KOMUT SETİ; tek bir tip
// yüzünden renderer'a çakılı duruyordu.
//
// Donanımcıların yaptığı ayrım bu: `ros2_control`da denetleyici
// `SystemInterface` ile konuşur, karşısındakinin Gazebo mu gerçek eklem mi
// olduğunu bilmez. Kök düğüm artık uygulamanın İÇİNDE kalıyor; dışarıya
// yalnızca "şu konuma git" ve "şu an neredesin" sorulabiliyor.
//
// Sonuç: bu arayüzü uygulayan bir şeyin Babylon sahnesi OLMAK ZORUNDA DEĞİL.
"use strict";
import type { Vec3 } from "../../protocol/temel.ts";
import type { Jest, Poz } from "../../protocol/niyet.ts";
import type { Uzuv } from "../../protocol/animasyon.ts";
import type { UzuvDegeri } from "./klipOrnekleyici.ts";

export interface IskeletBilgisi {
  /**
   * Hangi sürücü bağlı.
   *
   * `ledyuz` GERÇEK DONANIMDIR (`world/avatar/ledYuz.ts`): gövdesi yok,
   * yalnızca yüz. Arayüz kısmi gövdeyi baştan destekliyordu — bayraklar
   * (`basDestegi` vb.) tam da bunun içindi.
   */
  tur: "vrm" | "prosedurel" | "ledyuz";
  /** İnsan-okur kaynak açıklaması — HUD ve log için. */
  kaynak: string;
  /** Ağız (blend shape / çene mesh'i) sürülebiliyor mu. */
  agizDestegi: boolean;
  /** Göz kırpma sürülebiliyor mu. */
  kirpmaDestegi: boolean;
  /** Baş ayrı döndürülebiliyor mu (boyun kemiği / baş pivotu bulundu mu). */
  basDestegi: boolean;
  /** Ölçülen ham boy (metre) — normalize edilmeden önce. */
  hamBoy: number;
}

export interface AvatarIskeleti {
  readonly bilgi: IskeletBilgisi;

  /** Kökü dünya konumuna taşı. Gövde yaw'ı ayrı: `govdeUygula`. */
  konumUygula(x: number, y: number, z: number): void;
  /**
   * ÇİZİLEN konum — mantıksal değil.
   *
   * `yurutucu.durum().konum` mantıksal doğrudur ve tik hızında ilerler;
   * burası sunum katmanının yumuşattığı, ekranda gerçekten görünen yerdir.
   * İkisi bilerek ayrı tutulur (testler aradaki farkı sınar).
   */
  cizimKonumu(): Vec3;

  /** Gövde yaw'ı (radyan, dünya uzayı). */
  govdeUygula(yaw: number): void;
  /** Baş: GÖVDEYE GÖRELİ yaw ve pitch (pozitif = yukarı). */
  basUygula(yaw: number, pitch: number): void;
  /** Duruş + yürüme fazı (0..1) + anlık hız (m/s). */
  pozUygula(poz: Poz, faz: number, hiz: number): void;
  /** Aktif jest ve 0..1 ilerlemesi. `null` = jest yok. */
  jestUygula(jest: Jest | null, ilerleme: number): void;
  /** Ağız açıklığı 0..1. Desteklenmiyorsa sessiz no-op — `bilgi` söyler. */
  agizUygula(aciklik: number): void;
  /** Boşta mikro-hareket: nefes ve ağırlık aktarımı, ikisi de -1..1. */
  bostaUygula(nefes: number, agirlik: number): void;
  /** Göz kapanma oranı 0..1. */
  gozKirp(kapali: number): void;
  gorunur(g: boolean): void;
  yokEt(): void;

  /**
   * KLİP (spec 35 Dilim 5a; isteğe bağlı): bu gövdede klip izinin GERÇEKTEN uygulanabildiği soyut uzuvlar (eşleme tablosu ∩ modelde bulunan
   * düğüm, `uzuvEslemesi.ts`). Yoksa (LED yüz) klip izleri uygulanmaz; beden klibin anlamını (`jest`) `jestUygula` ile gösterir.
   */
  readonly klipUzuvlari?: ReadonlySet<Uzuv>;
  /**
   * Bu karenin klip değerleri (gövde uzayı, derece/metre). Boş dizi = klip yok: iskelet yazdıklarını geri alır. Kümede olmayan uzvun izi
   * yok sayılır — sayımı yürütücü yapar (`atlananIzler`), burası değil.
   */
  klipUygula?(degerler: readonly UzuvDegeri[]): void;
  /**
   * Control Rig (spec 38): uzvun eklem noktasının DÜNYA konumu (bu karedeki; ebeveyn zinciri tazelenerek). Uzvu olmayan gövdede null. Kontrol şekilleri
   * buraya konur; Babylon'a bağlı olmayan Vec3 döner.
   */
  uzuvKonumu?(u: Uzuv): Vec3 | null;
}

/**
 * İskeletin GÖRÜNÜŞ seçenekleri (spec 33, ikinci beden). `onek`: düğüm/malzeme adlarının öneki (varsayılan "orion");
 * `renk`: gövde rengi #rrggbb (verilmezse modelin kendi rengi). İkisi de yalnız görünüşü değiştirir; davranış aynı.
 */
export interface IskeletGorunusu {
  onek?: string;
  renk?: string;
}
