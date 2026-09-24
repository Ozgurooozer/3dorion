// brain-lab/learning/index.ts — three-factor learning and the living agent.
"use strict";

export { DEFAULT_LEARNING, Learner, type LearningParams } from "./learner.ts";
export { createAgent, type Agent, type AgentSpec } from "./agent.ts";
export { Critic, DEFAULT_CRITIC, type CriticParams } from "./critic.ts";
export { Compartments, type CompartmentMode, type CompartmentSpec } from "./compartments.ts";
export { actionsOf, teacherDeltas, type TeacherSpec } from "./teacher.ts";
