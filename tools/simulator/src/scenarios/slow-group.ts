import type { ScenarioDefinition } from "../types";

/** Group 2 at 1.35x + stuck on holes 5,7. Triggers behind_pace alert at hole 6-7. */
export const slowGroup: ScenarioDefinition = {
  name: "slow-group",
  description: "Groupe 2 lent (1.35x) + bloqué aux trous 5 et 7 — alerte behind_pace au trou 6-7",
  groups: [
    { groupIndex: 0, paceFactor: 1.0, holeNoise: 10, stuckHoles: [] },
    {
      groupIndex: 1,
      paceFactor: 1.35,
      holeNoise: 20,
      stuckHoles: [
        { hole: 5, extraMinutes: 6, reason: "Balle perdue dans le rough" },
        { hole: 7, extraMinutes: 5, reason: "Deux balles d'eau consécutives" },
      ],
    },
    { groupIndex: 2, paceFactor: 1.0, holeNoise: 15, stuckHoles: [] },
    { groupIndex: 3, paceFactor: 0.95, holeNoise: 12, stuckHoles: [] },
  ],
};
