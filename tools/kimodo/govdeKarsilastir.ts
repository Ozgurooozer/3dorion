// tools/kimodo/govdeKarsilastir.ts — ÇEVİRİNİN NESNEL ÖLÇÜSÜ (spec 37 §6): çevrilen sekans GERÇEK VRM gövdesinde (assets/orion-lowpoly.glb, başsız NullEngine,
// klipGovdesi.test.ts düzeneği: avatarKur + jest niyeti + klip) oynatılır; uç etkileyicilerin (eller, ayaklar, baş) yeri kaynak BVH'nin aynı eklemleriyle
// karşılaştırılır. "Yönler doğru mu (sağ/sol, ön/arka, yukarı/aşağı)" sorusunun cevabı bu sayılardır; görüntünün güzelliği DEĞİL.
//
// Sekans bedene ürünün yolundan gider: `sekansiDerle` (uygulama/sekans/derleyici.ts) → klip → `jest` niyeti → yürütücü → uzuv sürücüsü (bosta klibi altta oynar).
// Konumlar beden kökünün (`<önek>_vrm_kok`: ayak hizası, kok ötelemesi DAHİL) çerçevesinde, metre.
// ÖLÇÜT (uç etkileyici E, zincir kökü R; boy farkı zincir uzunluğu oranıyla giderilir):
//   v_O(t) = p_O(E) − p_O(R),  v_K(t) = (L_O / L_K) · (p_K(E) − p_K(R))        L = zincirin dinlenme/T-poz uzunluğu
//   hata = ortalama |v_O − v_K| (cm) ve L_O'ya oranı; korelasyon = eksen başına Pearson (yalnız kaynakta ≥ 2 cm oynayan eksenler); gecikme 0–3 tik aranır.
"use strict";

import { readFileSync } from "node:fs";
import type { Sekans } from "../../protocol/sekans.ts";
import type { HamCeviri, SomaTpoz } from "./cevir.ts";
import { fark, olcekle, topla, uzunluk, type V3 } from "./matris.ts";

export interface UcOlcusu {
  ad: string;
  hataCm: number;
  hataOrani: number;
  /** Eksen → Pearson (yalnız kaynakta oynayan eksenler). */
  korelasyon: Partial<Record<"x" | "y" | "z", number>>;
  /** Kaynak eksen genliği (cm, tepe-tepe) — korelasyonun neyi ölçtüğünü göstermek için. */
  genlikCm: Partial<Record<"x" | "y" | "z", number>>;
  orionYolu: V3[];
  kaynakYolu: V3[];
}
export interface GovdeOlcusu { gecikmeTik: number; tik: number; uclar: UcOlcusu[]; kalcaY: { orion: number[]; kaynak: number[] }; ayakTabaniCm: number }

/** Uç etkileyiciler: [ad, Orion kemiği, Orion zincir kökü, SOMA eklemi, SOMA kökü, zincir eklemleri (uzunluk için; VRM, SOMA)]. */
export const UCLAR = [
  { ad: "sag_el", o: "rightHand", oKok: "rightUpperArm", s: "RightHand", sKok: "RightArm", oZ: ["rightUpperArm", "rightLowerArm", "rightHand"], sZ: ["RightArm", "RightForeArm", "RightHand"] },
  { ad: "sol_el", o: "leftHand", oKok: "leftUpperArm", s: "LeftHand", sKok: "LeftArm", oZ: ["leftUpperArm", "leftLowerArm", "leftHand"], sZ: ["LeftArm", "LeftForeArm", "LeftHand"] },
  { ad: "sag_ayak", o: "rightFoot", oKok: "rightUpperLeg", s: "RightFoot", sKok: "RightLeg", oZ: ["rightUpperLeg", "rightLowerLeg", "rightFoot"], sZ: ["RightLeg", "RightShin", "RightFoot"] },
  { ad: "sol_ayak", o: "leftFoot", oKok: "leftUpperLeg", s: "LeftFoot", sKok: "LeftLeg", oZ: ["leftUpperLeg", "leftLowerLeg", "leftFoot"], sZ: ["LeftLeg", "LeftShin", "LeftFoot"] },
  { ad: "bas", o: "head", oKok: "hips", s: "Head", sKok: "Hips", oZ: ["hips", "spine", "chest", "upperChest", "neck", "head"], sZ: ["Hips", "Spine1", "Spine2", "Chest", "Neck1", "Neck2", "Head"] },
] as const;

