// world/level/editor/sahne/gizmo.ts — Taşı / döndür / ölçek okları ve sınır kutusu (spec 22).
//
// Babylon gizmo'ları ayrı bir "yardımcı katman"da çizilir (sahnenin ışık sonrası zincirine, stil çizgisine girmez,
// nesnelerin arkasında kalsa da görünür). GizmoManager KULLANILMIYOR: onun sınır kutusu kipi nesneye serbest
// 6-eksen sürükleme davranışı takıyor — bizim yüzeyde sürüklemeyle çakışırdı; dört gizmo burada elle kurulur.
//
// ÇOKLU SEÇİM: gizmo tek bir PİVOT düğüme takılır (tek seçimde nesnenin tabanı, çoklu seçimde konumların ortası).
// Sürükleme başlarken seçili düğümler pivota BAĞLANIR (dünya dönüşümü korunarak), bitince çözülür ve son
// dönüşümleri tek komutla tanıma yazılır (editör `bitince`). Sürükleme boyunca tanım değişmez — yalnız düğümler oynar.
// Sınır kutusu kipinde pivot, seçimin dünya kutusu biçiminde görünmez bir mesh'tir (BoundingBoxGizmo mesh ister).
//
// Bilinen sınır: dönmüş nesneleri eşit olmayan ölçekle (eksen başına) gruplu ölçeklemek kayma (shear) üretir;
// Euler + ölçek ile yazılamaz, en yakın ayrıştırma yazılır.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { UtilityLayerRenderer } from "@babylonjs/core/Rendering/utilityLayerRenderer";
import { PositionGizmo } from "@babylonjs/core/Gizmos/positionGizmo";
import { RotationGizmo } from "@babylonjs/core/Gizmos/rotationGizmo";
import { ScaleGizmo } from "@babylonjs/core/Gizmos/scaleGizmo";
import { BoundingBoxGizmo } from "@babylonjs/core/Gizmos/boundingBoxGizmo";
import type { AracAdi } from "../cekirdek/durum.ts";
import type { YaslamaAyari } from "../cekirdek/yaslama.ts";
import { etkin } from "../cekirdek/yaslama.ts";

export interface GizmoAyari { arac: AracAdi; uzay: "dunya" | "yerel"; yaslama: YaslamaAyari; ctrl: boolean }

export interface GizmoKatmani {
  ayarla(a: GizmoAyari): void;
  /** Seçili düğümler (sıra: son eleman etkin — yerel eksen ondan). Sürüklerken çağrılırsa yok sayılır. */
  bagla(dugumler: readonly TransformNode[]): void;
  surukleniyor(): boolean;
  /** İmleç bir gizmo tutamağının üstünde mi (tıklama seçime gitmesin). */
  ustunde(): boolean;
  /** Süren sürüklemeyi iptal: düğümler başladıkları yere. */
  iptal(): boolean;
  /** Sürükleme başlayınca / bitince (bitince: oynatılan düğümler, dünya dönüşümleri yerinde). */
  basinca(f: () => void): void;
  bitince(f: (dugumler: readonly TransformNode[]) => void): void;
  goster(acik: boolean): void;
  yokEt(): void;
}

interface Kayit { d: TransformNode; ust: TransformNode | null; konum: Vector3; donus: Vector3; olcek: Vector3 }

