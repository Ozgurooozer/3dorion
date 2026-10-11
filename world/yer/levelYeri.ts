// world/yer/levelYeri.ts — Bir level'ı (ova) Orion'un yaşayabileceği bir `Yer`e çevirir (spec 24 C2). Babylon YOK.
//
// Girdi level tanımı + yerleşimlerin dünya kutuları (sahneden BİR KEZ ölçülür, sonra saf veri olarak saklanır:
// ova sahnede kurulu değilken de Orion orada yürüyebilsin — C0 kararı, C6). Çıktı odanınkiyle aynı sözleşme:
//   engeller      görünür yerleşimlerin kutuları (yürünür alçak şeyler hariç) + göl çanağı
//   katiYuzeyler  görünür yerleşimlerin kutuları + geçidin kapısı (çapası `kapi`)
//   capalar       geçidin kapısı: durak kapının önünde, yüz kapıya dönük (ofise dönüş)
//   nesneler      kapı + `levelNesneleri` (spec 23 B anlamı: ad, tür, eylemler)
//   yukseklik     zemin modülünün yüksekliği (çağıran verir: sahnedeki level ya da saf `zeminYuksekligi`)
//   sinir         zemin dairesinin içine çizilen kare (kenardan pay)
// Bilinen sınırlar: kaya/dekor katmanlarının örnekleri engel değil (yerleşim değiller); döndürülmüş yerleşimin
// kutusu eksen hizalı (şişkin); görüş-hattı yol bulma engel sayısıyla küpsel büyür (ova'da 9 engel).
"use strict";
import type { Vec3 } from "../../protocol/temel.ts";
import type { Yer, Sinir } from "./yer.ts";
import type { Kutu, KatiYuzey } from "../level/olculer.ts";
import type { Capa } from "../level/capalar.ts";
import type { Nesne } from "../level/nesneKaydi.ts";
import type { Gecit, LevelTanimi, NesneYeri } from "../level/cekirdek/levelTanimi.ts";
import { levelNesneleri, type EtkinAnlam } from "../level/cekirdek/anlam.ts";
import { grupZinciri } from "../level/cekirdek/grup.ts";
import { ayarBirlestir } from "../level/cekirdek/modul.ts";
import { ZEMIN_VARSAYILAN, zeminYuksekligi } from "../level/moduller/zemin.ts";

/** Kapı kanadı (odanın KAPI ölçüsüyle aynı boy: içeriden çıkılan kapı dışarıdan da o kapı). */
export const KAPI_OLCUSU = { genislik: 1.0, yukseklik: 2.1, kalinlik: 0.06 } as const;
/** Orion'un kapıya yaklaşınca durduğu nokta: kapının önünde (oda çapasıyla aynı 1,1 m). */
export const KAPI_DURAGI = 1.1;
/** Ofisten çıkan kapının önünde belirdiği uzaklık (durağın biraz ötesi: hemen geri girilmesin). */
export const VARIS_UZAKLIGI = 1.8;
/** Bu boydan alçak yerleşimler (yol, kaldırım, plaka) yürünür: engel değil, ışını yine durdurur. */
export const YURUNUR_YUKSEKLIK = 0.25;
/** Zemin dairesinin kenarından bırakılan pay (m). */
const KENAR_PAYI = 4;

export interface KutuMinMax { min: readonly number[]; max: readonly number[] }

export interface LevelYeriGirdisi {
  /** Yerin adı (algıya ve günlüğe geçer): "ova". */
  ad: string;
  tanim: LevelTanimi;
  /** Yerleşimlerin dünya kutuları, kimliğe göre. Kutusu olmayan yerleşim yok sayılır (yüklenmemiş). */
  kutular: ReadonlyMap<string, KutuMinMax>;
  anlamOf: (n: NesneYeri) => EtkinAnlam;
  yukseklik: (x: number, z: number) => number;
}

/** Kapıdan dışarı birim yön (XZ). Babylon yaw: 0 = +Z, 90 = +X. */
export function gecitYonu(g: Gecit): { x: number; z: number } {
  const a = (g.yon * Math.PI) / 180;
  return { x: Math.sin(a), z: Math.cos(a) };
}

/** Kapının dışında, kapıdan `uzaklik` metre ötedeki zemin noktası. */
function onunde(g: Gecit, uzaklik: number, yukseklik: (x: number, z: number) => number): Vec3 {
  const d = gecitYonu(g);
  const x = g.konum[0] + d.x * uzaklik, z = g.konum[1] + d.z * uzaklik;
  return { x, y: yukseklik(x, z), z };
}

/** Geçidin Orion için çapası (`kapi`): durak kapının önünde, yüzü kapıya dönük. */
export function gecitCapasi(g: Gecit, yukseklik: (x: number, z: number) => number): Capa {
  const d = gecitYonu(g);
  const [x, z] = g.konum;
  return {
    ad: "kapi",
    konum: { x, y: yukseklik(x, z) + KAPI_OLCUSU.yukseklik / 2, z },
    durak: onunde(g, KAPI_DURAGI, yukseklik),
    yon: { x: -d.x, y: 0, z: -d.z },
    yaklasmaYaricapi: 1.4,
    // "gec": kapıdan geçilir (E; Orion için `gec` niyeti, C6). Oda kapısıyla aynı eylemler.
    eylemler: ["gec", "bak"],
    etiket: g.etiket ?? "kapı",
  };
}

