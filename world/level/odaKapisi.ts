// world/level/odaKapisi.ts — Ofisin kapısı: MENTEŞEDE DÖNEN kanat (spec 27; Ozyn 2026-10-14: "kapı açılır kapanır olsun").
//
// Kapıdan ışınlanma kalktı (ofis ova'nın içinde, aynı sahne): kapı artık gerçek bir kapı. Kanat glb'de DEĞİL, kodla kurulur
// (`assets/kaynak/oda-esyalar.py` varsayılan olarak kanatsız üretir; `--kapi-kanadi` eski hâli verir); kasa ve duvar boşluğu glb'de.
// Kanat menteşede (kapının +X kenarı) DIŞARIYA (+Z) döner: eşiğin ardı boş, içeride mobilyaya çarpmaz.
//
// Açılma kararı BURADA DEĞİL (kapı kimin yakın olduğunu bilmez): çağıran her tik `hedef(acik)` der, her karede `guncelle(dt)`.
// Çarpışmada kapı kanadı YOK: duvar boşluğu her zaman yürünür (yol bulma kapıyı kapalı görüp "yol yok" demesin); kanat, yakınlaşan
// biri için zaten açılmış olur (`kapiYakinMi`). Saf eğri `kapiAcisi` ayrı, Babylon'suz test edilir.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { KAPI, ODA } from "./olculer.ts";

/** Tam açık açı (radyan): 90° dışarı. */
export const KAPI_ACIK_ACI = Math.PI / 2;
/** Açılma/kapanma süresi (sn, 0 → tam açık). */
export const KAPI_SURESI = 0.6;
/** Biri bu kadar yakınsa kapı açılır (m, kapı merkezine XZ uzaklık). */
export const KAPI_ACMA_MESAFESI = 2.2;
/** Herkes bu kadar uzaklaşınca kapanır (m): açma mesafesinden büyük (titreşmesin; histerezis). */
export const KAPI_KAPAMA_MESAFESI = 3.4;

/** Kapı merkezi XZ (ön duvarın içinde). */
export const KAPI_MERKEZI = { x: KAPI.x, z: ODA.derinlik / 2 } as const;

/**
 * Kapı açık olmalı mı (SAF, histerezisli): yakındakilerin EN YAKININA bakar. Açıkken `KAPAMA`dan, kapalıyken `ACMA`dan
 * uzak olunca durum değişir.
 */
export function kapiYakinMi(simdiAcik: boolean, uzakliklar: readonly number[]): boolean {
  const enYakin = uzakliklar.length ? Math.min(...uzakliklar) : Infinity;
  return simdiAcik ? enYakin <= KAPI_KAPAMA_MESAFESI : enYakin <= KAPI_ACMA_MESAFESI;
}

/** Açı (SAF): hedefe `dt` boyunca sabit hızla; tam açıklık `KAPI_SURESI`de. */
export function kapiAcisi(simdi: number, hedef: number, dt: number): number {
  const adim = (KAPI_ACIK_ACI / KAPI_SURESI) * Math.max(0, dt);
  return simdi < hedef ? Math.min(hedef, simdi + adim) : Math.max(hedef, simdi - adim);
}

export interface KapiDenetimi {
  /** Açılmasını (true) ya da kapanmasını (false) iste. */
  hedef(acik: boolean): void;
  /** Her karede (saniye). */
  guncelle(dt: number): void;
  acikMi(): boolean;
  /** Şu anki açı (rad; 0 kapalı, KAPI_ACIK_ACI tam açık). */
  aci(): number;
  /** Kanadın mesh'leri (oda ışıklarına ve sayıma katılsın). */
  readonly meshler: readonly Mesh[];
  yokEt(): void;
}

export interface KapiMalzemeleri { kanat: Material | null; panel: Material | null; tokmak: Material | null }

export function odaKapisiKur(sahne: Scene, mal: KapiMalzemeleri): KapiDenetimi {
  const D = ODA.derinlik, G = KAPI.genislik;
  const mentese = new TransformNode("kapi_mentese", sahne);
  // Menteşe: kapının +X kenarı, iç yüzün biraz içinde (kanat z = D/2 − 0.03).
  mentese.position.set(KAPI.x + G / 2, 0, D / 2 - 0.03);
  const meshler: Mesh[] = [];
  const ekle = (m: Mesh, malzeme: Material | null, x: number, y: number, z: number) => {
    m.parent = mentese;
    m.position.set(x, y, z);
    if (malzeme) m.material = malzeme;
    m.isPickable = true;
    m.metadata = { capa: "kapi" };
    meshler.push(m);
  };
  // Kanat: menteşeden −X yönünde G genişliğinde.
  ekle(CreateBox("kapi_kanat", { width: G, height: KAPI.yukseklik, depth: 0.05 }, sahne), mal.kanat, -G / 2, KAPI.y, 0);
  // Paneller (Blender betiğindekiyle aynı ölçü ve yerler; kanat yerel z'si: iç yüz −0.03).
  for (const [py, ph] of [[0.55, 0.75], [1.55, 0.85]] as const) {
    for (const px of [-0.22, 0.22]) {
      ekle(CreateBox("kapi_panel", { width: 0.34, height: ph, depth: 0.02 }, sahne), mal.panel, px - G / 2, py, -0.03);
    }
  }
  // Tokmak: kilit kenarında (−X ucu), iki yüzde.
  for (const z of [-0.06, 0.06]) {
    ekle(CreateSphere("kapi_tokmak", { diameter: 0.07, segments: 8 }, sahne), mal.tokmak, -G + 0.12, 1.02, z);
  }
  let aci = 0, acik = false;
  const uygula = () => { mentese.rotation.y = aci; };
  uygula();
  return {
    hedef: (a) => { acik = a; },
    guncelle(dt) {
      const yeni = kapiAcisi(aci, acik ? KAPI_ACIK_ACI : 0, dt);
      if (yeni !== aci) { aci = yeni; uygula(); }
    },
    acikMi: () => acik,
    aci: () => aci,
    meshler,
    yokEt() { for (const m of meshler) m.dispose(); mentese.dispose(); },
  };
}
