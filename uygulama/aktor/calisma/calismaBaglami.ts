// uygulama/aktor/calisma/calismaBaglami.ts — ÇALIŞMA ZAMANI YÖNETİCİLERİNİN ORTAK YÜZÜ (spec 45 B4 bölme). Bağ/hareket/tetik yöneticileri (`aktorBaglari.ts`, `aktorHareketi.ts`, `aktorTetikleri.ts`)
// aktör tablosunu ve level'i buradaki daracık bağlamdan görür; durumu (ezme, yenileme) `aktorCalismaZamani.ts` tutar. Babylon değil yalnız tür burada.
"use strict";
import type { Node } from "@babylonjs/core/node";
import type { Level } from "../../../world/level/cekirdek/levelKur.ts";
import type { BilesenKaydi } from "../../../world/level/cekirdek/bilesenKaydi.ts";
import type { AktorGunlugu } from "./aktorGunlugu.ts";

/** Tanımdan okunan aktörün çalışma zamanı görünümü (nesne ya da ışık). */
export interface Aktor {
  id: string;
  tur: "nesne" | "isik";
  ust?: string;
  soket?: string;
  bilesenler: readonly BilesenKaydi[];
}

export interface CalismaBaglami {
  /** Açık level; yoksa null (yöneticiler sessizce atlar). */
  level: () => Level | null;
  gunluk: AktorGunlugu;
  /** Şu anki aktör tablosu (tanımdan 0.25 sn'de bir yenilenir; her çağrıda güncel harita). */
  aktorler: () => ReadonlyMap<string, Aktor>;
  /** Aktörün sahnedeki düğümü; henüz yüklenmediyse ya da yıkıldıysa null. */
  dugumu: (a: Aktor) => Node | null;
  /** Olay yolu reddederse SESSİZ KALMAZ: kodlu uyarı + sayaç. */
  olayYolla: (aktor: string, ad: string, veri: Record<string, string | number | boolean>) => void;
}

/** Aktörün verilen türdeki ilk bileşeni (yoksa undefined). */
export const bilesenBul = (a: Aktor, tur: string): BilesenKaydi | undefined => a.bilesenler.find((x) => x.tur === tur);

/** [x, y, z] sayı üçlüsü okur; biçim bozuksa `yedek`. */
export const ucluOku = (v: unknown, yedek: readonly [number, number, number]): readonly [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number") ? [v[0] as number, v[1] as number, v[2] as number] : yedek;
