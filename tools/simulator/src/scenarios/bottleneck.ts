import type { ScenarioDefinition } from "../types";

/**
 * Group 1 blocks par-3 hole 2 for 8 extra min.
 * Triggers bottleneck alert (2+ groups >5min wait).
 */
export const bottleneck: ScenarioDefinition = {
  name: "bottleneck",
  description:
    "Groupe 1 bloque le trou 2 (par 3) pendant 8 min — alerte bottleneck",
  groups: [
    {
      groupIndex: 0,
      paceFactor: 1.1,
      holeNoise: 10,
      stuckHoles: [
        { hole: 2, extraMinutes: 8, reason: "Green occupé, groupe lent" },
        { hole: 7, extraMinutes: 4, reason: "Recherche de balle" },
      ],
    },
    { groupIndex: 1, paceFactor: 1.0, holeNoise: 15, stuckHoles: [] },
    { groupIndex: 2, paceFactor: 0.95, holeNoise: 12, stuckHoles: [] },
    { groupIndex: 3, paceFactor: 1.0, holeNoise: 10, stuckHoles: [] },
  ],
};
