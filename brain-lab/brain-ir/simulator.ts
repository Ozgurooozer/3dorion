// brain-ir/simulator.ts — Brain IR v0.2: state, inhibition, recurrence, trace, replay.
"use strict";
import {
  dugumMap, esik, inputDegeri, sinyal, traceDondur,
  type BrainAdimi, type BrainCalisma, type BrainDugumu, type BrainGrafi,
  type BrainInputlari, type BrainReplay, type BrainTrace,
} from "./ir.ts";

export class BrainSimulator {
  readonly graf: BrainGrafi;
  private readonly nodes: Map<string, BrainDugumu>;
  private readonly incoming = new Map<string, BrainGrafi["connections"]>();
  private states = new Map<string, number>();
  private initialState = new Map<string, number>();
  private causes = new Map<string, { events: Set<string>; nodes: Set<string> }>();
  private tick = 0;

  constructor(graf: BrainGrafi, initialState: Record<string, number> = {}) {
    this.graf = graf;
    this.nodes = dugumMap(graf);
    for (const node of graf.nodes) this.incoming.set(node.id, []);
    for (const edge of graf.connections) this.incoming.get(edge.to)!.push(edge);
    for (const node of graf.nodes) {
      const value = Number(initialState[node.id] ?? 0);
      const safe = Number.isFinite(value) ? value : 0;
      this.states.set(node.id, safe);
      this.initialState.set(node.id, safe);
      this.causes.set(node.id, { events: new Set(), nodes: new Set([node.id]) });
    }
  }

  reset(initialState: Record<string, number> = {}): void {
    this.tick = 0;
    for (const node of this.graf.nodes) {
      const value = Number(initialState[node.id] ?? 0);
      const safe = Number.isFinite(value) ? value : 0;
      this.states.set(node.id, safe);
      this.initialState.set(node.id, safe);
      this.causes.set(node.id, { events: new Set(), nodes: new Set([node.id]) });
    }
  }

  step(inputs: BrainInputlari = {}): BrainAdimi {
    const next = new Map<string, number>();
    const nextCauses = new Map<string, { events: Set<string>; nodes: Set<string> }>();
    const output: Record<string, number> = {};
    const inputSnapshot: Record<string, number> = {};
    const trace: BrainTrace[] = [];

    for (const node of this.graf.nodes) {
      const previousState = this.states.get(node.id) ?? 0;
      let excitation = 0;
      let inhibition = 0;
      const causeEvents = new Set<string>();
      const causeNodes = new Set<string>([node.id]);

      if (node.type === "input" || node.type === "sensor") {
        const input = inputDegeri(inputs[node.id]);
        next.set(node.id, input.deger);
        inputSnapshot[node.id] = input.deger;
        for (const event of input.olaylar ?? []) causeEvents.add(event);
        if (input.deger >= 0) excitation = input.deger;
        else inhibition = input.deger;
      } else {
        for (const edge of this.incoming.get(node.id) ?? []) {
          const source = this.nodes.get(edge.from)!;
          const sourceState = this.states.get(edge.from) ?? 0;
          const contribution = sinyal(source, sourceState) * edge.weight;
          if (contribution >= 0) excitation += contribution;
          else inhibition += contribution;
          causeNodes.add(edge.from);
          const sourceCause = this.causes.get(edge.from);
          for (const event of sourceCause?.events ?? []) causeEvents.add(event);
          for (const sourceNode of sourceCause?.nodes ?? []) causeNodes.add(sourceNode);
        }
        const rawState = (node.decay ?? 0) * previousState + excitation + inhibition;
        next.set(node.id, rawState);
      }

      const rawState = next.get(node.id) ?? 0;
      const activated = sinyal(node, rawState) !== 0;
      const nodeTrace = traceDondur({
        tick: this.tick + 1,
        node: node.id,
        previousState,
        excitation,
        inhibition,
        rawState,
        threshold: (node.type === "decision" || node.type === "action" || node.type === "motor") ? esik(node) : undefined,
        activated,
        causeEvents: [...causeEvents].sort(),
        causeNodes: [...causeNodes].sort(),
        action: node.type === "action" || node.type === "motor" ? node.id : undefined,
      });
      trace.push(nodeTrace);
      nextCauses.set(node.id, { events: new Set(nodeTrace.causeEvents), nodes: new Set(nodeTrace.causeNodes) });
    }

    this.states = next;
    this.causes = nextCauses;
    for (const node of this.graf.nodes) output[node.id] = sinyal(node, this.states.get(node.id) ?? 0);
    this.tick++;
    const states: Record<string, number> = {};
    for (const node of this.graf.nodes) states[node.id] = this.states.get(node.id) ?? 0;
    return Object.freeze({ tick: this.tick, inputs: { ...inputSnapshot }, states, outputs: output, trace: Object.freeze(trace) });
  }

  run(inputs: BrainInputlari = {}, steps = this.graf.nodes.length, replay?: Partial<BrainReplay>): BrainCalisma {
    const runInitialState: Record<string, number> = {};
    for (const [id, state] of this.states) runInitialState[id] = state;
    const history: BrainAdimi[] = [];
    for (let i = 0; i < steps; i++) history.push(this.step(inputs));
    if (history.length > 0) {
      // Sonuç TEK SEFERDE kurulur: `replay` sonradan atanıyordu ve bu, çıktı
      // tiplerinin `readonly` olmasını engelleyen tek yerdi (bkz. ir.ts).
      const temel = {
        steps: Object.freeze(history),
        final: history.at(-1)!,
        trace: Object.freeze(history.flatMap((x) => x.trace)),
      };
      const result: BrainCalisma = replay
        ? { ...temel, replay: this.replayKaydi(replay.seed ?? "", replay.inputs ?? Array.from({ length: steps }, () => inputs), runInitialState) }
        : temel;
      return Object.freeze(result);
    }
    const states: Record<string, number> = {};
    const outputs: Record<string, number> = {};
    for (const node of this.graf.nodes) {
      const state = this.states.get(node.id) ?? 0;
      states[node.id] = state;
      outputs[node.id] = sinyal(node, state);
    }
    const final: BrainAdimi = { tick: this.tick, inputs: {}, states, outputs, trace: [] };
    return { steps: [], final, trace: [], replay: replay ? this.replayKaydi(replay.seed ?? "", replay.inputs ?? [], runInitialState) : undefined };
  }

  replayKaydi(seed: string, inputs: BrainInputlari[], initialState?: Record<string, number>): BrainReplay {
    const nodeParameters: Record<string, BrainDugumu> = {};
    for (const node of this.graf.nodes) nodeParameters[node.id] = { ...node };
    const baslangic = initialState ?? Object.fromEntries(this.initialState);
    return { seed, initialState: { ...baslangic }, inputs: inputs.map((x) => ({ ...x })), graphVersion: this.graf.version ?? "0", nodeParameters };
  }

  static replay(graf: BrainGrafi, kayit: BrainReplay): BrainCalisma {
    const sim = new BrainSimulator(graf, kayit.initialState);
    const history: BrainAdimi[] = kayit.inputs.map((inputs) => sim.step(inputs));
    return { steps: history, final: history.at(-1) ?? sim.run({}, 0).final, trace: history.flatMap((x) => x.trace), replay: kayit };
  }
}
