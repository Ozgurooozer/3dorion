// world/avatar/iskelet/kanonik.ts — KANONİK İNSANSI İSKELET (spec 38 §2): kaynak iskeletten (VRM, SOMA, prosedürel) BAĞIMSIZ yapı. SAF: Babylon yok.
//
// NEDEN AYRI: eskiden `zincirler.ts` hem yapıyı (hangi uzuv hangi zincirde, ebeveyni kim) hem de her kaynağın kemik adlarını tek tabloda taşıyordu;
// yeni bir kaynak iskelet (Mixamo, Unreal Mannequin) yapıya dokunmayı gerektirirdi. Şimdi üç katman, tek yön:
//   kanonik.ts (BU DOSYA: yapı)  →  kaynaklar.ts (kaynak başına ad eşlemesi)  →  zincirler.ts (ikisinin birleşimi; retarget/çevirici bunu okur)
// Retarget, IK ve Control Rig YALNIZ bu yapıya dayanır: "sol kolun üç uzvu, kutbu geri" bilgisi kemik adına bakmadan buradan gelir.
//
// Unreal Mannequin / Mixamo ile karşılığı (yalnız anlaşılsın diye): kalca = pelvis/Hips, govde = spine_01..02/Spine1, gogus = spine_03/Spine2,
// boyun = neck_01, bas = head, kol = upperarm, on_kol = lowerarm, el = hand, bacak = thigh, diz = calf, ayak = foot.
"use strict";
import type { Uzuv } from "../../../protocol/animasyon.ts";

export const ZINCIR_ADLARI = ["omurga", "bas_boyun", "sag_kol", "sol_kol", "sag_bacak", "sol_bacak"] as const;
export type ZincirAdi = (typeof ZINCIR_ADLARI)[number];

/** Kutup: gövde uzayında orta eklemin beklenen bükülme yönü (birim; dirsek GERİ −Z, diz İLERİ +Z). Gövde uzayı: yüzü +Z, yukarı +Y, sağı +X. */
export interface KanonikKutup { x: number; y: number; z: number }

export interface KanonikZincir {
  ad: ZincirAdi;
  taraf: "sag" | "sol" | "orta";
  /** Zincirin takıldığı uzuv (ilk uzvun ebeveyni). */
  baglanti: Uzuv;
  /** Kökten uca. Uç etkileyici = son uzuv. */
  uzuvlar: readonly Uzuv[];
  /** İki kemikli IK zinciri (üst/orta/uç = ilk üç uzuv) için kutup; omurga ve baş-boyun için null. */
  kutup: KanonikKutup | null;
}

/** Zincirlerin takıldığı kök uzuv (pelvis). Zincir DEĞİL. */
export const KANONIK_KOK: Uzuv = "kalca";

const taraf = (t: "sag" | "sol") => ({
  kol: { ad: `${t}_kol` as const, taraf: t, baglanti: "gogus" as Uzuv, uzuvlar: [`${t}_kol`, `${t}_on_kol`, `${t}_el`] as Uzuv[], kutup: { x: 0, y: 0, z: -1 } },
  bacak: { ad: `${t}_bacak` as const, taraf: t, baglanti: "kalca" as Uzuv, uzuvlar: [`${t}_bacak`, `${t}_diz`, `${t}_ayak`] as Uzuv[], kutup: { x: 0, y: 0, z: 1 } },
});

/** Zincir sırası = ZINCIR_ADLARI sırası: her zincirin bağlantısı kendisinden ÖNCE gelen bir zincirde (ya da kökte) bulunur. */
export const KANONIK_ZINCIRLER: readonly KanonikZincir[] = [
  { ad: "omurga", taraf: "orta", baglanti: "kalca", uzuvlar: ["govde", "gogus"], kutup: null },
  { ad: "bas_boyun", taraf: "orta", baglanti: "gogus", uzuvlar: ["boyun", "bas"], kutup: null },
  taraf("sag").kol, taraf("sol").kol, taraf("sag").bacak, taraf("sol").bacak,
];

/** Bir uzvun zincirdeki yeri: [zincir, sıra] (kök ve kok uzvu için null). */
export function uzuvZinciri(u: Uzuv): { zincir: KanonikZincir; sira: number } | null {
  for (const z of KANONIK_ZINCIRLER) { const i = z.uzuvlar.indexOf(u); if (i >= 0) return { zincir: z, sira: i }; }
  return null;
}

/** Ebeveyn: zincir içinde bir önceki uzuv; zincirin ilki için bağlantı; kök için null. */
export function kanonikAta(u: Uzuv): Uzuv | null {
  const y = uzuvZinciri(u);
  if (!y) return null;
  return y.sira === 0 ? y.zincir.baglanti : y.zincir.uzuvlar[y.sira - 1]!;
}

/** Kök + bütün zincir uzuvları, ebeveyn önce. */
export function kanonikUzuvlar(): Uzuv[] {
  return [KANONIK_KOK, ...KANONIK_ZINCIRLER.flatMap((z) => z.uzuvlar)];
}
