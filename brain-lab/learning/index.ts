// brain-lab/learning/index.ts — three-factor learning and the living agent.
"use strict";

export { DEFAULT_LEARNING, Learner, type LearningParams } from "./learner.ts";
export { createAgent, type Agent, type AgentSpec } from "./agent.ts";
export { Critic, DEFAULT_CRITIC, type CriticParams } from "./critic.ts";
export { CUE_PREFIX, CueMemory, DEFAULT_CUE, type CueParams } from "./cue-memory.ts";
export { Compartments, type CompartmentMode, type CompartmentSpec } from "./compartments.ts";
export { actionsOf, teacherDeltas, type TeacherSpec } from "./teacher.ts";
export { AXES, CompetitiveSelector, DEFAULT_SELECTION, type Choice, type SelectionParams } from "./selection.ts";
