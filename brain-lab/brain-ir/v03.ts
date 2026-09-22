// brain-ir/v03.ts — v0.3: küçük deterministik dünya ve öğrenme döngüsü.
// v0.2 neural substrate'tan bağımsız tutulur; amaç önce ölçülebilir davranışı kanıtlamaktır.
"use strict";

import { DeliberativePlanner } from "./deliberative.ts";

export type Eylem = "ileri" | "sol" | "sag" | "bekle";
export type Yon = 0 | 1 | 2 | 3; // kuzey, doğu, güney, batı
export type ReflexDurumu = "yok" | "aktif" | "askida";

export interface Nokta { x: number; y: number }
export interface Engel extends Nokta { id: string }
export interface DunyaDurumu {
  konum: Nokta;
  yon: Yon;
  hedef: Nokta;
  engeller: Engel[];
  enerji: number;
  zaman: number;
  tamamlandi: boolean;
}

export interface Gozlem {
  konum: Nokta;
  yon: Yon;
  hedefYon: Yon;
  mesafe: number;
  onEngel: boolean;
  enerji: number;
  baglam: string;
}

export interface Sonuc {
  basarili: boolean;
  carpisma: boolean;
  enerjiMaliyeti: number;
  yeniDurum: DunyaDurumu;
}

export interface Tahmin { basarili: boolean; enerji: number }
export interface Deneyim {
  id: string;
  gozlem: Gozlem;
  eylem: Eylem;
  tahmin: Tahmin;
  sonuc: Sonuc;
  predictionError: number;
  novelty: number;
  informationGain: number;
  enerjiMaliyeti: number;
  kaynak: "alice" | "bob";
}

const clamp = (x: number, min = 0, max = 1) => Math.max(min, Math.min(max, x));
const kopyala = (d: DunyaDurumu): DunyaDurumu => ({ ...d, konum: { ...d.konum }, hedef: { ...d.hedef }, engeller: d.engeller.map((e) => ({ ...e })) });
const manhattan = (a: Nokta, b: Nokta) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export class KucukDunya {
  private durum: DunyaDurumu;
  constructor(engeller: Engel[] = [{ id: "duvar-1", x: 1, y: 0 }]) {
    this.durum = { konum: { x: 0, y: 0 }, yon: 1, hedef: { x: 2, y: -1 }, engeller: engeller.map((e) => ({ ...e })), enerji: 1, zaman: 0, tamamlandi: false };
  }
  durumunuVer(): DunyaDurumu { return kopyala(this.durum); }
  gozlemle(): Gozlem {
    const dx = this.durum.hedef.x - this.durum.konum.x;
    const dy = this.durum.hedef.y - this.durum.konum.y;
    const hedefYon: Yon = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 1 : 3) : (dy >= 0 ? 2 : 0);
    const yonVektoru: Record<Yon, Nokta> = { 0: { x: 0, y: -1 }, 1: { x: 1, y: 0 }, 2: { x: 0, y: 1 }, 3: { x: -1, y: 0 } };
    const v = yonVektoru[this.durum.yon];
    const on = this.durum.engeller.some((e) => e.x === this.durum.konum.x + v.x && e.y === this.durum.konum.y + v.y);
    return { konum: { ...this.durum.konum }, yon: this.durum.yon, hedefYon, mesafe: manhattan(this.durum.konum, this.durum.hedef), onEngel: on, enerji: this.durum.enerji, baglam: `${this.durum.konum.x},${this.durum.konum.y}|${this.durum.yon}|${on ? "engel" : "acik"}` };
  }
  adim(eylem: Eylem): Sonuc {
    const once = kopyala(this.durum);
    const maliyet = eylem === "bekle" ? 0.005 : 0.02;
    let carpisma = false;
    if (eylem === "sol") this.durum.yon = ((this.durum.yon + 3) % 4) as Yon;
    if (eylem === "sag") this.durum.yon = ((this.durum.yon + 1) % 4) as Yon;
    if (eylem === "ileri") {
      const v: Record<Yon, Nokta> = { 0: { x: 0, y: -1 }, 1: { x: 1, y: 0 }, 2: { x: 0, y: 1 }, 3: { x: -1, y: 0 } };
      const n = { x: this.durum.konum.x + v[this.durum.yon].x, y: this.durum.konum.y + v[this.durum.yon].y };
      if (this.durum.engeller.some((e) => e.x === n.x && e.y === n.y)) carpisma = true;
      else this.durum.konum = n;
    }
    this.durum.enerji = Math.max(0, this.durum.enerji - maliyet);
    this.durum.zaman++;
    this.durum.tamamlandi = this.durum.konum.x === this.durum.hedef.x && this.durum.konum.y === this.durum.hedef.y;
    // Episode tamamlanması ayrı metriktir; burada tek güvenli adımın sonucunu kaydediyoruz.
    return { basarili: !carpisma && this.durum.enerji > 0, carpisma, enerjiMaliyeti: maliyet, yeniDurum: kopyala(this.durum) };
  }
  sifirla(): void { this.durum = new KucukDunya(this.durum.engeller).durumunuVer(); }
  oncekiDurum(): DunyaDurumu { return kopyala(this.durum); }
  static gozlemMesafesi(a: Gozlem, b: Gozlem): number { return Math.abs(a.konum.x - b.konum.x) + Math.abs(a.konum.y - b.konum.y) + (a.onEngel === b.onEngel ? 0 : 1); }
}

