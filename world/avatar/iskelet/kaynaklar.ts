// world/avatar/iskelet/kaynaklar.ts — KAYNAK İSKELET EŞLEMELERİ (spec 38 §2): kanonik uzuv → her kaynağın kemik/eklem adı. SAF: yalnız adlar.
//
// Yeni kaynak iskelet = bu dosyaya yeni bir tablo (Mixamo, Unreal Mannequin) + `KaynakIskelet` birleşimine bir ad; kanonik yapıya (`kanonik.ts`)
// ve zincirlere DOKUNULMAZ. Her kaynak için `yon`: kemiğin doğrultusunu veren alt nokta (dinlenme hizalaması ve uzunluk; VRM'de baş ucu yok → null).
//
// KARARLAR (spec 37 §3, ölçümle): omurga SOMA Spine1 (Spine2 göğsün dünya dönmesine katılır), göğüs Chest, boyun Neck1 (Neck2 başın dönmesine
// katılır), baş Head. Prosedürelde ön kol/el/göğüs/boyun ayrı parça değil; `govde` → kalça düğümü, `bas` → boyun pivotu ve ad KARIŞIK: `sag_kol` →
// `omuzL` (gövdenin SAĞINDA L; uzuvEslemesi.ts üst notu).
"use strict";
import type { Uzuv } from "../../../protocol/animasyon.ts";

/** Kaynak iskeletler (bugün yalnız Kimodo'nun SOMA77'si klip kaynağıdır; VRM ve prosedürel gövde türleridir). */
export type KaynakIskelet = "soma";

export interface KaynakKemigi {
  vrm: { kemik: string; yon: string | null };
  soma: { eklem: string; yon: string };
  /** Prosedürel düğüm adının önek SONRASI; yoksa o gövdede bu uzuv yok. */
  prosedurel?: string;
}

const yan = (t: "sag" | "sol") => {
  const V = t === "sag" ? "right" : "left", S = t === "sag" ? "Right" : "Left", P = t === "sag" ? "L" : "R";
  return {
    [`${t}_kol`]: { vrm: { kemik: `${V}UpperArm`, yon: `${V}LowerArm` }, soma: { eklem: `${S}Arm`, yon: `${S}ForeArm` }, prosedurel: `omuz${P}` },
    [`${t}_on_kol`]: { vrm: { kemik: `${V}LowerArm`, yon: `${V}Hand` }, soma: { eklem: `${S}ForeArm`, yon: `${S}Hand` } },
    [`${t}_el`]: { vrm: { kemik: `${V}Hand`, yon: `${V}MiddleProximal` }, soma: { eklem: `${S}Hand`, yon: `${S}HandMiddle1` } },
    [`${t}_bacak`]: { vrm: { kemik: `${V}UpperLeg`, yon: `${V}LowerLeg` }, soma: { eklem: `${S}Leg`, yon: `${S}Shin` }, prosedurel: `bacak${P}` },
    [`${t}_diz`]: { vrm: { kemik: `${V}LowerLeg`, yon: `${V}Foot` }, soma: { eklem: `${S}Shin`, yon: `${S}Foot` } },
    [`${t}_ayak`]: { vrm: { kemik: `${V}Foot`, yon: `${V}Toes` }, soma: { eklem: `${S}Foot`, yon: `${S}ToeBase` } },
  } as Record<string, KaynakKemigi>;
};

/** Uzuv → kaynak adları. `kok` (bütün beden) yoktur: iskeletin kendi ara düğümüdür. */
export const KAYNAK_KEMIKLERI: Readonly<Partial<Record<Uzuv, KaynakKemigi>>> = {
  kalca: { vrm: { kemik: "hips", yon: "spine" }, soma: { eklem: "Hips", yon: "Spine1" } },
  govde: { vrm: { kemik: "spine", yon: "chest" }, soma: { eklem: "Spine1", yon: "Spine2" }, prosedurel: "kalca" },
  gogus: { vrm: { kemik: "chest", yon: "neck" }, soma: { eklem: "Chest", yon: "Neck1" } },
  boyun: { vrm: { kemik: "neck", yon: "head" }, soma: { eklem: "Neck1", yon: "Head" } },
  bas: { vrm: { kemik: "head", yon: null }, soma: { eklem: "Head", yon: "HeadEnd" }, prosedurel: "boyun" },
  ...yan("sag"), ...yan("sol"),
};
