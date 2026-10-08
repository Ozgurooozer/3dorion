// uygulama/senaryolar/takipdene.ts — `3dorion.bat takipdene`: "beni takip et" canlıda (içgüdü `kopru.takip`).
//
// Söz gerçek köprü yolundan; oyuncu (Ozyn) kodla taşınır, Orion'un gerçek bedeni ölçülür — söz değil sonuç:
//   1. "beni takip et" → takip açık, LLM uyanmadı.
//   2. Ozyn odanın öbür ucuna → Orion yanına geldi (< 1,8 m).
//   3. Ozyn başka bir yere → yine geldi.
//   4. "takibi bırak" → Ozyn uzaklaşır, Orion GELMEZ (6 sn sonra hâlâ uzak).
//   5. "beni takip et" + "dur" → yeni emir takibi bitirir.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import type { Kopru } from "../../bridge/kopru.ts";
import { UZAK_M } from "../takip.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { oyuncu } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sonuc: string[] = [];
  const kontrol = (ad: string, gecti: boolean, detay = "") =>
    sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);
  await bekle(2500);
  const k = d.kopru as Kopru | null;
  const o = d.orion as Avatar | null;
  if (!k || !o) { console.log("[TAKIPDENE] KALDI köprü ya da beden yok"); return; }
  const soyle = (metin: string) => k.algi({ tur: "duydum", metin, kesin: true });
  const mesafe = () => {
    const a = o.durum().konum, p = oyuncu.oyuncuDurumu().konum;
    return Math.hypot(a.x - p.x, a.z - p.z);
  };
  const tasi = (x: number, z: number) => { oyuncu.konum.set(x, 0, z); };
  const yaklasana = async (ms: number) => {
    for (let t = 0; t < ms; t += 250) { if (mesafe() < 1.8) return true; await bekle(250); }
    return mesafe() < 1.8;
  };
  const dusunmeOnce = k.sayac().dusunme;

  soyle("beni takip et");
  await bekle(500);
  kontrol("'beni takip et' → takip açık, LLM uyanmadı", k.takipte && k.sayac().dusunme === dusunmeOnce, `takipte=${k.takipte}`);

  tasi(-2.5, 1.5);
  kontrol("Ozyn uzaklaşınca yanına geldi", await yaklasana(15_000), `mesafe=${mesafe().toFixed(2)} m`);
  tasi(2.0, 1.2);
  kontrol("Ozyn yine uzaklaşınca yine geldi", await yaklasana(15_000), `mesafe=${mesafe().toFixed(2)} m`);

  soyle("takibi bırak");
  await bekle(500);
  tasi(-2.5, 1.5);
  await bekle(6000);
  kontrol("'takibi bırak' → Ozyn uzaklaşınca GELMEDİ", !k.takipte && mesafe() > UZAK_M, `takipte=${k.takipte} mesafe=${mesafe().toFixed(2)} m`);

  soyle("beni takip et");
  await bekle(500);
  soyle("dur");
  await bekle(800);
  kontrol("'dur' (yeni emir) takibi bitirdi", !k.takipte, `takipte=${k.takipte}`);

  for (const s of sonuc) console.log(`[TAKIPDENE] ${s}`);
  console.log(`[TAKIPDENE] ozet: ${sonuc.filter((s) => s.startsWith("GECTI")).length}/${sonuc.length}`);
}
