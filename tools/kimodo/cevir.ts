// tools/kimodo/cevir.ts — YENİDEN HEDEFLEME (retarget) MATEMATİĞİ (spec 37 §4): Kimodo BVH karesi → Orion'un soyut uzuvlarında GÖVDE UZAYI dönme deltası. SAF.
//
// Sütun vektör kuralı (matris.ts). Her kare, her eşlenmiş uzuv i için:
//   Δ_i  = G_i · Oᵀ_i                   SOMA'da T-pozdan dünya farkı (G: BVH ileri kinematiği, O: standart T-poz ofseti — somaTpoz.json; NPZ ile doğrulandı)
//   Δᵇ_i = H · M · Δ_i · M               gövde uzayına: M = diag(−1, 1, 1) (SOMA +X = karakterin SOLU, bizde +X SAĞI; yukarı ve ileri aynı), H = ilk karenin
//                                         yönünü +Z'ye çeviren dik eksen dönmesi
//   C_i  = hizala(Orion dinlenme yönü → SOMA T-poz yönü)   Orion A-pozda dinlenir, SOMA T-pozda: dinlenme hizalaması (salınım, burulma eklemez)
//   S_i  = Δᵇ_i · C_i · A_i               A_i: Orion'un BOŞTA duruşundan dinlenmeye (orionGovdesi.json). S_i: boşta duruşundan hedefe gövde uzayı dönmesi
//   R_i  = S_i · S_ata⁻¹                  sürücü uzvu ebeveyn ÖNCE ve gövde uzayında ekler (uzuvSurucusu.ts: yerel' = yerel × P R P⁻¹); ata (zincirler.ts
//                                         `uzuvAtasi`) zaten S_ata'yı uyguladı, eşlenmemiş ara kemikler (omuz, üst göğüs) ona katı bağlı
// R_i sürücünün Euler'ine (Babylon YXZ) matris.ts'te çevrilir. `kok`: yalnız öteleme (bacak boyu oranıyla ölçekli kalça yüksekliği; yatay isteğe bağlı).
"use strict";
import { bvhAyristir, eklemDizini, ileriKinematik, type Bvh } from "./bvh.ts";
import { BIRIM, Ry, birimle, carp, devrik, fark, hizala, olcekle, uygula, type M3, type V3 } from "./matris.ts";
import { butunEklemler, uzuvAtasi } from "../../world/avatar/zincirler.ts";
import type { Uzuv } from "../../protocol/animasyon.ts";
import type { OrionGovdesi } from "./orionOlc.ts";

export interface SomaTpoz { eklemler: Record<string, { ofset: M3; konum: V3 }> }

/** SOMA (sağ elli, +X sol) → gövde (Babylon sol elli, +X sağ): yalnız X'in işareti. Kanıt: el_salla NPZ — Left* eklemleri +X'te, ayak parmakları ayağın +Z'sinde. */
export const AYNA: M3 = [-1, 0, 0, 0, 1, 0, 0, 0, 1];
const aynala = (m: M3): M3 => carp(AYNA, carp(m, AYNA));
const aynaNokta = (p: V3): V3 => [-p[0], p[1], p[2]];

export interface CeviriSecenekleri {
  /** true (varsayılan): yatay kök hareketi atılır (yürüme motoru gövdeyi ayrıca taşır). false: kok.oteleme_x/z yazılır (±0,5 m'ye kısılır). */
  yerinde: boolean;
}

export interface HamCeviri {
  kareSayisi: number;
  fps: number;
  /** Uzuv başına kare başına R_i (gövde uzayı, sütun vektör). */
  donmeler: Map<Uzuv, M3[]>;
  /** kok ötelemesi (metre) kare başına. */
  kok: { x: number[]; y: number[]; z: number[] };
  /** Kaynağın gövde uzayındaki eklem konumları (metre; ilk karenin yönüne çevrili, yerindeyse yatay kök çıkarılmış) — ölçüm ve döngü bulma için. */
  kaynakKonumu(ad: string): V3[];
  /** Bacak boyu oranı (Orion / SOMA) — kok yüksekliği bununla ölçeklenir. */
  bacakOrani: number;
  /** İlk karenin yönü (derece; +Z'den +X'e). */
  ilkYon: number;
  uyarilar: string[];
}

const ortaNokta = (a: V3, b: V3): V3 => olcekle([a[0] + b[0], a[1] + b[1], a[2] + b[2]], 0.5);

