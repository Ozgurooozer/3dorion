// world/avatar/zincirler.ts — ZİNCİR MODELİ (spec 37 §3, spec 38 §2): kanonik yapı (`iskelet/kanonik.ts`) + kaynak adları (`iskelet/kaynaklar.ts`) birleşimi.
// SAF: Babylon yok.
//
// Çeviri (Kimodo BVH → sekans), IK ve Control Rig AYNI birleşik yapıya dayanır: kökten uca sıralı eklemler, zincirin takıldığı uzuv, uç etkileyici,
// dirsek/diz kutbu. YAPI burada tanımlanmaz (kanonik.ts), AD burada tanımlanmaz (kaynaklar.ts): bu dosya ikisini eski biçimde (`ZincirEklemi`) birleştirir,
// böylece çevirici/eşleme tüketicileri değişmedi (davranış anlık görüntüyle sınanır: iskelet/kanonik.test.ts).
//
// KAVRAMLAR:
//   • RETARGET KÖKÜ (`RETARGET_KOKU`): pelvis — `kalca` uzvu; zincir değildir, omurga ve bacaklar ona takılır. (`kok` uzvu ayrı: iskeletin kendi ara
//     düğümü, bütün beden; yalnız öteleme taşır — uzuvEslemesi.ts KOK_DUGUMU.)
//   • ZİNCİR EKLEMİ: soyut uzuv + her gövde türünde kemik adı + kaynak eklem adı + YÖN NOKTASI (kemiğin doğrultusu; hizalama ve uzunluk için).
//   • UÇ ETKİLEYİCİ (`uc`): zincirin son uzvu. KONTROL NOKTALARI: el ×2, ayak ×2, pelvis, baş.
//   • IK: iki kemikli zincirde üst/orta/uç uzuv + KUTUP (kanonik.ts).
// Eksenler gövde uzayıdır (protocol/animasyon.ts): yüzü +Z, yukarı +Y, sağı +X.
"use strict";
import type { Uzuv } from "../../protocol/animasyon.ts";
import { KANONIK_KOK, KANONIK_ZINCIRLER, ZINCIR_ADLARI, kanonikAta, type ZincirAdi } from "./iskelet/kanonik.ts";
import { KAYNAK_KEMIKLERI, type KaynakIskelet } from "./iskelet/kaynaklar.ts";

export { ZINCIR_ADLARI };
export type { ZincirAdi, KaynakIskelet };

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

function eklem(u: Uzuv): ZincirEklemi {
  const k = KAYNAK_KEMIKLERI[u];
  if (!k) throw new Error(`kaynak tablosunda uzuv yok: ${u}`);
  return {
    uzuv: u,
    kemik: { vrm: k.vrm.kemik, ...(k.prosedurel !== undefined ? { prosedurel: k.prosedurel } : {}) },
    kaynak: { soma: k.soma.eklem },
    yon: { vrm: k.vrm.yon, soma: k.soma.yon },
  };
}

/** Pelvis: zincirlerin takıldığı kök eklem (`kalca` uzvu). */
export const RETARGET_KOKU: ZincirEklemi = eklem(KANONIK_KOK);

/** Zincir tablosu (kanonik yapı + kaynak adları). */
export const ZINCIRLER: readonly Zincir[] = KANONIK_ZINCIRLER.map((z) => ({
  ad: z.ad, taraf: z.taraf, baglanti: z.baglanti, uc: z.uzuvlar[z.uzuvlar.length - 1]!,
  eklemler: z.uzuvlar.map(eklem),
  ik: z.kutup ? { ust: z.uzuvlar[0]!, orta: z.uzuvlar[1]!, uc: z.uzuvlar[2]!, kutup: { ...z.kutup } } : null,
}));

/** Control Rig'in kontrol noktaları (ad + uzuv). Kontrol modeli (`rig/kontroller.ts`) bunlardan fazlasını da tanımlar. */
export const KONTROL_NOKTALARI: readonly { ad: string; uzuv: Uzuv }[] = [
  { ad: "pelvis", uzuv: "kalca" }, { ad: "bas", uzuv: "bas" },
  { ad: "sag_el", uzuv: "sag_el" }, { ad: "sol_el", uzuv: "sol_el" }, { ad: "sag_ayak", uzuv: "sag_ayak" }, { ad: "sol_ayak", uzuv: "sol_ayak" },
];

/** Kök + bütün zincir eklemleri, ebeveyn önce (kök, sonra tablo sırası: her zincirin bağlantısı kendisinden önce gelir). */
export function butunEklemler(): ZincirEklemi[] {
  return [RETARGET_KOKU, ...ZINCIRLER.flatMap((z) => z.eklemler)];
}

/** Bir uzvun en yakın EŞLENMİŞ atası (zincir içinde bir önceki eklem; zincirin ilki için bağlantı; pelvis için null). */
export const uzuvAtasi: (u: Uzuv) => Uzuv | null = kanonikAta;