export interface Beceri {
  id: string;
  xp: number;
  mastery: number;
  confidence: number;
  level: number;
  successRate: number;
  predictionError: number;
  contextCoverage: number;
  kullanim: number;
  reflex: ReflexDurumu;
  basari: number;
  hata: number;
  baglamlar: Set<string>;
}

export class BeceriMotoru {
  readonly beceri: Beceri;
  constructor(id = "engel-kacinma") {
    this.beceri = { id, xp: 0, mastery: 0, confidence: 0.25, level: 0, successRate: 0, predictionError: 1, contextCoverage: 0, kullanim: 0, reflex: "yok", basari: 0, hata: 0, baglamlar: new Set() };
  }
  deneyimUygula(d: Deneyim): Beceri {
    const b = this.beceri;
    b.kullanim++; b.baglamlar.add(d.gozlem.baglam);
    b.contextCoverage = clamp(b.baglamlar.size / 4);
    const etkiliXp = d.novelty * d.informationGain * (d.sonuc.basarili ? 1 : 0.6);
    b.xp += etkiliXp;
    if (d.sonuc.basarili) { b.basari++; b.confidence = clamp(b.confidence + 0.08 * (1 - b.confidence)); }
    else { b.hata++; b.confidence = clamp(b.confidence - 0.18); if (d.predictionError > 0.5) b.reflex = "askida"; }
    b.successRate = b.basari / Math.max(1, b.kullanim);
    b.predictionError = b.predictionError * 0.8 + d.predictionError * 0.2;
    b.mastery = clamp(0.45 * b.successRate + 0.3 * b.contextCoverage + 0.25 * (1 - b.predictionError));
    const aday = b.xp >= 1 && b.mastery >= 0.55 && b.confidence >= 0.5 && b.successRate >= 0.6 && b.contextCoverage >= 0.25;
    if (aday) b.level = Math.max(b.level, 3);
    if (b.xp >= 2 && b.mastery >= 0.72 && b.confidence >= 0.72 && b.successRate >= 0.8 && b.contextCoverage >= 0.5) b.level = Math.max(b.level, 5);
    if (b.level >= 5 && b.confidence >= 0.75 && b.successRate >= 0.85 && b.reflex !== "askida") b.reflex = "aktif";
    return this.snapshot();
  }
  snapshot(): Beceri { return { ...this.beceri, baglamlar: new Set(this.beceri.baglamlar) }; }
  reflexiDogrula(basarili: boolean): void { if (basarili && this.beceri.level >= 5) this.beceri.reflex = "aktif"; else if (!basarili) this.beceri.reflex = "askida"; }
  yenidenAktifEt(): void { if (this.beceri.confidence >= 0.7 && this.beceri.successRate >= 0.8) this.beceri.reflex = "aktif"; }
}

