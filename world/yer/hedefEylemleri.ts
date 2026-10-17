// world/yer/hedefEylemleri.ts — ZEMİN ve ORION menüleri (spec 28 genişletmesi): sağ tıkın nesne dışındaki iki hedefi. SAF (Babylon ve DOM yok).
//
// Üç sağ tık menüsü vardır: nesne (`nesneEylemleri.ts`), Orion'un kendisi, boş zemin. Üçü de aynı `NesneEylemi` biçimini üretir: panel, "gri + neden" kuralı ve
// tek eylem yolu (`niyetiYurut`) hiç değişmez. Burada yalnız "ne sunulur" vardır.
//   Zemin: Orion o noktaya yürüsün / o noktaya baksın. Nokta yürünemezse (engel, sınır dışı) eylem gri ve NEDENLİ: sessizce başarısız olmaz.
//   Orion: yanıma gel, bana bak, el salla, dur, (oturuyorsa) kalk.
"use strict";
import type { NesneEylemi } from "./nesneEylemleri.ts";
import type { YurumeAlani } from "./yer.ts";
import { carpisiyorMu, OYUNCU_YARICAP } from "../level/olculer.ts";

/** Yürünebilirlik payı (m): Orion'un gövde yarıçapı (avatar/yolBulma: 0,34; alt-sistem sınırı yüzünden oradan alınmaz) oyuncununkinden biraz geniştir. */
const YURUME_YARICAPI = OYUNCU_YARICAP + 0.05;

export interface ZeminNoktasi { x: number; y: number; z: number }

const m = (v: number): string => v.toFixed(1);

/** Zemindeki bir noktaya yapılabilecekler. `alan`: o yerin yürüme alanı (sınır + engeller). */
export function zeminEylemleri(p: ZeminNoktasi, alan: YurumeAlani): NesneEylemi[] {
  const disarida = p.x < alan.sinir.minX || p.x > alan.sinir.maxX || p.z < alan.sinir.minZ || p.z > alan.sinir.maxZ;
  const dolu = !disarida && carpisiyorMu(p.x, p.z, YURUME_YARICAPI, alan);
  const neden = disarida ? "burası yürünebilir alanın dışında" : dolu ? "burada bir engel var, yürünemez" : undefined;
  const yurunur = neden === undefined;
  return [
    { kimlik: "orion.git", ad: "Buraya git", kim: "orion", uygun: yurunur, niyet: { tur: "git", hedef: { tip: "nokta", x: p.x, y: p.y, z: p.z } },
      ...(yurunur ? {} : { neden, soz: "Oraya yürüyemem." }) },
    { kimlik: "orion.bak", ad: "Buraya bak", kim: "orion", uygun: true, niyet: { tur: "bak", hedef: { tip: "nokta", x: p.x, y: p.y, z: p.z } } },
  ];
}

/** Zemin menüsünün başlığı altındaki özellik satırları (panel için). */
export function zeminOzellikleri(p: ZeminNoktasi): [string, string][] {
  return [["Konum", `${m(p.x)}, ${m(p.z)}`], ["Zemin yüksekliği", `${m(p.y)} m`]];
}

export interface OrionBaglami {
  oturuyor: boolean;
  poz: string;
  mesgul: boolean;
  elinde: string | null;
  konum: { x: number; z: number };
}

/** Orion'a fareyle tıklanınca: ona verilebilecek bedensel komutlar (konuşmak değil; söz yine klavye/mikrofon). */
export function orionEylemleri(b: OrionBaglami): NesneEylemi[] {
  const cikti: NesneEylemi[] = [
    { kimlik: "orion.gel", ad: "Yanıma gel", kim: "orion", uygun: true, niyet: { tur: "git", hedef: { tip: "oyuncu" } } },
    { kimlik: "orion.banabak", ad: "Bana bak", kim: "orion", uygun: true, niyet: { tur: "bak", hedef: { tip: "oyuncu" } } },
    { kimlik: "orion.selam", ad: "El salla", kim: "orion", uygun: true, niyet: { tur: "jest", jest: "el_salliyor" } },
    { kimlik: "orion.dur", ad: "Dur", kim: "orion", uygun: true, niyet: { tur: "dur" } },
  ];
  if (b.oturuyor) cikti.push({ kimlik: "orion.kalk", ad: "Kalk", kim: "orion", uygun: true, niyet: { tur: "kalk" } });
  return cikti;
}

/** Orion menüsünün özellik satırları. */
export function orionOzellikleri(b: OrionBaglami): [string, string][] {
  return [
    ["Poz", b.oturuyor ? "oturuyor" : b.poz],
    ["Durum", b.mesgul ? "bir işle meşgul" : "boşta"],
    ["Elinde", b.elinde ?? "—"],
    ["Konum", `${m(b.konum.x)}, ${m(b.konum.z)}`],
  ];
}
