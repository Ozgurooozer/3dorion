// world/avatar/uzuvEslemesi.ts — SOYUT UZUV → GÖVDEYE ÖZGÜ DÜĞÜM tablosu (spec 35 Dilim 5a). SAF: Babylon yok, yalnız adlar.
//
// Klip bir kez yazılır ("sag_kol"); her gövde türü onu kendi düğümüne çevirir. Tabloda olmayan uzuv o gövdede YOKTUR: izi atlanır ve SAYILIR
// (`klipOrnekleyici.atlananIzler`; avatar günlüğe yazar), sessizce yutulmaz. Tabloda olup modelde bulunamayan düğüm de (başka bir VRM, eksik kemik)
// iskelet kurulurken düşer: `AvatarIskeleti.klipUzuvlari` yalnız GERÇEKTEN bulunanları taşır.
//
// ÖLÇÜLEN GERÇEK (başsız, NullEngine, 2026-10-22; `klipGovdesi.test.ts` bekçisi):
//   • low-poly beden (assets/orion-lowpoly.glb) TEK MESH ("orion_govde", 15 000 köşe) ama İSKELETLİ: 52 kemik ("orion_rig", VRM humanoid adları),
//     her kemik bir TransformNode'a bağlı. Yüzü +Z, `rightHand` +X'te (gövdenin kendi sağı).
//   • prosedürel blok gövde: yüzü +Z, ama `omuzL`/`bacakL` +X'te (gövdenin SAĞI) — gözlerde L -X'te. Ad karışık: bu yüzden `sag_kol` → `omuzL`.
//     (Prosedürel `el_salliyor` jesti `omuzR`'yi, yani gövdenin SOL kolunu kaldırır; ona dokunulmadı.)
//   • LED yüz: uzuv yok (gövdesiz donanım; tablo boş — klip yerine jestin yüz hâli görünür).
"use strict";
import type { Uzuv } from "../../protocol/animasyon.ts";
import type { IskeletBilgisi } from "./iskelet.ts";
import { butunEklemler } from "./zincirler.ts";

/** Bütün bedeni taşıyan, iskeletin KENDİ eklediği ara düğüm (ayak hizasında): eğilme/zıplama buna uygulanır, modele dokunmadan. */
export const KOK_DUGUMU = "@kok";

/**
 * Gövde türü başına eşleme. VRM: VRM humanoid kemik adları (bu yükleyici adla arar; başka bir VRM aynı adları taşır). Prosedürel: düğüm adının
 * önek SONRASI ("omuzL" → `${onek}_omuzL`). Bilerek yok: prosedürelde ön kol, el, göğüs ve boyun ayrı parça değil (kol tek kutu, baş boyun
 * pivotunda) — `bas` boyun pivotuna gider, `boyun` ise aynı düğümü İKİNCİ kez döndürmesin diye eşlenmez.
 */
export const UZUV_ESLEMESI: Readonly<Record<IskeletBilgisi["tur"], Readonly<Partial<Record<Uzuv, string>>>>> = {
  // Tek kaynak ZİNCİR TABLOSU (spec 37 §3, `zincirler.ts`): kemik adları orada; burada yalnız türetilir (kopya tablo yok). Bekçi:
  // klipKutuphanesi.test.ts (VRM bütün uzuvları kapsar) ve kimodoCevir.test.ts (prosedürel tablo eski hâliyle aynı).
  vrm: { kok: KOK_DUGUMU, ...Object.fromEntries(butunEklemler().map((e) => [e.uzuv, e.kemik.vrm])) },
  prosedurel: { kok: KOK_DUGUMU, ...Object.fromEntries(butunEklemler().flatMap((e) => (e.kemik.prosedurel ? [[e.uzuv, e.kemik.prosedurel]] : []))) },
  ledyuz: {},
};

/**
 * Bir gövde türünün eşlemesini çözer: `bul(ad)` düğümü döner ya da null (modelde yok). Sonuç YALNIZ bulunanlar — çağıran bunları uzuv kümesi yapar.
 * Genel (tip parametresi): saf testte sahte düğüm, iskelette Babylon TransformNode.
 */
export function uzuvlariCoz<D>(tur: IskeletBilgisi["tur"], bul: (ad: string) => D | null): { dugumler: Map<Uzuv, D>; eksik: string[] } {
  const dugumler = new Map<Uzuv, D>();
  const eksik: string[] = [];
  for (const [uzuv, ad] of Object.entries(UZUV_ESLEMESI[tur]) as [Uzuv, string][]) {
    if (ad === KOK_DUGUMU) continue;          // kök ara düğümü iskeletin kendisi kurar
    const d = bul(ad);
    if (d) dugumler.set(uzuv, d); else eksik.push(`${uzuv} → ${ad}`);
  }
  return { dugumler, eksik };
}
