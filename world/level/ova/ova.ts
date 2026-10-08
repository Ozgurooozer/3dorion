// world/level/ova/ova.ts — Ova level'ini sahneye kurar (spec 17): gök, güneş, bulutlar, zemin, ışık, sis.
//
// Geometri saf (ovaGeometri.ts), malzeme tek fabrikadan (ovaMalzeme.ts), sayılar ovaVerisi.ts'te; burada
// yalnız Babylon'a sarma ve sahne ayarı. Odadan BAĞIMSIZ: olculer/capalar import edilmez.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { Scene as SahneSinifi } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { OVA, PALET, rastgele, type Renk } from "./ovaVerisi.ts";
import { zeminGeometrisi, gokGeometrisi, bulutGeometrisi, bulutYerleri, type Geometri } from "./ovaGeometri.ts";
import { ovaMalzemesi } from "./ovaMalzeme.ts";

export interface OvaKurulumu {
  meshler: Mesh[];
  zemin: Mesh;
  /** Her karede çağrılır (dt saniye): bulut sürüklenmesi. */
  guncelle(dt: number): void;
}

const c3 = (r: Renk) => new Color3(r[0], r[1], r[2]);

function meshKur(sahne: Scene, ad: string, g: Geometri): Mesh {
  const m = new Mesh(`ova_${ad}`, sahne);
  const v = new VertexData();
  v.positions = g.konum; v.colors = g.renk; v.normals = g.normal; v.indices = g.indeks;
  v.applyToMesh(m, false);
  m.isPickable = false;
  return m;
}

export function ovaKur(sahne: Scene): OvaKurulumu {
  // Ufuk rengi = arka plan = sis: kenarlar gökle eriyor, "uçsuz bucaksız" hissi.
  sahne.clearColor = new Color4(...PALET.gokUfuk, 1);
  sahne.fogMode = SahneSinifi.FOGMODE_EXP2;
  sahne.fogDensity = OVA.sisYogunluk;
  sahne.fogColor = c3(PALET.gokUfuk);

  const gunes = new Vector3(...OVA.gunesYonu).normalize();
  const gok = new HemisphericLight("ova_gok_isigi", new Vector3(0, 1, 0), sahne);
  gok.diffuse = c3(PALET.gokOrta);
  gok.groundColor = c3(PALET.cimKoyu);
  gok.intensity = 0.55;
  const isik = new DirectionalLight("ova_gunes_isigi", gunes.scale(-1), sahne);
  isik.diffuse = c3(PALET.gunes);
  isik.intensity = 1.05;

  const gokMesh = meshKur(sahne, "gok", gokGeometrisi());
  gokMesh.material = ovaMalzemesi(sahne, "gok", "pismis");
  gokMesh.infiniteDistance = true;   // kamera yürüse de gök kaçmaz
  gokMesh.applyFog = false;

  const disk = CreateDisc("ova_gunes", { radius: 16, tessellation: 10 }, sahne);
  disk.position = gunes.scale(OVA.gokYaricap * 0.92);
  disk.billboardMode = Mesh.BILLBOARDMODE_ALL;
  disk.infiniteDistance = true;
  disk.isPickable = false;
  disk.material = ovaMalzemesi(sahne, "gunes", "pismis", { renk: PALET.gunes });

  const rnd = rastgele(OVA.tohum);
  const bulut = meshKur(sahne, "bulut", bulutGeometrisi(bulutYerleri(rnd), rastgele(OVA.tohum + 1)));
  bulut.material = ovaMalzemesi(sahne, "bulut", "pismis");

  const zemin = meshKur(sahne, "zemin", zeminGeometrisi());
  zemin.material = ovaMalzemesi(sahne, "zemin", "isikli");
  zemin.freezeWorldMatrix();
  gokMesh.freezeWorldMatrix();

  // Bulutlar ağır ağır sürüklenir; halka dışına çıkan taraf görünmez olmadan döner (çok yavaş dönüş).
  const BULUT_DONUS = 0.004;   // rad/sn ≈ 26 dk'da bir tur
  return {
    meshler: [gokMesh, disk, bulut, zemin],
    zemin,
    guncelle(dt) { bulut.rotation.y += BULUT_DONUS * dt; },
  };
}
