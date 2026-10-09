// world/level/cekirdek/ruzgar.ts — Rüzgâr: köşeleri dünya uzayında sallayan malzeme eklentisi (çim, ileride yaprak).
//
// Neden eklenti: malzeme fabrikası (malzeme.ts) StandardMaterial veriyor; eklenti onun gölgelendiricisine
// `CUSTOM_VERTEX_UPDATE_WORLDPOS` noktasından kod ekler. O nokta dünya konumu hesaplandıktan SONRA,
// ekran konumu, sis ve gölge hesabından ÖNCE — sallanan çim doğru yerde gölge alır ve sislenir.
//
// Salınım yerel yüksekliğin KARESİYLE büyür: kök (y = 0) yerinde kalır, uç en çok kayar (eğilen sap).
// Bu yüzden rüzgârlı mesh'in yerel kökü y = 0'da, ucu y ≈ 1'de kurulmalı (ince örnek ölçeği boyu verir).
// Dalga dünya konumundan fazlanır: komşu tutamlar birlikte, uzaktakiler ayrı salınır (rüzgâr dalgası).
"use strict";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { Material } from "@babylonjs/core/Materials/material";
import type { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import { RegisterClass } from "@babylonjs/core/Misc/typeStore";

export interface RuzgarAyari {
  /** Uçtaki en büyük kayma (m, yerel boy 1 için). */
  guc: number;
  /** Salınım hızı (rad/sn). */
  hiz: number;
  /** Dalga sıklığı (1/m): küçükse geniş, yavaş dalgalar. */
  olcek: number;
  /** Rüzgârın estiği yön (derece, +X'ten +Z'ye). */
  aci: number;
}

export class RuzgarEklentisi extends MaterialPluginBase {
  ayar: RuzgarAyari;

  /** `ayar` verilmezse rüzgârsız (malzeme kopyası eklentiyi tek argümanla kurar — isikEklentisi.ts'deki not). */
  constructor(malzeme: Material, ayar: RuzgarAyari = { guc: 0, hiz: 0, olcek: 0.05, aci: 0 }) {
    super(malzeme, "Ruzgar", 200, { RUZGAR: false });
    this.ayar = ayar;
    this._enable(true);
  }

  override getClassName(): string { return "RuzgarEklentisi"; }

  override prepareDefines(defines: MaterialDefines): void { defines["RUZGAR"] = true; }

  override getUniforms() {
    return {
      ubo: [{ name: "ruzgarA", size: 4, type: "vec4" }, { name: "ruzgarB", size: 4, type: "vec4" }],
      vertex: "#ifdef RUZGAR\nuniform vec4 ruzgarA;\nuniform vec4 ruzgarB;\n#endif\n",
    };
  }

  override bindForSubMesh(ub: UniformBuffer): void {
    const a = this.ayar, r = (a.aci * Math.PI) / 180;
    // A: yön xz, güç, zaman · B: hız, ölçek. Zaman her çizimde güncel (performance.now: sayfa açıldığından beri).
    ub.updateFloat4("ruzgarA", Math.cos(r), Math.sin(r), a.guc, performance.now() / 1000);
    ub.updateFloat4("ruzgarB", a.hiz, a.olcek, 0, 0);
  }

  override getCustomCode(tur: string): Record<string, string> | null {
    if (tur !== "vertex") return null;
    return {
      CUSTOM_VERTEX_UPDATE_WORLDPOS: `
#ifdef RUZGAR
  float rzH = max(positionUpdated.y, 0.0);
  float rzT = ruzgarA.w * ruzgarB.x;
  vec2 rzP = worldPos.xz * ruzgarB.y;
  float rzS = 0.65 * sin(rzT + dot(rzP, ruzgarA.xy) * 6.2831) + 0.35 * sin(rzT * 1.7 + rzP.x * 9.1 + rzP.y * 4.3);
  worldPos.xz += ruzgarA.xy * (0.45 + 0.55 * rzS) * ruzgarA.z * rzH * rzH;
#endif
`,
    };
  }
}
RegisterClass("BABYLON.RuzgarEklentisi", RuzgarEklentisi);
