// world/level/editor/sahne/yerlestirme.ts — Yerleştirme hayaleti: varlık ya da hazır yapı (parça) imleçle yüzeyde
// gezer, tıklayınca konur (spec 22).
//
// Hayalet yarı saydam örneklerdir (seçilemez, stil çizgisine girmez). Yüzey: arazi + nesnelerin üstü (üst üste
// koyma); yaslama ızgarası x/z'ye, "normale hizala" açıksa tek varlık yamaca eğik oturur. Tekerlek Y'de döndürür.
// Konan nesne editörün komutuyla tanıma yazılır (`koyulacak`), hayalet yerleştirme kipinde kalır (art arda koy).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Level } from "../../cekirdek/levelKur.ts";
import type { Vec3 } from "../../cekirdek/levelTanimi.ts";
import { donusRadyan, olcekVec } from "../../cekirdek/donusum.ts";
import { etkin, konumYasla, normaleHizaliDonus, type YaslamaAyari } from "../cekirdek/yaslama.ts";
import type { Parca } from "../cekirdek/pano.ts";
import type { Yuzey } from "./yuzey.ts";

export type YerlestirmeKaynagi = { tur: "varlik"; ad: string } | { tur: "parca"; parca: Parca; ad: string };

export interface Koyulacak { kaynak: YerlestirmeKaynagi; konum: Vec3; donus: Vec3 }

export interface Yerlestirme {
  basla(k: YerlestirmeKaynagi): Promise<void>;
  etkin(): boolean;
  kaynak(): YerlestirmeKaynagi | null;
  tasi(x: number, y: number, yaslama: YaslamaAyari, ctrl: boolean): void;
  dondur(derece: number): void;
  /** Hayaletin şu anki yeri (imleç yüzeyde değilse null). */
  koyulacak(): Koyulacak | null;
  bitir(): void;
}

export function yerlestirmeKur(sahne: Scene, level: Level, yuzey: Yuzey): Yerlestirme {
  let kaynak: YerlestirmeKaynagi | null = null;
  let hayalet: TransformNode | null = null;
  let nesil = 0;
  let yaw = 0;
  let yer: { konum: Vec3; donus: Vec3 } | null = null;
  let son: { x: number; y: number; yaslama: YaslamaAyari; ctrl: boolean } | null = null;

  const hayaletYap = (m: AbstractMesh) => {
    m.isPickable = false;
    m.visibility = 0.55;
    m.metadata = { ...(m.metadata as object | null), cizgisiz: true, hayalet: true };
  };

  const uygula = () => {
    if (!hayalet || !son || !kaynak) return;
    const h = yuzey.ekrandan(son.x, son.y);
    hayalet.setEnabled(!!h);
    if (!h) { yer = null; return; }
    let [x, y, z] = h.nokta;
    let normal = h.normal;
    if (etkin(son.yaslama.konum, son.ctrl)) {
      [x, , z] = konumYasla([x, y, z], son.yaslama, true, [true, false, true]);
      y = yuzey.altindaki(x, z, y + 0.5);
      normal = yuzey.araziNormali(x, z);
    }
    const donus: Vec3 = kaynak.tur === "varlik" && son.yaslama.normaleHizala ? normaleHizaliDonus(normal, yaw) : [0, yaw, 0];
    yer = { konum: [x, y, z], donus };
    hayalet.position.set(x, y, z);
    hayalet.rotationQuaternion = null;
    hayalet.rotation.set(...donusRadyan(donus));
  };

  const bitir = () => {
    nesil++;
    hayalet?.dispose(false, false);
    hayalet = null; kaynak = null; yer = null;
  };

  return {
    async basla(k) {
      bitir();
      kaynak = k;
      const benim = nesil;
      const kok = new TransformNode(`hayalet_${k.ad}`, sahne);
      hayalet = kok;
      kok.setEnabled(false);
      const parcalar = k.tur === "varlik" ? [{ varlik: k.ad, konum: [0, 0, 0] as Vec3, donus: 0 as number | Vec3, olcek: 1 as number | Vec3 }] : k.parca.nesneler;
      await Promise.all(parcalar.map(async (n) => {
        const d = await level.nesneler.ornekOlustur(n.varlik);
        if (benim !== nesil) { d.dispose(false, false); return; }
        d.parent = kok;
        d.position.set(...n.konum);
        d.rotation.set(...donusRadyan(n.donus));
        d.scaling.set(...olcekVec(n.olcek));
        for (const m of d.getChildMeshes(false)) hayaletYap(m);
      }));
      if (benim === nesil) uygula();
    },
    etkin: () => kaynak !== null,
    kaynak: () => kaynak,
    tasi(x, y, yaslama, ctrl) { son = { x, y, yaslama, ctrl }; uygula(); },
    dondur(derece) { yaw = (((yaw + derece) % 360) + 360) % 360; uygula(); },
    koyulacak: () => (kaynak && yer ? { kaynak, konum: [...yer.konum], donus: [...yer.donus] } : null),
    bitir,
  };
}
