import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { CourseData, HoleData } from "@golfix/shared";
import type { LocalScore } from "@/stores/round-store";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useNavigate: () => mockNavigate };
});

let mockCourseData: CourseData | null = null;
vi.mock("@/stores/course-store", () => ({
  useCourseStore: vi.fn((selector: (s: { courseData: CourseData | null }) => unknown) =>
    selector({ courseData: mockCourseData }),
  ),
}));

const mockScores = new Map<number, LocalScore>();
const mockReset = vi.fn();
let mockRoundId: string | null = "r1";

vi.mock("@/stores/round-store", () => ({
  useRoundStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ scores: mockScores, roundId: mockRoundId, reset: mockReset }),
  ),
}));

const mockSessionReset = vi.fn();
vi.mock("@/stores/session-store", () => ({
  useSessionStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ reset: mockSessionReset }),
  ),
}));

const { RoundSummaryScreen } = await import("../RoundSummaryScreen");

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

function makeScore(strokes: number, putts: number): LocalScore {
  return { strokes, putts, fairwayHit: null, greenInRegulation: null, synced: false };
}

describe("RoundSummaryScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCourseData = null;
    mockScores.clear();
    mockRoundId = "r1";
  });

  afterEach(cleanup);

  it("redirects to / when no scores exist", () => {
    render(
      <MemoryRouter>
        <RoundSummaryScreen />
      </MemoryRouter>,
    );
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("shows total score and vs par", () => {
    mockCourseData = {
      id: "c1",
      name: "Test Golf",
      slug: "test",
      holesCount: 2,
      par: 7,
      paceTargetMinutes: 240,
      teeIntervalMinutes: 8,
      timezone: "Europe/Paris",
      dataVersion: 1,
      holes: [makeHole(1, 4), makeHole(2, 3)],
    };
    mockScores.set(1, makeScore(5, 2));
    mockScores.set(2, makeScore(3, 1));

    render(
      <MemoryRouter>
        <RoundSummaryScreen />
      </MemoryRouter>,
    );

    // Total strokes in the large display
    const bigScore = screen.getByText("8");
    expect(bigScore.className).toContain("text-5xl");
    // vs par appears in main display and per-hole rows
    expect(screen.getAllByText("+1").length).toBeGreaterThanOrEqual(1);
  });

  it("shows per-hole breakdown", () => {
    mockCourseData = {
      id: "c1",
      name: "Test Golf",
      slug: "test",
      holesCount: 2,
      par: 7,
      paceTargetMinutes: 240,
      teeIntervalMinutes: 8,
      timezone: "Europe/Paris",
      dataVersion: 1,
      holes: [makeHole(1, 4), makeHole(2, 3)],
    };
    mockScores.set(1, makeScore(5, 2));
    mockScores.set(2, makeScore(3, 1));

    render(
      <MemoryRouter>
        <RoundSummaryScreen />
      </MemoryRouter>,
    );

    // Hole breakdown table rendered
    expect(screen.getByText("Trou")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    // 1 header row + 2 data rows
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);
  });

  it("resets stores and navigates home on button click", () => {
    mockCourseData = {
      id: "c1",
      name: "Test Golf",
      slug: "test",
      holesCount: 1,
      par: 4,
      paceTargetMinutes: 240,
      teeIntervalMinutes: 8,
      timezone: "Europe/Paris",
      dataVersion: 1,
      holes: [makeHole(1, 4)],
    };
    mockScores.set(1, makeScore(4, 2));

    render(
      <MemoryRouter>
        <RoundSummaryScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Retour à l'accueil"));

    expect(mockReset).toHaveBeenCalled();
    expect(mockSessionReset).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
