import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { CourseData } from "@golfix/shared";

// Mock idb-keyval before importing anything that uses it
const mockCache = new Map<string, CourseData>();
vi.mock("@/services/course-cache", () => ({
  getCachedCourse: vi.fn((slug: string) => Promise.resolve(mockCache.get(slug) ?? null)),
  setCachedCourse: vi.fn((course: CourseData) => {
    mockCache.set(course.slug, course);
    return Promise.resolve();
  }),
  clearCachedCourse: vi.fn(),
}));

const mockApiGet = vi.fn();
vi.mock("@/services/api-client", () => ({
  apiClient: { get: (...args: unknown[]) => mockApiGet(...args) },
  ApiError: class extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

vi.mock("@/stores/course-store", () => ({
  useCourseStore: {
    getState: () => ({ setCourse: vi.fn(), clearCourse: vi.fn() }),
  },
}));

const { useCourseData } = await import("../use-course-data");

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

describe("useCourseData", () => {
  beforeEach(() => {
    mockCache.clear();
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("returns cached data when available", async () => {
    const course = makeCourse();
    mockCache.set("test-course", course);
    mockApiGet.mockResolvedValue(course);

    const { result } = renderHook(() => useCourseData("test-course"));

    await waitFor(() => {
      expect(result.current.courseData).toEqual(course);
    });
    expect(result.current.loading).toBe(false);
  });

  it("fetches from API when no cache", async () => {
    const course = makeCourse();
    mockApiGet.mockResolvedValue(course);

    const { result } = renderHook(() => useCourseData("test-course"));

    await waitFor(() => {
      expect(result.current.courseData).toEqual(course);
    });
    expect(mockApiGet).toHaveBeenCalledWith("/courses/test-course/data");
  });

  it("updates cache when API returns new version", async () => {
    const cached = makeCourse({ dataVersion: 1 });
    const fresh = makeCourse({ dataVersion: 2 });
    mockCache.set("test-course", cached);
    mockApiGet.mockResolvedValue(fresh);

    const { result } = renderHook(() => useCourseData("test-course"));

    await waitFor(() => {
      expect(result.current.courseData?.dataVersion).toBe(2);
    });
  });

  it("shows error on network failure with no cache", async () => {
    mockApiGet.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useCourseData("test-course"));

    await waitFor(() => {
      expect(result.current.error).toBe("Impossible de charger le parcours");
    });
  });

  it("returns null for null slug", async () => {
    const { result } = renderHook(() => useCourseData(null));

    expect(result.current.courseData).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