export function pearson(a: readonly number[], b: readonly number[]): number {
  const n = a.length, ma = a.reduce((t, x) => t + x, 0) / n, mb = b.reduce((t, x) => t + x, 0) / n;
  let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { s += (a[i]! - ma) * (b[i]! - mb); sa += (a[i]! - ma) ** 2; sb += (b[i]! - mb) ** 2; }
  return sa > 0 && sb > 0 ? s / Math.sqrt(sa * sb) : 0;
}

const zincirUzunlugu = (l: readonly V3[]) => l.slice(1).reduce((t, p, i) => t + uzunluk(fark(p, l[i]!)), 0);
/** Kaynak dizisini t (sn) anında doğrusal örnekler (30 kare/sn). */
const ornekle = (l: readonly V3[], t: number): V3 => {
  const f = Math.max(0, Math.min(l.length - 1, t * 30)), i = Math.floor(f), u = f - i, b = l[Math.min(l.length - 1, i + 1)]!;
  return topla(olcekle(l[i]!, 1 - u), olcekle(b, u));
};

/** `tikSayisi` kadar 50 ms tik oynatır (döngülü sekansta tur sayısı bununla). */
export async function govdedeKarsilastir(s: Sekans, ham: HamCeviri, tpoz: SomaTpoz, tikSayisi?: number): Promise<GovdeOlcusu> {
  const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
  const { Scene } = await import("@babylonjs/core/scene.js");
  const { FreeCamera } = await import("@babylonjs/core/Cameras/freeCamera.js");
  const { Vector3, Matrix } = await import("@babylonjs/core/Maths/math.vector.js");
  const { Saat } = await import("../../world/engine/tik.ts");
  const { avatarKur, klipKutuphanesiKur } = await import("../../world/avatar/index.ts");
  const { sekansiDerle } = await import("../../uygulama/sekans/derleyici.ts");
  const glb = `data:model/gltf-binary;base64,${readFileSync(new URL("../../assets/orion-lowpoly.glb", import.meta.url)).toString("base64")}`;

  const motor = new NullEngine();
  const sahne = new Scene(motor);
  new FreeCamera("kamera", new Vector3(0, 1.4, 4), sahne).setTarget(new Vector3(0, 1, 0));
  const saat = new Saat();
  const kutuphane = klipKutuphanesiKur();
  const d = sekansiDerle(s, kutuphane, 0, false, () => "kimodo_olcum");
  kutuphane.doldur(d.klipler.map((x) => x.klip));
  const u = console.warn, l = console.log;
  console.warn = () => {}; console.log = () => {};
  try {
    const orion = await avatarKur({ sahne, saat, spawn: { x: 0, y: 0, z: 0 }, vrmYolu: glb, vrmZorla: true, klipler: kutuphane });
    const kok = sahne.getTransformNodeByName("orion_vrm_kok")!;
    const kemikler = sahne.getTransformNodeByName("orion_klip_kok")!.getChildTransformNodes(false);
    const yer = (ad: string): V3 => {
      const n = kemikler.find((x) => x.name === ad);
      if (!n) throw new Error(`glb'de '${ad}' yok`);
      const zincir: (typeof n)[] = [];
      for (let x: typeof n | null = n; x; x = x.parent as typeof n | null) zincir.push(x);
      for (let i = zincir.length - 1; i >= 0; i--) zincir[i]!.computeWorldMatrix(true);
      const p = Vector3.TransformCoordinates(n.getAbsolutePosition(), Matrix.Invert(kok.getWorldMatrix()));
      return [p.x, p.y, p.z];
    };
    const kare = () => { saat.ilerle(50); orion.cizimGuncelle(0.05); sahne.render(); };
    kare(); kare();
    // Zincir uzunlukları: Orion dinlenme değil ŞU ANKİ (boşta) kemik uzunlukları — uzunluk duruştan bağımsızdır.
    const oL = UCLAR.map((c) => zincirUzunlugu(c.oZ.map(yer)));
    const sL = UCLAR.map((c) => zincirUzunlugu(c.sZ.map((a) => tpoz.eklemler[a]!.konum)));
    orion.niyet({ tur: "jest", jest: "bekliyor", klip: "kimodo_olcum" }, "kimodo_olcum");
    const N = tikSayisi ?? Math.ceil((s.sure_kare / 30) / 0.05);
    const orionYol = UCLAR.map(() => [] as V3[]);
    const kalcaO: number[] = [], ayakO: number[] = [];
    for (let n = 1; n <= N; n++) {
      kare();
      for (const [i, c] of UCLAR.entries()) orionYol[i]!.push(fark(yer(c.o), yer(c.oKok)));
      kalcaO.push(yer("hips")[1]);
      ayakO.push(Math.min(yer("rightFoot")[1], yer("leftFoot")[1]));
    }
    const sKonum = UCLAR.map((c) => ({ e: ham.kaynakKonumu(c.s), r: ham.kaynakKonumu(c.sKok) }));
    const kalcaK = ham.kaynakKonumu("Hips"), sagA = ham.kaynakKonumu("RightFoot"), solA = ham.kaynakKonumu("LeftFoot");
    /** n. ölçüm tikinin klip zamanı (g tik gecikmeyle; döngüsüz: ornekle son kareye kısar). */
    const zaman = (n: number, g: number) => Math.max(0, (n + 1 - g) * 0.05);
    const kaynakYolu = (i: number, g: number) => orionYol[i]!.map((_, n) => {
      const t = zaman(n, g);
      return olcekle(fark(ornekle(sKonum[i]!.e, t), ornekle(sKonum[i]!.r, t)), oL[i]! / sL[i]!);
    });
    const hata = (i: number, g: number) => { const k = kaynakYolu(i, g); return orionYol[i]!.reduce((t, p, n) => t + uzunluk(fark(p, k[n]!)), 0) / N; };
    let gecikme = 0, enIyi = Infinity;
    for (let g = -2; g <= 2; g += 0.25) { const h = UCLAR.reduce((t, _, i) => t + hata(i, g), 0); if (h < enIyi) { enIyi = h; gecikme = g; } }
    const uclar: UcOlcusu[] = UCLAR.map((c, i) => {
      const k = kaynakYolu(i, gecikme), o = orionYol[i]!;
      const korelasyon: UcOlcusu["korelasyon"] = {}, genlikCm: UcOlcusu["genlikCm"] = {};
      for (const [j, ex] of (["x", "y", "z"] as const).entries()) {
        const kv = k.map((p) => p[j]!), ov = o.map((p) => p[j]!);
        const g = Math.max(...kv) - Math.min(...kv);
        genlikCm[ex] = Number((g * 100).toFixed(1));
        if (g >= 0.02) korelasyon[ex] = Number(pearson(ov, kv).toFixed(3));
      }
      const h = hata(i, gecikme);
      return { ad: c.ad, hataCm: Number((h * 100).toFixed(2)), hataOrani: Number((h / oL[i]!).toFixed(4)), korelasyon, genlikCm, orionYolu: o, kaynakYolu: k };
    });
    const kalcaKaynak = kalcaO.map((_, n) => ham.bacakOrani * ornekle(kalcaK, zaman(n, gecikme))[1]);
    const ayakK = ayakO.map((_, n) => { const t = zaman(n, gecikme); return ham.bacakOrani * Math.min(ornekle(sagA, t)[1], ornekle(solA, t)[1]); });
    const ayakTabaniCm = Number((ayakO.reduce((t, v, n) => t + Math.abs(v - ayakK[n]!), 0) / N * 100).toFixed(2));
    return { gecikmeTik: gecikme, tik: N, uclar, kalcaY: { orion: kalcaO, kaynak: kalcaKaynak }, ayakTabaniCm };
  } finally { console.warn = u; console.log = l; motor.dispose(); }
}
