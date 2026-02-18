import type { ScenarioDefinition } from "../types";
import { bottleneck } from "./bottleneck";
import { gapCompression } from "./gap-compression";
import { happyPath } from "./happy-path";
import { slowGroup } from "./slow-group";

export { generateRandomScenario } from "./random";

export const SCENARIOS: Record<string, ScenarioDefinition> = {
  "happy-path": happyPath,
  "slow-group": slowGroup,
  bottleneck,
  "gap-compression": gapCompression,
};

export function getScenario(name: string): ScenarioDefinition | undefined {
  return SCENARIOS[name];
}

export function listScenarios(): string[] {
  return Object.keys(SCENARIOS);
}
