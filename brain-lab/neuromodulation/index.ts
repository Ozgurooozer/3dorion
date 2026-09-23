// brain-lab/neuromodulation/index.ts — public entry point for modulator channels.
"use strict";

export { outcomeOf } from "./outcome.ts";
export { RunningMeanPredictor, type Predictor } from "./predictor.ts";
export { DopamineChannel, withDopamine, type DopamineSignal, type Neuromodulator } from "./dopamine.ts";
