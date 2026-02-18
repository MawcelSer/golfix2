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

// Mock course store
vi.mock("@/stores/course-store", () => ({
  useCourseStore: vi.fn((selector: (s: { courseSlug: string | null }) => unknown) =>
    selector({ courseSlug: "test-course" }),
  ),
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
    mockGeo.watching = false;
    mockGeo.startWatching.mockClear();
    mockCourseData.courseData = null;
    mockCourseData.loading = false;
    mockCourseData.error = null;
  });

  afterEach(cleanup);

  it("shows loading state", () => {
    mockCourseData.loading = true;
    renderGps();
    expect(screen.getByText("Chargement du parcours…")).toBeInTheDocument();
  });

  it("displays distances when GPS and course are available", () => {
    mockCourseData.courseData = makeCourse();
    mockGeo.position = { lat: 44.885, lng: -0.564, accuracy: 5 };

    renderGps();

    expect(screen.getByText("Avant")).toBeInTheDocument();
    expect(screen.getByText("Centre")).toBeInTheDocument();
    expect(screen.getByText("Arrière")).toBeInTheDocument();
    // Should show distance values (not dashes)
    expect(screen.queryByText("—")).toBeNull();
  });

  it("navigates between holes", async () => {
    const user = userEvent.setup();
    mockCourseData.courseData = makeCourse();
    mockGeo.position = { lat: 44.885, lng: -0.564, accuracy: 5 };

    renderGps();

    expect(screen.getByText("Trou 1/18")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Trou suivant"));
    expect(screen.getByText("Trou 2/18")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Trou précédent"));
    expect(screen.getByText("Trou 1/18")).toBeInTheDocument();
  });

  it("shows error when course fails to load", () => {
    mockCourseData.error = "Impossible de charger le parcours";
    renderGps();
    expect(screen.getByText("Impossible de charger le parcours")).toBeInTheDocument();
  });

  it("shows GPS error message", () => {
    mockCourseData.courseData = makeCourse();
    mockGeo.error = "permission_denied";

    renderGps();
    expect(screen.getByText("GPS refusé — activez la géolocalisation")).toBeInTheDocument();
  });

  it("displays GPS accuracy", () => {
    mockCourseData.courseData = makeCourse();
    mockGeo.position = { lat: 44.885, lng: -0.564, accuracy: 8 };

    renderGps();
    expect(screen.getByText("Précision GPS : ±8 m")).toBeInTheDocument();
  });
});
