// world/avatar/zincirler.ts — ZİNCİR MODELİ (spec 37 §3): gövdenin soyut uzuvları ZİNCİRLER hâlinde (Unreal IK Rig / Retargeter mantığı). SAF: Babylon yok.
//
// NEDEN ZİNCİR (düz "eklem → uzuv" listesi değil): çeviri (Kimodo BVH → sekans), ileride iki kemikli IK (kol/bacak) ve Control Rig (el/ayak/pelvis/baş
// kontrol noktaları) AYNI yapıya dayanır: kökten uca sıralı eklemler, zincirin takıldığı uzuv, uç etkileyici, dirsek/diz kutup yönü. Tablo TEK KAYNAKTIR:
// VRM kemik adları buradan okunur (`uzuvEslemesi.ts` VRM tablosunu buradan türetir), kaynak iskeletin (SOMA77, Kimodo) eklem adları da buradadır.
// IK çözücüsü, Control Rig arayüzü ve ayak sabitleme YOK (yalnız onların ihtiyaç duyacağı alanlar).
//
// KAVRAMLAR:
//   • RETARGET KÖKÜ (`RETARGET_KOKU`): pelvis — `kalca` uzvu. Zincirler değildir; omurga ve bacaklar ona takılır. (`kok` uzvu ayrı: iskeletin kendi ara
//     düğümü, bütün beden; yalnız öteleme taşır — uzuvEslemesi.ts KOK_DUGUMU.)
//   • ZİNCİR EKLEMİ: soyut uzuv + her gövde türünde kemik/düğüm adı + kaynak eklem adı + YÖN NOKTASI (kemiğin doğrultusunu veren alt eklem; dinlenme
//     hizalaması ve uzunluk için). Yön noktası çocuk değil, aradaki eşlenmemiş kemiklerin ÖTESİ olabilir (göğüs → boyun: üst göğüs eşlenmez, göğse
//     katı bağlıdır). Yön noktası olmayan uç (VRM'de baş ucu kemiği yok) hizalanmaz.
//   • UÇ ETKİLEYİCİ (`uc`): zincirin son uzvu (el, ayak, baş). KONTROL NOKTALARI: el ×2, ayak ×2, pelvis, baş.
//   • IK: iki kemikli zincirde üst/orta/uç uzuv + KUTUP: gövde uzayında orta eklemin (dirsek/diz) beklenen bükülme yönü (dirsek GERİ −Z, diz İLERİ +Z).
// Eksenler gövde uzayıdır (protocol/animasyon.ts): yüzü +Z, yukarı +Y, sağı +X.
"use strict";
import type { Uzuv } from "../../protocol/animasyon.ts";

export const ZINCIR_ADLARI = ["omurga", "bas_boyun", "sag_kol", "sol_kol", "sag_bacak", "sol_bacak"] as const;
export type ZincirAdi = (typeof ZINCIR_ADLARI)[number];

/** Kaynak iskeletler (bugün yalnız Kimodo'nun SOMA77'si). */
export type KaynakIskelet = "soma";

export interface ZincirEklemi {
  uzuv: Uzuv;
  /** Gövde türü başına kemik/düğüm adı. Prosedürel: düğüm adının önek SONRASI; yoksa o gövdede bu uzuv yok. */
  kemik: { vrm: string; prosedurel?: string };
  /** Kaynak iskeletteki eklem (dönmesi bu uzva taşınır). */
  kaynak: Record<KaynakIskelet, string>;
  /** Kemiğin doğrultusunu veren nokta (eklem → yön noktası). VRM'de yoksa null (hizalama yapılmaz). */
  yon: { vrm: string | null } & Record<KaynakIskelet, string>;
}

export interface IkBilgisi {
  ust: Uzuv; orta: Uzuv; uc: Uzuv;
  /** Gövde uzayında orta eklemin beklenen bükülme yönü (birim vektör). */
  kutup: { x: number; y: number; z: number };
}

export interface Zincir {
  ad: ZincirAdi;
  taraf: "sag" | "sol" | "orta";
  /** Zincirin takıldığı uzuv (ilk eklemin en yakın EŞLENMİŞ atası). */
  baglanti: Uzuv;
  /** Kökten uca. */
  eklemler: readonly ZincirEklemi[];
  /** Uç etkileyici (son eklemin uzvu). */
  uc: Uzuv;
  ik: IkBilgisi | null;
}

/** Pelvis: zincirlerin takıldığı kök eklem (`kalca` uzvu). */
export const RETARGET_KOKU: ZincirEklemi = {
  uzuv: "kalca", kemik: { vrm: "hips" }, kaynak: { soma: "Hips" }, yon: { vrm: "spine", soma: "Spine1" },
};