export interface HizliYol { beceriId: string; baglam: string; eylem: Eylem; guven: number; surum: number; }
export interface Karar { kaynak: "alice" | "bob"; eylem: Eylem; plan?: Eylem[]; ziyaretEdilenDugum?: number; }
export class AliceBob {
  private yollar = new Map<string, HizliYol>();
  private surum = 0;
  readonly planner: DeliberativePlanner;
  constructor(planner = new DeliberativePlanner()) { this.planner = planner; }
  derle(b: Beceri, eylem: Eylem, baglam: string): HizliYol | null {
    if (b.level < 5 || b.reflex !== "aktif") return null;
    const yol = { beceriId: b.id, baglam, eylem, guven: b.confidence, surum: ++this.surum };
    this.yollar.set(baglam, yol); return { ...yol };
  }
  sec(g: Gozlem, b: Beceri, dunya?: DunyaDurumu): Karar {
    const yol = this.yollar.get(g.baglam);
    if (yol && b.reflex === "aktif" && b.confidence >= 0.75 && b.predictionError < 0.4) return { kaynak: "alice", eylem: yol.eylem };
    if (dunya) {
      const plan = this.planner.planla(dunya, g);
      return { kaynak: "bob", eylem: plan.eylem, plan: plan.plan.map((adim) => adim.eylem), ziyaretEdilenDugum: plan.ziyaretEdilenDugum };
    }
    // Dünya durumu verilmemişse geriye dönük, ucuz güvenli policy.
    if (g.onEngel) return { kaynak: "bob", eylem: "sol" };
    if (g.konum.x === 0 && g.konum.y === 0 && g.yon === 0) return { kaynak: "bob", eylem: "ileri" };
    if (g.yon !== g.hedefYon) return { kaynak: "bob", eylem: "sag" };
    return { kaynak: "bob", eylem: "ileri" };
  }
  askıyaAl(b: Beceri): void { b.reflex = "askida"; }
  yolSayisi(): number { return this.yollar.size; }
}

export function deneyimOlustur(id: string, gozlem: Gozlem, eylem: Eylem, tahmin: Tahmin, sonuc: Sonuc, kaynak: "alice" | "bob", onceki?: Gozlem): Deneyim {
  const predictionError = Math.abs((sonuc.basarili ? 1 : 0) - (tahmin.basarili ? 1 : 0));
  const novelty = onceki ? clamp(KucukDunya.gozlemMesafesi(gozlem, onceki) / 4) : 1;
  const informationGain = clamp((predictionError + (gozlem.onEngel ? 0.5 : 0.2)) / 1.5);
  return { id, gozlem, eylem, tahmin, sonuc, predictionError, novelty, informationGain, enerjiMaliyeti: sonuc.enerjiMaliyeti, kaynak };
}

export function calistirOrnek(deneySayisi = 24): { beceri: Beceri; yollar: number; alice: number; bob: number; gecmis: Deneyim[] } {
  const dunya = new KucukDunya(); const motor = new BeceriMotoru(); const yonetici = new AliceBob(); const gecmis: Deneyim[] = [];
  let onceki: Gozlem | undefined; let alice = 0; let bob = 0;
  for (let i = 0; i < deneySayisi; i++) {
    const gozlem = dunya.gozlemle(); const secim = yonetici.sec(gozlem, motor.beceri); if (secim.kaynak === "alice") alice++; else bob++;
    const tahmin = { basarili: secim.eylem !== "ileri" || !gozlem.onEngel, enerji: secim.eylem === "bekle" ? 0.005 : 0.02 };
    const sonuc = dunya.adim(secim.eylem); const d = deneyimOlustur(`EXP-${String(i + 1).padStart(4, "0")}`, gozlem, secim.eylem, tahmin, sonuc, secim.kaynak, onceki); gecmis.push(d); motor.deneyimUygula(d); onceki = gozlem;
    if (sonuc.yeniDurum.tamamlandi) dunya.sifirla();
    if (motor.beceri.level >= 5 && motor.beceri.reflex === "aktif") yonetici.derle(motor.beceri, secim.eylem, gozlem.baglam);
  }
  return { beceri: motor.snapshot(), yollar: yonetici.yolSayisi(), alice, bob, gecmis };
}
