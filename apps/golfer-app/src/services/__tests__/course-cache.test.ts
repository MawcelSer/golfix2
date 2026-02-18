import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CourseData } from "@golfix/shared";

const mockStore = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => Promise.resolve(mockStore.get(key) ?? undefined)),
  set: vi.fn((key: string, val: unknown) => {
    mockStore.set(key, val);
    return Promise.resolve();
  }),
  del: vi.fn((key: string) => {
    mockStore.delete(key);
    return Promise.resolve();
  }),
}));

const { getCachedCourse, setCachedCourse, clearCachedCourse, isCacheValid } =
  await import("../course-cache");

function makeCourse(overrides: Partial<CourseData> = {}): CourseData {
  return {
    id: "c1",
    name: "Test Course",
    slug: "test-course",
    holesCount: 18,
    par: 72,
    paceTargetMinutes: 240,
    teeIntervalMinutes: 8,
    timezone: "Europe/Paris",
    dataVersion: 1,
    holes: [],
    ...overrides,
  };
}

describe("course-cache", () => {
  beforeEach(() => {
    mockStore.clear();
    vi.restoreAllMocks();
  });

  it("returns null for missing cache", async () => {
    const result = await getCachedCourse("nonexistent");
    expect(result).toBeNull();
  });

  it("stores and retrieves course data", async () => {
    const course = makeCourse();
    await setCachedCourse(course);
    const cached = await getCachedCourse("test-course");
    expect(cached).toEqual(course);
  });

  it("clears cached course", async () => {
    await setCachedCourse(makeCourse());
    await clearCachedCourse("test-course");
    const cached = await getCachedCourse("test-course");
    expect(cached).toBeNull();
  });

  it("returns null when TTL expired", async () => {
    const course = makeCourse();
    await setCachedCourse(course);

    // Manually set cachedAt to 25 hours ago
    const entry = mockStore.get("course:test-course") as {
      cachedAt: number;
    };
    entry.cachedAt = Date.now() - 25 * 60 * 60 * 1000;

    const cached = await getCachedCourse("test-course");
    expect(cached).toBeNull();
  });

  it("validates cache version match", async () => {
    await setCachedCourse(makeCourse({ dataVersion: 3 }));
    expect(await isCacheValid("test-course", 3)).toBe(true);
    expect(await isCacheValid("test-course", 4)).toBe(false);
  });

  it("reports invalid for missing cache", async () => {
    expect(await isCacheValid("nonexistent", 1)).toBe(false);
  });
});
