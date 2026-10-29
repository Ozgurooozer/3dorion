// world/level/cekirdek/isiklar.ts — Level'ın IŞIK AKTÖRLERİ (spec 42): `tanim.isiklar` → Babylon ışıkları. Güneş ve dolgu `isikSistemi.ts`'te kalır.
//
// Unreal'da ışık level'ın bir nesnesidir (Place Actors ▸ Lights); bizde güneş ve dolgu level'ın tek ayarıydı. Bu modül ikincisine EKLENİR, onu değiştirmez:
// tanımda `isiklar` yoksa hiçbir ışık kurulmaz (eski level'lar birebir aynı).
// `uygula` her düzenlemede çağrılır (ucuz): kimlik eşleşir, değişen yerinde güncellenir, kalkan yok edilir, yenisi kurulur. Kimlik SIRA değil `id` (silme diğerlerine dokunmaz).
// MVP yalnız nokta ışık; gölge yok (gölge maliyeti ölçülmeden açılmaz). GI hacmi her kare `scene.lights`'i okur: yeni ışık kendiliğinden girer.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { IsikAktoru } from "./levelTanimi.ts";
import type { Renk } from "./renk.ts";

export interface IsikAktorleri {
  /** Tanıma uydurur: yeni → kur, aynı kimlik → yerinde güncelle, kalkan → yok et, gizli → kapalı. */
  uygula(liste: readonly IsikAktoru[], renk: (ad: string) => Renk): void;
  /** Sahnede AÇIK ışık aktörü sayısı (gizliler sayılmaz). */
  say(): number;
  /** Kimliğe göre Babylon ışığı (seçim, gizmo, ölçüm); yoksa null. */
  isik(id: string): PointLight | null;
  /** Kurulu ışıkların kimlikleri (gizliler dahil): sahne işaretleri ve gizmo her karede bunu gezer, tanımı kopyalamadan. */
  kimlikler(): IterableIterator<string>;
  yokEt(): void;
}

/** Sahne ışık adı: ışık aktörleri güneş/dolgudan (`isik_gunes`, `isik_dolgu`) ayrılsın. */
export const ISIK_ADI_ONEKI = "isik_aktor_";

const c3 = (r: Renk) => new Color3(r[0], r[1], r[2]);

export function isiklarKur(sahne: Scene): IsikAktorleri {
  const kurulu = new Map<string, PointLight>();

  return {
    uygula(liste, renk) {
      const istenen = new Set<string>();
      for (const [sira, a] of liste.entries()) {
        const id = a.id ?? `sira${sira}`;   // levelKur kimlikleri doldurur; yedek yalnız doğrudan çağrıda
        istenen.add(id);
        let n = kurulu.get(id);
        if (!n) { n = new PointLight(`${ISIK_ADI_ONEKI}${id}`, Vector3.Zero(), sahne); kurulu.set(id, n); }
        n.position.set(a.konum[0], a.konum[1], a.konum[2]);
        const r = c3(renk(a.renk));
        n.diffuse = r;
        n.specular = Color3.Black();   // mat lowpoly yüzey (malzeme.ts specular siyah); parlama yok
        n.intensity = a.siddet;
        n.range = a.menzil;
        // setEnabled yalnız durum DEĞİŞİNCE (her çağrıda ışık yeniden hesaplatır: Babylon uyarısı, spec 38 tuzağı).
        const aciksin = !a.gizli;
        if (n.isEnabled(false) !== aciksin) n.setEnabled(aciksin);
      }
      for (const [id, n] of kurulu) if (!istenen.has(id)) { n.dispose(); kurulu.delete(id); }
    },
    say: () => [...kurulu.values()].filter((n) => n.isEnabled(false)).length,
    isik: (id) => kurulu.get(id) ?? null,
    kimlikler: () => kurulu.keys(),
    yokEt() { for (const n of kurulu.values()) n.dispose(); kurulu.clear(); },
  };
}
