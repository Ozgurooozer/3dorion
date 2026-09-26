// brain-ir/ir.ts — Orion'dan bağımsız Brain IR v0.2 veri sözleşmesi.
"use strict";

export type DugumTuru = "input" | "sensor" | "neuron" | "memory" | "inhibitor" | "decision" | "action" | "motor" | "ai";
export type Aktivasyon = "relu" | "linear";

export interface BrainDugumu {
  id: string;
  type: DugumTuru;
  /** Önceki state'in bu tikte taşınan oranı. */
  decay?: number;
  /** decision/action/motor için aktivasyon eşiği. */
  threshold?: number;
  /** Döngü ve negatif state deneyleri için varsayılan relu yerine linear. */
  activation?: Aktivasyon;
  /** Only on a grown memory neuron (type "memory", brain-lab TASARIM-008 §5): what it remembers. */
  memory?: MemoryRecord;
}

/**
 * What a memory neuron remembers (brain-lab TASARIM-008 §5). Never changed in place: every change is a new record,
 * written to the subject's ledger. Ticks count within the room the memory was born in.
 */
export interface MemoryRecord {
  /** What is remembered. */
  readonly what: "food";
  /** Where, in the body's own start frame (metres). */
  readonly x: number;
  readonly y: number;
  /** Strength 0–1 as of tick `updated`; from then on it fades with time. */
  readonly strength: number;
  readonly updated: number;
  /** How many sightings the place averages (each counts once, up to a cap). */
  readonly sightings: number;
  /** Tick of birth, and of the last confirmation (seen again after a gap): kept apart from the strength. */
  readonly born: number;
  readonly confirmed: number;
}

export interface BrainBaglantisi {
  from: string;
  to: string;
  weight: number;
}

export interface BrainGrafi {
  name?: string;
  version?: string;
  nodes: BrainDugumu[];
  connections: BrainBaglantisi[];
}

export interface BrainInput {
  deger: number;
  /** Bu input'u üreten olay numaraları. */
  olaylar?: string[];
}

export type BrainInputDegeri = number | BrainInput;
export type BrainInputlari = Record<string, BrainInputDegeri>;

// ── ÇIKTI TİPLERİ: DEĞİŞMEZ ───────────────────────────────────────────────
//
// Aşağıdaki üç tip simülatörün ÜRETTİĞİ sonuçtur ve `readonly`dir. Kod bunu
// zaten `Object.freeze` ile çalışma anında kuruyordu ama tipler
// değiştirilebilir ilan edilmişti; `Object.freeze` `Readonly<T>` döndürdüğü
// için atama tutmuyordu (`tsc` 4 hata). Tasarım iddiası belgelerde açık:
// "immutable BrainTrace" — yani doğru olan kod, yanlış olan tipti. Freeze'leri
// kaldırmak da hatayı susturur ama deterministik replay'in dayandığı
// değişmezliği bozar.
//
// GİRDİ tipleri (`BrainGrafi`, `BrainDugumu`, `BrainBaglantisi`) bilerek
// değiştirilebilir kaldı: onları çağıran kurar.

export interface BrainAdimi {
  readonly tick: number;
  readonly inputs: Readonly<Record<string, number>>;
  readonly states: Readonly<Record<string, number>>;
  readonly outputs: Readonly<Record<string, number>>;
  readonly trace: readonly BrainTrace[];
}

export interface BrainTrace {
  readonly tick: number;
  readonly node: string;
  readonly previousState: number;
  readonly excitation: number;
  readonly inhibition: number;
  readonly rawState: number;
  readonly threshold?: number;
  readonly activated: boolean;
  readonly causeEvents: readonly string[];
  readonly causeNodes: readonly string[];
  readonly action?: string;
}

export interface BrainReplay {
  seed: string;
  initialState: Record<string, number>;
  inputs: BrainInputlari[];
  graphVersion: string;
  nodeParameters: Record<string, BrainDugumu>;
}

export interface BrainCalisma {
  readonly steps: readonly BrainAdimi[];
  readonly final: BrainAdimi;
  readonly trace: readonly BrainTrace[];
  readonly replay?: BrainReplay;
}

export interface OrionAksiyon {
  readonly node: string;
  readonly arac: string;
  readonly girdi: Readonly<Record<string, unknown>>;
}

export interface OrionBrainSonucu extends BrainCalisma {
  readonly aksiyonlar: readonly OrionAksiyon[];
}

const DUGUM_TURLERI = new Set<DugumTuru>([
  "input", "sensor", "neuron", "memory", "inhibitor", "decision", "action", "motor", "ai",
]);

export function grafiDogrula(graf: BrainGrafi): void {
  const ids = new Set<string>();
  for (const node of graf.nodes) {
    if (!node.id || ids.has(node.id)) throw new Error(`geçersiz/tekrar düğüm: ${node.id}`);
    ids.add(node.id);
    if (!DUGUM_TURLERI.has(node.type)) throw new Error(`geçersiz düğüm türü: ${String(node.type)}`);
    if (node.activation && node.activation !== "relu" && node.activation !== "linear") {
      throw new Error(`geçersiz aktivasyon: ${node.id}`);
    }
    if (node.decay !== undefined && (node.decay < 0 || node.decay > 1)) {
      throw new Error(`decay 0..1 aralığında olmalı: ${node.id}`);
    }
    if (node.threshold !== undefined && !Number.isFinite(node.threshold)) {
      throw new Error(`geçersiz eşik: ${node.id}`);
    }
  }
  for (const edge of graf.connections) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      throw new Error(`kopuk bağlantı: ${edge.from} -> ${edge.to}`);
    }
    if (!Number.isFinite(edge.weight)) throw new Error(`geçersiz ağırlık: ${edge.from} -> ${edge.to}`);
  }
}

export function dugumMap(graf: BrainGrafi): Map<string, BrainDugumu> {
  grafiDogrula(graf);
  return new Map(graf.nodes.map((node) => [node.id, node]));
}

export function gelenler(graf: BrainGrafi, hedef: string): BrainBaglantisi[] {
  return graf.connections.filter((edge) => edge.to === hedef);
}

export function esik(node: BrainDugumu): number {
  return node.threshold ?? 0.5;
}

export function sinyal(node: BrainDugumu, state: number): number {
  if (node.type === "decision" || node.type === "action" || node.type === "motor") {
    return state >= esik(node) ? 1 : 0;
  }
  if (node.type === "inhibitor") return -Math.max(0, state);
  if (node.activation === "linear") return state;
  return Math.max(0, state);
}

export function inputDegeri(value: BrainInputDegeri | undefined): BrainInput {
  if (typeof value === "number") return { deger: Number.isFinite(value) ? value : 0 };
  const deger = Number(value?.deger ?? 0);
  return {
    deger: Number.isFinite(deger) ? deger : 0,
    olaylar: [...new Set(value?.olaylar ?? [])],
  };
}

export function traceDondur(trace: BrainTrace): BrainTrace {
  return Object.freeze({
    ...trace,
    causeEvents: Object.freeze([...trace.causeEvents]),
    causeNodes: Object.freeze([...trace.causeNodes]),
  });
}
