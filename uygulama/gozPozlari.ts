// uygulama/gozPozlari.ts — Spec 25 görme deneylerinin SABİT pozları (V0 ön kaydı §1; V1 §7 aynılarını kullanır).
//
// Önce `tools/goz-olc.ts`in içindeydi; V1 canlı senaryosu (`gozdene`) aynı pozları ister. İki kopya ayrışırsa iki
// deney farklı karelere bakar ve kıyas sessizce bozulur — tek kaynak burası.
"use strict";
import type { Capa } from "../world/level/capalar.ts";

export interface GozPozu { yer: "oda" | "ova"; ad: string; x: number; z: number; yaw: number }

const YONLER: [string, number][] = [["+Z", 0], ["+X", Math.PI / 2], ["-Z", Math.PI], ["-X", -Math.PI / 2]];
const ODA_DURAKLARI = ["masa", "monitor", "tahta", "pencere", "kapi", "sema", "gunluk", "admin"];

/** Oda, 12 poz: sekiz çapanın durağında çapaya bakarak + oda ortası (0, 0.5) dört yöne. */
export function odaPozlari(capalar: readonly Capa[]): GozPozu[] {
  const p: GozPozu[] = [];
  for (const ad of ODA_DURAKLARI) {
    const c = capalar.find((x) => x.ad === ad);
    if (!c) throw new Error(`göz pozu: odada çapa yok: ${ad}`);
    p.push({ yer: "oda", ad: `${ad} durağı`, x: c.durak.x, z: c.durak.z, yaw: Math.atan2(c.yon.x, c.yon.z) });
  }
  for (const [y, a] of YONLER) p.push({ yer: "oda", ad: `oda ortası ${y}`, x: 0, z: 0.5, yaw: a });
  return p;
}

/** Ova, 10 poz: ofisten çıkış noktası dört yöne, ova merkezi (0, 0) dört yöne, (15, −5) iki yöne. */
export function ovaPozlari(cikis: { x: number; z: number }): GozPozu[] {
  const p: GozPozu[] = [];
  for (const [y, a] of YONLER) p.push({ yer: "ova", ad: `ofis çıkışı ${y}`, x: cikis.x, z: cikis.z, yaw: a });
  for (const [y, a] of YONLER) p.push({ yer: "ova", ad: `ova merkezi ${y}`, x: 0, z: 0, yaw: a });
  p.push({ yer: "ova", ad: "(15,-5) -X", x: 15, z: -5, yaw: -Math.PI / 2 }, { yer: "ova", ad: "(15,-5) +Z", x: 15, z: -5, yaw: 0 });
  return p;
}
