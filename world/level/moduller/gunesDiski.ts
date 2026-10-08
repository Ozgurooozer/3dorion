// world/level/moduller/gunesDiski.ts — Gökte güneş diski: ışık sisteminin güneş yönünü izler.
//
// Işık canlı düzenlenebildiği için disk konumunu her karede güneş yönünden alır (ucuz). Işıksız, sisten
// etkilenmez, kameraya yapışık, her zaman kameraya dönük (billboard).
"use strict";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { LevelModulu } from "../cekirdek/modul.ts";

export const GUNES_DISKI_VARSAYILAN = {
  yaricap: 16,
  /** Kenar sayısı (lowpoly). */
  kenar: 10,
  renk: "gunes",
  /** Kameradan uzaklık (gök kubbesinin içinde kalmalı). */
  uzaklik: 440,
};
export type GunesDiskiAyari = typeof GUNES_DISKI_VARSAYILAN;

export const gunesDiskiModulu: LevelModulu<GunesDiskiAyari> = {
  tur: "gunesDiski",
  aciklama: "Güneş diski: ışığın güneş yönünü izler.",
  varsayilan: GUNES_DISKI_VARSAYILAN,
  kur(b, a) {
    const m = CreateDisc("gunes_diski", { radius: a.yaricap, tessellation: Math.max(3, Math.round(a.kenar)) }, b.sahne);
    m.billboardMode = Mesh.BILLBOARDMODE_ALL;
    m.infiniteDistance = true;
    m.isPickable = false;
    const malzeme = b.malzeme("gunes_diski", "pismis", { renk: b.renk(a.renk) });
    m.material = malzeme;
    const yerlestir = () => { const [x, y, z] = b.gunesYonu(); m.position = new Vector3(x, y, z).scale(a.uzaklik); };
    yerlestir();
    return { meshler: [m], guncelle: yerlestir, yokEt() { m.dispose(); malzeme.dispose(); } };
  },
};
