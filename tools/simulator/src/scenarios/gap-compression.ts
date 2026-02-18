import type { ScenarioDefinition } from "../types";

/**
 * Group 3 at 0.8x catches Group 2 at 1.25x.
 * Triggers gap_compression alert at hole 5-6.
 */
export const gapCompression: ScenarioDefinition = {
  name: "gap-compression",
  description: "Groupe 3 (0.8x) rattrape Groupe 2 (1.25x) — alerte gap_compression au trou 5-6",
  groups: [
    { groupIndex: 0, paceFactor: 1.0, holeNoise: 10, stuckHoles: [] },
    {
      groupIndex: 1,
      paceFactor: 1.25,
      holeNoise: 20,
      stuckHoles: [{ hole: 4, extraMinutes: 3, reason: "Provisoire jouée" }],
    },
    { groupIndex: 2, paceFactor: 0.8, holeNoise: 8, stuckHoles: [] },
    { groupIndex: 3, paceFactor: 1.0, holeNoise: 15, stuckHoles: [] },
  ],
};