/** Ofisten çıkınca durulan yer ve bakış (yaw, radyan): kapının önünde, dışarı bakarak. */
export function gecitVarisi(g: Gecit, yukseklik: (x: number, z: number) => number): { konum: Vec3; yaw: number } {
  return { konum: onunde(g, VARIS_UZAKLIGI, yukseklik), yaw: (g.yon * Math.PI) / 180 };
}

/** Kapı kanadının eksen hizalı kutusu (döndürülmüş ince levha → çevreleyen kutu). */
export function kapiKutusu(g: Gecit, yukseklik: (x: number, z: number) => number): Kutu {
  const d = gecitYonu(g);
  const { genislik: w, yukseklik: h, kalinlik: t } = KAPI_OLCUSU;
  const [x, z] = g.konum;
  // Genişlik kapı yönüne dik eksende (cos, -sin), kalınlık kapı yönünde.
  return { x, y: yukseklik(x, z) + h / 2, z, g: Math.abs(d.z) * w + Math.abs(d.x) * t, yuk: h, d: Math.abs(d.x) * w + Math.abs(d.z) * t };
}

const kutuya = (k: KutuMinMax): Kutu => ({
  x: (k.min[0]! + k.max[0]!) / 2, y: (k.min[1]! + k.max[1]!) / 2, z: (k.min[2]! + k.max[2]!) / 2,
  g: k.max[0]! - k.min[0]!, yuk: k.max[1]! - k.min[1]!, d: k.max[2]! - k.min[2]!,
});

/** Zemin katmanının ayarı (yoksa null). */
function zeminAyari(t: LevelTanimi) {
  const k = t.katmanlar.find((x) => x.tur === "zemin" && x.acik);
  return k ? ayarBirlestir("zemin", ZEMIN_VARSAYILAN, k.ayar) : null;
}

/**
 * Zemin yüksekliği TANIMDAN (saf): sahnedeki level yıkılınca `Level.yukseklik` 0 döner; Orion'un ova yeri ise
 * sahne olmadan da doğru zemine basmalı (C6). Sahnedeki zemin aynı işlevle kurulur (moduller/zemin.ts).
 */
export function levelYuksekligi(t: LevelTanimi): (x: number, z: number) => number {
  const z = zeminAyari(t);
  return z ? zeminYuksekligi(z) : () => 0;
}

/** Yürünebilir kare: zemin dairesinin içine çizilen kare, kenardan pay; zemin yoksa ±50 m. */
export function levelSiniri(t: LevelTanimi): Sinir {
  const z = zeminAyari(t);
  const y = z ? Math.max(1, z.yaricap / Math.SQRT2 - KENAR_PAYI) : 50;
  return { minX: -y, maxX: y, minZ: -y, maxZ: y };
}

/** Göl çanağı yürüme engeli (derin kısım: yarıçapın ~%70'i), yoksa null. */
export function golEngeli(t: LevelTanimi): Kutu | null {
  const z = zeminAyari(t);
  if (!z || z.golDerinlik <= 0) return null;
  const k = z.golYaricap * 1.4;
  return { x: z.golX, y: 0, z: z.golZ, g: k, yuk: 1, d: k };
}

export function levelYeri(g: LevelYeriGirdisi): Yer {
  const { tanim, kutular, yukseklik } = g;
  const gruplar = tanim.gruplar ?? [];
  const gorunur = (tanim.nesneler ?? []).filter((n) => n.id && !n.gizli && !grupZinciri(n.grup, gruplar).some((x) => x.gizli));
  const olculen = gorunur.flatMap((n) => { const k = kutular.get(n.id!); return k ? [{ n, kutu: kutuya(k) }] : []; });

  const engeller: Kutu[] = olculen.filter((o) => o.kutu.yuk >= YURUNUR_YUKSEKLIK).map((o) => o.kutu);
  const gol = golEngeli(tanim);
  if (gol) engeller.push(gol);

  const katiYuzeyler: KatiYuzey[] = olculen.map((o) => ({ kutu: o.kutu, capa: null }));
  const capalar: Capa[] = [];
  const nesneler: Nesne[] = [];
  for (const gc of tanim.gecitler ?? []) {
    const kapi = kapiKutusu(gc, yukseklik);
    katiYuzeyler.push({ kutu: kapi, capa: "kapi" });
    const c = gecitCapasi(gc, yukseklik);
    capalar.push(c);
    nesneler.push({ id: "kapi", ad: c.etiket, tur: "yuzey", capa: "kapi", kutu: kapi });
  }
  nesneler.push(...levelNesneleri(gorunur, kutular, g.anlamOf));

  return {
    ad: g.ad, sinir: levelSiniri(tanim), engeller, katiYuzeyler, capalar, nesneler, yukseklik,
    ...(tanim.algi ? { algiMenzil: tanim.algi.menzil } : {}),
  };
}
