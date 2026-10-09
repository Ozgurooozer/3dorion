// world/level/editor/sahne/yuzey.ts — "İmlecin altındaki yüzey": arazi + yerleştirilmiş nesneler (spec 22).
//
// Yerleştirme, yüzeyde sürükleme, yapıştırma, tekerlekle yaklaşma ve End (zemine indir) hep bunu sorar.
// Arazi MESH olarak toplanmaz: zemin modülünün analitik yükseklik işlevi (`level.yukseklik`) üzerinde ışın
// yürütülür — çim hücreleri (500 bin tutam) ve gök kubbesi seçim ışınına hiç girmez, yamaçta normal de oradan.
// Nesneler mesh ışınıyla (Babylon pick, yalnız yerleşim mesh'leri; `haric` kümesindekiler sayılmaz: sürüklenen
// nesne kendi üstüne oturmasın).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Level } from "../../cekirdek/levelKur.ts";
import type { Vec3 } from "../../cekirdek/levelTanimi.ts";

export interface YuzeyIsabeti {
  nokta: Vec3;
  /** Birim yüzey normali. */
  normal: Vec3;
  /** Çarpılan yerleşimin kimliği (arazi ise null). */
  id: string | null;
  uzaklik: number;
}

export interface Yuzey {
  /** Işının ilk çarptığı yüzey (arazi ya da nesne); yoksa null. */
  isin(r: Ray, haric?: ReadonlySet<string>): YuzeyIsabeti | null;
  /** Tuval pikselinden (CSS piksel, tuvalin sol üstüne göre). */
  ekrandan(x: number, y: number, haric?: ReadonlySet<string>): YuzeyIsabeti | null;
  /** Yalnız ARAZİ (nesneler yok sayılır): arazi aracı binanın arkasındaki/altındaki zemini işler (Unreal sculpt gibi). */
  araziden(x: number, y: number): YuzeyIsabeti | null;
  /** Tuval pikselinden ışın (kamera ışını). */
  ekranIsini(x: number, y: number): Ray;
  /** (x, z) noktasında `ustY`nin ALTINDAKİ en yüksek yüzey (End, yüzeye oturtma). */
  altindaki(x: number, z: number, ustY: number, haric?: ReadonlySet<string>): number;
  /** Arazi normali (sonlu fark). */
  araziNormali(x: number, z: number): Vec3;
}

const ARAZI_EN_UZAK = 800;

export function yuzeyKur(sahne: Scene, kamera: Camera, level: Level): Yuzey {
  const yuk = (x: number, z: number) => level.yukseklik(x, z);

  const araziNormali = (x: number, z: number): Vec3 => {
    const e = 0.25;
    const dx = yuk(x + e, z) - yuk(x - e, z), dz = yuk(x, z + e) - yuk(x, z - e);
    const n = new Vector3(-dx, 2 * e, -dz).normalize();
    return [n.x, n.y, n.z];
  };

  /** Işın boyunca araziyi ara: büyüyen adımla işaret değişimi, sonra ikiye bölme. */
  const araziIsini = (r: Ray): number | null => {
    const o = r.origin, d = r.direction;
    const fark = (t: number) => o.y + d.y * t - yuk(o.x + d.x * t, o.z + d.z * t);
    let t0 = 0, f0 = fark(0);
    if (f0 < 0) return null;   // kamera arazinin altında
    for (let t = 0.25; t < ARAZI_EN_UZAK; t += Math.max(0.25, t * 0.04)) {
      const f = fark(t);
      if (f <= 0) {
        let a = t0, b = t;
        for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (fark(m) > 0) a = m; else b = m; }
        return (a + b) / 2;
      }
      t0 = t; f0 = f;
    }
    return null;
  };

  const nesneMi = (m: AbstractMesh, haric?: ReadonlySet<string>) => {
    if (!m.isEnabled() || !m.isVisible || !m.isPickable) return false;
    const id = level.nesneler.idsi(m);
    return id !== null && !(haric?.has(id));
  };

  const isin = (r: Ray, haric?: ReadonlySet<string>): YuzeyIsabeti | null => {
    const p = sahne.pickWithRay(r, (m) => nesneMi(m, haric), false);
    const ta = araziIsini(r);
    const nesneUzak = p?.hit ? p.distance : Infinity, araziUzak = ta ?? Infinity;
    if (nesneUzak === Infinity && araziUzak === Infinity) return null;
    if (nesneUzak <= araziUzak && p?.pickedPoint) {
      const n = p.getNormal(true, true) ?? Vector3.Up();
      if (Vector3.Dot(n, r.direction) > 0) n.scaleInPlace(-1);   // arka yüz: normal ışına baksın
      return { nokta: [p.pickedPoint.x, p.pickedPoint.y, p.pickedPoint.z], normal: [n.x, n.y, n.z], id: level.nesneler.idsi(p.pickedMesh), uzaklik: nesneUzak };
    }
    const q = r.origin.add(r.direction.scale(araziUzak));
    return { nokta: [q.x, q.y, q.z], normal: araziNormali(q.x, q.z), id: null, uzaklik: araziUzak };
  };

  const ekranIsini = (x: number, y: number): Ray => {
    // Babylon pointerX/Y tuval CSS pikseli; createPickingRay donanım ölçeğini kendisi uygular.
    return sahne.createPickingRay(x, y, Matrix.Identity(), kamera);
  };

  return {
    isin,
    ekranIsini,
    ekrandan: (x, y, haric) => isin(ekranIsini(x, y), haric),
    araziden(x, y) {
      const r = ekranIsini(x, y), t = araziIsini(r);
      if (t === null) return null;
      const q = r.origin.add(r.direction.scale(t));
      return { nokta: [q.x, q.y, q.z], normal: araziNormali(q.x, q.z), id: null, uzaklik: t };
    },
    altindaki(x, z, ustY, haric) {
      const bas = new Vector3(x, ustY + 0.01, z);
      // Yalnız YUKARI bakan yüzler oturulacak yüzeydir: ışın bir binanın içinden başlarsa ilk çarptığı taban yüzüdür
      // (arkası) — oraya oturtmak nesneyi binanın tabanına gömüyordu (denemede yakalandı).
      const isabetler = sahne.multiPickWithRay(new Ray(bas, new Vector3(0, -1, 0), 2000), (m) => nesneMi(m, haric)) ?? [];
      let nesne = -Infinity;
      for (const p of isabetler) {
        if (!p.hit || !p.pickedPoint) continue;
        const n = p.getNormal(true, true);
        if (n && n.y > 0.2 && p.pickedPoint.y > nesne) nesne = p.pickedPoint.y;
      }
      const arazi = yuk(x, z);
      // Taban araziye gömülüyse (arazi yukarıda) araziye çık; değilse alttaki nesne ile arazinin yükseği.
      if (arazi > ustY) return arazi;
      return Math.max(nesne, arazi);
    },
    araziNormali,
  };
}
