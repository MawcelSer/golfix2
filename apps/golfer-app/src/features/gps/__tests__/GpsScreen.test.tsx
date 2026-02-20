import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { CourseData, HoleData } from "@golfix/shared";

// Mock geolocation hook
const mockGeo = {
  position: null as { lat: number; lng: number; accuracy: number } | null,
  error: null as string | null,
  watching: false,
  startWatching: vi.fn(),
  stopWatching: vi.fn(),
};
vi.mock("@/hooks/use-geolocation", () => ({
  useGeolocation: () => mockGeo,
}));

// Mock course data hook
const mockCourseData = {
  courseData: null as CourseData | null,
  loading: false,
  error: null as string | null,
  refetch: vi.fn(),
};
vi.mock("@/hooks/use-course-data", () => ({
  useCourseData: () => mockCourseData,
}));

// Mock hole detection hook
const mockSetManualHole = vi.fn();
const mockHoleDetection = {
  detectedHole: 1,
  nearGreen: false,
  setManualHole: mockSetManualHole,
};
vi.mock("@/hooks/use-hole-detection", () => ({
  useHoleDetection: () => mockHoleDetection,
}));

// Mock course store
vi.mock("@/stores/course-store", () => ({
  useCourseStore: vi.fn((selector: (s: { courseSlug: string | null }) => unknown) =>
    selector({ courseSlug: "test-course" }),
  ),
}));

// Mock session store
let mockSessionStatus = "idle";
let mockSessionError: string | null = null;
const mockStartSession = vi.fn();

vi.mock("@/stores/session-store", () => ({
  useSessionStore: vi.fn(
    (
      selector: (s: {
        status: string;
        error: string | null;
        startSession: typeof mockStartSession;
      }) => unknown,
    ) =>
      selector({
        status: mockSessionStatus,
        error: mockSessionError,
        startSession: mockStartSession,
      }),
  ),
}));

// Mock useSocket
vi.mock("@/hooks/use-socket", () => ({
  useSocket: () => ({ connected: false, error: null }),
}));

const { GpsScreen } = await import("../GpsScreen");

function makeHole(num: number, par: number): HoleData {
  return {
    id: `h${num}`,
    holeNumber: num,
    par,
    strokeIndex: num,
    distanceMeters: 350 + num * 10,
    teePosition: { x: -0.564, y: 44.885 },
    greenCenter: { x: -0.561, y: 44.887 },
    greenFront: { x: -0.5612, y: 44.8868 },
    greenBack: { x: -0.5608, y: 44.8872 },
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
    holes: Array.from({ length: 18 }, (_, i) => makeHole(i + 1, i % 2 === 0 ? 4 : 3)),
  };
}

function renderGps() {
  return render(
    <MemoryRouter initialEntries={["/gps?course=test-course"]}>
      <GpsScreen />
    </MemoryRouter>,
  );
}

describe("GpsScreen", () => {
  beforeEach(() => {
    mockGeo.position = null;
    mockGeo.error = null;
    mockGeo.startWatching.mockClear();
    mockSetManualHole.mockClear();
    mockStartSession.mockClear();
    mockHoleDetection.detectedHole = 1;
    mockHoleDetection.nearGreen = false;
    mockCourseData.courseData = null;
    mockCourseData.loading = false;
    mockCourseData.error = null;
    mockSessionStatus = "idle";
    mockSessionError = null;
  });

  afterEach(cleanup);

  it("shows loading state", () => {
    mockCourseData.loading = true;
    renderGps();
    expect(screen.getByText("Chargement du parcours…")).toBeInTheDocument();
  });

  it("shows session confirmation when course loaded and session is idle", () => {
    mockCourseData.courseData = makeCourse();
    renderGps();

    expect(screen.getByText("Test Course")).toBeInTheDocument();
    expect(screen.getByText("18 trous — Par 72")).toBeInTheDocument();
    expect(screen.getByText("Commencer la session")).toBeInTheDocument();
  });

  it("calls startSession on confirmation button click", async () => {
    const user = userEvent.setup();
    mockCourseData.courseData = makeCourse();
    renderGps();

    await user.click(screen.getByText("Commencer la session"));
    expect(mockStartSession).toHaveBeenCalledWith("c1");
  });

  it("shows session error when startSession fails", () => {
    mockCourseData.courseData = makeCourse();
    mockSessionError = "Network error";
    renderGps();

    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("disables button and shows loading text when session is starting", () => {
    mockCourseData.courseData = makeCourse();
    mockSessionStatus = "starting";
    renderGps();

    const button = screen.getByText("Démarrage…");
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("displays distances when session is active and GPS is available", () => {
    mockSessionStatus = "active";
    mockCourseData.courseData = makeCourse();
    mockGeo.position = { lat: 44.885, lng: -0.564, accuracy: 5 };

    renderGps();

    expect(screen.getByText("Avant")).toBeInTheDocument();
    expect(screen.getByText("Centre")).toBeInTheDocument();
    expect(screen.getByText("Arrière")).toBeInTheDocument();
  });

  it("starts GPS watching when session becomes active", () => {
    mockSessionStatus = "active";
    mockCourseData.courseData = makeCourse();

    renderGps();

    expect(mockGeo.startWatching).toHaveBeenCalled();
  });

  it("does not start GPS when session is idle", () => {
    mockCourseData.courseData = makeCourse();
    renderGps();

    expect(mockGeo.startWatching).not.toHaveBeenCalled();
  });

  it("calls setManualHole on navigation", async () => {
    const user = userEvent.setup();
    mockSessionStatus = "active";
    mockCourseData.courseData = makeCourse();
    mockGeo.position = { lat: 44.885, lng: -0.564, accuracy: 5 };

    renderGps();

    expect(screen.getByText("Trou 1/18")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Trou suivant"));
    expect(mockSetManualHole).toHaveBeenCalledWith(2);
  });

  it("shows error when course fails to load with retry button", async () => {
    const user = userEvent.setup();
    mockCourseData.error = "Impossible de charger le parcours";
    renderGps();
    expect(screen.getByText("Impossible de charger le parcours")).toBeInTheDocument();

    const retryBtn = screen.getByText("Réessayer");
    expect(retryBtn).toBeInTheDocument();
    await user.click(retryBtn);
    expect(mockCourseData.refetch).toHaveBeenCalled();
  });

  it("shows GPS error message", () => {
    mockSessionStatus = "active";
    mockCourseData.courseData = makeCourse();
    mockGeo.error = "permission_denied";

    renderGps();
    expect(screen.getByText("GPS refusé — activez la géolocalisation")).toBeInTheDocument();
  });

  it("shows spinner when session is finishing", () => {
    mockSessionStatus = "finishing";
    mockCourseData.courseData = makeCourse();
    renderGps();
    expect(screen.getByText("Fin de session…")).toBeInTheDocument();
  });

  it("shows summary link when session is ended", () => {
    mockSessionStatus = "ended";
    mockCourseData.courseData = makeCourse();
    renderGps();
    expect(screen.getByText("Session terminée")).toBeInTheDocument();
    expect(screen.getByText("Voir le résumé")).toBeInTheDocument();
  });

  it("displays GPS accuracy", () => {
    mockSessionStatus = "active";
    mockCourseData.courseData = makeCourse();
    mockGeo.position = { lat: 44.885, lng: -0.564, accuracy: 8 };

    renderGps();
    expect(screen.getByText("Précision GPS : ±8 m")).toBeInTheDocument();
  });
});
