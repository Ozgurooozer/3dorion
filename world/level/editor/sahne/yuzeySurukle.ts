// world/level/editor/sahne/yuzeySurukle.ts — Seçiliyi tutup yüzeyde kaydırma (gizmosuz hızlı yerleşim, spec 22).
//
// Tutulan nesne imlecin altındaki YÜZEYE oturur: arazi ya da başka bir nesnenin üstü (çatıya lamba, masaya
// bardak) — "her şey zemine sabit" sorununun asıl çözümü. Diğer seçililer tutulana göre aradaki farkı korur.
// Yaslama açıksa x/z ızgaraya, y o noktadaki yüzeye; "yüzeye otur" kapalıysa nesne başladığı YÜKSEKLİKTE yatay
// düzlemde kayar (havadaki nesneyi yüksekliğini bozmadan taşımak için). Tutarken tekerlek Y'de döndürür.
// Sürükleme boyunca yalnız düğümler oynar; bırakınca editör son dönüşümleri tek komutla yazar.
"use strict";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Vec3 } from "../../cekirdek/levelTanimi.ts";
import { etkin, konumYasla, normaleHizaliDonus, type YaslamaAyari } from "../cekirdek/yaslama.ts";
import type { Yuzey } from "./yuzey.ts";

interface Kayit { id: string; d: TransformNode; konum: Vector3; donus: Vector3; olcek: Vector3; fark: Vector3 }

export interface YuzeySurukleme {
  basla(dugumler: ReadonlyMap<string, TransformNode>, tutulan: string): void;
  tasi(x: number, y: number, yaslama: YaslamaAyari, ctrl: boolean): void;
  /** Y'de döndür (derece), son imleç konumuyla yeniden uygular. */
  dondur(derece: number): void;
  surukleniyor(): boolean;
  /** Bitti: oynatılan kimlikler (düğümler son yerinde kalır). */
  bitir(): string[];
  /** İptal: düğümler başladıkları yere. */
  iptal(): void;
}

const rad = (d: number) => (d * Math.PI) / 180;

export function yuzeySuruklemeKur(yuzey: Yuzey): YuzeySurukleme {
  let kayitlar: Kayit[] = [];
  let tutulan: Kayit | null = null;
  let ekYaw = 0;
  let son: { x: number; y: number; yaslama: YaslamaAyari; ctrl: boolean } | null = null;
  let haric = new Set<string>();

  const uygula = () => {
    if (!tutulan || !son) return;
    const { x, y, yaslama, ctrl } = son;
    let nokta: Vector3 | null = null, normal: Vec3 = [0, 1, 0];
    if (yaslama.yuzeyeOtur) {
      const h = yuzey.ekrandan(x, y, haric);
      if (!h) return;
      nokta = new Vector3(...h.nokta); normal = h.normal;
    } else {
      // Başlangıç yüksekliğinde yatay düzlem.
      const r = yuzey.ekranIsini(x, y);
      const t = r.intersectsPlane(Plane.FromPositionAndNormal(tutulan.konum, Vector3.Up()));
      if (t === null) return;
      nokta = r.origin.add(r.direction.scale(t));
    }
    if (etkin(yaslama.konum, ctrl)) {
      const [sx, , sz] = konumYasla([nokta.x, nokta.y, nokta.z], yaslama, true, [true, false, true]);
      nokta.x = sx; nokta.z = sz;
      if (yaslama.yuzeyeOtur) {
        nokta.y = yuzey.altindaki(sx, sz, nokta.y + 0.5, haric);
        normal = yuzey.araziNormali(sx, sz);
      }
    }
    const tek = kayitlar.length === 1;
    const c = Math.cos(rad(ekYaw)), s = Math.sin(rad(ekYaw));
    for (const k of kayitlar) {
      // Fark tutulan çevresinde Y'de döner (Babylon sol el: x' = x·c + z·s, z' = −x·s + z·c).
      const f = k.fark;
      k.d.position.set(nokta.x + f.x * c + f.z * s, nokta.y + f.y, nokta.z - f.x * s + f.z * c);
      k.d.rotationQuaternion = null;
      if (tek && yaslama.yuzeyeOtur && yaslama.normaleHizala) {
        const r = normaleHizaliDonus(normal, (k.donus.y * 180) / Math.PI + ekYaw);
        k.d.rotation.set(rad(r[0]), rad(r[1]), rad(r[2]));
      } else {
        k.d.rotation.set(k.donus.x, k.donus.y + rad(ekYaw), k.donus.z);
      }
    }
  };

  return {
    basla(dugumler, id) {
      kayitlar = [...dugumler].map(([kid, d]) => ({ id: kid, d, konum: d.position.clone(), donus: d.rotation.clone(), olcek: d.scaling.clone(), fark: Vector3.Zero() }));
      tutulan = kayitlar.find((k) => k.id === id) ?? null;
      if (!tutulan) { kayitlar = []; return; }
      for (const k of kayitlar) k.fark = k.konum.subtract(tutulan.konum);
      haric = new Set(kayitlar.map((k) => k.id));
      ekYaw = 0; son = null;
    },
    tasi(x, y, yaslama, ctrl) { son = { x, y, yaslama, ctrl }; uygula(); },
    dondur(derece) { ekYaw += derece; uygula(); },
    surukleniyor: () => tutulan !== null,
    bitir() {
      const idler = son ? kayitlar.map((k) => k.id) : [];
      if (!son) for (const k of kayitlar) { k.d.position.copyFrom(k.konum); k.d.rotation.copyFrom(k.donus); }
      kayitlar = []; tutulan = null; son = null;
      return idler;
    },
    iptal() {
      for (const k of kayitlar) { k.d.rotationQuaternion = null; k.d.position.copyFrom(k.konum); k.d.rotation.copyFrom(k.donus); k.d.scaling.copyFrom(k.olcek); }
      kayitlar = []; tutulan = null; son = null;
    },
  };
}
