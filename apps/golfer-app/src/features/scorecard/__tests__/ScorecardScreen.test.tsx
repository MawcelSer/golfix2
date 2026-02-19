import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { CourseData, HoleData } from "@golfix/shared";

// ── Mock course store ─────────────────────────────────────────────────
let mockCourseData: CourseData | null = null;
vi.mock("@/stores/course-store", () => ({
  useCourseStore: vi.fn((selector: (s: { courseData: CourseData | null }) => unknown) =>
    selector({ courseData: mockCourseData }),
  ),
}));

// ── Mock round store ──────────────────────────────────────────────────
const mockScores = new Map<number, Record<string, unknown>>();
const mockStartRound = vi.fn();
const mockSetCurrentHole = vi.fn();
const mockSaveScore = vi.fn().mockResolvedValue(undefined);
const mockReset = vi.fn();
let mockCurrentHole = 1;
let mockError: string | null = null;
let mockSaving = false;

vi.mock("@/stores/round-store", () => ({
  useRoundStore: vi.fn((selectorOrUndefined?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      currentHole: mockCurrentHole,
      scores: mockScores,
      error: mockError,
      saving: mockSaving,
      startRound: mockStartRound,
      setCurrentHole: mockSetCurrentHole,
      saveScore: mockSaveScore,
      reset: mockReset,
    };
    if (typeof selectorOrUndefined === "function") {
      return selectorOrUndefined(state);
    }
    return state;
  }),
}));

const { ScorecardScreen } = await import("../ScorecardScreen");

function makeHole(num: number, par: number): HoleData {
  return {
    id: `h${num}`,
    holeNumber: num,
    par,
    strokeIndex: num,
    distanceMeters: 350,
    teePosition: null,
    greenCenter: null,
    greenFront: null,
    greenBack: null,
    paceTargetMinutes: null,
    transitionMinutes: 3,
    hazards: [],
  };
}

function makeCourse(): CourseData {
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
    holes: Array.from({ length: 18 }, (_, i) => makeHole(i + 1, i < 4 ? 3 : 4)),
  };
}

describe("ScorecardScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCourseData = null;
    mockScores.clear();
    mockCurrentHole = 1;
    mockError = null;
    mockSaving = false;
  });

  afterEach(cleanup);

  it("shows no course message when course is not loaded", () => {
    render(<ScorecardScreen />);

    expect(screen.getByText("Aucun parcours sélectionné")).toBeInTheDocument();
  });

  it("calls startRound on mount when course is available", () => {
    mockCourseData = makeCourse();
    mockScores.set(1, {
      strokes: 3,
      putts: 0,
      fairwayHit: null,
      greenInRegulation: null,
      synced: false,
    });

    render(<ScorecardScreen />);

    expect(mockStartRound).toHaveBeenCalledWith("c1", expect.arrayContaining([3, 3, 3, 3]));
  });

  it("renders hole selector with current hole", () => {
    mockCourseData = makeCourse();
    mockCurrentHole = 5;
    mockScores.set(5, {
      strokes: 4,
      putts: 0,
      fairwayHit: null,
      greenInRegulation: null,
      synced: false,
    });

    render(<ScorecardScreen />);

    expect(screen.getByText("Trou 5/18")).toBeInTheDocument();
  });

  it("calls saveScore and setCurrentHole on next", async () => {
    mockCourseData = makeCourse();
    mockCurrentHole = 1;
    mockScores.set(1, {
      strokes: 3,
      putts: 0,
      fairwayHit: null,
      greenInRegulation: null,
      synced: false,
    });

    render(<ScorecardScreen />);

    fireEvent.click(screen.getByLabelText("Trou suivant"));

    await waitFor(() => {
      expect(mockSaveScore).toHaveBeenCalledWith(1);
      expect(mockSetCurrentHole).toHaveBeenCalledWith(2);
    });
  });

  it("calls saveScore and setCurrentHole on prev", async () => {
    mockCourseData = makeCourse();
    mockCurrentHole = 3;
    mockScores.set(3, {
      strokes: 4,
      putts: 0,
      fairwayHit: null,
      greenInRegulation: null,
      synced: false,
    });

    render(<ScorecardScreen />);

    fireEvent.click(screen.getByLabelText("Trou précédent"));

    await waitFor(() => {
      expect(mockSaveScore).toHaveBeenCalledWith(3);
      expect(mockSetCurrentHole).toHaveBeenCalledWith(2);
    });
  });

  it("displays error banner when error is set", () => {
    mockCourseData = makeCourse();
    mockError = "Sauvegarde échouée";
    mockScores.set(1, {
      strokes: 3,
      putts: 0,
      fairwayHit: null,
      greenInRegulation: null,
      synced: false,
    });

    render(<ScorecardScreen />);

    expect(screen.getByText("Sauvegarde échouée")).toBeInTheDocument();
  });

  it("displays saving indicator when saving", () => {
    mockCourseData = makeCourse();
    mockSaving = true;
    mockScores.set(1, {
      strokes: 3,
      putts: 0,
      fairwayHit: null,
      greenInRegulation: null,
      synced: false,
    });

    render(<ScorecardScreen />);

    expect(screen.getByText("Sauvegarde…")).toBeInTheDocument();
  });

  it("calls reset on unmount", () => {
    mockCourseData = makeCourse();
    mockScores.set(1, {
      strokes: 3,
      putts: 0,
      fairwayHit: null,
      greenInRegulation: null,
      synced: false,
    });

    const { unmount } = render(<ScorecardScreen />);
    unmount();

    expect(mockReset).toHaveBeenCalled();
  });
});
