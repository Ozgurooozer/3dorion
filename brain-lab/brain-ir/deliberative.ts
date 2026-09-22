// brain-ir/deliberative.ts — Bob'un sınırlı bütçeli deliberative planlayıcısı.
// Amaç: gerçek dünya döngüsünü durdurmadan aday eylem dizilerini deterministik olarak değerlendirmek.
"use strict";

import type { DunyaDurumu, Eylem, Gozlem, Nokta, Yon } from "./v03.ts";

export interface DeliberativeConfig {
  derinlik: number;
  nodeBudget: number;
  collisionPenalty: number;
  energyWeight: number;
  distanceWeight: number;
}

export interface PlanAdimi {
  eylem: Eylem;
  beklenenKonum: Nokta;
  beklenenYon: Yon;
  carpisma: boolean;
}

export interface PlanSonucu {
  eylem: Eylem;
  plan: PlanAdimi[];
  beklenenBasari: boolean;
  beklenenFayda: number;
  ziyaretEdilenDugum: number;
  kesildi: boolean;
  derinlik: number;
}

const EYLEMLER: readonly Eylem[] = ["ileri", "sol", "sag", "bekle"];
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
const mesafe = (a: Nokta, b: Nokta) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const yonVektoru: Record<Yon, Nokta> = { 0: { x: 0, y: -1 }, 1: { x: 1, y: 0 }, 2: { x: 0, y: 1 }, 3: { x: -1, y: 0 } };
const kopya = (d: DunyaDurumu): DunyaDurumu => ({ ...d, konum: { ...d.konum }, hedef: { ...d.hedef }, engeller: d.engeller.map((e) => ({ ...e })) });

function uygula(durum: DunyaDurumu, eylem: Eylem): { durum: DunyaDurumu; adim: PlanAdimi } {
  const sonraki = kopya(durum);
  const maliyet = eylem === "bekle" ? 0.005 : 0.02;
  let carpisma = false;
  if (eylem === "sol") sonraki.yon = ((sonraki.yon + 3) % 4) as Yon;
  if (eylem === "sag") sonraki.yon = ((sonraki.yon + 1) % 4) as Yon;
  if (eylem === "ileri") {
    const v = yonVektoru[sonraki.yon];
    const hedef = { x: sonraki.konum.x + v.x, y: sonraki.konum.y + v.y };
    if (sonraki.engeller.some((e) => e.x === hedef.x && e.y === hedef.y)) carpisma = true;
    else sonraki.konum = hedef;
  }
  sonraki.enerji = Math.max(0, sonraki.enerji - maliyet);
  sonraki.zaman++;
  sonraki.tamamlandi = sonraki.konum.x === sonraki.hedef.x && sonraki.konum.y === sonraki.hedef.y;
  return { durum: sonraki, adim: { eylem, beklenenKonum: { ...sonraki.konum }, beklenenYon: sonraki.yon, carpisma } };
}

function fayda(durum: DunyaDurumu, carpisma: boolean, config: DeliberativeConfig): number {
  const goal = -mesafe(durum.konum, durum.hedef) * config.distanceWeight;
  const energy = -((1 - durum.enerji) * config.energyWeight);
  const collision = carpisma ? -config.collisionPenalty : 0;
  const completion = durum.tamamlandi ? config.collisionPenalty * 2 : 0;
  return goal + energy + collision + completion;
}

export class DeliberativePlanner {
  readonly config: DeliberativeConfig;
  constructor(config: Partial<DeliberativeConfig> = {}) {
    this.config = {
      derinlik: config.derinlik ?? 4,
      nodeBudget: config.nodeBudget ?? 512,
      collisionPenalty: config.collisionPenalty ?? 10,
      energyWeight: config.energyWeight ?? 1,
      distanceWeight: config.distanceWeight ?? 2,
    };
    if (this.config.derinlik < 1 || this.config.nodeBudget < 1) throw new Error("deliberative bütçe pozitif olmalı");
  }
  planla(baslangic: DunyaDurumu, _gozlem?: Gozlem): PlanSonucu {
    let ziyaretEdilenDugum = 0;
    let enIyi: { fayda: number; plan: PlanAdimi[]; tamamlandi: boolean } | undefined;
    let kesildi = false;
    const ara = (durum: DunyaDurumu, derinlik: number, plan: PlanAdimi[], sonCarpisma: boolean): void => {
      if (ziyaretEdilenDugum >= this.config.nodeBudget) { kesildi = true; return; }
      ziyaretEdilenDugum++;
      const skor = fayda(durum, sonCarpisma, this.config);
      if (!enIyi || skor > enIyi.fayda) enIyi = { fayda: skor, plan: [...plan], tamamlandi: durum.tamamlandi };
      if (derinlik >= this.config.derinlik || durum.tamamlandi) return;
      for (const eylem of EYLEMLER) {
        const sonraki = uygula(durum, eylem);
        ara(sonraki.durum, derinlik + 1, [...plan, sonraki.adim], sonraki.adim.carpisma);
        if (ziyaretEdilenDugum >= this.config.nodeBudget) { kesildi = true; return; }
      }
    };
    ara(kopya(baslangic), 0, [], false);
    // Çok küçük bütçede kök düğümden sonra hiç çocuk tamamlanamayabilir.
    // Planner yine de boş karar döndürmez; güvenli dönüş ilk eylemidir.
    const secilen = enIyi?.plan[0] ?? uygula(baslangic, "sol").adim;
    return {
      eylem: secilen.eylem,
      plan: enIyi?.plan?.length ? enIyi.plan : [secilen],
      beklenenBasari: enIyi?.tamamlandi ?? false,
      beklenenFayda: enIyi?.fayda ?? -Infinity,
      ziyaretEdilenDugum,
      kesildi,
      derinlik: this.config.derinlik,
    };
  }
}

export function gozlemdenPlan(planner: DeliberativePlanner, dunya: DunyaDurumu, gozlem: Gozlem): PlanSonucu {
  return planner.planla(dunya, gozlem);
}

export function adaySayisi(derinlik: number, dallanma = EYLEMLER.length): number {
  return Math.floor((dallanma ** (derinlik + 1) - 1) / (dallanma - 1));
}

export function faydaSiniri(durum: DunyaDurumu, config: DeliberativeConfig): number {
  return clamp(fayda(durum, false, config), -Infinity, Infinity);
}
