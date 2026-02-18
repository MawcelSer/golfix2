import { createRng } from "../path-generator";
import type { GroupScenario, ScenarioDefinition, StuckHole } from "../types";

const STUCK_REASONS = [
  "Balle perdue",
  "Recherche de balle dans le rough",
  "Attente sur le green",
  "Provisoire jouée",
  "Balle d'eau",
  "Deux balles d'eau consécutives",
  "Bunker difficile",
  "Green occupé",
];

/**
 * Procedurally generate a random scenario.
 *
 * @param groupCount - Number of groups (2-12)
 * @param seed - RNG seed for reproducibility
 */
export function generateRandomScenario(
  groupCount: number,
  seed: number = Date.now(),
): ScenarioDefinition {
  const rng = createRng(seed);

  const groups: GroupScenario[] = Array.from({ length: groupCount }, (_, i) => {
    // Pace factor: 0.8 - 1.4
    const paceFactor = 0.8 + rng() * 0.6;

    // Noise: 5 - 30 seconds
    const holeNoise = 5 + rng() * 25;

    // 30% chance of having stuck holes
    const stuckHoles: StuckHole[] = [];
    if (rng() < 0.3) {
      const stuckCount = 1 + Math.floor(rng() * 2);
      const usedHoles = new Set<number>();

      for (let s = 0; s < stuckCount; s++) {
        let hole: number;
        do {
          hole = 1 + Math.floor(rng() * 18);
        } while (usedHoles.has(hole));
        usedHoles.add(hole);

        stuckHoles.push({
          hole,
          extraMinutes: 2 + Math.floor(rng() * 8),
          reason: STUCK_REASONS[Math.floor(rng() * STUCK_REASONS.length)]!,
        });
      }
    }

    // 10% chance of dropout after hole 6
    const dropOutAtHole = rng() < 0.1 ? 6 + Math.floor(rng() * 12) : undefined;

    return {
      groupIndex: i,
      paceFactor: Math.round(paceFactor * 100) / 100,
      holeNoise: Math.round(holeNoise),
      stuckHoles,
      dropOutAtHole,
    };
  });

  return {
    name: "random",
    description: `Scénario aléatoire — ${groupCount} groupes, seed ${seed}`,
    groups,
  };
}
