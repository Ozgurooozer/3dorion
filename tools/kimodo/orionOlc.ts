// tools/kimodo/orionOlc.ts — ORION GÖVDESİ ÖLÇÜMÜ (spec 37 §4): gerçek `assets/orion-lowpoly.glb`, başsız (NullEngine). Çeviricinin Orion tarafındaki girdisi.
//
// NEDEN ÖLÇÜM (sabit sayı değil): sürücü klip dönmesini kemiğin O ANKİ duruşunun ÜSTÜNE ekler (uzuvSurucusu.ts); o an `bosta` klibi oynar. Çevirici bu
// yüzden (a) DİNLENME pozunu (glTF düğüm değerleri — ölçüldü: A-poz, kollar ~60° aşağı, T-poz DEĞİL) ve (b) BOŞTA pozunu (bosta klibinin 24 karesinin
// ortalaması) bilmeli. Her eşlenmiş kemik için gövde uzayında (klip kökü çerçevesi: yüzü +Z, yukarı +Y, sağı +X):
//   • dinlenme/boşta eklem konumu ve yön noktasının dinlenme konumu (metre),
//   • A = O_dinlenme · O_boşta⁻¹ (sütun vektör): boşta duruşundan dinlenme duruşuna gövde uzayı dönmesi,
//   • boşta saçılımı: 24 karenin ortalamadan en büyük açı farkı (derece) — çevirinin taban hatası bu kadar oynar.
// Çıktı `tools/kimodo/orionGovdesi.json` (çevirici Babylon'suz okur). Bekçi: kimodoCevir.olcum.test.ts dosyayı yeniden ölçümle karşılaştırır.
// Koşma: node --experimental-strip-types --import ./tools/babylon-cozucu.mjs tools/kimodo/orionOlc.ts [cikis.json]
"use strict";
import { readFileSync, writeFileSync } from "node:fs";
import { aciFarki, carp, devrik, diklestir, ortalamaDonme, type M3, type V3 } from "./matris.ts";
import { butunEklemler } from "../../world/avatar/zincirler.ts";

export interface OrionEklemi {
  kemik: string;
  dinlenme: V3;
  yonDinlenme: V3 | null;
  bosta: V3;
  /** 3×3 satır-ana, sütun vektör. */
  A: M3;
  bostaSacilimi: number;
}
export interface OrionGovdesi { kaynak: string; bostaKareleri: number; eklemler: Record<string, OrionEklemi> }

const yuvarla = (v: number, n = 6) => Number(v.toFixed(n));

export async function orionGovdesiniOlc(): Promise<OrionGovdesi> {
  const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
  const { Scene } = await import("@babylonjs/core/scene.js");
  const { Matrix, Vector3 } = await import("@babylonjs/core/Maths/math.vector.js");
  const { vrmIskeletYukle } = await import("../../world/avatar/vrm.ts");
  const glb = `data:model/gltf-binary;base64,${readFileSync(new URL("../../assets/orion-lowpoly.glb", import.meta.url)).toString("base64")}`;
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const u = console.warn, l = console.log;
  console.warn = () => {}; console.log = () => {};
  try {
    const isk = await vrmIskeletYukle(sahne, glb, { onek: "olc" });
    const kok = sahne.getTransformNodeByName("olc_klip_kok")!;
    const dugumler = kok.getChildTransformNodes(false);
    const bul = (ad: string) => { const d = dugumler.find((n) => n.name === ad); if (!d) throw new Error(`glb'de '${ad}' kemiği yok`); return d; };
    type Ham = { p: V3; O: M3 };
    /** Gövde uzayında konum ve 3×3 (satır-vektör Babylon matrisinin devriği = sütun biçimi; ayna/ölçek DAHİL — A'da sadeleşir). */
    const oku = (ad: string): Ham => {
      const ref = Matrix.Invert(kok.computeWorldMatrix(true));
      const m = bul(ad).computeWorldMatrix(true).multiply(ref).m;
      const p = Vector3.TransformCoordinates(Vector3.Zero(), Matrix.FromArray(m));
      return { p: [p.x, p.y, p.z], O: devrik([m[0]!, m[1]!, m[2]!, m[4]!, m[5]!, m[6]!, m[8]!, m[9]!, m[10]!]) };
    };
    const eklemler = butunEklemler();
    const dinlenme = new Map(eklemler.map((e) => [e.uzuv, { ...oku(e.kemik.vrm), yon: e.yon.vrm ? oku(e.yon.vrm).p : null }]));
    isk.pozUygula("duruyor", 0, 0);
    const g = sahne.animationGroups.find((x) => x.name === "bosta");
    if (!g) throw new Error("glb'de 'bosta' klibi yok");
    const N = 24;
    const ornekler = new Map<string, Ham[]>(eklemler.map((e) => [e.uzuv, []]));
    for (let i = 0; i < N; i++) {
      g.goToFrame(g.from + ((g.to - g.from) * i) / N);
      for (const e of eklemler) ornekler.get(e.uzuv)!.push(oku(e.kemik.vrm));
    }
    const sonuc: OrionGovdesi = { kaynak: "assets/orion-lowpoly.glb (NullEngine; bosta 24 kare ortalaması)", bostaKareleri: N, eklemler: {} };
    for (const e of eklemler) {
      const d = dinlenme.get(e.uzuv)!, o = ornekler.get(e.uzuv)!;
      // Her örnek için A_i = O_d · O_b⁻¹ (ayna/ölçek sadeleşir, saf dönme); ortalaması alınır.
      const Al = o.map((x) => diklestir(carp(d.O, tersi(x.O))));
      const A = ortalamaDonme(Al);
      const bosta: V3 = [0, 1, 2].map((k) => o.reduce((t, x) => t + x.p[k]!, 0) / N) as V3;
      sonuc.eklemler[e.uzuv] = {
        kemik: e.kemik.vrm, dinlenme: d.p.map((v) => yuvarla(v)) as V3, yonDinlenme: d.yon ? (d.yon.map((v) => yuvarla(v)) as V3) : null,
        bosta: bosta.map((v) => yuvarla(v)) as V3, A: A.map((v) => yuvarla(v, 7)), bostaSacilimi: yuvarla(Math.max(...Al.map((x) => aciFarki(x, A))) * 180 / Math.PI, 2),
      };
    }
    return sonuc;
  } finally { console.warn = u; console.log = l; motor.dispose(); }
}

/** Genel 3×3 tersi (ayna/ölçek içeren kemik matrisi için). */
function tersi(m: M3): M3 {
  const [a, b, c, d, e, f, g, h, i] = m as [number, number, number, number, number, number, number, number, number];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

if (import.meta.url === `file:///${process.argv[1]!.replace(/\\/g, "/").replace(/^\//, "")}`) {
  const cikis = process.argv[2] ?? new URL("./orionGovdesi.json", import.meta.url);
  const g = await orionGovdesiniOlc();
  const satirlar = Object.entries(g.eklemler).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  writeFileSync(cikis, `{\n"kaynak": ${JSON.stringify(g.kaynak)},\n"bostaKareleri": ${g.bostaKareleri},\n"eklemler": {\n${satirlar.join(",\n")}\n}\n}\n`);
  for (const [k, v] of Object.entries(g.eklemler)) process.stdout.write(`${k.padEnd(10)} saçılım ${v.bostaSacilimi}°\n`);
}
