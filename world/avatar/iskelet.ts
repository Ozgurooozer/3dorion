// world/avatar/iskelet.ts — Avatar iskeletinin SÖZLEŞMESİ.
//
// `beden.ts` yalnızca bu arayüzü tanır: karşısındakinin VRM mi yoksa prosedürel
// bloklardan mı yapıldığını BİLMEZ. VRM yüklenemediğinde tek satır değişmeden
// prosedürel iskelete geçilebilmesinin sebebi budur.
//
// Buradaki hiçbir fonksiyon KARAR VERMEZ. `yurutucu.ts` ne yapılacağını
// söyler, bu arayüz onu mesh'e/kemiğe uygular.
"use strict";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Jest, Poz } from "../../protocol/niyet.ts";

export interface IskeletBilgisi {
  tur: "vrm" | "prosedurel";
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
  /** Kök düğüm. Konum ve gövde yaw'ı buna uygulanır. */
  readonly kok: TransformNode;
  readonly bilgi: IskeletBilgisi;

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
}