export function gizmoKatmaniKur(sahne: Scene): GizmoKatmani {
  const katman = new UtilityLayerRenderer(sahne);
  katman.utilityLayerScene.autoClearDepthAndStencil = true;
  const pivot = new TransformNode("editor_pivot", sahne);
  const kutuMesh = new Mesh("editor_kutu", sahne);
  kutuMesh.isVisible = false; kutuMesh.isPickable = false;
  kutuMesh.metadata = { cizgisiz: true };

  const konumG = new PositionGizmo(katman, 1.5);
  konumG.planarGizmoEnabled = true;
  const donusG = new RotationGizmo(katman, 48, false, 1.5);
  const olcekG = new ScaleGizmo(katman, 1.5);
  const kutuG = new BoundingBoxGizmo(new Color3(1, 0.62, 0.15), katman);
  kutuG.ignoreChildren = true;
  kutuG.fixedDragMeshScreenSize = true;
  kutuG.scaleBoxSize = 0.12; kutuG.rotationSphereSize = 0.14;
  const hepsi = [konumG, donusG, olcekG, kutuG] as const;

  let ayar: GizmoAyari | null = null;
  let secili: TransformNode[] = [];
  let suruklenen: Kayit[] = [];
  let surukluyor = false, gorunur = true;
  const basDinleyici: (() => void)[] = [], bitDinleyici: ((d: readonly TransformNode[]) => void)[] = [];

  const etkinGizmo = () => {
    switch (ayar?.arac) {
      case "tasi": return konumG;
      case "dondur": return donusG;
      case "olcek": return olcekG;
      case "kutu": return kutuG;
      default: return null;
    }
  };

  /** Pivotu seçime yerleştirir (sürükleme yokken). */
  const pivotuYerlestir = () => {
    const son = secili[secili.length - 1];
    if (!son) return;
    for (const d of secili) d.computeWorldMatrix(true);
    const merkez = secili.length === 1 ? son.getAbsolutePosition().clone()
      : secili.reduce((t, d) => t.addInPlace(d.getAbsolutePosition()), Vector3.Zero()).scaleInPlace(1 / secili.length);
    pivot.position.copyFrom(merkez);
    pivot.rotationQuaternion = null;
    pivot.rotation.copyFrom(ayar?.uzay === "yerel" ? son.rotation : Vector3.Zero());
    pivot.scaling.setAll(1);
    if (ayar?.arac === "kutu") kutuyuKur();
  };

  /** Seçimin dünya kutusu biçiminde görünmez mesh (sınır kutusu gizmosu buna takılır). */
  const kutuyuKur = () => {
    let min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const d of secili) {
      const s = d.getHierarchyBoundingVectors(true);
      if (!Number.isFinite(s.min.x)) { min = Vector3.Minimize(min, d.getAbsolutePosition()); max = Vector3.Maximize(max, d.getAbsolutePosition()); continue; }
      min = Vector3.Minimize(min, s.min); max = Vector3.Maximize(max, s.max);
    }
    if (!Number.isFinite(min.x)) return;
    const boy = max.subtract(min);
    const yeni = CreateBox("editor_kutu_g", { width: Math.max(boy.x, 0.05), height: Math.max(boy.y, 0.05), depth: Math.max(boy.z, 0.05) }, sahne);
    yeni.geometry?.applyToMesh(kutuMesh);
    yeni.dispose();
    kutuMesh.rotationQuaternion = null;
    kutuMesh.rotation.setAll(0);
    kutuMesh.scaling.setAll(1);
    kutuMesh.position.copyFrom(min.add(max).scale(0.5));
    kutuMesh.computeWorldMatrix(true);
    kutuMesh.refreshBoundingInfo();
    kutuG.updateBoundingBox();
  };

  const takil = () => {
    const g = etkinGizmo();
    for (const x of hepsi) {
      if (x === kutuG) { if (x !== g || !secili.length || !gorunur) kutuG.attachedMesh = null; }
      else if (x !== g || !secili.length || !gorunur) x.attachedNode = null;
    }
    if (!g || !secili.length || !gorunur) return;
    pivotuYerlestir();
    if (g === kutuG) kutuG.attachedMesh = kutuMesh;
    else g.attachedNode = pivot;
  };

  const yaslamaUygula = () => {
    if (!ayar) return;
    const y = ayar.yaslama;
    konumG.snapDistance = etkin(y.konum, ayar.ctrl) ? y.konumAdim : 0;
    donusG.snapDistance = etkin(y.aci, ayar.ctrl) ? (y.aciAdim * Math.PI) / 180 : 0;
    olcekG.snapDistance = etkin(y.olcek, ayar.ctrl) ? y.olcekAdim : 0;
    const yerel = ayar.uzay === "yerel";
    konumG.updateGizmoRotationToMatchAttachedMesh = yerel;
    donusG.updateGizmoRotationToMatchAttachedMesh = yerel;
    olcekG.updateGizmoRotationToMatchAttachedMesh = true;   // ölçek eksenleri hep pivotun kendisi
  };

  const baslat = () => {
    if (surukluyor) return;
    surukluyor = true;
    const ust = ayar?.arac === "kutu" ? kutuMesh : pivot;
    ust.computeWorldMatrix(true);
    suruklenen = secili.map((d) => ({ d, ust: d.parent as TransformNode | null, konum: d.position.clone(), donus: d.rotation.clone(), olcek: d.scaling.clone() }));
    for (const k of suruklenen) k.d.setParent(ust);
    for (const f of basDinleyici) f();
  };
  const coz = () => {
    for (const k of suruklenen) { k.d.setParent(k.ust); if (k.d.rotationQuaternion) { k.d.rotation.copyFrom(k.d.rotationQuaternion.toEulerAngles()); k.d.rotationQuaternion = null; } }
  };
  const bitir = () => {
    if (!surukluyor) return;
    surukluyor = false;
    coz();
    const oynayan = suruklenen.map((k) => k.d);
    suruklenen = [];
    pivotuYerlestir();
    for (const f of bitDinleyici) f(oynayan);
  };

  for (const g of [konumG, donusG, olcekG]) { g.onDragStartObservable.add(baslat); g.onDragEndObservable.add(bitir); }
  kutuG.onDragStartObservable.add(baslat);
  kutuG.onScaleBoxDragEndObservable.add(bitir);
  kutuG.onRotationSphereDragEndObservable.add(bitir);

  return {
    ayarla(a) {
      const aracDegisti = a.arac !== ayar?.arac || a.uzay !== ayar?.uzay;
      ayar = a;
      yaslamaUygula();
      if (aracDegisti && !surukluyor) takil();
    },
    bagla(dugumler) {
      if (surukluyor) return;
      secili = [...dugumler];
      takil();
    },
    surukleniyor: () => surukluyor,
    // Üstünde durma: yardımcı katman kendi işaretçi seçimini yapar, gizmo `isHovered` tutar.
    ustunde: () => surukluyor || hepsi.some((g) => g.isHovered),
    iptal() {
      if (!surukluyor) return false;
      surukluyor = false;
      for (const k of suruklenen) {
        k.d.setParent(k.ust);
        k.d.rotationQuaternion = null;
        k.d.position.copyFrom(k.konum); k.d.rotation.copyFrom(k.donus); k.d.scaling.copyFrom(k.olcek);
      }
      suruklenen = [];
      // Babylon'un sürükleme davranışı işaretçi bırakılana dek sürer: gizmoyu söküp takmak onu keser.
      for (const x of hepsi) { if (x === kutuG) kutuG.attachedMesh = null; else x.attachedNode = null; }
      takil();
      return true;
    },
    basinca(f) { basDinleyici.push(f); },
    bitince(f) { bitDinleyici.push(f); },
    goster(acik) { gorunur = acik; if (!surukluyor) takil(); },
    yokEt() {
      for (const g of hepsi) g.dispose();
      pivot.dispose(); kutuMesh.dispose();
      katman.dispose();
    },
  };
}
