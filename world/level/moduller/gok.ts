// world/level/moduller/gok.ts — Gök kubbesi: içinden bakılan lowpoly yarım küre, BANTLI renk geçişi.
//
// Işıksız (pişmiş): rengi tamamen bantlardan. Ufkun biraz altından başlar (kenar görünmesin), kameraya
// yapışıktır (`infiniteDistance`: yürüsen de gök kaçmaz). Ayar: yarıçap, bant/dilim sayısı, üç durak rengi.
"use strict";
import { flatGeometri, meshKur, type Geometri, type Ucgen, type V3 } from "../cekirdek/geometri.ts";
import { karistir, type Renk } from "../cekirdek/renk.ts";
import type { LevelModulu } from "../cekirdek/modul.ts";

export const GOK_VARSAYILAN = {
  yaricap: 480,
  /** Çevre dilimi (boylam). */
  dilim: 18,
  /** Ufuktan tepeye bant sayısı (enlem). Az = kaba kademeli, çok = yumuşak. */
  bant: 7,
  ufuk: "gokUfuk",
  orta: "gokOrta",
  zenit: "gokZenit",
  /** Orta rengin ufuktan yüksekliği (0..1, sinüs). */
  ortaKonum: 0.25,
};
export type GokAyari = typeof GOK_VARSAYILAN;

/** Yükseklik sinüsü [0..1] → renk (ufuk → orta → zenit). */
export function gokRengi(t: number, ufuk: Renk, orta: Renk, zenit: Renk, ortaKonum: number): Renk {
  const s = Math.max(0, Math.min(1, t));
  return s < ortaKonum ? karistir(ufuk, orta, s / ortaKonum) : karistir(orta, zenit, (s - ortaKonum) / (1 - ortaKonum));
}

export function gokGeometrisi(a: GokAyari, ufuk: Renk, orta: Renk, zenit: Renk): Geometri {
  const r = a.yaricap;
  const enlemler = Array.from({ length: a.bant + 1 }, (_, k) => -0.12 + (k / a.bant) * (Math.PI / 2 + 0.12));
  const nokta = (bo: number, en: number): V3 => {
    const t = (bo / a.dilim) * Math.PI * 2;
    return [Math.cos(en) * Math.cos(t) * r, Math.sin(en) * r, Math.cos(en) * Math.sin(t) * r];
  };
  const ice = (p: V3, q: V3, s: V3): V3 => [-(p[0] + q[0] + s[0]), -(p[1] + q[1] + s[1]), -(p[2] + q[2] + s[2])];
  const u: Ucgen[] = [];
  for (let k = 0; k < a.bant; k++) {
    const renk = gokRengi(Math.sin(Math.max(0, (enlemler[k]! + enlemler[k + 1]!) / 2)), ufuk, orta, zenit, a.ortaKonum);
    for (let b = 0; b < a.dilim; b++) {
      const a0 = nokta(b, enlemler[k]!), a1 = nokta(b + 1, enlemler[k]!);
      const u0 = nokta(b, enlemler[k + 1]!), u1 = nokta(b + 1, enlemler[k + 1]!);
      u.push({ a: a0, b: a1, c: u1, renk, yon: ice(a0, a1, u1) });
      if (k < a.bant - 1) u.push({ a: a0, b: u1, c: u0, renk, yon: ice(a0, u1, u0) });
    }
  }
  return flatGeometri(u);
}

export const gokModulu: LevelModulu<GokAyari> = {
  tur: "gok",
  aciklama: "Bantlı gök kubbesi (ışıksız, kameraya yapışık).",
  varsayilan: GOK_VARSAYILAN,
  aralik: {
    yaricap: { min: 100, max: 900, adim: 10 }, dilim: { min: 6, max: 48, adim: 1 }, bant: { min: 2, max: 32, adim: 1 },
    ortaKonum: { min: 0.05, max: 0.95, adim: 0.01 },
  },
  kur(b, a) {
    const m = meshKur(b.sahne, "gok", gokGeometrisi(a, b.renk(a.ufuk), b.renk(a.orta), b.renk(a.zenit)));
    const malzeme = b.malzeme("gok", "pismis", { gok: true });   // gece göğü/yıldız/ay: shader/moduller/gokZamani.ts
    m.material = malzeme;
    m.infiniteDistance = true;
    m.applyFog = false;
    m.freezeWorldMatrix();
    return { meshler: [m], yokEt() { m.dispose(); malzeme.dispose(); } };
  },
};
