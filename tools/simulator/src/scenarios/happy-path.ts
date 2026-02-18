import type { ScenarioDefinition } from "../types";

/** Baseline — 4 groups, all on pace. No alerts should fire. */
export const happyPath: ScenarioDefinition = {
  name: "happy-path",
  description: "4 groupes à bon rythme — aucune alerte ne devrait se déclencher",
  groups: [
    { groupIndex: 0, paceFactor: 1.0, holeNoise: 10, stuckHoles: [] },
    { groupIndex: 1, paceFactor: 0.95, holeNoise: 15, stuckHoles: [] },
    { groupIndex: 2, paceFactor: 1.05, holeNoise: 12, stuckHoles: [] },
    { groupIndex: 3, paceFactor: 1.0, holeNoise: 18, stuckHoles: [] },
  ],
};
