import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DashboardPage } from "../DashboardPage";
import { useDashboardStore } from "@/stores/dashboard-store";

// Mock api-client
vi.mock("@/services/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
  ApiError: class extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

// Mock dashboard socket hook
vi.mock("@/hooks/use-dashboard-socket", () => ({
  useDashboardSocket: vi.fn(),
}));

// Mock CourseMap to avoid mapbox-gl dependency
vi.mock("@/features/map/CourseMap", () => ({
  CourseMap: ({ groups, holes }: { groups: unknown[]; holes: unknown[] }) => (
    <div data-testid="course-map">
      Map: {groups.length} groups, {holes.length} holes
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  useDashboardStore.getState().reset();
  vi.restoreAllMocks();
});

function renderPage(courseId = "course-1") {
  return render(
    <MemoryRouter initialEntries={[`/course/${courseId}`]}>
      <Routes>
        <Route path="/course/:courseId" element={<DashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const mockCourse = {
  id: "course-1",
  name: "Golf de Test",
  slug: "golf-de-test",
  holesCount: 18,
  par: 72,
  holes: [
    {
      holeNumber: 1,
      par: 4,
      greenCenter: { x: 2.35, y: 48.85 },
      teePosition: { x: 2.34, y: 48.84 },
    },
    { holeNumber: 2, par: 3, greenCenter: { x: 2.36, y: 48.86 }, teePosition: null },
  ],
};

describe("DashboardPage", () => {
  beforeEach(async () => {
    const { apiClient } = await import("@/services/api-client");
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockCourse);
  });

  it("shows loading state initially", () => {
    renderPage();
    expect(screen.getByText("Chargement du parcours...")).toBeInTheDocument();
  });

  it("renders course name and panels after loading", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Golf de Test")).toBeInTheDocument();
    });

    // Map rendered
    expect(screen.getByTestId("course-map")).toBeInTheDocument();
    // Group list panel header
    expect(screen.getByText("Groupes en jeu")).toBeInTheDocument();
    // Alert feed panel header
    expect(screen.getByText("Alertes")).toBeInTheDocument();
  });

  it("shows connection status", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Golf de Test")).toBeInTheDocument();
    });

    expect(screen.getByText("Deconnecte")).toBeInTheDocument();
  });

  it("shows error state when course not found", async () => {
    const { apiClient } = await import("@/services/api-client");
    const { ApiError } = await import("@/services/api-client");
    (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError("Not found", 404));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Parcours introuvable")).toBeInTheDocument();
    });
  });
});