export function bvhCevir(metin: string | Bvh, tpoz: SomaTpoz, orion: OrionGovdesi, sec: CeviriSecenekleri): HamCeviri {
  const b = typeof metin === "string" ? bvhAyristir(metin) : metin;
  const uyarilar: string[] = [];
  const birim = 0.01;   // Kimodo BVH: santimetre (exports/bvh.py "Scale from meters to centimeters")
  const eklemler = butunEklemler();
  const fk = Array.from({ length: b.kareSayisi }, (_, k) => ileriKinematik(b, k));
  const tumKonum = (ad: string): V3[] => { const j = eklemDizini(b, ad); return fk.map((p) => aynaNokta(olcekle(p.konum[j]!, birim))); };

  // İlk karenin yönü: sol bacak kökünden sağa giden yatay vektörün 90° solu ileridir (gövdede sağ +X, ileri +Z).
  const sag0 = tumKonum("RightLeg")[0]!, sol0 = tumKonum("LeftLeg")[0]!;
  const r = birimle([sag0[0] - sol0[0], 0, sag0[2] - sol0[2]]);
  const ilkYon = Math.atan2(-r[2], r[0]);
  const H = Ry(-ilkYon);
  const kalca = tumKonum("Hips");
  const kok0 = kalca[0]!;
  const yerlestir = (l: V3[]): V3[] => l.map((p, k) => uygula(H, sec.yerinde ? fark(p, [kalca[k]![0], 0, kalca[k]![2]]) : fark(p, [kok0[0], 0, kok0[2]])));

  // Dinlenme hizalaması C_i (Orion dinlenme yönü → SOMA T-poz yönü, gövde uzayında).
  const C = new Map<Uzuv, M3>();
  for (const e of eklemler) {
    const o = orion.eklemler[e.uzuv];
    if (!o) throw new Error(`orionGovdesi.json'da '${e.uzuv}' yok (yeniden ölç: tools/kimodo/orionOlc.ts)`);
    const t = tpoz.eklemler[e.kaynak.soma], ty = tpoz.eklemler[e.yon.soma];
    if (!t || !ty) throw new Error(`somaTpoz.json'da '${e.kaynak.soma}' ya da '${e.yon.soma}' yok`);
    C.set(e.uzuv, o.yonDinlenme ? hizala(fark(o.yonDinlenme, o.dinlenme), aynaNokta(fark(ty.konum, t.konum))) : [...BIRIM]);
  }
  const donmeler = new Map<Uzuv, M3[]>(eklemler.map((e) => [e.uzuv, []]));
  for (let k = 0; k < b.kareSayisi; k++) {
    const S = new Map<Uzuv, M3>();
    for (const e of eklemler) {
      const j = eklemDizini(b, e.kaynak.soma);
      const delta = carp(H, aynala(carp(fk[k]!.donme[j]!, devrik(tpoz.eklemler[e.kaynak.soma]!.ofset))));
      const s = carp(delta, carp(C.get(e.uzuv)!, orion.eklemler[e.uzuv]!.A));
      S.set(e.uzuv, s);
      const ata = uzuvAtasi(e.uzuv);
      donmeler.get(e.uzuv)!.push(ata ? carp(s, devrik(S.get(ata)!)) : s);
    }
  }

  // kok: Orion'un bacak kökü, SOMA bacak kökünün ayak bileği üstündeki yüksekliğini bacak boyu oranıyla izler (ayaklar SOMA'nınkinin yerine iner).
  const ort = (a: string, c: string) => { const x = orion.eklemler[a]!, y = orion.eklemler[c]!; return { d: ortaNokta(x.dinlenme, y.dinlenme), b: ortaNokta(x.bosta, y.bosta) }; };
  const oBacak = ort("sag_bacak", "sol_bacak"), oAyak = ort("sag_ayak", "sol_ayak");
  const sBacak = ortaNokta(tpoz.eklemler.RightLeg!.konum, tpoz.eklemler.LeftLeg!.konum), sAyak = ortaNokta(tpoz.eklemler.RightFoot!.konum, tpoz.eklemler.LeftFoot!.konum);
  const bacakOrani = (oBacak.d[1] - oAyak.d[1]) / (sBacak[1] - sAyak[1]);
  const sagB = tumKonum("RightLeg"), solB = tumKonum("LeftLeg"), sagA = tumKonum("RightFoot"), solA = tumKonum("LeftFoot");
  // SOMA'nın ayak bileği yüksekliği (ayak düz basarken): klipteki en alçak bilek (zıplamada da kalkış/iniş anı yerdedir).
  const bilekK = Math.min(...sagA.map((p) => p[1]), ...solA.map((p) => p[1]));
  const kokY: number[] = [], kokX: number[] = [], kokZ: number[] = [];
  for (let k = 0; k < b.kareSayisi; k++) {
    const kb = ortaNokta(sagB[k]!, solB[k]!);
    kokY.push(oAyak.d[1] + bacakOrani * (kb[1] - bilekK) - oBacak.b[1]);
    const yatay = uygula(H, fark(kalca[k]!, kok0));
    kokX.push(sec.yerinde ? 0 : bacakOrani * yatay[0]);
    kokZ.push(sec.yerinde ? 0 : bacakOrani * yatay[2]);
  }
  return {
    kareSayisi: b.kareSayisi, fps: Math.round(1 / b.kareSuresi), donmeler, kok: { x: kokX, y: kokY, z: kokZ },
    kaynakKonumu: (ad) => yerlestir(tumKonum(ad)), bacakOrani, ilkYon: (ilkYon * 180) / Math.PI, uyarilar,
  };
}
