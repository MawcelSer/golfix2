import { describe, expect, it } from "vitest";

import { scenarioDefinitionSchema } from "../types";
import { getScenario, listScenarios } from "../scenarios/index";
import { generateRandomScenario } from "../scenarios/random";

describe("pre-built scenarios", () => {
  it("has 4 pre-built scenarios", () => {
    expect(listScenarios()).toEqual([
      "happy-path",
      "slow-group",
      "bottleneck",
      "gap-compression",
    ]);
  });

  it.each(["happy-path", "slow-group", "bottleneck", "gap-compression"])(
    "%s passes Zod validation",
    (name) => {
      const scenario = getScenario(name);
      expect(scenario).toBeDefined();

      const result = scenarioDefinitionSchema.safeParse(scenario);
      expect(result.success).toBe(true);
    },
  );

  it("happy-path has 4 groups near pace 1.0", () => {
    const s = getScenario("happy-path")!;
    expect(s.groups.length).toBe(4);
    for (const g of s.groups) {
      expect(g.paceFactor).toBeGreaterThanOrEqual(0.9);
      expect(g.paceFactor).toBeLessThanOrEqual(1.1);
      expect(g.stuckHoles).toHaveLength(0);
    }
  });

  it("slow-group has group with paceFactor > 1.3", () => {
    const s = getScenario("slow-group")!;
    const slow = s.groups.find((g) => g.paceFactor > 1.3);
    expect(slow).toBeDefined();
    expect(slow!.stuckHoles.length).toBeGreaterThan(0);
  });

  it("bottleneck has stuck holes with extra time", () => {
    const s = getScenario("bottleneck")!;
    const stuck = s.groups.flatMap((g) => g.stuckHoles);
    expect(stuck.length).toBeGreaterThan(0);
    expect(stuck.some((h) => h.extraMinutes >= 8)).toBe(true);
  });

  it("gap-compression has groups with divergent pace factors", () => {
    const s = getScenario("gap-compression")!;
    const paces = s.groups.map((g) => g.paceFactor);
    const maxDiff = Math.max(...paces) - Math.min(...paces);
    expect(maxDiff).toBeGreaterThan(0.3);
  });
});

describe("random scenario", () => {
  it("generates valid scenario with specified group count", () => {
    const s = generateRandomScenario(6, 42);
    expect(s.groups.length).toBe(6);

    const result = scenarioDefinitionSchema.safeParse(s);
    expect(result.success).toBe(true);
  });

  it("is deterministic with same seed", () => {
    const s1 = generateRandomScenario(4, 42);
    const s2 = generateRandomScenario(4, 42);

    expect(s1.groups.map((g) => g.paceFactor)).toEqual(
      s2.groups.map((g) => g.paceFactor),
    );
  });

  it("varies with different seeds", () => {
    const s1 = generateRandomScenario(4, 1);
    const s2 = generateRandomScenario(4, 2);

    const paces1 = s1.groups.map((g) => g.paceFactor);
    const paces2 = s2.groups.map((g) => g.paceFactor);
    expect(paces1).not.toEqual(paces2);
  });

  it("has pace factors in valid range", () => {
    const s = generateRandomScenario(8, 42);
    for (const g of s.groups) {
      expect(g.paceFactor).toBeGreaterThanOrEqual(0.8);
      expect(g.paceFactor).toBeLessThanOrEqual(1.4);
    }
  });
});