const kol = (t: "sag" | "sol"): Zincir => {
  const V = t === "sag" ? "right" : "left", S = t === "sag" ? "Right" : "Left", P = t === "sag" ? "L" : "R";   // prosedürelde ad karışık (uzuvEslemesi.ts)
  return {
    ad: `${t}_kol`, taraf: t, baglanti: "gogus", uc: `${t}_el`,
    eklemler: [
      { uzuv: `${t}_kol`, kemik: { vrm: `${V}UpperArm`, prosedurel: `omuz${P}` }, kaynak: { soma: `${S}Arm` }, yon: { vrm: `${V}LowerArm`, soma: `${S}ForeArm` } },
      { uzuv: `${t}_on_kol`, kemik: { vrm: `${V}LowerArm` }, kaynak: { soma: `${S}ForeArm` }, yon: { vrm: `${V}Hand`, soma: `${S}Hand` } },
      { uzuv: `${t}_el`, kemik: { vrm: `${V}Hand` }, kaynak: { soma: `${S}Hand` }, yon: { vrm: `${V}MiddleProximal`, soma: `${S}HandMiddle1` } },
    ],
    ik: { ust: `${t}_kol`, orta: `${t}_on_kol`, uc: `${t}_el`, kutup: { x: 0, y: 0, z: -1 } },
  };
};

const bacak = (t: "sag" | "sol"): Zincir => {
  const V = t === "sag" ? "right" : "left", S = t === "sag" ? "Right" : "Left", P = t === "sag" ? "L" : "R";
  return {
    ad: `${t}_bacak`, taraf: t, baglanti: "kalca", uc: `${t}_ayak`,
    eklemler: [
      { uzuv: `${t}_bacak`, kemik: { vrm: `${V}UpperLeg`, prosedurel: `bacak${P}` }, kaynak: { soma: `${S}Leg` }, yon: { vrm: `${V}LowerLeg`, soma: `${S}Shin` } },
      { uzuv: `${t}_diz`, kemik: { vrm: `${V}LowerLeg` }, kaynak: { soma: `${S}Shin` }, yon: { vrm: `${V}Foot`, soma: `${S}Foot` } },
      { uzuv: `${t}_ayak`, kemik: { vrm: `${V}Foot` }, kaynak: { soma: `${S}Foot` }, yon: { vrm: `${V}Toes`, soma: `${S}ToeBase` } },
    ],
    ik: { ust: `${t}_bacak`, orta: `${t}_diz`, uc: `${t}_ayak`, kutup: { x: 0, y: 0, z: 1 } },
  };
};

/**
 * Zincir tablosu. Kaynak eşleme kararları (spec 37 §3): omurga Spine1 (Spine2 göğsün dünya dönmesine katılır), göğüs Chest, boyun Neck1 (Neck2 başın dünya
 * dönmesine katılır), baş Head. Prosedürelde `govde` → `kalca` düğümü, `bas` → `boyun` pivotu (eski tablo; `boyun` uzvu eşlenmez — aynı düğüm iki kez dönmesin).
 */
export const ZINCIRLER: readonly Zincir[] = [
  {
    ad: "omurga", taraf: "orta", baglanti: "kalca", uc: "gogus", ik: null,
    eklemler: [
      { uzuv: "govde", kemik: { vrm: "spine", prosedurel: "kalca" }, kaynak: { soma: "Spine1" }, yon: { vrm: "chest", soma: "Spine2" } },
      { uzuv: "gogus", kemik: { vrm: "chest" }, kaynak: { soma: "Chest" }, yon: { vrm: "neck", soma: "Neck1" } },
    ],
  },
  {
    ad: "bas_boyun", taraf: "orta", baglanti: "gogus", uc: "bas", ik: null,
    eklemler: [
      { uzuv: "boyun", kemik: { vrm: "neck" }, kaynak: { soma: "Neck1" }, yon: { vrm: "head", soma: "Head" } },
      { uzuv: "bas", kemik: { vrm: "head", prosedurel: "boyun" }, kaynak: { soma: "Head" }, yon: { vrm: null, soma: "HeadEnd" } },
    ],
  },
  kol("sag"), kol("sol"), bacak("sag"), bacak("sol"),
];

/** Control Rig'in kontrol noktaları (ileride; bugün yalnız ad + uzuv). */
export const KONTROL_NOKTALARI: readonly { ad: string; uzuv: Uzuv }[] = [
  { ad: "pelvis", uzuv: "kalca" }, { ad: "bas", uzuv: "bas" },
  { ad: "sag_el", uzuv: "sag_el" }, { ad: "sol_el", uzuv: "sol_el" }, { ad: "sag_ayak", uzuv: "sag_ayak" }, { ad: "sol_ayak", uzuv: "sol_ayak" },
];

/** Kök + bütün zincir eklemleri, ebeveyn önce (kök, sonra tablo sırası: her zincirin bağlantısı kendisinden önce gelir). */
export function butunEklemler(): ZincirEklemi[] {
  return [RETARGET_KOKU, ...ZINCIRLER.flatMap((z) => z.eklemler)];
}

/** Bir uzvun en yakın EŞLENMİŞ atası (zincir içinde bir önceki eklem; zincirin ilki için bağlantı; pelvis için null). */
export function uzuvAtasi(u: Uzuv): Uzuv | null {
  if (u === RETARGET_KOKU.uzuv) return null;
  for (const z of ZINCIRLER) {
    const i = z.eklemler.findIndex((e) => e.uzuv === u);
    if (i >= 0) return i === 0 ? z.baglanti : z.eklemler[i - 1]!.uzuv;
  }
  return null;
}
