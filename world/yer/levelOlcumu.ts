// world/yer/levelOlcumu.ts — Kurulu bir level'dan Orion için `Yer` ölçer (spec 24 C2; spec 27'de ortak): yerleşim kutuları sahneden BİR KEZ
// ölçülür, anlam sözlükten gelir, sonuç SAF veridir (level yıkılsa da geçerli).
"use strict";
import type { Level } from "../level/cekirdek/levelKur.ts";
import { etkinAnlam } from "../level/cekirdek/anlam.ts";
import { kisaAd } from "../level/cekirdek/katalog.ts";
import type { Yer } from "./yer.ts";
import { levelYeri, levelYuksekligi, type KutuMinMax } from "./levelYeri.ts";

export async function levelYeriniOlc(level: Level, ad: string): Promise<Yer> {
  const tanim = level.tanim();
  const kutular = new Map<string, KutuMinMax>();
  for (const n of tanim.nesneler ?? []) {
    const dugum = n.id ? level.nesneler.dugum(n.id) : null;
    if (!dugum) continue;
    const s = dugum.getHierarchyBoundingVectors(true);
    if (Number.isFinite(s.min.x)) kutular.set(n.id!, { min: [s.min.x, s.min.y, s.min.z], max: [s.max.x, s.max.y, s.max.z] });
  }
  const [katalog, sozluk] = await Promise.all([level.nesneler.katalog(), level.nesneler.anlamlar().catch(() => null)]);
  const kategori = new Map(katalog.varliklar.map((v) => [v.ad, v.kategori]));
  return levelYeri({ ad, tanim, kutular, yukseklik: levelYuksekligi(tanim), anlamOf: (n) => etkinAnlam(n, kategori.get(n.varlik), sozluk, kisaAd) });
}
