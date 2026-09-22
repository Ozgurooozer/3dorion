"use strict";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "../../bridge/beyin.ts";
import { GraphSimulator, type BrainGraph } from "./simulator.ts";

export interface OrionBeyniAyari {
  graph: BrainGraph;
  inputlariCikar?: (girdi: BeyinGirdisi) => Record<string, number>;
  kararMetni?: (karar: "escape" | "ignore") => string;
}

export const ISIK_TEHDIT_GRAPH: BrainGraph = {
  version: 1,
  nodes: [
    { id: "light", kind: "input" },
    { id: "vision", kind: "neuron", decay: 0.5, threshold: 0 },
    { id: "threat", kind: "decision", threshold: 0.7 },
  ],
  connections: [
    { from: "light", to: "vision", weight: 0.8 },
    { from: "vision", to: "threat", weight: 1 },
  ],
  inputs: ["light"],
  outputs: ["threat"],
};

export class OrionGraphBeyni implements Beyin {
  readonly ad = "brain-graph";
  private readonly _simulator: GraphSimulator;
  private readonly _inputlariCikar: (girdi: BeyinGirdisi) => Record<string, number>;
  private readonly _kararMetni: (karar: "escape" | "ignore") => string;

  constructor(ayar: OrionBeyniAyari) {
    this._simulator = new GraphSimulator(ayar.graph);
    this._inputlariCikar = ayar.inputlariCikar ?? varsayilanInputlar;
    this._kararMetni = ayar.kararMetni ?? ((karar) => karar === "escape" ? "Tehdit algıladım." : "");
  }

  async hazirMi(): Promise<boolean> { return true; }

  async dusun(girdi: BeyinGirdisi): Promise<BeyinCikti> {
    const adim = this._simulator.adim(this._inputlariCikar(girdi));
    const karar = adim.outputs["threat"] ?? "ignore";
    const metin = this._kararMetni(karar);
    return {
      metin,
      cagrilar: metin ? [{ ad: "dunya_soyle", girdi: { metin } }] : [],
      bilgi: { model: this.ad, karar, states: adim.states },
    };
  }
}

function varsayilanInputlar(girdi: BeyinGirdisi): Record<string, number> {
  const metin = [...girdi.ozetler, girdi.dunya].join(" ").toLocaleLowerCase("tr-TR");
  return { light: /ışık|isik|light/.test(metin) ? 1 : 0 };
}