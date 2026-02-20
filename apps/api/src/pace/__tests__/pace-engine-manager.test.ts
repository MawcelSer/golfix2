import { describe, it, expect, beforeEach } from "vitest";
import { PaceEngineManager } from "../pace-engine-manager";
import type { HoleData } from "../pace-types";

const holes: HoleData[] = [
  { holeNumber: 1, par: 4, paceTargetMinutes: 14, transitionMinutes: 1 },
  { holeNumber: 2, par: 3, paceTargetMinutes: 10, transitionMinutes: 1 },
  { holeNumber: 3, par: 5, paceTargetMinutes: 18, transitionMinutes: 1 },
];

describe("PaceEngineManager", () => {
  let manager: PaceEngineManager;

  beforeEach(() => {
    manager = new PaceEngineManager();
  });

  it("creates a new engine for a course", () => {
    const entry = manager.getOrCreate("course-1", holes);
    expect(entry.engine).toBeDefined();
    expect(entry.positions.size).toBe(0);
  });

  it("returns existing engine for same course", () => {
    const entry1 = manager.getOrCreate("course-1", holes);
    const entry2 = manager.getOrCreate("course-1", holes);
    expect(entry1.engine).toBe(entry2.engine);
  });

  it("creates separate engines for different courses", () => {
    const entry1 = manager.getOrCreate("course-1", holes);
    const entry2 = manager.getOrCreate("course-2", holes);
    expect(entry1.engine).not.toBe(entry2.engine);
  });

  it("feedPosition buffers position data", () => {
    manager.getOrCreate("course-1", holes);
    manager.feedPosition("course-1", "s1", 48.8, 2.3, 5, new Date());

    const entry = manager.getEngine("course-1");
    expect(entry?.positions.size).toBe(1);
    expect(entry?.holeDetections.get("s1")).toBe(5);
  });

  it("feedPosition is noop if engine does not exist", () => {
    manager.feedPosition("nonexistent", "s1", 48.8, 2.3, 1, new Date());
    expect(manager.getEngine("nonexistent")).toBeUndefined();
  });

  it("getActiveEngines returns all engines", () => {
    manager.getOrCreate("c1", holes);
    manager.getOrCreate("c2", holes);
    expect(manager.getActiveEngines().size).toBe(2);
  });

  it("remove deletes an engine", () => {
    manager.getOrCreate("c1", holes);
    manager.remove("c1");
    expect(manager.getEngine("c1")).toBeUndefined();
  });

  it("clear removes all engines", () => {
    manager.getOrCreate("c1", holes);
    manager.getOrCreate("c2", holes);
    manager.clear();
    expect(manager.getActiveEngines().size).toBe(0);
  });
});
