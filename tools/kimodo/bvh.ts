// tools/kimodo/bvh.ts — BVH AYRIŞTIRICI + İLERİ KİNEMATİK (spec 37 §4). SAF: metin girer, eklemler ve kare başına dünya dönmesi/konumu çıkar.
//
// BVH kuralı (bu dosyanın varsayımı; Kimodo çıktısıyla NPZ `posed_joints` üzerinden çapraz doğrulandı, kimodoCevir.test.ts):
//   • OFFSET ebeveynin yerel çerçevesinde; konum kanalı (Xposition…) olan eklemde yerel konum = KANAL değeri (OFFSET'in yerine; Kimodo'da Hips
//     OFFSET'i 100 cm ama kanal 98.85 cm — toplansa kalça 2 m'de olurdu).
//   • Dönme kanalları yazıldığı sırayla çarpılır: "Zrotation Yrotation Xrotation" → R = Rz·Ry·Rx (sütun vektör), derece.
//   • Birim dosyanın birimi (Kimodo: santimetre); çevirici metreye böler.
"use strict";
import { bvhDonmesi, carp, topla, uygula, type M3, type V3 } from "./matris.ts";

export type KanalAdi = "Xposition" | "Yposition" | "Zposition" | "Xrotation" | "Yrotation" | "Zrotation";
const KANAL_ADLARI: readonly string[] = ["Xposition", "Yposition", "Zposition", "Xrotation", "Yrotation", "Zrotation"];

export interface BvhEklemi {
  ad: string;
  /** Ebeveynin dizini; kök −1. */
  ebeveyn: number;
  ofset: V3;
  kanallar: KanalAdi[];
  /** Bu eklemin karedeki ilk kanal sütunu. */
  sutun: number;
}

export interface Bvh {
  eklemler: BvhEklemi[];
  kareSayisi: number;
  /** Saniye. */
  kareSuresi: number;
  /** kare × kanal (toplam sütun). */
  kareler: number[][];
}

/** BVH metnini ayrıştırır. Bozuk dosyada NEDENLİ hata fırlatır (satır numarasıyla). */
export function bvhAyristir(metin: string): Bvh {
  const satirlar = metin.split(/\r?\n/);
  const eklemler: BvhEklemi[] = [];
  const yigin: number[] = [];
  let sutun = 0, i = 0, son = -1, ucBlogu = 0;
  const hata = (m: string): never => { throw new Error(`BVH satır ${i + 1}: ${m}`); };
  if (satirlar[0]?.trim() !== "HIERARCHY") hata("ilk satır HIERARCHY olmalı");
  for (i = 1; i < satirlar.length; i++) {
    const p = satirlar[i]!.trim().split(/\s+/);
    if (p[0] === "MOTION") break;
    if (p[0] === "ROOT" || p[0] === "JOINT") {
      if (!p[1]) hata("eklem adı yok");
      eklemler.push({ ad: p[1]!, ebeveyn: yigin.length ? yigin[yigin.length - 1]! : -1, ofset: [0, 0, 0], kanallar: [], sutun });
      son = eklemler.length - 1;
    } else if (p[0] === "End") { ucBlogu++; }
    else if (p[0] === "{") { if (ucBlogu) ucBlogu++; else yigin.push(son); }
    else if (p[0] === "}") { if (ucBlogu) { ucBlogu--; if (ucBlogu === 1) ucBlogu = 0; } else yigin.pop(); }
    else if (p[0] === "OFFSET" && !ucBlogu) {
      const v = p.slice(1, 4).map(Number);
      if (v.length !== 3 || v.some((x) => !Number.isFinite(x))) hata("OFFSET üç sayı olmalı");
      eklemler[son]!.ofset = v as V3;
    } else if (p[0] === "CHANNELS") {
      const n = Number(p[1]);
      const k = p.slice(2);
      if (k.length !== n || k.some((x) => !KANAL_ADLARI.includes(x))) hata(`CHANNELS ${n} kanal bildiriyor, gelen: ${k.join(" ")}`);
      eklemler[son]!.kanallar = k as KanalAdi[];
      sutun += n;
    }
  }
  if (!eklemler.length) hata("eklem yok");
  const kareSayisi = Number(satirlar[++i]?.trim().replace(/^Frames:\s*/, ""));
  const kareSuresi = Number(satirlar[++i]?.trim().replace(/^Frame Time:\s*/, ""));
  if (!Number.isInteger(kareSayisi) || kareSayisi < 1) hata("Frames: pozitif tamsayı olmalı");
  if (!(kareSuresi > 0)) hata("Frame Time: pozitif olmalı");
  const kareler: number[][] = [];
  for (let k = 0; k < kareSayisi; k++) {
    i++;
    const v = (satirlar[i] ?? "").trim().split(/\s+/).map(Number);
    if (v.length !== sutun || v.some((x) => !Number.isFinite(x))) hata(`kare ${k}: ${sutun} sayı beklendi, gelen ${v.length}`);
    kareler.push(v);
  }
  return { eklemler, kareSayisi, kareSuresi, kareler };
}

export interface KarePozu {
  /** Eklem başına dünya dönmesi (sütun vektör). */
  donme: M3[];
  /** Eklem başına dünya konumu (dosya birimi). */
  konum: V3[];
}

/** Bir karenin ileri kinematiği (ebeveyn önce gelir: BVH sırası bunu garanti eder). */
export function ileriKinematik(b: Bvh, kare: number): KarePozu {
  const v = b.kareler[kare]!;
  const donme: M3[] = [], konum: V3[] = [];
  for (const [j, e] of b.eklemler.entries()) {
    let yerelKonum: V3 = [...e.ofset];
    const sira: ("X" | "Y" | "Z")[] = [], acilar: number[] = [];
    for (const [c, k] of e.kanallar.entries()) {
      const d = v[e.sutun + c]!;
      // Konum kanalı OFFSET'in o bileşeninin YERİNE geçer (Kimodo'da üçü birden).
      if (k.endsWith("position")) yerelKonum[k === "Xposition" ? 0 : k === "Yposition" ? 1 : 2] = d;
      else { sira.push(k[0] as "X" | "Y" | "Z"); acilar.push(d); }
    }
    const yerel = bvhDonmesi(sira, acilar);
    if (e.ebeveyn < 0) { donme.push(yerel); konum.push(yerelKonum); continue; }
    const pd = donme[e.ebeveyn]!;
    donme.push(carp(pd, yerel));
    konum.push(topla(konum[e.ebeveyn]!, uygula(pd, yerelKonum)));
  }
  return { donme, konum };
}

export const eklemDizini = (b: Bvh, ad: string): number => {
  const i = b.eklemler.findIndex((e) => e.ad === ad);
  if (i < 0) throw new Error(`BVH'de '${ad}' eklemi yok`);
  return i;
};
